# Источники и проверка версии 30

Основная задача обновления — визуальное соответствие предоставленным изображениям.
Девять снимков от 11.10.2026 просмотрены целиком; в отчётах указаны конкретные
расхождения. Полные снимки рабочего стола пользователя в проект не включены.

Обычный вход открывает оригинальный панорамный режим. Свободная 3D-модель
доработана отдельно и сохраняет статус реконструкции. Источники, отличие
проектной визуализации от фотографической съёмки и ограничения геометрии
описаны далее.

## Архитектура и благоустройство

Сравнивались одинаковые камеры v29/v30 и соответствующие исходные ракурсы.
Первая итерация выявила пересвет покрытия, пёстрое остекление, тонкие белые
ленты, узкие кольца арены и недостающие посадки. После неё выполнена
вторая корректировка. Документы `tools/qa-v30/architecture-b-visual-corrections.md`
и `tools/qa-v30/landscape-implementation-notes.md` содержат параметры изменений.
Видимая полоса медиафасада перепроецирована из настоящих JPEG-пикселей;
невидимые буквы не восстановлены выдумкой. Производная текстура отдельно
обозначена в `arena-media-reprojection.json`.

На площади направление взгляда переключено с фасада белого павильона
на открытый променад. Координата точки и существующий маршрут сохранены.
Архитектурные подписи приложения перенесены в интерфейс и метаданные.

Полный исходный комплект и действующая версия проверяются по
`EXPORT-MANIFEST.json`. Контрольные суммы подтверждают файлы конкретного
экспорта; они не подтверждают геодезическую точность или визуальное сходство.

# v30 — Original source assets and panoramic explorer

## Finding

The published developer tour is a six-scene JPEG cubemap tour. It does not expose the renderer's original apartment-block geometry, terrain geometry, depth maps, GLB/GLTF/OBJ/FBX/IFC, Gaussian splats or 3D Tiles in the inspected HTML → player/skin → tour-XML dependency chain. The main development website embeds this very tour. Its visual apartment selector is a rendered image with SVG hit areas, not a free-orbit 3D scene.

This is a bounded source inspection, not proof that the developer has no private model. The user says the developer has granted permission. No additional permission was requested to use the original published imagery. A true freely moving replica still needs source geometry/materials or a much more complete reconstruction; this additional mode does not replace that work.

## Primary materials inspected

1. <https://rodina-peredelkino.ru/> — current HTML, read both with search service and as static HTML over HTTPS. It embeds `https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/` in an iframe. The `#selector` section uses `/project/web/assets/images/webp/selector/selector.webp` and SVG `<path>` hit areas. Current HTML: 284,080 bytes, SHA-256 `2030fbd3c5ed8f5043db75f9899dcc13ed80cbcd0b47a47cddf0e9c3347be953`.
2. <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/> — 4,640 bytes, SHA-256 `4c5cafe3656a49c8a569adbdfb223691e6751f26887e239b4d02045d9aeee6d5`. Only `pano2vr_player.js`, `skin.js`, and `pano.xml` are involved in the scene dependency chain.
3. <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/pano.xml> — 22,594 bytes, SHA-256 `f5dff1bac007ce12f1119fdb975aa90663318864f52e22a23372f4c873f490e2`. Byte-identical to the v25 local copy and v29 installed source. The XML describes six images, view angles, GPS, scene links, hotspots and JPEG tile URLs.
4. <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/pano2vr_player.js?ts=52937626> — Pano2VR 7.1.11/21010, 290,574 bytes, SHA-256 `6ad4ebcfad73eb0d8b17d9ee969576e1e6fd891df8b58b92bf5708928ff3928f`. Static inspection only. The header marks a trial runtime. It is **not included or executed** in our explorer.
5. <https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/skin.js?ts=52937626> — 588,302 bytes, SHA-256 `3908aee954a1706a6dcb8fa0ea4f26b634d6bcbd2dd7f0a46700bfa1f4866a0a`. Generated 2026-06-29. References only three PNG branding images in addition to tour nodes. No second hidden tour/model reference was found. Static inspection only, not copied into the explorer.
6. <https://rodinagroup.com/projects/rodina-peredelkino> — 13,265 bytes, SHA-256 `60b0e4b7848af844456dab9e5cc883ee071f850c0296caabe3c1d07d24ae7699`. The linked `/ajax/js?script=page.project&v=1624289358` bundle is 483,387 bytes, SHA-256 `a1220d8c0459a9d7812dfaaedc91e811f7c7d9e7c40db37cbab1f132d5f4fdd0`. Inspected as text only; references map/selection JSON and image assets, no source 3D models.
7. <https://ggnome.com/doc/pano2vr/7_1/reference/javascript-api/> — primary API documentation confirms fixed viewing direction, scene switching, native hotspot and event support. Its ordinary external iframe cannot be controlled across origins by our app. The implementation uses our own Three.js image renderer instead.

The tour directory, HTTP Last-Modified, and skin generation date support a publication date of 29 June 2026. Embedded XML camera datetimes say 9 August 2024 and may be inherited. No actual photography date is asserted. The after scenes are a proposed finished project composited into surrounding photography, not evidence of completed construction.

## Scene inventory

| Scene | Source tags | Longitude, latitude | XML altitude | North offset | Native face | Preview face |
|---|---|---|---:|---:|---:|---:|
| node1 | after, day | 37.351367, 55.637298 | 60 | 123.58° | 3500² | 437² |
| node2 | after, evening | 37.351266, 55.637231 | 60 | 123.87° | 3500² | 437² |
| node3 | after | 37.355754, 55.636534 | 130 | 278.84° | 3500² | 437² |
| node4 | before | 37.351367, 55.637298 | 60 | 123.582° | 3000² | 375² |
| node5 | before, evening | 37.351266, 55.637231 | 60 | 123.872° | 3000² | 375² |
| node6 | before | 37.355754, 55.636534 | 130 | 278.841° | 3000² | 375² |

Altitude values are retained as source metadata. Their vertical datum is not independently verified and the explorer does not use them to invent new camera positions.

## Availability and recovery

The current scratch snapshot originally contained v23–v27, not the v29 raw source directory claimed by the prior summary. The Mac was searched read-only in `/tmp/rodina-*` and project-related Downloads directories. Seven project backup tarballs were inspected by member list. No original panorama tiles or assembled cube faces were present. The Mac retained `pano.xml`, `source-inventory.json` and the previous audit in `tools/forecourt-v29`.

The source tile URLs were still public and matched the retained inventory. Direct HTTPS access from scratch worked. Downloads therefore recover missing source assets, rather than duplicate an available large collection.

The two-resolution collection contains **1,566 original files / 107,177,643 bytes**:

- Three after scenes: 294 full-resolution tiles + 6 previews each.
- Three before scenes: 216 full-resolution tiles + 6 previews each.
- Exactly six cubemap faces per scene, 36 faces in total.
- Full Pano2VR four-level output would have 2,160 tiles. The 594 intermediate tiles are intentionally not required by our renderer. Do not call the recovered two-level set a complete original Pano2VR export.

`qa-v30/panorama-download-results.json` is the authoritative final download result; `dist/assets/panorama/source-manifest.json` retains every source URL, original byte count, image size and checksum. `tools/fetch-original-panorama.py` can stage or verify the source collection on another machine using Python's standard library. It accepts an explicit destination, verifies SHA-256 before reuse or replacement, and downloads only the frozen source paths.

## Orientation and exact source sampling

Source faces: 0 front, 1 right, 2 back, 3 left, 4 up, 5 down. This was checked against actual downloaded images and the retained analytical projection, not inferred from filename order alone.

For source-image coordinates `u,v ∈ [-1,1]` with `v` increasing downward, source camera rays are:

| Face | Source ray | Three.js ray |
|---|---|---|
| 0 | `(u,-v,1)` | `(u,-v,-1)` |
| 1 | `(1,-v,-u)` | `(1,-v,u)` |
| 2 | `(-u,-v,-1)` | `(-u,-v,1)` |
| 3 | `(-1,-v,u)` | `(-1,-v,-u)` |
| 4 | `(u,1,v)` | `(u,1,-v)` |
| 5 | `(u,-1,-v)` | `(u,-1,v)` |

The source has one-pixel overlaps and a 510-pixel tile step. A normal full tile is 512×512 including overlap. Preview images similarly include two extra pixels. Geometry boundaries map to the source's 510-pixel useful extent; texture coordinates exclude the one-pixel border. The published URLs are:

`tiles/nodeN/cf_F/l_0/c_0/tile_0.jpg` — preview.

`tiles/nodeN/cf_F/l_3/c_C/tile_R.jpg` — native detail, C/R 0–6 after and 0–5 before.

Positive source pan turns left. Three's viewing vector is `[-sin(pan)cos(tilt), sin(tilt), -cos(pan)cos(tilt)]`. The retained v29 analytical forecourt view is reproduced at pan 45°, tilt −34°, horizontal field of view 54°.

The custom viewer uploads original decoded pixels to unlit sRGB textures and disables tone mapping. It adds no scene lights, replacement trees, synthesized facade detail or colour grading. Rotation, perspective projection, screen scaling and texture filtering necessarily resample the original image for the viewport; the underlying JPEG files remain byte-for-byte unchanged.

## Implementation boundary

Files owned by this subtask:

- `dist/reference-explorer.js`
- `dist/reference-explorer.css`
- `dist/reference-explorer-data.js`
- `dist/assets/panorama/` (source XML, manifest and original JPEG tiles)
- `tools/fetch-original-panorama.py`

No main application, index, onboarding, walking or model module was edited by this subtask.

The overlay is explicitly titled “Оригинал застройщика” and describes fixed panoramic points. It has source day/evening scenes, a matched photo/project switch, pointer drag, wheel/pinch zoom, keyboard controls, labelled objects, and a clear return to the free-moving 3D map. The original local developer genplan and its five building hit areas call `onOpenBuilding(id)`.

The source tag `before` means the uncomposited photographic view in this tour. It visibly includes partly constructed towers. The UI therefore says **“Съёмка”** / **“Съёмка участка · исходная панорама”**, not “before construction”; the original metadata tag remains unchanged. The `after` images are clearly labelled as project views.

It does not claim that a source image is the improved freely moving model. It does not fabricate unseen viewpoints, street-level panoramas, apartment interiors or water features. Existing XML metro/context pins are retained. Additional plaza/gallery/arena/courtyard markers are image-angle annotations; their source placement is documented separately from geographic coordinates.

All native tiles are stored locally, but only visible detail is uploaded to the GPU. At most six detail requests are active. The view-dependent cache targets 160 native tiles on desktop and 96 on small viewports; previous in-flight requests can add at most six transient entries before the next view update. The low-resolution complete cube remains behind detail tiles during loading. Closing disposes textures, geometry, bitmaps, the observer and the renderer.

## Environment/HDR assessment

These sources are JPEG panoramas, not HDR radiance maps. The top cube face contains genuine sky, while every complete cube includes buildings/roads/terrain. `node4` is a photographic before view and may be useful as an LDR reflection reference, but it must not be called true HDR or applied as a camera-independent recreation of the surrounding geometry. No HDR source file was found or invented in this subtask.

## QA records

`qa-v30/panorama-qa.cjs` runs the authored module on an isolated local HTTP server and bundled Chromium 153. The server and browser close in `finally`. `qa-v30/panorama-qa/results.json` contains the final scenario results. Initial source frame: 1700×1200, 33 native visible tiles, no JavaScript errors, no failed HTTP requests. UI and direct source-canvas PNGs are retained for actual visual inspection.

Full checks cover the six source scenes, panorama focus areas, source-state transitions, original genplan callback, keyboard zoom/rotation, label switch, 390px mobile layout, close/disposal and source-only image exports. The root owns live Mac integration and the separate reconstruction/model acceptance checks.

Final standalone result: **PASS — 10 captured views, all six source scenes, zero JavaScript errors, zero failed HTTP responses**. The native visible tile sets were 33 for the initial forecourt, 35 for the arena, 66 for the forest/road, 35 for the metro, 48 for the courtyard, 42 for the courtyard photo, 28 for each forecourt photo, 33 for the evening project, and 51 for the portrait mobile view. Maximum observed cache residence was 127 detail tiles. The 390×844 UI had exactly 390px scroll width; the original genplan remained usable on that viewport.

The regression check changes from forecourt to arena within `node1` synchronously, then checks the readiness API before and after detail loading. Expected and observed: `true → false → true`, with native tile demand changing from 33 to 35. This protects against the previous camera's ready flag incorrectly satisfying a new view. `whenReady()` now flushes camera/frustum demand itself, and readiness is tied to the exact view key. `captureFrame()` rejects an unfinished detailed view unless `{details:false}` is explicitly requested.

The five-building genplan's third button returned numeric `3`; arrow-right, arrow-up and plus changed `(pan,tilt,fov)` from `(45,-34,54)` to `(41,-30,46)`; labels changed from visible to hidden; close invoked its callback once and removed the layer. All 10 view images, both genplan sizes and the three photographic scenes were inspected visually. No flipped faces, visible preview/detail patches in completed views, missing tiles or misplaced courtyard/arena annotations remained in those views.

The generator records source-image pixels for the custom annotations. The arena marker is traced to pixel `(970,405)` of the 1700×1200 arena view at pan −37°, tilt −37°, horizontal field of view 58°. The courtyard marker is traced to `(810,680)` of its 1700×1200 view at pan 1.9°, tilt −31°, horizontal field of view 78°. These are image annotations, not survey coordinates.

## Integration API

```js
import {createReferenceExplorer} from './reference-explorer.js';

const explorer = createReferenceExplorer({
  host: document.body,
  initialArea: 'forecourt',
  onClose() { /* resume the main 3D view */ },
  onOpenBuilding(id) { /* close the overlay and select corpus 1..5 */ }
});

await explorer.whenReady({details:true, timeout:20000});
const originalPerspectivePNG = explorer.captureFrame();
```

Other public operations: `focusArea('forecourt'|'arena'|'courtyard'|'forest'|'metro')`, `openNode('node1'..'node6')`, `setView({pan,tilt,fov})`, `openPlan()`, `closePlan()`, `getState()`, `close()` and `destroy()`. `close()` performs disposal then calls `onClose`; `destroy()` performs disposal only. The parent should pause its main animation / free-walk inputs while this overlay owns the screen. The original perspective export contains only the canvas source view; UI labels and controls are separate DOM elements.

## Actual application integration QA

The authored module was also opened through the real `dist/index.html`, not only a standalone harness. This revealed a host stylesheet collision that the isolated harness could not: global `nav` / `nav button` rules supplied a bottom inset, width, margin and column layout to the panoramic area navigation. `reference-explorer.css` now explicitly resets those geometry properties. The fixed navigation is 43.8px tall at 1280×900 and 37.5px tall at 390×844; the latter overlay has no horizontal document overflow. Both integrated screenshots and the mobile genplan were inspected visually after the correction.

`qa-v30/index-integration-qa/results.json` records **11 passing functional checks, zero JavaScript errors and zero failed HTTP responses** on a fresh real index page. Normal entry opens the original scene. Closing restores the original map tab and removes inertness; the root's entry fix restores either the opener or the active map-tab button. Escape also closes without locking the main app. The button is labelled “К карте”, reflecting that transition.

The actual path through original genplan → corpus 3 → floor 2 → apartment 676 loaded the published 1241×1241 PNG `assets/reference/apartment-plans/bd9cc88752717cf63c9fe4983abcd626.png`, linked to <https://rodina-peredelkino.ru/catalog/3-676/>. “Показать на этаже” returned to the original floor SVG and highlighted that apartment's contour. The catalogue showed 203/203 published plans across all five buildings, and selecting corpus 3 showed 63/203. Access was not restricted to the two explicitly labelled mock residence grants.

`qa-v30/index-integration-qa/layout-results.json` records three additional passing checks for desktop/mobile integrated navigation and the original five-building mobile genplan. Source-photo wording was separately checked in `qa-v30/panorama-qa/source-label-results.json` for all three `before` scenes.

The free-moving 3D tab mounted a real canvas and `clusterCamera` in the earlier integration run; its screenshot timed out after 40 seconds on scratch's software SwiftShader. That run is preserved as `results-first-gpu-timeout.json`. The final functional run used the explicit `--skip-3d` option and must not be described as native free-3D rendering acceptance. Native Mac GPU performance and the updated reconstructed model are the root agent's separate acceptance responsibility. `index-integration-qa.cjs` includes the 3D step by default for that purpose, or supports `--skip-3d-capture` to omit only its screenshot.

Final file hashes are recorded in `qa-v30/reference-explorer-delivery.json`; the root integration files inspected during this run are checkpointed in `qa-v30/index-integration-runtime-snapshot.json`.
