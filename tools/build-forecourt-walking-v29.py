"""Build the v29 resident route from actual paving, ground solids and furniture.

Run from the project root after tools/build-forecourt-v29.py:
  python3 tools/build-forecourt-walking-v29.py

Install shared Python dependencies with:
  python3 -m pip install -r tools/requirements-forecourt-v29.txt
Node.js must be available as `node` (or use --node /path/to/node).
Optional --plots requires matplotlib and writes diagrams under generated/.

The companion Node exporter constructs the real model and records its colliders.
This script never changes the reference geometry or the main data generator.
The exported path is a polyline: runtime interpolation cannot cut its corners.
"""
from pathlib import Path
import argparse
import hashlib
import heapq
import json
import math
import subprocess

import numpy as np
from shapely import contains_xy, make_valid
from shapely.geometry import Point, LineString, Polygon, GeometryCollection
from shapely.ops import unary_union
from shapely.prepared import prep

PROJECT = Path(__file__).resolve().parents[1]
INPUTS = PROJECT / 'tools' / 'forecourt-v29'
GENERATED = INPUTS / 'generated'
DIST = PROJECT / 'dist'
STEP = .40
PLANNING_CLEARANCE = .56
VERIFIED_RADIUS = .48


def load_js(path):
    text = Path(path).read_text()
    return json.loads(text[text.index('={') + 1:text.rfind(';')])


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def polygon(record):
    return make_valid(Polygon(record['outer'], record.get('holes', [])))


def parts(geometry, kind=Polygon):
    if geometry.is_empty:
        return []
    if isinstance(geometry, kind):
        return [geometry]
    return [p for g in getattr(geometry, 'geoms', []) for p in parts(g, kind)]


def round_points(points):
    return [[round(float(x), 5), round(float(z), 5)] for x, z in points]


def collider_geometry(o):
    if o.get('type') == 'circle':
        return Point(o['x'], o['z']).buffer(o['radius'], quad_segs=16)
    if o.get('type') == 'segment':
        return LineString([o['a'], o['b']]).buffer(max(.001, o.get('radius', 0)), quad_segs=12)
    c, s = math.cos(o.get('angle', 0)), math.sin(o.get('angle', 0))
    return Polygon([[o['x'] + c*u + s*v, o['z'] - s*u + c*v]
                    for u, v in [(-o['width']/2, -o['depth']/2), (o['width']/2, -o['depth']/2),
                                 (o['width']/2, o['depth']/2), (-o['width']/2, o['depth']/2)]])


def derive_service_road(runtime):
    """Reuse the exact 200-sample sales-office.js ribbon and its tangent offsets."""
    road_walk = runtime['boundaries'][-1]
    outer = road_walk['outer']
    if len(outer) != 402:
        raise ValueError('Expected the existing 200-segment sales drive walkway ribbon')
    half = len(outer) // 2
    centers = [[(outer[i][j] + outer[-1-i][j])/2 for j in (0, 1)] for i in range(half)]
    drive = runtime['salesOfficeLayout']['drive']
    if math.dist(centers[0], drive[0]) > 1e-5 or math.dist(centers[-1], drive[-1]) > 1e-5:
        raise ValueError('Last boundary is not the rendered sales drive walkway')
    ratio = runtime['salesOfficeLayout']['driveWidth'] / 10.7
    left = [[centers[i][j] + (outer[i][j]-centers[i][j])*ratio for j in (0, 1)] for i in range(half)]
    right = [[centers[i][j] + (outer[-1-i][j]-centers[i][j])*ratio for j in (0, 1)] for i in range(half)]
    return polygon(road_walk), make_valid(Polygon(left + right[::-1]))


def build_geometry(reference, runtime, footprints, road_data):
    realm = runtime['publicRealmData']
    paving_records = realm.get('promenadeParts', [realm['promenade']])
    paving_records += reference.get('gradedPavingParts', [])
    paving_records += reference.get('cafes', {}).get('apronParts', [])
    paving = unary_union([polygon(p) for p in paving_records])
    service_walk, service_road = derive_service_road(runtime)
    paving = unary_union([paving, service_walk])
    boundaries = unary_union([polygon(p) for p in runtime['boundaries']])
    paving = paving.intersection(boundaries)

    records = []
    paving_reach = paving.buffer(3)
    def add(geometry, kind, source_id):
        if not geometry.is_empty and geometry.intersects(paving_reach):
            records.append({'geometry': geometry, 'kind': kind, 'id': str(source_id)})

    for i, shape in enumerate(runtime['solids']):
        add(polygon(shape), shape.get('type', 'existing-solid'), shape.get('sourceId', shape.get('id', f'solid-{i}')))
    for i, obstacle in enumerate(runtime['obstacles']):
        add(collider_geometry(obstacle), 'furniture-or-tree', obstacle.get('sourceId', obstacle.get('id', f'collider-{i}')))
    # The runtime snapshot includes the actual tower outlines and all courtyard
    # posts/portals through createTourWorld. Reconstructing those outlines again
    # from plan data would miss small protrusions used by first-person physics.
    roads = []
    for road in road_data:
        axis = LineString([[p[0], p[2]] for p in road['pointsWorld']])
        area = axis.buffer(road['width']/2, cap_style=2, join_style=2)
        roads.append(area)
        add(area, 'road', road['id'])
    for item in reference.get('roadside', {}).get('areas', []) + reference.get('roadside', {}).get('openings', []):
        points = item.get('outer', item.get('points', []))
        if len(points) >= 3:
            area = make_valid(Polygon(points)); roads.append(area)
            add(area, 'road-or-parking', item['id'])
    roads.append(service_road); add(service_road, 'service-road', 'existing-sales-drive')
    rear = runtime['salesOfficeLayout']['rearParking']
    parking = collider_geometry({'x':rear['x'], 'z':rear['z'], 'width':rear['width'], 'depth':rear['depth'], 'angle':0})
    roads.append(parking); add(parking, 'road-or-parking', 'existing-rear-parking')
    blocked = unary_union([r['geometry'] for r in records])
    free = paving.buffer(-PLANNING_CLEARANCE).difference(blocked.buffer(PLANNING_CLEARANCE))
    return {'paving':paving, 'blocked':blocked, 'free':make_valid(free), 'roads':unary_union(roads), 'records':records}


class Navigator:
    def __init__(self, component):
        self.component = component
        self.prepared = prep(component.buffer(1e-8))
        lo_x, lo_z, hi_x, hi_z = component.bounds
        self.origin = (math.floor(lo_x/STEP)*STEP, math.floor(lo_z/STEP)*STEP)
        self.width = math.ceil((hi_x-self.origin[0])/STEP)+1
        self.height = math.ceil((hi_z-self.origin[1])/STEP)+1
        xx, zz = np.meshgrid(self.origin[0]+np.arange(self.width)*STEP, self.origin[1]+np.arange(self.height)*STEP)
        self.mask = contains_xy(component, xx, zz)
        self.valid_ids = np.flatnonzero(self.mask.ravel())
        self.valid_points = np.column_stack((xx.ravel()[self.valid_ids], zz.ravel()[self.valid_ids]))
        self.edge_cache = {}
        self.expansions = 0

    def point(self, node):
        row, col = divmod(node, self.width)
        return [self.origin[0]+col*STEP, self.origin[1]+row*STEP]

    def visible(self, a, b):
        return self.prepared.covers(LineString([a, b]))

    def nearest_node(self, target, require_visible=False, max_distance=12):
        distances = np.sum((self.valid_points-np.asarray(target))**2, axis=1)
        candidate_count = min(80, len(distances))
        candidates = np.argpartition(distances, candidate_count-1)[:candidate_count]
        for index in sorted(candidates, key=lambda i:distances[i]):
            if distances[index] > max_distance*max_distance:
                break
            node = int(self.valid_ids[index])
            if not require_visible or self.visible(target, self.point(node)):
                return node
        raise ValueError(f'No reachable walkable grid point near {target}')

    def goal(self, target, max_distance=12):
        return self.point(self.nearest_node(target, max_distance=max_distance))

    def path(self, start, end):
        if math.dist(start, end) < 1e-7:
            return [start]
        if self.visible(start, end):
            return [start, end]
        a, b = self.nearest_node(start, True), self.nearest_node(end, True)
        end_point = self.point(b)
        queue = [(math.dist(self.point(a), end_point), 0., a)]
        distance = {a:0.}; previous = {}; closed = set()
        offsets = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]
        while queue:
            _, cost, node = heapq.heappop(queue)
            if node in closed:
                continue
            if node == b:
                chain = [node]
                while chain[-1] != a:
                    chain.append(previous[chain[-1]])
                chain = [start] + [self.point(n) for n in chain[::-1]] + [end]
                out = [chain[0]]; index = 0
                while index < len(chain)-1:
                    following = len(chain)-1
                    while following > index+1 and not self.visible(chain[index], chain[following]):
                        following -= 1
                    if math.dist(out[-1], chain[following]) > 1e-7:
                        out.append(chain[following])
                    index = following
                return out
            closed.add(node); self.expansions += 1
            row, col = divmod(node, self.width)
            for dc, dr in offsets:
                nr, nc = row+dr, col+dc
                if nr < 0 or nc < 0 or nr >= self.height or nc >= self.width or not self.mask[nr,nc]:
                    continue
                if dc and dr and (not self.mask[row,nc] or not self.mask[nr,col]):
                    continue
                nxt = nr*self.width+nc
                if nxt in closed:
                    continue
                step = STEP*math.hypot(dc,dr); new_cost = cost+step
                if new_cost >= distance.get(nxt, math.inf):
                    continue
                edge = (min(node,nxt),max(node,nxt))
                if edge not in self.edge_cache:
                    self.edge_cache[edge] = self.visible(self.point(node),self.point(nxt))
                if not self.edge_cache[edge]:
                    continue
                distance[nxt] = new_cost; previous[nxt] = node
                heapq.heappush(queue,(new_cost+math.dist(self.point(nxt),end_point),new_cost,nxt))
        raise ValueError(f'No safe route from {start} to {end}')


def build_route(reference, footprints, geometry):
    pavilion = polygon(reference['architecture']['pavilion'])
    center = [pavilion.centroid.x, pavilion.centroid.y]
    outer = reference['architecture']['pavilion']['outer']
    front_corner = outer[len(outer)*3//4]
    direction = np.asarray(front_corner)-np.asarray(center)
    preferred = np.asarray(front_corner)+direction/np.linalg.norm(direction)*2.8
    all_parts = parts(geometry['free'])
    component = min(all_parts,key=lambda p:p.distance(Point(preferred)))
    navigation = Navigator(component)
    destination = navigation.goal(preferred,max_distance=8)
    white = next(c for c in reference['architecture']['canopies'] if c['tone']=='white')
    white_center = polygon(white).centroid
    start = navigation.goal([white_center.x,white_center.y],max_distance=10)
    points = navigation.path(start,destination)

    old_points = footprints['walkRoutes'][2]['points']
    old_line = LineString(old_points)
    region = unary_union([polygon(p) for p in reference['region']]).buffer(1.2)
    preserved_candidates = parts(old_line.difference(region).intersection(component),LineString)
    preserved_candidates = [p for p in preserved_candidates if p.length>=2]
    preserved_candidates.sort(key=lambda p:old_line.project(Point(p.coords[0])))
    preserved = []; skipped = []; continuation_started = False
    for part in preserved_candidates:
        part_points = list(part.coords)
        if old_line.project(Point(part_points[0])) > old_line.project(Point(part_points[-1])):
            part_points.reverse()
        try:
            connection = navigation.path(points[-1],part_points[0])
        except ValueError:
            if not continuation_started:
                raise
            skipped.append({'oldDistanceStart':old_line.project(Point(part_points[0])),
                            'reason':'No safe continuation across the intervening road or blocked corridor'})
            break
        length = LineString(connection).length if len(connection)>1 else 0
        direct = math.dist(points[-1],part_points[0])
        if continuation_started and length>max(25,direct*2.6):
            skipped.append({'oldDistanceStart':old_line.project(Point(part_points[0])),
                            'reason':'Continuation would require a long detour around a road or blocked corridor',
                            'detourLength':length,'directDistance':direct})
            break
        points.extend(connection[1:]); points.extend(part_points[1:])
        preserved.append({'points':round_points(part_points),'length':part.length,
                          'oldDistanceStart':old_line.project(Point(part_points[0]))})
        continuation_started = True
    if not preserved:
        raise ValueError('No suitable part of the old promenade route can be preserved safely')
    points = round_points(points)
    line = LineString(points)
    preserved_vertices = [i for i,p in enumerate(old_points) if any(math.dist(p,q)<1e-4 for q in points)]
    return {'points':points,'destination':{'name':'Площадь','point':round_points([destination])[0],'look':round_points([center])[0]},
            'line':line,'component':component,'preserved':preserved,'preservedVertices':preserved_vertices,
            'skipped':skipped,'gridExpansions':navigation.expansions,'gridStep':STEP}


def verify(route, geometry):
    line = route['line']; footprint = line.buffer(VERIFIED_RADIUS,quad_segs=16)
    outside = footprint.difference(geometry['paving']).area
    road_overlap = footprint.intersection(geometry['roads']).area
    overlap = footprint.intersection(geometry['blocked']).area
    clearance = line.distance(geometry['blocked'])
    boundary_clearance = line.distance(geometry['paving'].boundary)
    collisions = []
    for record in geometry['records']:
        area = footprint.intersection(record['geometry']).area
        if area > 1e-8:
            collisions.append({'id':record['id'],'kind':record['kind'],'overlapArea':area})
    destination = Point(route['destination']['point']).buffer(VERIFIED_RADIUS)
    destination_ok = geometry['paving'].covers(destination) and not destination.intersects(geometry['blocked'])
    result = {'verifiedRadius':VERIFIED_RADIUS,'planningClearance':PLANNING_CLEARANCE,
              'outsidePavingArea':outside,'roadOverlapArea':road_overlap,'obstacleOverlapArea':overlap,
              'minimumObstacleClearance':clearance,'minimumPavingBoundaryClearance':boundary_clearance,
              'destinationFree':destination_ok,'collisions':collisions,'obstacleRecords':len(geometry['records'])}
    result['passed'] = bool(outside<1e-7 and road_overlap<1e-7 and overlap<1e-7 and destination_ok and not collisions)
    return result


def draw_plot(reference, footprints, geometry, route, path, zoom=False):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Patch
    fig,ax = plt.subplots(figsize=(12,11),dpi=160)
    def fill(geometry,color,alpha=1,zorder=1):
        for p in parts(geometry):
            ax.add_patch(Patch(list(p.exterior.coords),facecolor=color,edgecolor='none',alpha=alpha,zorder=zorder))
            for hole in p.interiors:
                ax.add_patch(Patch(list(hole.coords),facecolor='#f5f5f0',edgecolor='none',zorder=zorder))
    fill(geometry['paving'],'#dadbd8');fill(geometry['roads'],'#d99a8c',.8)
    fill(geometry['blocked'].difference(geometry['roads']),'#638260',.78,2)
    fill(polygon(reference['architecture']['pavilion']),'#e8e8e5',1,3)
    old=np.array(footprints['walkRoutes'][2]['points']);ax.plot(old[:,0],old[:,1],'--',color='#b64d47',linewidth=1.3,label='Previous third route',zorder=4)
    points=np.array(route['points']);ax.plot(points[:,0],points[:,1],color='#1669cf',linewidth=2.2,label='Verified polyline',zorder=5)
    for p in route['preserved']:
        a=np.array(p['points']);ax.plot(a[:,0],a[:,1],color='#13a297',linewidth=3,label='_preserved',zorder=6)
    x,z=route['destination']['point'];ax.plot(x,z,'D',color='#b02fb4',markersize=7,label='Plaza destination',zorder=7)
    ax.annotate('Pavilion viewpoint',(x,z),xytext=(6,8),textcoords='offset points',fontsize=9)
    if zoom:
        b=unary_union([polygon(p) for p in reference['region']]).bounds
        ax.set_xlim(b[0]-3,b[2]+3);ax.set_ylim(b[1]-3,b[3]+3)
    else:
        b=route['line'].bounds;ax.set_xlim(b[0]-15,b[2]+15);ax.set_ylim(b[1]-15,b[3]+15)
    ax.set_aspect('equal');ax.grid(alpha=.15);ax.set_xlabel('World X');ax.set_ylabel('World Z')
    ax.set_title('V29 pedestrian route — real paving and obstacle buffer checked')
    ax.legend(loc='best',fontsize=8);fig.tight_layout();path.parent.mkdir(parents=True,exist_ok=True);fig.savefig(path);plt.close(fig)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node',default='node',help='Node.js executable used to construct the real model')
    parser.add_argument('--plots',action='store_true',help='Write optional plan PNGs; requires matplotlib')
    parser.add_argument('--output',type=Path,default=DIST/'forecourt-walking-layout.js',
                        help='Destination JS module; defaults to dist/forecourt-walking-layout.js')
    args=parser.parse_args()
    source_path=INPUTS/'projected-forecourt.json'
    road_path=INPUTS/'road-data.json'
    for path in (source_path,road_path,DIST/'complex-footprints.js'):
        if not path.is_file():
            parser.error(f'Missing input: {path}. Run tools/build-forecourt-v29.py first.')
    if args.plots:
        try:
            import matplotlib
        except ImportError:
            parser.error('--plots requires matplotlib: python3 -m pip install matplotlib')
    GENERATED.mkdir(parents=True,exist_ok=True)
    # Always export from current model code. A snapshot identified only by the
    # projection SHA cannot detect edits to colliders or scene constructors.
    try:
        completed=subprocess.run([args.node,str(INPUTS/'export-walking-model-obstacles.mjs')],
                                 cwd=PROJECT,capture_output=True,text=True,timeout=60)
    except FileNotFoundError:
        parser.error('Node.js was not found; install Node.js or pass --node /path/to/node')
    if completed.returncode:
        raise RuntimeError(completed.stderr or completed.stdout)
    source_hash=digest(source_path)
    reference=json.loads(source_path.read_text())
    runtime=json.loads((GENERATED/'walking-model-obstacles.json').read_text())
    if runtime['sourceInputSHA256']!=source_hash:
        raise ValueError('Reference data changed during model export; rerun after the data build finishes')
    if runtime.get('collisionSource')!='createTourWorld':
        raise ValueError('Walking requires a complete createTourWorld obstacle snapshot')
    footprints=load_js(DIST/'complex-footprints.js')
    geometry=build_geometry(reference,runtime,footprints,json.loads(road_path.read_text()))
    route=build_route(reference,footprints,geometry);checks=verify(route,geometry)
    report={'version':29,'sourceInputSHA256':source_hash,'routeLength':route['line'].length,'routePointCount':len(route['points']),
            'originalRoutesRetained':[0,1],'preservedOriginalThirdVertices':route['preservedVertices'],
            'preservedThirdRouteLength':sum(p['length'] for p in route['preserved']),
            'preservedThirdRouteParts':route['preserved'],'uncontinuedParts':route['skipped'],
            'destination':route['destination'],'gridStep':route['gridStep'],'gridExpansions':route['gridExpansions'],'checks':checks}
    report_path=GENERATED/'walking-path-check.json'
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    if args.plots:
        draw_plot(reference,footprints,geometry,route,GENERATED/'walking-route-plan.png')
        draw_plot(reference,footprints,geometry,route,GENERATED/'walking-forecourt-plan.png',True)
    if not checks['passed']:
        raise ValueError(f'Pedestrian route failed real-geometry validation; see {report_path}')
    if digest(source_path)!=source_hash:
        raise ValueError('Reference data changed during route generation; rerun after the data build finishes')
    layout={'version':29,'sourceInputSHA256':source_hash,'route':{'id':'forecourt-promenade-walk','closed':False,'points':route['points'],
            'interpolation':'polyline','drawSurface':False,'sampleGround':True},'plazaDestination':route['destination'],
            'validation':{k:v for k,v in checks.items() if k not in ['collisions']},
            'preservedOriginalThirdVertices':route['preservedVertices'],'preservedThirdRouteLength':round(report['preservedThirdRouteLength'],4)}
    text='// @r_peredelkino · generated, obstacle-checked forecourt walking layout · v29.\n'
    text+='// Rebuild: python3 tools/build-forecourt-walking-v29.py\n'
    text+='export const forecourtWalkingLayout='+json.dumps(layout,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n'
    text+='export const forecourtWalkRoute=forecourtWalkingLayout.route;\nexport const forecourtPlazaDestination=forecourtWalkingLayout.plazaDestination;\n'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(text)
    print(json.dumps({**{k:v for k,v in report.items() if k not in ['preservedThirdRouteParts']},
                      'output':str(args.output),'outputSHA256':digest(args.output),'report':str(report_path)},
                     ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
