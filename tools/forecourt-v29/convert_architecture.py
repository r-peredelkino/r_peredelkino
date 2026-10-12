"""Convert the traced forecourt architecture into the renderer's world schema.

``project_points(points, height=0, source='perspective')`` is supplied by the
caller so that architecture receives the same road/facade registration as the
landscape. Its result is already in model XZ units. Only physical dimensions
ending in ``Meters`` are multiplied by ``scale`` and lose that suffix.

Projection elevations are physical metres above the reference ground plane;
they are never scaled before ray projection. The original pixel trace remains
in forecourt-architecture-pixels.json. The office gallery is fitted separately
by the root generator and is intentionally not inferred from two image bands.
"""

from copy import deepcopy
import math


def convert_architecture(raw, project_points, scale):
    """Return a new layout accepted by ``addForecourtArchitecture``.

    The supplied callable is not imported or replaced here. World coordinates
    are not scaled a second time. Diagnostic pixel fields are omitted from the
    render layout; source IDs, explicit uncertainties and source URL survive.
    """
    if not isinstance(raw, dict) or not callable(project_points):
        raise TypeError('Architecture needs a trace dict and project_points callable')
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0:
        raise ValueError('Architecture scale must be finite and positive')

    def number(value, label):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f'Architecture {label} must be finite')
        return float(value)

    def height(record, inherited=0):
        return number(record.get('sourceHeightMeters', inherited), 'sourceHeightMeters')

    def project(points, plane_height):
        if not points:
            return []
        result = project_points(points, plane_height, 'perspective')
        if len(result) != len(points):
            raise ValueError('Architecture projection changed the number of points')
        return [[round(number(p[0], 'world X'), 5), round(number(p[1], 'world Z'), 5)] for p in result]

    def record_fields(record):
        result = {}
        for key, value in record.items():
            if key == 'sourceHeightMeters' or key.endswith('SourceHeightMeters'):
                continue
            if key.endswith('Meters') and isinstance(value, (int, float)):
                result[key[:-6]] = round(number(value, key) * scale, 5)
            elif key in ('id', 'tone', 'baseStyle', 'backrest', 'referenceStatus',
                         'note', 'outlineMode', 'opaque', 'lookAtTableId'):
                result[key] = deepcopy(value)
        return result

    def polygon(record, inherited=0):
        result = record_fields(record)
        if len(record.get('outer', [])) < 3:
            raise ValueError(f"Architecture {record.get('id', 'polygon')} lacks a traced outline")
        result['outer'] = project(record['outer'], height(record, inherited))
        return result

    def anchor(record, inherited=0, ground_base=True):
        result = record_fields(record)
        point = record.get('pixel')
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError(f"Architecture {record.get('id', 'anchor')} lacks a pixel anchor")
        result['x'], result['z'] = project([point], height(record, inherited))[0]
        if ground_base:
            result.setdefault('baseY', 0)
        return result

    def horizontal_angle(points, plane_height):
        if len(points) != 2:
            raise ValueError('Architecture orientation needs two horizontal-axis pixels')
        a, b = project(points, plane_height)
        dx, dz = b[0] - a[0], b[1] - a[1]
        if math.hypot(dx, dz) < 1e-6:
            raise ValueError('Architecture orientation axis is degenerate')
        # Three.js rotation.y sends local +X to (cos(angle), -sin(angle)).
        return round(-math.atan2(dz, dx), 8)

    def centroid(points):
        twice_area = cx = cz = 0.0
        for a, b in zip(points, points[1:] + points[:1]):
            cross = a[0] * b[1] - b[0] * a[1]
            twice_area += cross
            cx += (a[0] + b[0]) * cross
            cz += (a[1] + b[1]) * cross
        if abs(twice_area) < 1e-8:
            return [sum(p[i] for p in points) / len(points) for i in (0, 1)]
        return [cx / (3 * twice_area), cz / (3 * twice_area)]

    result = {
        'schemaVersion': raw.get('schemaVersion', 1),
        'coordinateSystem': 'worldXZ; physical dimensions converted to model units',
        'source': deepcopy(raw.get('source', {})),
        'canopies': [], 'shellSeats': [], 'yellowBollards': [], 'lamps': [], 'socialSeating': [],
    }

    if raw.get('pavilion'):
        result['pavilion'] = polygon(raw['pavilion'])
        result['pavilion'].setdefault('baseY', 0)

    for canopy in raw.get('canopies', []):
        out = polygon(canopy)
        out['supports'] = [anchor(s, height(canopy)) for s in canopy.get('supports', [])]
        out['rings'] = []
        for ring in canopy.get('rings', []):
            item = anchor(ring, height(canopy), ground_base=False)
            item['angle'] = horizontal_angle(ring['horizontalDiameterPixels'], height(ring))
            out['rings'].append(item)
        result['canopies'].append(out)

    if raw.get('bar'):
        bar = raw['bar']
        out = polygon(bar)
        out.setdefault('baseY', 0)
        out['legs'] = [anchor(leg, height(bar)) for leg in bar.get('legs', [])]
        out['insets'] = [polygon(inset, height(bar)) for inset in bar.get('insets', [])]
        out['stools'] = []
        table_center = centroid(out['outer'])
        for stool in bar.get('stools', []):
            item = anchor(stool)
            dx, dz = table_center[0] - item['x'], table_center[1] - item['z']
            if math.hypot(dx, dz) < 1e-6:
                raise ValueError(f"Architecture {item.get('id')} cannot face a coincident table centre")
            # The constructed backrest is local +Z, so the seat faces local -Z.
            item['angle'] = round(math.atan2(-dx, -dz), 8)
            out['stools'].append(item)
        result['bar'] = out

    # Two small yellow furnishing pockets are distinct from the long communal
    # workstation. Only observed objects are enumerated; an occluded table is
    # not manufactured merely to give a chair an orientation target.
    for group in raw.get('socialSeating', []):
        out = record_fields(group)
        out['tables'] = [anchor(t) for t in group.get('tables', [])]
        table_by_id = {t['id']: t for t in out['tables']}
        out['chairs'] = []
        for chair in group.get('chairs', []):
            item = anchor(chair)
            target = table_by_id.get(chair.get('lookAtTableId'))
            if target is not None:
                target_point = [target['x'], target['z']]
            elif chair.get('facingPixel'):
                target_point = project([chair['facingPixel']], number(chair.get('facingSourceHeightMeters', 0), 'chair facing height'))[0]
            else:
                raise ValueError(f"Architecture {item.get('id')} lacks its observed facing target")
            dx, dz = target_point[0] - item['x'], target_point[1] - item['z']
            if math.hypot(dx, dz) < 1e-6:
                raise ValueError(f"Architecture {item.get('id')} has a degenerate facing direction")
            item['angle'] = round(math.atan2(-dx, -dz), 8)
            out['chairs'].append(item)
        result['socialSeating'].append(out)

    for shell in raw.get('shellSeats', []):
        item = anchor(shell)
        axis_height = shell.get('rimSourceHeightMeters', height(shell))
        item['angle'] = horizontal_angle(shell['axisPixels'], number(axis_height, 'shell rim height'))
        result['shellSeats'].append(item)

    result['yellowBollards'] = [anchor(b) for b in raw.get('yellowBollards', [])]

    for lamp in raw.get('lamps', []):
        item = anchor(lamp)
        # The trace's primary pixel is the vertical pole's raised head, not its
        # partly occluded ground foot. Head and tip lie on the same height plane.
        head, tip = project([lamp['headPixel'], lamp['headTipPixel']], height(lamp))
        item['x'], item['z'] = head
        item['arm'] = [round(tip[0] - head[0], 5), round(tip[1] - head[1], 5)]
        if math.hypot(*item['arm']) < .06:
            raise ValueError(f"Architecture {item.get('id')} has an implausibly short projected lamp arm")
        result['lamps'].append(item)

    result['counts'] = {
        'pavilions': int(bool(result.get('pavilion'))),
        'canopies': len(result['canopies']),
        'darkCanopies': sum(c.get('tone') == 'dark' for c in result['canopies']),
        'rings': sum(len(c['rings']) for c in result['canopies']),
        'chairs': len(result.get('bar', {}).get('stools', [])),
        'tableInsets': len(result.get('bar', {}).get('insets', [])),
        'shellSeats': len(result['shellSeats']),
        'yellowBollards': len(result['yellowBollards']),
        'lamps': len(result['lamps']),
        'socialGroups': len(result['socialSeating']),
        'socialTables': sum(len(g['tables']) for g in result['socialSeating']),
        'socialChairs': sum(len(g['chairs']) for g in result['socialSeating']),
    }
    return result
