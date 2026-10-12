# Apartment sunlight integration — v31

## Runtime ownership

This integration changes only `dist/apartment3d.js`, `dist/apartment-model.js`, and `dist/apartment.css`. It consumes the shared `solar-clock.js`, `solar.js`, and `architectural-lighting.js` APIs. No apartment outline, window segment, room layout, building placement, floor height, or original geometry buffer was changed.

The apartment uses the district's selected Moscow civil date and time. Manual selections persist on return to the map. Month selection retains the day where possible and clamps it to the end of the selected month through the common clock helper. Actual azimuth and apparent elevation come from the same solar snapshot as the district; night is defined by the calculated horizon crossing. There is no independent fixed sun vector or evening switch. The apartment explicitly displays a clear-sky visualization; the optional inspection lamp starts off and is distinct from sunlight. Its position is fixed in a room, rather than following the viewer.

## Opaque envelope and windows

The six additional shadow-only meshes in each apartment share the original opaque upper-wall/ceiling geometry. Their transforms match the original meshes exactly. Their material is double-sided with `colorWrite=false` and `depthWrite=false`; they cast shadows but do not receive shadows or respond to picking. The original visible layer and its corresponding shadow-only layer are mutually exclusive in cutaway/full-wall/walking views. Transparent glass does not cast an opaque shadow. Walking collision still uses the original apartment plan.

The prior facade opening shader changed only the colour pass: the enclosing tower continued to block incoming sunlight in the depth pass. `cutApartmentShadowOpenings` now applies the same finite cut to custom depth and distance materials on the apartment's tower. Instanced transforms are applied before the world-to-apartment aperture transform. Curved opaque infill retains the existing `paneBend` vertex deformation in both shadow shaders. The cut remains restricted to the selected apartment's vertical interval, so the opposite facade and other storeys remain present.

This intentionally preserves the existing registration tolerance: **1.35 m on either side of each window segment's local normal**, **0.08 m beyond its ends**, and the established vertical shell-cut interval **0.08 m to ceiling height minus 0.06 m**. The apartment's original sill, frame, jamb, and head geometry still occludes the true opening locally. The wider facade cut compensates for the previously estimated apartment-to-shell registration; it is not a measured wall thickness or a newly certified window dimension. Exact insolation still depends on surveyed facade and window geometry.

## Context, shadow camera, and materials

The surrounding complex loads automatically because its geometry is required for sunlight even when its colour view is hidden. A loading/error message identifies the period when only the apartment's own shadows are available. A retry button is available after a load error.

The lighting rig receives an identity parent group containing the apartment and the loaded complex. Shadow receivers are bounded by the apartment's transformed outline at floor and ceiling level plus a 0.25 m conservative margin; caster bounds still include the surrounding complex. The loader calls `rig.refreshBounds(shadowModels, receiverBounds)` after attaching the context. This retains off-screen buildings without spending the apartment's shadow texture resolution on distant ground.

Hiding the context changes its material write masks only within each colour draw, then restores them in `onAfterRender`. The original `onBeforeRender` and `onAfterRender` hooks remain chained. No shadow callback is changed, and the real context root remains visible to the shadow traversal. Detached low-detail plant meshes receive the same hook before Three attaches them during the first LOD update. This avoids replacing material references held by the seasonal and night-lighting controllers, including later-created LOD fade materials.

## UI and diagnostics

One `.apt-solar-panel` contains `[data-date]`, `[data-time]`, `[data-range]`, `[data-month="0..11"]`, `[data-solar-event="rise|noon|set"]`, `[data-now]`, `[data-lamp]`, `[data-context-status]`, and `[data-context-retry]`. During a tour, “Солнце и время” in `.apt-tour-actions` opens the same panel inside the viewport. `[data-solar-close]` or Escape closes it. Camera motion pauses while this panel is open, and date/time arrow keys do not move the camera. Controls have a 44 px minimum height.

`#model-viewport.apartmentViewer` exposes `rig`, `receiverBounds`, `getSolar()`, `setSolar(day, minutes)`, `complex`, `contextState`, and the existing `environment()` readiness promise. `scene.userData.solar` records date, time, time zone, coordinates, actual azimuth, apparent/geometric elevation, direction, context readiness, clear-sky state, and the inspection lamp state. The panel also mirrors date/time/angles in data attributes.

## Verification

`node tools/qa/apartments.mjs` passes for both furnished and empty apartments: all 12 rooms remain reachable, the windows and walls remain physical boundaries, and the original floor registration and batching checks pass.

`node tools/qa-v31/apartment-solar-check.mjs` passes and writes `apartment-solar-check.json`:

- Every original geometry attribute, index, and transform in both apartments matches v30 exactly.
- Six opaque proxies per apartment share the original geometry and preserve full-wall/walking visibility semantics.
- Vertical rays over all 12 rooms hit the retained ceiling. One clear pane sampled on each of the 13 original window segments passes its ray; rays through the corresponding opaque frames remain blocked.
- All 21 transparent glass meshes have opaque shadow casting disabled.
- Shared source/proxy geometry is disposed exactly once.
- All nine own-tower casters receive finite aperture depth and distance materials; the two bent infill shadow materials retain their curved geometry.
- 1,819 simulated colour draws, including 16 lazily created LOD fade materials, restore the exact original material write masks. Shadow callbacks remain unchanged.

These are CPU geometry, shader construction, lifecycle, and callback checks. They do not claim native GPU pixel verification or a measured frame-rate improvement. Native browser verification should additionally compare the shared clock after returning from the apartment, walk-mode panel operation, shader compilation, context-hidden shadows, and summer/winter/near-horizon frames.
