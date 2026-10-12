# Panorama source audit — v29

## Coverage and provenance

Source: <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/>.

The public HTML directly loads `pano.xml?ts=52937626`. The XML declares exactly six spherical scenes, not a collection of street-level photographs. Its Pano2VR player version is 7.1.11. The accompanying skin contains no additional scene/configuration references. Three PNG skin images are branding; `preview.jpg` is a cover made from the second aerial viewpoint.

The directory date is 2026-06-29. XML userdata datetime fields say 09.08.2024, but those fields may have been carried over from a previous tour; the actual photography date is not independently established. `after` scenes are a proposed finished development composited into photographic surroundings; `before` scenes show construction. Neither the URL nor stale embedded datetime establishes completion/as-built status.

| Node | Type | GPS longitude, latitude | XML altitude | Front bearing | Source face resolution | Relevant coverage |
|---|---|---|---:|---:|---|---|
| node1 | after / daytime | 37.351367, 55.637298 | 60 | 123.58° | 3500×3500 | Best daylight frontal plaza / roof / decoration / frontage road view |
| node2 | after / evening | 37.351266, 55.637231 | 60 | 123.87° | 3500×3500 | Same general viewpoint; purple/cyan lighting unambiguous |
| node3 | after / daytime, higher point | 37.355754, 55.636534 | 130 | 278.84° | 3500×3500 | Courtyard, tower roofs, medical/retail surroundings; requested forecourt mostly hidden by office tower |
| node4 | before / daytime | 37.351367, 55.637298 | 60 | 123.582° | 3000×3000 | Construction state and existing roads; no finished forecourt |
| node5 | before / evening | 37.351266, 55.637231 | 60 | 123.872° | 3000×3000 | Construction state and evening road context |
| node6 | before / daytime, higher point | 37.355754, 55.636534 | 130 | 278.841° | 3000×3000 | Construction footprint, rear accesses and surrounding existing structures |

Each scene has six cubemap faces. Face numbering, verified against the published player: 0 front, 1 right, 2 back, 3 left, 4 up, 5 down. All 36 maximum-resolution faces are retained in `references/panorama/faces/`; their original source tiles, URLs, dimensions and SHA-256 values are recorded in `references/panorama/source-inventory.json`. Top faces are sky; no hidden courtyard/office photographs exist above the horizon.

The retained source set contains 1,530 maximum-resolution tiles and 36 low-resolution face previews, totalling 1,566 successfully downloaded tile assets and 107,177,643 original bytes. There were no failed tile downloads. The complete six-scene/36-face audit used both whole-face overviews and relevant native-resolution details. This covers the entire published tour, including the construction views and the higher rear view, rather than only its landing camera.

## High-confidence visible decorative program

The source frontal plaza is continuous with the two-storey curving retail frontage. It is distinct from the existing forest-side sales office. The unlabelled white volume in the square has an opaque mineral surface and four straight observed roof edges in the analytical pinhole view. The earlier impression of a curving pavilion edge came from the panoramic projection and was superseded by the detailed roof trace. The separate commercial gallery has a curved front edge. No legible entrance, signage or interior establishes a sales-office function for the white volume; its function remains unassigned.

1. An extensive thin purple light inlay crosses the paving. It curves around planted islands, follows parts of the storefront, enters the rod installation in a loop and continues along the full public frontage. Daylight source shows a thin saturated line. Evening source shows a brighter core and a narrow glow on the paving. It is not a high physical barrier or a continuous row of lamps.
2. **Sixteen cyan/magenta vertical light rods in a regular 4×4 arrangement** stand near the northern end of the square, between parking and the white volume. They appear rigid, have sharp tops and consistent two-colour segments. There is no visible spray, wet basin or nozzle evidence. The user calls them fountains; the imagery supports a luminous installation, not a confirmed water system.
3. A **second small group of two visibly confirmed cyan/magenta rods** stands near a yellow round table in front of the red flowerbed. Vegetation hides part of this small area; a neighbouring white upright is a normal light pole, not a third coloured rod.
4. A dark blue-grey, elongated lobed canopy faces the service road. Three vertical luminous purple circles hang beneath it on fine attachments. Thin white supports leave the area open. Its footprint is asymmetrical and elongated rather than a symmetric clover.
5. A separate dark grey, irregular lobed canopy sits beside the white volume and the red/white flowerbed, shading yellow furniture. It does not carry the three large luminous rings.
6. Behind the white volume, near the sixteen rods, stands a low rounded communal workstation/table arrangement: three individually traced dark brown tabletop insets, four dark backrest-like circles, four yellow seats and a cyan-lit curved lower edge in the evening image. Its apparent height is around the waist of adjacent people; treating it as a tall pergola would misread the source.
7. White sculpted shell/crescent seats with pale beige inset surfaces appear near this low table and elsewhere. Some separate white bowls near the storefront contain green planting; those are distinguishable from unplanted sculptural seats.
8. Planted islands have individually varied elongated, kidney-shaped or lobed outlines. They contain dense low white-flowering shrubs, green shrubs and varied-height small trees. One prominent angular/curved island has a dense red-and-pale planting pattern with a light timber/mineral seating edge.
9. The street-facing paving includes slender white light poles with short bent heads, yellow cylindrical bins or bollard-like objects, small yellow/orange table-and-chair sets, white pebble seats, curved pale planter edges and thin pale nonluminous paving lines.
10. Along the commercial frontage are repeated white square parasols, orange café chairs, small round tables, white freestanding planters and planted pockets that follow the glass facade. Generic restaurant/bakery labels are visible in the rendering; they are not proof of actual leaseholders.

The final day/evening maximum-face comparison confirms **two separate small yellow furniture groups, containing one visible round table and three distinctly visible chairs in total**. The open pocket beside the two additional coloured rods contains the table and two chairs. Under the smaller dark canopy, only the front-right yellow chair is distinctly readable. The yellow/black silhouette beside it is a seated person; no separate tabletop or concealed chair is counted there. These four furnishing objects are traced in `forecourt-architecture-pixels.json` under `socialSeating`; their dimensions and fine base construction remain reconstruction estimates. The eight seats at the long communal workstation are counted separately.

The small yellow furniture group beside the two rods contains one visible round table and two clearly distinguishable chairs; vegetation conceals the remaining space. Under the small canopy, one unoccupied yellow chair with a pedestal/star base is distinguishable. The yellow upper body, dark lower clothing and pale legs behind it appear to belong to a seated person; they are not evidence of a second table. The corresponding evening view confirms the same shapes. Hidden chairs and an unseen tabletop should not be fabricated from those pixels.

## Adjacent road and parking

The front service road is a separate asphalt strip between the square and the long parking area adjoining the highway. The parking area has multiple perpendicular rows, gaps, kerbed islands, pedestrian space and end connections; it should not be replaced by a single featureless strip. Existing public road circulation should continue to follow the previously verified transport data; a static render alone does not establish current legal lane directions or turn permissions.

The small end parking area beside the office frontage shows nine marked bays, six occupied by rendered cars and three empty. Preserve empty spaces rather than filling every bay. The zebra crossing and approach to this short car park are visible. Exact widths are not labelled in the tour and must be reconstructed by geometric calibration rather than declared surveyed.

The final v29 parking reconstruction retains all **94 observed parked cars**, with **53 local pose corrections** required to keep their bodies inside the fitted parking areas and clear of the fixed road corridors, raised walks and other cars. Five cars beside OSM connector `1131102991` move together by 7.14703 model units, approximately **7.933 m**, preserving their mutual spacing and headings. The largest correction among the other cars is **2.05912 model units**. The five-car group therefore does not reproduce its source positions 1:1. The public road axes remain unchanged. `roadside-fit-results.json` records every correction, and `roadside-bounded-final-audit.json` reports zero car/road, car/raised-walk, car/car or outside-parking overlaps. These are geometric compatibility checks, not evidence of survey accuracy.

The individually reviewed static-car trace records **94 cars**: six in the office pad, 23 in the northern highway-side row, 21 in the northern service-road row, 15 in the central service-road row, 13 in the central western highway-side row and 16 in the central eastern highway-side row. A preliminary count of 97 contained three duplicate observations; native-resolution roof-by-roof review removed those duplicates from the source trace. No actual observed car was deleted to solve a model collision. The office pad has occupied bays 1, 2, 3, 5, 6 and 7; bays 4, 8 and 9 remain empty. The separate moving vehicle beside the crossing is excluded from this static-car count. Nine zebra bars and ten bay-divider lines are traced.

The source trace also contains eight original ground polygons, nine curb paths, two driveway openings and seven streetlight bases. The published image directly supports these features and their relative arrangement; silhouette-based vehicle dimensions and pole heights remain estimates. Cars use individually observed roof centres and longitudinal directions, with a separate estimated roof elevation for reprojection rather than one repeated pixel direction.

## Reprojection and calibration

`references/panorama/cube-analysis.py` performs ordinary pinhole reprojection of the downloaded pixels; it creates no new scene content. The two principal analytical views are:

- `node1-forecourt-perspective.png` — daylight, native yaw-right −45°, tilt-up −34°, horizontal FOV 54°, 1700×1200.
- `node2-forecourt-perspective.png` — evening, same native view values.

Their JSON sidecars list source face images. `node1-plaza-face3-crop.png` and `node2-plaza-face3-crop.png` are exact rectangular source crops, without upscaling. `small-poles-detail.png` is a side-by-side analytical crop comparison.

For pixel centre `(px,py)` in a W×H face, set `u=2(px+.5)/W−1`, `v=2(py+.5)/H−1`. In a right/up/forward camera basis the ray directions are: front `(u,−v,1)`, right `(1,−v,−u)`, back `(−u,−v,−1)`, left `(−1,−v,u)`, up `(u,1,v)`, down `(u,−1,−v)`. Geographic bearing clockwise from north is `pannorth + atan2(x,z)`. `camera-world-v28.json` contains nominal GPS registration to the existing model.

The XML distance 296.527 m between the two aerial points is consistent with their GPS difference and altitude difference of 70 m. The before-scene hotspot direction is consistent as well. Some after-scene hotspot icons have been moved slightly; use fixed ground controls for final tracing instead of hotspot-icon centres. Roofs, tree crowns and furniture tops require their own elevation when projecting: flattening every coloured image pixel to ground will misplace elevated geometry and rings. The old fixed-model registration is approximate (about 5 m); source tracing improves visual agreement without proving surveying accuracy.

### Parking reconciliation with the existing road model

`convert_roadside.py` applies a separate parking-only thin-plate registration with 30 observed parking-side curb controls, anchored to the fixed rendered widths and axes of highway 231671394 and service road 49155461. The office pad and seven plaza-frontage lamps retain the main forecourt registration. Source cube-face seams are canonicalized against their shared recorded edge; final geometry has no seam gap. Parking surfaces, sidewalks and curb segments are clipped to keep the existing road corridors clear. The two observed driveway openings also receive asphalt apron surfaces. The resulting ground geometry has 13 parts.

Five cars in the eastern central highway-side row conflict with the model's fixed straight connector 1131102991 even after the local road-edge registration. This is a geometric discrepancy between the project panorama and the retained road model. Their final placement uses one approved rigid translation of `[+2.2, +6.8]` model units with zero rotation, preserving all five source headings and all inter-car spacings. The displacement is 7.147 model units, approximately 7.933 m at the model scale. These five placements are an approximate reconciliation and **must not be described as a 1:1 match**. Each car's original registered pose, its pixel observation and its correction remain saved in `sourcePose`, `boundedPlacement`, `fitMetadata` and the source trace. All 94 cars are retained.

The final spatial audit reports zero car-road overlaps, zero car-car overlaps, zero cars outside parking asphalt, zero car overlaps with raised walkways, zero parking/walkway surface coverage over road corridors and zero cube-face seam gap. The runtime constructor audit reports 94 cars, 376 wheels, 20 meshes, 18,255 stored vertices and 1,410 instances; all coordinates and normals are finite. These checks establish internal geometric consistency, not a survey-grade match to the original development.

## Limits

The requested forecourt is documented by two nearby front camera positions, primarily distinguished by time of day, and partly concealed by the office tower from the higher opposite view. Unseen sides, exact profiles, fixing details, programmed LED behaviour, real water functionality and hidden planting counts are not established. All reconstructed dimensions should retain their reference-based status. Source screenshots and unrelated desktop UI are analysis inputs only, not deliverables.
