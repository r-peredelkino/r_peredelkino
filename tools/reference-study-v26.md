# Reference refinement 26 — 2026-10-10

This continues the installed and checksum-verified v25; it does not replace
the v25 source catalogue or claim new surveying/BIM evidence.

| Evidence | Change | Constraint |
| --- | --- | --- |
| User 12.03.36 / 39 / 41 | Residential timber decking, low edge planting and white lounge chairs | Keep original terrace outlines, office finish, source furniture and walking elevations |
| User 12.03.36 / 39 / 41 | Adjacent panes share a continuous commercial interior | Visual groups are not legal tenant boundaries; retain two storeys, doors, fascia and authored details |
| User 12.03.33 / 41 | Three service units and low branching ducts near the arena | Validate the actual meshes on the service roof; do not occupy terraces or arena relief |
| User 12.03.41 / 43 / 45 | Cafe groups align to the outer retail contour | Preserve existing street planting; reserve furniture, lamps and office entrance access |
| User 12.03.04 / 07, official sport-left.webp | Separate open garden lounge | Keep the existing anchor relative to the main event ring |
| User 12.03.07 / 09, official sport-left.webp | Concave Sport Point, garden projection, two tables and remote panna end | Use one geometric source for surface, edging, planting cuts and collisions |

Two inspection defects are also corrected: facade navigation previously
hard-coded tower 1; floor navigation previously discarded the selected
apartment ID. The latter keeps the published SVG paths as provided and
does not invent missing slot 13 for apartments 5-1403 and 5-1416.

Geometry checks use the actual model vertices and walking worlds. Courtyard
polygon subtraction is independently compared with Shapely, including
partial cuts, holes, splits and the production garden contours. Visual QA
uses the unchanged v25 camera coordinates on the user's Apple M2.

Original architectural references, third-party libraries and @r_peredelkino
authorship remain attributed. Numeric placements here are reconstructed
model values, not measured construction documentation.
