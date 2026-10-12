// @r_peredelkino · public forecourt, supplied references 12.03.43 / 12.03.45, 09.10.2026.
// The opaque cube, three-lobed canopy and luminous poles are visible forms.
// Their unlabelled functions and unseen interior are deliberately not assigned.
import * as THREE from './vendor/three.module.js';

const replacementIds = ['office-plaza', 'front-lounge'];

function worldPoint(anchor, u, v) {
  const c = Math.cos(anchor.angle), s = Math.sin(anchor.angle);
  return [anchor.x + c * u + s * v, anchor.z - s * u + c * v];
}

function rectangleFootprint(anchor, width, depth) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
    worldPoint(anchor, u * width / 2, v * depth / 2));
}

export function publicPlazaProgramLayout(data) {
  const source = data?.pavilions?.find(p => p.id === 'office-plaza');
  const anchor = {
    x: source?.x ?? 10.765, z: source?.z ?? -89.961,
    angle: source?.angle ?? -2.3422286215056185,
  };
  // u follows the frontage toward residential building 1; v points toward the street.
  const at = (u, v) => {
    const [x, z] = worldPoint(anchor, u, v);
    return {x, z, angle: anchor.angle};
  };
  return {
    anchor,
    cube: {...anchor, width: source?.width ?? 6.5, depth: source?.depth ?? 6.5, height: 4.2},
    canopy: {...at(15, 14), width: 5.05, depth: 4.15, roofHeight: 2.82, roofThickness: .14},
    media: {...at(-9, -10), rows: 3, columns: 4, spacing: 1.3},
    replacePavilionIds: [...replacementIds],
  };
}

export function addPublicPlazaProgram(group, {materials, data}) {
  const layout = publicPlazaProgramLayout(data);
  const meshes = [], colliders = [];
  const cubeMaterial = materials.white.clone();
  cubeMaterial.name = 'Reference forecourt cube, quiet mineral grey';
  cubeMaterial.color.set(0xa8a39b);
  cubeMaterial.roughness = .74;
  cubeMaterial.metalness = .08;

  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.noAutomaticCollider = true;
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  const box = (anchor, u, v, y, width, height, depth, material, name) => {
    const [x, z] = worldPoint(anchor, u, v);
    const mesh = add(new THREE.BoxGeometry(width, height, depth), material, name);
    mesh.position.set(x, y + height / 2, z);
    mesh.rotation.y = anchor.angle;
    return mesh;
  };
  const pole = (anchor, u, v, bottom, height, radius, material, name) => {
    const [x, z] = worldPoint(anchor, u, v);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, height, 8), material, name);
    mesh.position.set(x, bottom + height / 2, z);
    return mesh;
  };
  const planSlab = (anchor, points, bottom, height, material, name, bevel = 0) => {
    const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, -v)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: bevel > 0,
      bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 24,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = add(geometry, material, name);
    mesh.position.set(anchor.x, bottom, anchor.z);
    mesh.rotation.y = anchor.angle;
    return mesh;
  };
  const line = (points, radius, material, name) => add(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * 2), radius, 6, false),
    material, name);

  // A closed, flat-roofed volume replaces the open four-post placeholder.
  const cube = layout.cube;
  box(cube, 0, 0, .015, cube.width, cube.height, cube.depth, cubeMaterial, 'Opaque reference forecourt cube');
  box(cube, 0, 0, cube.height + .015, cube.width + .06, .075, cube.depth + .06,
    materials.white, 'Thin level cap of reference cube');
  // Very fine panel joints retain the smooth silhouette of the reference.
  for (const side of [-1, 1]) {
    for (let i = 1; i <= 3; i++) {
      box(cube, -cube.width / 2 + cube.width * i / 4, side * (cube.depth / 2 + .002), .11,
        .008, cube.height - .2, .004, materials.bronze || materials.dark, 'Cube panel joint');
      box(cube, side * (cube.width / 2 + .002), -cube.depth / 2 + cube.depth * i / 4, .11,
        .004, cube.height - .2, .008, materials.bronze || materials.dark, 'Cube panel joint');
    }
  }
  colliders.push({type: 'box', x: cube.x, z: cube.z, width: cube.width + .008,
    depth: cube.depth + .008, angle: cube.angle});

  // One continuous three-lobed roof; the space below stays open between real supports.
  const canopy = layout.canopy;
  const unscaled = Array.from({length: 96}, (_, i) => {
    const a = i / 96 * Math.PI * 2;
    const r = 1.64 + .43 * Math.cos(3 * (a + Math.PI / 2));
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const minU = Math.min(...unscaled.map(p => p[0])), maxU = Math.max(...unscaled.map(p => p[0]));
  const minV = Math.min(...unscaled.map(p => p[1])), maxV = Math.max(...unscaled.map(p => p[1]));
  const roofPoints = unscaled.map(([u, v]) => [
    (u - (minU + maxU) / 2) * canopy.width / (maxU - minU),
    (v - (minV + maxV) / 2) * canopy.depth / (maxV - minV),
  ]);
  planSlab(canopy, roofPoints, canopy.roofHeight, canopy.roofThickness,
    materials.dark, 'Continuous blue-grey three-lobed canopy', .025);

  const supports = [[-1.8, .65], [1.8, .65], [0, -1.55]];
  for (const [u, v] of supports) {
    pole(canopy, u, v, .025, canopy.roofHeight - .025, .043, materials.white, 'Slender canopy support');
    const [x, z] = worldPoint(canopy, u, v);
    colliders.push({type: 'circle', x, z, radius: .043});
  }

  const rings = [[-1.58, .63], [0, -.82], [1.58, .63]];
  const ringMetadata = [];
  for (const [u, v] of rings) {
    const [x, z] = worldPoint(canopy, u, v), y = 1.18;
    const frame = add(new THREE.TorusGeometry(.60, .064, 8, 40),
      materials.white, 'Structural frame of luminous circle');
    frame.position.set(x, y, z);
    frame.rotation.y = canopy.angle;
    for (const side of [-1, 1]) {
      const [lx, lz] = worldPoint(canopy, u, v + side * .047);
      const glow = add(new THREE.TorusGeometry(.599, .026, 6, 40),
        materials.pink, 'Luminous circular strip beneath canopy');
      glow.position.set(lx, y, lz);
      glow.rotation.y = canopy.angle;
      glow.castShadow = false;
    }
    pole(canopy, u, v, y + .62, canopy.roofHeight - y - .62, .022,
      materials.white, 'Fine ring suspension');
    // The circle is below head height; its narrow physical plane is a barrier.
    const a = worldPoint(canopy, u - .591, v), b = worldPoint(canopy, u + .591, v);
    colliders.push({type: 'segment', a, b, radius: .073});
    ringMetadata.push({center: [x, y, z], outerRadius: .664, planeAngle: canopy.angle});
  }

  // Light columns are separate thin objects with open pedestrian gaps, not a solid field.
  const media = layout.media, mediaMetadata = [];
  for (let row = 0; row < media.rows; row++) for (let col = 0; col < media.columns; col++) {
    const u = (col - (media.columns - 1) / 2) * media.spacing;
    const v = (row - (media.rows - 1) / 2) * media.spacing + (col % 2 ? .17 : -.17);
    const height = 1.88 + .24 * ((col + row * 2) % 4);
    pole(media, u, v, .018, .10, .08, materials.dark, 'Small base of luminous column');
    pole(media, u, v, .118, height * .48, .033, materials.cyan, 'Cyan luminous column segment');
    pole(media, u, v, .118 + height * .48, height * .52, .033,
      (col + row) % 3 === 0 ? materials.warm : materials.pink, 'Upper luminous column segment');
    const [x, z] = worldPoint(media, u, v);
    colliders.push({type: 'circle', x, z, radius: .08});
    mediaMetadata.push({x, z, height: .118 + height, radius: .08});
  }
  const coil = Array.from({length: 61}, (_, i) => {
    const t = i / 60, u = 2.42 * Math.sin(t * Math.PI * 3), v = (t - .5) * 4.6;
    const [x, z] = worldPoint(media, u, v);
    return new THREE.Vector3(x, .024, z);
  });
  const inlay = line(coil, .025, materials.pink, 'Flush luminous curve between media poles');
  inlay.castShadow = false;

  const metadata = {
    reference: ['2026-10-09 12.03.43', '2026-10-09 12.03.45'],
    coordinates: 'Metres in the existing model; relative offsets calibrated to the visible forecourt composition.',
    cube: {...cube, outer: rectangleFootprint(cube, cube.width + .008, cube.depth + .008)},
    canopy: {...canopy, outer: roofPoints.map(([u, v]) => worldPoint(canopy, u, v)),
      clearHeight: canopy.roofHeight - .025, rings: ringMetadata,
      supports: supports.map(([u, v]) => worldPoint(canopy, u, v))},
    media: {...media, poles: mediaMetadata},
    walkChecks: [
      ['cubeFront', [-5, 5], [5, 5]],
      ['cubeBack', [-5, -5], [5, -5]],
      ['canopyApproach', [11, 14], [12, 14]],
      ['mediaAisle', [-9, -13], [-9, -7]],
    ].map(([name, from, to]) => ({name,
      from: worldPoint(layout.anchor, ...from), to: worldPoint(layout.anchor, ...to)})),
  };
  return {meshes, colliders, metadata, layout,
    replacePavilionIds: [...replacementIds], ownedMaterials: [cubeMaterial]};
}
