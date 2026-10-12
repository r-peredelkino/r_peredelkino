# v30 landscape — visual corrections after GPU A

## Evidence and limits

Comparison used the full 1700 × 1200 native source exports in `panorama-qa/` and the actual Mac GPU A renders in `scene-exports/`. The source is the developer's June 29, 2026 panorama tour at <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/>. No generated reference imagery was used.

The source shows a much finer, darker garden texture than GPU A; distinctive burgundy bedding is a coherent planted shape; a fine purple line remains visible in sunlight. Its forest edge has thin tall trunks, irregular lateral pine branches and dark depth. GPU A instead had large pale shrub lobes, isolated pink flower pixels, nearly invisible inlays, and large repeated rounded woodland crowns. The front of the arena was mostly empty pavement in A, despite several obvious planting islands in the source.

The reconstruction remains constrained by an estimated AGL plane and retained building/road registration. This pass does **not** establish metric 1:1 correspondence. The missing arena planting is manually traced and explicitly locally registered, not taken from a survey or BIM model.

## Implemented corrections for GPU B

- Replaced nine coarse shrub lobes with seventeen smaller irregular lobes. Lowered garden vegetation and gave contiguous groups darker varied greens.
- Added fine stemmed white flowers throughout the dark planting rather than a few isolated flower heads. Flower stems remain rooted at each actual soil surface, including raised vessels.
- Burgundy source polygons now tint the complete low planted mass. The small petalled blossoms reinforce the patch without being its only colour signal.
- Restored a visible purple daytime inlay: material emissive intensity `.32`, with the light-spill field still at zero during the day. Night intensity remains `2.4`; widths and source line paths were preserved in the original forecourt.
- Mature pine geometry now has seven staggered whorls of flattened needle-bearing branch fans. Crown depth varies from 30% to 43% of tree height instead of one repeated 45% rounded envelope. Interior young-tree and shrub materials are darker.
- Filled the former distant open grass/isolated-tree row with an instanced low-detail woodland layer inside the existing forest mask. It adds two draws (crowns and trunks), without moving any of the original 1,850 context tree anchors.
- Kept the smooth low white vessel and pebble geometry from A.
- Corrected missing vertex-colour inputs that could make legacy boat-planter fill black: conventional shared materials are now separated from the rooted botanical geometry's vertex-colour materials. Distant pine LOD geometry has an explicit white colour attribute.
- Applied the coordinated wider retail-sign scale requested by the architecture agent; retained the parent's paving helper and all lighting changes.

## New arena planting

`arena-landscape-data.js` adds nine beds, five trees, seven slender white lights, one white organic seat, one visible pair of cafe umbrellas, and nine clipped inlay fragments. The new bed union occupies **292.42 square scene units**. Scene units follow the project's existing transform (scale approximately 0.90093); this is not a surveyed site-area statement.

The nine beds follow the source's sequence: southern tree garden; central multi-tree garden; two small planting pockets against the shops; eastern tree garden; burgundy/cream triangular bed; paired small entrance islands; and the larger northern entry garden. Tree feet hidden by crowns are labelled as estimates.

Each source silhouette was smoothed from manually recorded pixel anchors, then registered against the existing pedestrian paving and a 0.30-scene-unit building buffer. Four beds fit directly. Five required the shortest modest translation into the retained narrower promenade:

| Source bed | Local XZ translation | Length | Reason |
|---|---:|---:|---|
| Southern tree garden | +1.32583, +1.32583 | 1.875 | Raw ground-ray edge crossed the retained curb |
| Central tree garden | +0.79550, +0.79550 | 1.125 | Raw edge crossed the retained curb |
| Western storefront pocket | −0.20787, −0.13889 | 0.250 | Keep a narrow clear gap to the facade |
| Eastern storefront pocket | −1.59099, −1.59099 | 2.250 | Raw ground rays intersected the retained podium |
| Eastern tree garden | +0.41573, +0.27779 | 0.500 | Preserve the full contour inside paving |

The final contours retain more than 99.5% of the traced area after these translations. Source pixel anchors, original rays, corrections and final world geometry are separately preserved. The translations disclose a real limitation of the retained plan registration; they are not silently presented as exact coordinates.

Legacy guessed planting, benches, lights and cafes inside the newly evidenced arena zone are replaced rather than superimposed. Outside that zone, existing realm paths and layouts remain. Roads, traffic, footprint centres and road-direction data were not changed by this agent.

## Camera and reproducibility

Arena source: node1, pan −37°, tilt −37°, horizontal FOV 58°, 1700 × 1200 pixels, north 123.58°, assumed AGL 60 m.

- Scene camera: `[-88.38121210004893, 54.055899587602426, -74.43182231121628]`.
- Source-centre target: `[-64.291, 0, -6.86323]`.
- Vertical FOV: `42.73852457859029°`.
- Canonical generator: `rodina-v30/tools/arena-v30/trace_arena.py`.
- Canonical projection helper: `tools/arena-v30/projection.py`.
- Portable source, pixel overlay and reproduction check: `tools/arena-v30/`.
- Source anchors and registration checks: `tools/arena-v30/arena-source-trace.json`.
- Current landscape runtime SHA manifest: `tools/qa-v30/landscape-changed-files-v30.json`.

The A arena camera had a different target. Direct pixel-to-pixel comparison with the source must use the matched source camera above; otherwise differences in projected roof and planting size include a camera effect.

## Checks and remaining GPU decision

The focused CPU B check passed finite geometry/matrices, unit normals, source XY preservation for every original forecourt object, preservation of original context tree anchors, tree feet inside beds, summer/winter restoration, day/night and wetness values, and complete disposal of owned landscape geometry, textures and instance buffers. Source tracing additionally checks pedestrian-surface containment and facade separation.

Forecourt plus woodland geometry increases from approximately 8.0 million triangles in A to 12.1 million in B; the forest adds two draws. The extra workload is primarily the new planting area, fine white flowers and distant woodland. Real GPU frame time and the source-matched B images must decide whether the detail density is practical. CPU counts are not evidence of visual accuracy.

At this checkpoint the parent has GO to render GPU B. Runtime files are frozen until that review. Actual B appearance and frame rate are pending, and no claim of complete visual or metric 1:1 is made by this audit.


## Final integration follow-up after GPU B

The four-frame visual review is recorded in `tools/qa-v30/visual-review-v30.md`. It found one duplicated cafe and three unsupported legacy bench/planter groups, which were removed by a filter in `public-realm.js` only. Source contours and all 28 traced islands remain. The focused result and final module SHA are in `arena-integration-fix-check.json`. The arena source, projection helper and portable reconstruction command are now contained entirely in `tools/arena-v30/`; no files from an older release or an external QA folder are required.


## Targeted rendering optimization after the final integration image

Six static planting batches are now partitioned into 20-unit spatial cells; all original geometry, instance transforms, colours and source records are retained. Cast shadows are disabled only for the three groups of fine flowering stems, while receiveShadow and the shrub shadows remain. The portable exact-data/season/bounds/disposal check and its results are `check-spatial-planting-v30.mjs` and `spatial-planting-check-v30.json`. CPU culling estimates and the required native GPU comparison are described in `spatial-planting-v30.md`. This update changes rendering submission, not the planting plan. The final native M2 measurement confirmed fewer submitted triangles without lost beds, but did not materially improve median frame cadence: about 66.7 ms for the forecourt and 83.3 ms for walking. The detailed 3D scene remains performance-limited; the measured results and scope are recorded in spatial-planting-v30.md.
