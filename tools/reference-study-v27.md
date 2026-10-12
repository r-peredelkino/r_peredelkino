# Neighbouring homes — reference study, v27

The user requested neighbouring homes' 3D forms and colours to match the
supplied views. No new attachment accompanied the latest message. This
revision uses the existing 8–9 October screenshots and original project maps.

## Evidence and anchor mapping

The EN anchors below are the existing approximate scene coordinates, not
geographic survey coordinates or building addresses.

| Scene anchor EN | Existing envelope W/D/H | Reference interpretation | Evidence | Mapping confidence |
| --- | --- | --- | --- | --- |
| -183, 29 | 40 / 65 / 50 (height estimate revised from 42) | N/S shallow-stepped lilac-and-burgundy panel building; white frames and ends | 2026-10-09 12.03.14; north-map.png | Medium |
| -224, 131 (centre revised from -194, 131) | 120 / 23 / 44 (length estimate revised from 60) | E/W grey-beige slab with horizontal loggia rows and blank end walls; east end retained at E=-164 | 2026-10-08 21.51.44, 21.51.47, 22.02.18 | Medium |
| -199, -157 | 65 / 24 / 42 | E/W grey-white sectional slab | 2026-10-09 12.03.23, 12.03.24 | Low for this individual anchor |
| -80, -182 | 66 / 24 / 45 | White slab with ochre vertical inserts | Same overview images | Low for this individual anchor |
| 27, -180 | 36 / 54 / 38 | N/S red-white sectional house | 2026-10-09 12.03.23; 2026-10-08 22.00.58, 22.01.42 | Low for this individual anchor |
| 119, -185 | 53 / 28 / 45 | White-ochre slab | 2026-10-09 12.03.24; 2026-10-08 22.00.58, 22.01.42 | Low for this individual anchor |
| 225, -174 | 53 / 23 / 45 | White-grey slab | Same overview images | Low for this individual anchor |

All source screenshot names above refer to the original Russian filenames
starting with «Снимок экрана». The earlier reference study retains the official
project source URLs: https://rodina-peredelkino.ru/ and the public presentation
https://rodina-peredelkino.ru/project/web/assets/rodina_peredelkino.pdf.

The three original context maps in tools/reference/context/ were inspected on
the Mac: north-map.png, aerial-map.png and perspective-map.png. They support
general placement and orientation. Their simplified building colours are not
used as physical facade colours.

## Directly visible architectural details

- Flat dark roofs, white/light parapets and small stair/ventilation headhouses.
- Separate panel sections and shallow changes in facade plane.
- Repeated white window frames, dark reflective glass and projecting enclosed
  loggia stacks; long grey-beige slabs have strong horizontal balcony rows.
- Blank light-grey or warm grey end walls on some long slabs.
- Muted lilac walls with burgundy balcony fronts on the nearby western house.
- White/light-grey walls with ochre or muted red accents in the southern group.

Material colours are visually matched approximations, not measured paint
specifications. Six houses retain the prior reconstructed EN positions and
maximum plan envelopes. The grey western slab is lengthened westwards to an
estimated 120 m, retaining its east/street-facing end at E=-164. The old
60/44 width/height proportion was visibly too short for the approximately
3:1 near-frontal silhouette in 22.02.18. Its new centre is E=-224; six repeated
sections preserve ordinary window spacing. The maps crop this building and
establish neither the old 60 m nor the new 120 m as a surveyed measurement.

The pink western house is revised to a 17-storey
rhythm based on roughly 17 visible balcony-parapet rows in 12.03.14. Its height
is estimated at 50 m, replacing the former 42 m placeholder; this is not a
measured height. Its section setbacks are shallow, matching the near-continuous
facade in that view. The grey slab's overview shows about 14 rows above partial
tree occlusion, so its 15-storey approximation is retained. It uses continuous
horizontal loggia rows rather than the other profiles' angular stacks.
The profile mapping for the five southern anchors remains provisional.

The original envelope at EN(-199,-157) overlapped the highway. Its actual
sections and projecting elements are inset southward within that envelope to
clear the carriageway and sidewalk. Only forest trees intersecting the new
residential envelopes are resampled; the other original tree records and total
tree count are preserved.

Two detailed low-rise backdrop buildings already exist in reference-backdrop.js.
Two further low-rise objects visible in 22.02.18 cannot be tied confidently to
the remaining named service-block placeholders. They are outside this
residential-neighbour revision. No unsupported addresses or BIM precision are
asserted.

## Runtime integration

neighbor-building-layout.js defines per-building profiles and source metadata.
neighbor-buildings.js constructs opaque geometry and night/season controls.
neighborhood.js replaces the seven residential placeholders and keeps the
existing environment visibility/disposal lifecycle. This is geometry in the
interactive Three.js scene, rather than a background panorama or generated
raster illustration.
