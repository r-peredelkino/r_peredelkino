"""Fit cafe terraces to the existing shopfront, using the 9 October references.

This is a reference reconstruction, not a measured site plan. Building contours,
gardens, trees, benches, roads and the plaza programme retain their source data.
The generator can also call refine_frontage() after its ordinary layout pass.
"""
import json
import math
from pathlib import Path

from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def read_js(name):
    return json.loads((ROOT / name).read_text().split('=', 1)[1].strip().rstrip(';'))


def polygon(c):
    return Polygon(c['outer'], c.get('holes', []))


def placed(shape, c):
    return translate(rotate(shape, -math.degrees(c['angle']), origin=(0, 0)), c['x'], c['z'])


def cafe_envelope(c, index):
    parts = [box(-3.65, -1.85, 3.65, 1.85)]
    if index % 2 == 0:
        # Boat planter and pebble seat built by addPromenadeFurniture().
        parts += [box(2.9, -.91, 6.55, .82), box(-5.0, -.4, -3.1, .72)]
    return placed(unary_union(parts), c)


def refine_frontage(data, footprints):
    podium = polygon(footprints['podium'])
    boundary = podium.exterior
    buildings = unary_union([polygon(footprints[k]) for k in ['podium', 'arena', 'kindergarten']])
    gardens = unary_union([polygon(c) for c in data['islands']])
    benches = unary_union([polygon(c['seat']) for c in data['benches']])
    site = polygon(data['boundary'])
    pavilion_areas = [placed(box(-c['width']/2-1, -c['depth']/2-1,
                                 c['width']/2+1, c['depth']/2+1), c)
                      for c in data['pavilions']]
    # Existing revolving office entrance and its approach, unchanged in v26.
    entrance_clear = Point(34.393828921, -83.64188656).buffer(7.2)
    lamp_clearances = [Point(c['x'], c['z']).buffer(.35) for c in data['lamps']]
    exclusions = unary_union([gardens.buffer(.2), benches.buffer(.4),
                              *pavilion_areas, *lamp_clearances, entrance_clear])
    origins = data.get('frontageRevision', {}).get('sourceCafes', data['cafes'])
    cafes, occupied, diagnostics = [], [], []
    for index, source in enumerate(origins):
        if index >= 8:
            # The ninth old anchor belongs to the reserved sales-office grounds;
            # its existing runtime exclusion is deliberately retained.
            cafes.append(dict(source))
            continue
        projection = boundary.project(Point(source['x'], source['z']))
        candidate = None
        # Small along-front adjustments keep the exact existing garden contours.
        for shift in [0, .5, -.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10]:
            at = projection + shift
            point = boundary.interpolate(at)
            a, b = boundary.interpolate(at-.25), boundary.interpolate(at+.25)
            dx, dz = b.x-a.x, b.y-a.y
            length = math.hypot(dx, dz)
            nx, nz = dz/length, -dx/length
            if podium.contains(Point(point.x+nx, point.y+nz)):
                nx, nz = -nx, -nz
            c = {'x': point.x+nx*3.85, 'z': point.y+nz*3.85,
                 'angle': -math.atan2(dz, dx)}
            envelope = cafe_envelope(c, index)
            if envelope.distance(buildings) < 1.65:
                continue
            if not site.buffer(-.3).covers(envelope) or envelope.intersects(exclusions):
                continue
            if any(envelope.distance(previous) < 1.1 for previous in occupied):
                continue
            c.update(id=f'frontage-cafe-{index+1}', frontagePoint=[point.x, point.y],
                     setback=3.85, minimumBuildingGap=round(envelope.distance(buildings), 3))
            # A long, softly rounded dark terrace follows the local shop tangent.
            apron = placed(box(-3.05, -1.16, 3.05, 1.16).buffer(.65, quad_segs=12), c)
            c['apron'] = {'outer': list(apron.exterior.coords), 'holes': []}
            candidate = c
            occupied.append(envelope)
            diagnostics.append({'id': c['id'], 'beforeDistance': round(Point(source['x'], source['z']).distance(podium), 3),
                                'afterDistance': round(Point(c['x'], c['z']).distance(podium), 3),
                                'alongAdjustment': shift, 'minimumBuildingGap': c['minimumBuildingGap']})
            break
        if candidate is None:
            raise ValueError(f'No clear terrace position for cafe {index+1}')
        cafes.append(candidate)
    data['cafes'] = cafes

    # Rebuild only the existing three-colour inlays. This closes the old gaps in
    # the middle of the plaza and routes the same lines around relocated tables.
    court = read_js('dist/courtyard-layout.js')
    courtyard_garden = unary_union([polygon(c) for c in court['islands']])
    reserved = unary_union([*occupied, *pavilion_areas, Point(*data['fountain']).buffer(3.3)])
    light_free = site.buffer(-.4).difference(buildings.buffer(.45)).difference(
        unary_union([gardens, courtyard_garden]).buffer(.16)).difference(reserved.buffer(.2)).difference(benches.buffer(.25))
    routes = json.loads((ROOT/'tools/courtyard-routes.json').read_text())
    def model(e, n):
        return [-.69716*e+.71691*n, .71691*e+.69716*n]
    lines = [*map(LineString, routes),
             LineString([model(e, -76+math.sin(e/6)*1.7) for e in range(-108, 90)]),
             LineString([model(88+math.sin(n/11)*2, n) for n in range(-60, 60)]),
             LineString(data['forestRoute'])]
    light_lines = []
    for route, line in enumerate(lines):
        for channel, color in enumerate(['pink', 'warm', 'cyan']):
            samples = []
            for i in range(int(line.length/.55)+1):
                at = min(line.length-.001, i*.55)
                a, b = line.interpolate(at), line.interpolate(min(line.length, at+.08))
                dx, dz = b.x-a.x, b.y-a.y
                length = math.hypot(dx, dz)
                if length < 1e-9:
                    continue
                offset = (channel-1)*.6+.42*math.sin(at/4.8+channel*1.3)
                samples.append([a.x-dz/length*offset, a.y+dx/length*offset])
            cut = LineString(samples).intersection(light_free)
            for segment in getattr(cut, 'geoms', [cut]):
                if isinstance(segment, LineString) and segment.length > 3:
                    light_lines.append({'color': color, 'points': list(segment.coords), 'route': route})
    data['lightLines'] = light_lines
    data['frontageRevision'] = {'version': 26, 'reference': ['2026-10-09 12.03.41', '2026-10-09 12.03.43', '2026-10-09 12.03.45'],
                                'sourceCafes': origins, 'cafes': diagnostics,
                                'scope': 'Cafe alignment and inlay clearances; unchanged source buildings and planting.'}
    return data


if __name__ == '__main__':
    result = refine_frontage(read_js('dist/public-realm-layout.js'), read_js('dist/complex-footprints.js'))
    (ROOT/'dist/public-realm-layout.js').write_text('// @r_peredelkino · reference promenade; cafe frontage refinement v26.\nexport const publicRealmLayout='+json.dumps(result, separators=(',', ':'))+';\n')
    print(json.dumps({'cafes': result['frontageRevision']['cafes'], 'lightLines': len(result['lightLines'])}, ensure_ascii=False, indent=2))
