import * as THREE from 'three';
import { TextureBundle } from './campusTextures.ts';

export interface CampusSceneRefs {
  root: THREE.Group;
  palmCrowns: THREE.Group[];
  flagMesh: THREE.Mesh | null;
  windowMaterials: THREE.MeshPhysicalMaterial[];
  lampBulbs: THREE.MeshStandardMaterial[];
  domeFloodLights: THREE.PointLight[];
  dispose: () => void;
}

class AssetRegistry {
  geos: THREE.BufferGeometry[] = [];
  mats: THREE.Material[] = [];

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}

function addRealWindowGrid(
  parent: THREE.Group,
  reg: AssetRegistry,
  glassMat: THREE.MeshPhysicalMaterial,
  frameMat: THREE.Material,
  config: {
    faceWidth: number;
    floors: number;
    bays: number;
    floorHeight: number;
    startY: number;
    zOffset: number;
    rotY?: number;
    xOffset?: number;
    ledgeColor?: number;
    ledgeMat?: THREE.Material;
    bayPadding?: number;
  }
) {
  const {
    faceWidth,
    floors,
    bays,
    floorHeight,
    startY,
    zOffset,
    rotY = 0,
    xOffset = 0,
    ledgeMat,
    bayPadding = 0.35,
  } = config;

  const group = new THREE.Group();
  group.position.set(xOffset, 0, zOffset);
  group.rotation.y = rotY;

  const usableW = faceWidth - bayPadding * 2;
  const bayW = usableW / bays;
  const winW = bayW * 0.64;
  const winH = floorHeight * 0.56;

  const winGeo = reg.geo(new THREE.BoxGeometry(winW, winH, 0.08));
  const sillGeo = reg.geo(new THREE.BoxGeometry(winW + 0.14, 0.09, 0.16));
  const pierGeo = reg.geo(new THREE.BoxGeometry(bayW * 0.24, floors * floorHeight, 0.18));

  // Vertical piers between bays
  for (let b = 0; b <= bays; b++) {
    const px = -usableW / 2 + b * bayW;
    const pier = new THREE.Mesh(pierGeo, frameMat);
    pier.position.set(px, startY + (floors * floorHeight) / 2, 0.04);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
  }

  for (let f = 0; f < floors; f++) {
    const cy = startY + f * floorHeight + floorHeight * 0.54;

    if (ledgeMat) {
      const ledgeGeo = reg.geo(new THREE.BoxGeometry(faceWidth + 0.22, 0.2, 0.34));
      const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
      ledge.position.set(0, startY + f * floorHeight + 0.08, 0.14);
      ledge.castShadow = true;
      ledge.receiveShadow = true;
      group.add(ledge);
    }

    for (let b = 0; b < bays; b++) {
      const wx = -usableW / 2 + (b + 0.5) * bayW;
      const pane = new THREE.Mesh(winGeo, glassMat);
      pane.position.set(wx, cy, 0.02);
      group.add(pane);

      const sill = new THREE.Mesh(sillGeo, frameMat);
      sill.position.set(wx, cy - winH * 0.52, 0.06);
      group.add(sill);
    }
  }

  parent.add(group);
}

function addSolarArrayBank(
  parent: THREE.Group,
  reg: AssetRegistry,
  solarMat: THREE.Material,
  metalMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rows: number,
  cols: number,
  panelW = 1.65,
  panelD = 0.95
) {
  const bank = new THREE.Group();
  bank.position.set(x, y, z);
  const pGeo = reg.geo(new THREE.BoxGeometry(panelW, 0.05, panelD));
  const legGeo = reg.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = (c - (cols - 1) / 2) * (panelW + 0.2);
      const pz = (r - (rows - 1) / 2) * (panelD + 0.32);

      const panel = new THREE.Mesh(pGeo, solarMat);
      panel.position.set(px, 0.24, pz);
      panel.rotation.x = 0.34;
      panel.castShadow = true;
      bank.add(panel);

      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(px, 0.14, pz);
      bank.add(leg);
    }
  }
  parent.add(bank);
}

function buildMainAcademicBlock(
  reg: AssetRegistry,
  tex: TextureBundle,
  windowMat: THREE.MeshPhysicalMaterial,
  curtainGlassMat: THREE.MeshPhysicalMaterial
): THREE.Group {
  const group = new THREE.Group();
  // Positioned front-right matching the aerial photograph
  group.position.set(7.6, 0, 2.2);
  group.rotation.y = 0.2;

  const stuccoWhite = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xf5f6f3,
      roughness: 0.84,
      roughnessMap: tex.stuccoRoughness,
      metalness: 0.02,
    })
  );
  const warmStone = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xe6e5df,
      roughness: 0.86,
      metalness: 0.02,
    })
  );
  const mintLedge = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0x67c796,
      roughness: 0.56,
      metalness: 0.05,
    })
  );
  const blueTrim = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.45,
      metalness: 0.08,
    })
  );
  const roofMetal = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.metalRoofColor,
      color: 0xf8fafc,
      roughness: 0.36,
      metalness: 0.25,
    })
  );
  const darkColonnade = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.78,
      metalness: 0.08,
    })
  );

  // Dimensions of the 5-story Main Block: 12.6 wide x 15.8 deep x 8.2 tall
  const W = 12.6;
  const D = 15.8;
  const H = 8.2;

  // Plinth base
  const plinth = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(W + 0.5, 0.25, D + 0.5)),
    warmStone
  );
  plinth.position.y = 0.125;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Ground-floor recessed colonnade core + exterior columns
  const groundCore = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(W - 1.1, 1.55, D - 1.1)),
    darkColonnade
  );
  groundCore.position.y = 0.25 + 0.775;
  groundCore.castShadow = true;
  groundCore.receiveShadow = true;
  group.add(groundCore);

  const colGeo = reg.geo(new THREE.BoxGeometry(0.32, 1.6, 0.32));
  for (let i = 0; i <= 8; i++) {
    const cx = -W / 2 + 0.35 + (i / 8) * (W - 0.7);
    const frontCol = new THREE.Mesh(colGeo, stuccoWhite);
    frontCol.position.set(cx, 1.05, D / 2 - 0.22);
    frontCol.castShadow = true;
    group.add(frontCol);
  }
  for (let i = 1; i <= 7; i++) {
    const cz = -D / 2 + 0.4 + (i / 8) * (D - 0.8);
    const sideCol = new THREE.Mesh(colGeo, stuccoWhite);
    sideCol.position.set(W / 2 - 0.22, 1.05, cz);
    sideCol.castShadow = true;
    group.add(sideCol);
  }

  // Upper 4.5-story Main Mass
  const upperMass = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(W, H - 1.85, D)),
    stuccoWhite
  );
  upperMass.position.y = 1.85 + (H - 1.85) / 2;
  upperMass.castShadow = true;
  upperMass.receiveShadow = true;
  group.add(upperMass);

  // Raised Parapet Framing Walls around the white standing-seam auditorium roof
  const parapetH = 0.72;
  const parapetThick = 0.48;
  const fbParapetGeo = reg.geo(new THREE.BoxGeometry(W + 0.12, parapetH, parapetThick));
  const lrParapetGeo = reg.geo(new THREE.BoxGeometry(parapetThick, parapetH, D + 0.12));

  const frontP = new THREE.Mesh(fbParapetGeo, stuccoWhite);
  frontP.position.set(0, H + parapetH / 2, D / 2 - parapetThick / 2);
  frontP.castShadow = true;
  group.add(frontP);

  const backP = new THREE.Mesh(fbParapetGeo, stuccoWhite);
  backP.position.set(0, H + parapetH / 2, -D / 2 + parapetThick / 2);
  backP.castShadow = true;
  group.add(backP);

  const leftP = new THREE.Mesh(lrParapetGeo, stuccoWhite);
  leftP.position.set(-W / 2 + parapetThick / 2, H + parapetH / 2, 0);
  leftP.castShadow = true;
  group.add(leftP);

  const rightP = new THREE.Mesh(lrParapetGeo, stuccoWhite);
  rightP.position.set(W / 2 - parapetThick / 2, H + parapetH / 2, 0);
  rightP.castShadow = true;
  group.add(rightP);

  // Vaulted/Pitched White Standing-Seam Auditorium Roof inside the parapets
  const ridgeGeo = reg.geo(new THREE.CylinderGeometry(0.4, 1, D - 1.6, 4, 1));
  // Better: clean extruded gable/trapezoidal auditorium roof
  const roofShape = new THREE.Shape();
  const halfRW = (W - 1.2) / 2;
  roofShape.moveTo(-halfRW, 0);
  roofShape.lineTo(0, 1.05);
  roofShape.lineTo(halfRW, 0);
  roofShape.lineTo(-halfRW, 0);
  const audRoofGeo = reg.geo(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: D - 1.4,
      bevelEnabled: false,
    })
  );
  audRoofGeo.translate(0, 0, -(D - 1.4) / 2);
  const audRoof = new THREE.Mesh(audRoofGeo, roofMetal);
  audRoof.position.set(0, H - 0.12, 0);
  audRoof.castShadow = true;
  audRoof.receiveShadow = true;
  group.add(audRoof);
  ridgeGeo.dispose();

  // Front-Left & Front-Right 5-Story Blue-Glass Curtain Wall Corner Towers
  const towerGlassGeo = reg.geo(new THREE.BoxGeometry(1.55, H - 1.1, 1.55));
  const frontRightTower = new THREE.Mesh(towerGlassGeo, curtainGlassMat);
  frontRightTower.position.set(W / 2 - 0.72, 1.1 + (H - 1.1) / 2, D / 2 - 0.72);
  frontRightTower.castShadow = true;
  group.add(frontRightTower);

  // White structural corner pier framing the glass tower
  const cornerPier = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(0.58, H + 0.9, 0.58)),
    stuccoWhite
  );
  cornerPier.position.set(W / 2 - 0.18, (H + 0.9) / 2, D / 2 - 0.18);
  cornerPier.castShadow = true;
  group.add(cornerPier);

  // Left-front corner stairwell tower
  const leftCorner = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.75, H + 0.85, 1.75)),
    stuccoWhite
  );
  leftCorner.position.set(-W / 2 + 0.88, (H + 0.85) / 2, D / 2 - 0.88);
  leftCorner.castShadow = true;
  group.add(leftCorner);

  // Rooftop Stair Penthouse / Water Tank Structure
  const penthouse = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(2.2, 1.0, 2.0)),
    warmStone
  );
  penthouse.position.set(W / 2 - 1.6, H + 0.5, D / 2 - 1.6);
  penthouse.castShadow = true;
  group.add(penthouse);

  // Front Facade 5-Story Window Grid + Mint-Green Horizontal Bands
  addRealWindowGrid(group, reg, windowMat, stuccoWhite, {
    faceWidth: W - 2.6,
    floors: 4,
    bays: 9,
    floorHeight: 1.5,
    startY: 1.85,
    zOffset: D / 2 + 0.02,
    xOffset: -0.2,
    ledgeMat: mintLedge,
  });

  // Ground-to-first mint canopy awning
  const entryCanopy = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(W - 2.1, 0.22, 0.95)),
    mintLedge
  );
  entryCanopy.position.set(-0.2, 1.78, D / 2 + 0.42);
  entryCanopy.castShadow = true;
  group.add(entryCanopy);

  // Left Facade (facing courtyard)
  addRealWindowGrid(group, reg, windowMat, stuccoWhite, {
    faceWidth: D - 2.4,
    floors: 4,
    bays: 10,
    floorHeight: 1.5,
    startY: 1.85,
    zOffset: 0,
    xOffset: -W / 2 - 0.02,
    rotY: -Math.PI / 2,
    ledgeMat: mintLedge,
  });

  // Right Facade (facing driveway & dome pavilion)
  addRealWindowGrid(group, reg, windowMat, stuccoWhite, {
    faceWidth: D - 2.4,
    floors: 4,
    bays: 10,
    floorHeight: 1.5,
    startY: 1.85,
    zOffset: 0,
    xOffset: W / 2 + 0.02,
    rotY: Math.PI / 2,
  });

  // Rear Facade
  addRealWindowGrid(group, reg, windowMat, stuccoWhite, {
    faceWidth: W - 1.8,
    floors: 4,
    bays: 8,
    floorHeight: 1.5,
    startY: 1.85,
    zOffset: -D / 2 - 0.02,
    rotY: Math.PI,
  });

  // Rear-Right Sky-Blue Terraced Annex (prominent in the photo between Main Block & Dome!)
  const annex = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.4, 5.4, 5.4)),
    stuccoWhite
  );
  annex.position.set(W / 2 + 1.8, 2.7, -D / 2 + 2.8);
  annex.castShadow = true;
  annex.receiveShadow = true;
  group.add(annex);

  const annexBlueRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.6, 0.24, 5.6)),
    blueTrim
  );
  annexBlueRoof.position.set(W / 2 + 1.8, 5.5, -D / 2 + 2.8);
  annexBlueRoof.castShadow = true;
  group.add(annexBlueRoof);

  addRealWindowGrid(group, reg, windowMat, stuccoWhite, {
    faceWidth: 4.0,
    floors: 3,
    bays: 4,
    floorHeight: 1.45,
    startY: 0.7,
    zOffset: -D / 2 + 5.52,
    xOffset: W / 2 + 1.8,
    ledgeMat: mintLedge,
  });

  return group;
}

function buildMarblePavilion(
  reg: AssetRegistry,
  tex: TextureBundle,
  lampBulbs: THREE.MeshStandardMaterial[],
  domeFloodLights: THREE.PointLight[]
): THREE.Group {
  const group = new THREE.Group();
  // Positioned to the right-rear of the Main Block just like in the aerial photo
  group.position.set(17.8, 0, -7.8);
  group.rotation.y = -0.35;

  const marbleMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xf7f8fa,
      roughness: 0.34,
      metalness: 0.04,
    })
  );
  const marbleArchMat = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.marbleArchColor,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.03,
    })
  );
  const brassMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xd4a437,
      roughness: 0.22,
      metalness: 0.88,
    })
  );

  // 1. Raised Marble Plinth Platform + Front Steps
  const plinth = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(8.6, 0.6, 8.6)),
    marbleMat
  );
  plinth.position.y = 0.3;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      reg.geo(new THREE.BoxGeometry(3.8 - s * 0.2, 0.18, 0.9 - s * 0.22)),
      marbleMat
    );
    step.position.set(0, 0.09 + s * 0.17, 4.45 - s * 0.15);
    step.receiveShadow = true;
    group.add(step);
  }

  // 2. Main Cube Sanctum with Arched Facades on all 4 sides
  const bodyW = 6.2;
  const bodyH = 4.6;
  const body = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(bodyW, bodyH, bodyW)),
    marbleArchMat
  );
  body.position.y = 0.6 + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Ornamental cornice & parapet trim
  const cornice = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(bodyW + 0.35, 0.32, bodyW + 0.35)),
    marbleMat
  );
  cornice.position.y = 0.6 + bodyH + 0.16;
  cornice.castShadow = true;
  group.add(cornice);

  // Central Front & Side Pishtaq (raised portal pediments)
  const pishtaqGeo = reg.geo(new THREE.BoxGeometry(2.3, 0.95, 0.35));
  const pishtaqPos: Array<[number, number, number]> = [
    [0, bodyW / 2 + 0.05, 0],
    [0, -bodyW / 2 - 0.05, Math.PI],
    [bodyW / 2 + 0.05, 0, Math.PI / 2],
    [-bodyW / 2 - 0.05, 0, -Math.PI / 2],
  ];
  for (const [px, pz, rotY] of pishtaqPos) {
    const p = new THREE.Mesh(pishtaqGeo, marbleMat);
    p.position.set(px, 0.6 + bodyH + 0.45, pz);
    p.rotation.y = rotY;
    p.castShadow = true;
    group.add(p);
  }

  // 3. Signature Bulbous Onion Dome (LatheGeometry) on Cylindrical Drum
  const drum = new THREE.Mesh(
    reg.geo(new THREE.CylinderGeometry(1.75, 1.82, 1.1, 32)),
    marbleMat
  );
  drum.position.y = 0.6 + bodyH + 0.72;
  drum.castShadow = true;
  group.add(drum);

  const domePoints: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r: number;
    let y: number;
    if (t < 0.38) {
      // Swell outward like a Mughal onion dome
      const s = t / 0.38;
      r = 1.72 + Math.sin(s * Math.PI * 0.5) * 0.36;
      y = s * 1.15;
    } else if (t < 0.88) {
      // Smoothly curve inward to lotus neck
      const s = (t - 0.38) / 0.5;
      r = 2.08 * Math.cos(s * Math.PI * 0.47);
      y = 1.15 + Math.sin(s * Math.PI * 0.5) * 1.85;
    } else {
      // Inverted lotus crown tapering to spire base
      const s = (t - 0.88) / 0.12;
      r = Math.max(0.02, 0.24 * (1 - s));
      y = 3.0 + s * 0.35;
    }
    domePoints.push(new THREE.Vector2(r, y));
  }
  const onionDomeGeo = reg.geo(new THREE.LatheGeometry(domePoints, 40));
  const onionDome = new THREE.Mesh(onionDomeGeo, marbleMat);
  onionDome.position.y = 0.6 + bodyH + 1.24;
  onionDome.castShadow = true;
  onionDome.receiveShadow = true;
  group.add(onionDome);

  // Brass Kalash Finial Spire
  const finial = new THREE.Mesh(
    reg.geo(new THREE.CylinderGeometry(0.02, 0.07, 1.15, 12)),
    brassMat
  );
  finial.position.y = 0.6 + bodyH + 4.95;
  group.add(finial);

  const kalashOrb = new THREE.Mesh(
    reg.geo(new THREE.SphereGeometry(0.16, 16, 12)),
    brassMat
  );
  kalashOrb.position.y = 0.6 + bodyH + 4.65;
  group.add(kalashOrb);

  // 4. Four Corner Chhatris + 4 Tall Slender Corner Minarets on Plinth
  const chhatriOffsets: Array<[number, number]> = [
    [-2.1, -2.1],
    [2.1, -2.1],
    [-2.1, 2.1],
    [2.1, 2.1],
  ];
  for (const [cx, cz] of chhatriOffsets) {
    const chBase = new THREE.Mesh(
      reg.geo(new THREE.CylinderGeometry(0.55, 0.58, 0.72, 12)),
      marbleMat
    );
    chBase.position.set(cx, 0.6 + bodyH + 0.55, cz);
    group.add(chBase);

    const chDome = new THREE.Mesh(
      reg.geo(new THREE.SphereGeometry(0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)),
      marbleMat
    );
    chDome.position.set(cx, 0.6 + bodyH + 0.85, cz);
    chDome.castShadow = true;
    group.add(chDome);
  }

  const minaretOffsets: Array<[number, number]> = [
    [-3.85, -3.85],
    [3.85, -3.85],
    [-3.85, 3.85],
    [3.85, 3.85],
  ];
  for (const [mx, mz] of minaretOffsets) {
    const mShaft = new THREE.Mesh(
      reg.geo(new THREE.CylinderGeometry(0.24, 0.34, 5.2, 16)),
      marbleMat
    );
    mShaft.position.set(mx, 0.6 + 2.6, mz);
    mShaft.castShadow = true;
    group.add(mShaft);

    for (const ry of [2.1, 3.8, 5.35]) {
      const ring = new THREE.Mesh(
        reg.geo(new THREE.CylinderGeometry(0.4, 0.36, 0.14, 16)),
        marbleMat
      );
      ring.position.set(mx, 0.6 + ry, mz);
      group.add(ring);
    }

    const mCupola = new THREE.Mesh(
      reg.geo(new THREE.SphereGeometry(0.32, 16, 12)),
      marbleMat
    );
    mCupola.position.set(mx, 0.6 + 5.72, mz);
    group.add(mCupola);

    const mSpire = new THREE.Mesh(
      reg.geo(new THREE.ConeGeometry(0.06, 0.45, 8)),
      brassMat
    );
    mSpire.position.set(mx, 0.6 + 6.1, mz);
    group.add(mSpire);
  }

  // Evening floodlight glow for the marble pavilion
  const floodMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4a3,
      emissive: 0xffd27a,
      emissiveIntensity: 0,
      roughness: 0.3,
    })
  );
  lampBulbs.push(floodMat);
  const floodLight = new THREE.PointLight(0xffd796, 0, 18, 1.5);
  floodLight.position.set(0, 7.6, 4.2);
  group.add(floodLight);
  domeFloodLights.push(floodLight);

  return group;
}

function buildWestCampusWings(
  reg: AssetRegistry,
  tex: TextureBundle,
  windowMat: THREE.MeshPhysicalMaterial,
  curtainGlassMat: THREE.MeshPhysicalMaterial
): THREE.Group {
  const group = new THREE.Group();

  const whiteStucco = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f5f0,
      roughness: 0.84,
      roughnessMap: tex.stuccoRoughness,
      metalness: 0.02,
    })
  );
  const pastelMint = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x7fd8b8, roughness: 0.68 })
  );
  const pastelBlue = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x7cc4f8, roughness: 0.62 })
  );
  const ochreYellow = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0xf0c965, roughness: 0.78 })
  );
  const coralRed = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.terracottaTile,
      color: 0xd95f43,
      roughness: 0.64,
    })
  );
  const blueRoof = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x2f87d9, roughness: 0.48 })
  );
  const solarMat = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.solarPanelColor,
      roughness: 0.22,
      metalness: 0.55,
    })
  );
  const steelFrameMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.38, metalness: 0.75 })
  );

  // ---------------------------------------------------------------
  // 1. Foreground-Left L-Shaped 3-Story Building (with blue-glass atrium & rooftop solar)
  // ---------------------------------------------------------------
  const westL = new THREE.Group();
  westL.position.set(-16.5, 0, 1.8);
  westL.rotation.y = 0.24;

  // Main front wing of L
  const wMain = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.4, 4.8, 4.6)),
    whiteStucco
  );
  wMain.position.set(0, 2.4, 0);
  wMain.castShadow = true;
  wMain.receiveShadow = true;
  westL.add(wMain);

  // Pastel floor accents
  const mintBand = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.55, 0.38, 4.75)),
    pastelMint
  );
  mintBand.position.set(0, 1.7, 0);
  westL.add(mintBand);

  const blueBand = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.55, 0.34, 4.75)),
    pastelBlue
  );
  blueBand.position.set(0, 3.25, 0);
  westL.add(blueBand);

  // Terracotta eave border roof
  const eaveMain = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(12.1, 0.38, 5.2)),
    coralRed
  );
  eaveMain.position.set(0, 4.92, 0);
  eaveMain.castShadow = true;
  westL.add(eaveMain);

  // Inner L-arm extending backward
  const wBack = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.8, 4.8, 7.6)),
    whiteStucco
  );
  wBack.position.set(3.3, 2.4, -5.8);
  wBack.castShadow = true;
  wBack.receiveShadow = true;
  westL.add(wBack);

  const eaveBack = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(5.3, 0.38, 8.1)),
    coralRed
  );
  eaveBack.position.set(3.3, 4.92, -5.8);
  eaveBack.castShadow = true;
  westL.add(eaveBack);

  // Signature 3-story Vertical Blue-Glass Atrium Curtain Tower facing courtyard
  const atrium = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(2.1, 5.55, 2.1)),
    curtainGlassMat
  );
  atrium.position.set(4.95, 2.775, 1.65);
  atrium.castShadow = true;
  westL.add(atrium);

  const atriumCap = new THREE.Mesh(
    reg.geo(new THREE.ConeGeometry(1.75, 0.85, 4)),
    coralRed
  );
  atriumCap.position.set(4.95, 5.95, 1.65);
  atriumCap.rotation.y = Math.PI / 4;
  atriumCap.castShadow = true;
  westL.add(atriumCap);

  // Windows on L-wing
  addRealWindowGrid(westL, reg, windowMat, whiteStucco, {
    faceWidth: 9.2,
    floors: 3,
    bays: 7,
    floorHeight: 1.45,
    startY: 0.4,
    zOffset: 2.32,
    xOffset: -0.9,
  });
  addRealWindowGrid(westL, reg, windowMat, whiteStucco, {
    faceWidth: 6.4,
    floors: 3,
    bays: 5,
    floorHeight: 1.45,
    startY: 0.4,
    zOffset: -5.8,
    xOffset: 5.72,
    rotY: Math.PI / 2,
  });

  // Rooftop Solar Panels & Pergola on West L-Wing
  addSolarArrayBank(westL, reg, solarMat, steelFrameMat, -2.5, 5.1, 0, 2, 3);
  addSolarArrayBank(westL, reg, solarMat, steelFrameMat, 3.3, 5.1, -5.8, 3, 2);

  group.add(westL);

  // ---------------------------------------------------------------
  // 2. Mid-Left Ochre-Yellow & Terracotta-Roof 2-Story Wing
  // ---------------------------------------------------------------
  const midWing = new THREE.Group();
  midWing.position.set(-10.2, 0, -8.8);
  midWing.rotation.y = 0.22;

  const midBody = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(8.8, 3.6, 5.4)),
    ochreYellow
  );
  midBody.position.y = 1.8;
  midBody.castShadow = true;
  midBody.receiveShadow = true;
  midWing.add(midBody);

  // Hipped Terracotta Roof
  const hipGeo = reg.geo(new THREE.ConeGeometry(6.6, 1.55, 4));
  const hipRoof = new THREE.Mesh(hipGeo, coralRed);
  hipRoof.position.y = 4.35;
  hipRoof.rotation.y = Math.PI / 4;
  hipRoof.scale.set(1.12, 1, 0.72);
  hipRoof.castShadow = true;
  midWing.add(hipRoof);

  // Courtyard Porch Canopy
  const porchRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(2.4, 0.25, 1.8)),
    coralRed
  );
  porchRoof.position.set(1.2, 2.2, 3.3);
  porchRoof.castShadow = true;
  midWing.add(porchRoof);

  addRealWindowGrid(midWing, reg, windowMat, pastelMint, {
    faceWidth: 7.8,
    floors: 2,
    bays: 6,
    floorHeight: 1.5,
    startY: 0.4,
    zOffset: 2.72,
  });

  group.add(midWing);

  // ---------------------------------------------------------------
  // 3. Rear Blue-Parapet Solar Wing
  // ---------------------------------------------------------------
  const blueSolarWing = new THREE.Group();
  blueSolarWing.position.set(-7.6, 0, -16.8);
  blueSolarWing.rotation.y = 0.18;

  const bsBody = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(10.6, 3.8, 4.4)),
    whiteStucco
  );
  bsBody.position.y = 1.9;
  bsBody.castShadow = true;
  bsBody.receiveShadow = true;
  blueSolarWing.add(bsBody);

  const bsRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(10.9, 0.35, 4.7)),
    blueRoof
  );
  bsRoof.position.y = 3.95;
  bsRoof.castShadow = true;
  blueSolarWing.add(bsRoof);

  addRealWindowGrid(blueSolarWing, reg, windowMat, whiteStucco, {
    faceWidth: 9.6,
    floors: 2,
    bays: 7,
    floorHeight: 1.55,
    startY: 0.45,
    zOffset: 2.22,
  });
  addSolarArrayBank(blueSolarWing, reg, solarMat, steelFrameMat, 0, 4.12, 0, 2, 4);

  group.add(blueSolarWing);

  // ---------------------------------------------------------------
  // 4. Rear U-Shaped Hostel / Senior Quad + Far-Right Rear Block
  // ---------------------------------------------------------------
  const rearQuad = new THREE.Group();
  rearQuad.position.set(-4.2, 0, -25.4);
  rearQuad.rotation.y = 0.16;

  const qBack = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(18.0, 4.2, 4.0)),
    ochreYellow
  );
  qBack.position.set(0, 2.1, -3.2);
  qBack.castShadow = true;
  qBack.receiveShadow = true;
  rearQuad.add(qBack);

  const qBackRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(18.5, 0.36, 4.5)),
    coralRed
  );
  qBackRoof.position.set(0, 4.35, -3.2);
  rearQuad.add(qBackRoof);

  const qLeft = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(3.8, 4.2, 7.0)),
    whiteStucco
  );
  qLeft.position.set(-7.1, 2.1, 1.5);
  qLeft.castShadow = true;
  rearQuad.add(qLeft);

  const qLeftRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.2, 0.36, 7.4)),
    coralRed
  );
  qLeftRoof.position.set(-7.1, 4.35, 1.5);
  rearQuad.add(qLeftRoof);

  const qRight = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.2, 4.4, 7.4)),
    whiteStucco
  );
  qRight.position.set(7.0, 2.2, 1.5);
  qRight.castShadow = true;
  rearQuad.add(qRight);

  const qRightRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.6, 0.36, 7.8)),
    coralRed
  );
  qRightRoof.position.set(7.0, 4.55, 1.5);
  rearQuad.add(qRightRoof);

  addRealWindowGrid(rearQuad, reg, windowMat, whiteStucco, {
    faceWidth: 16.4,
    floors: 2,
    bays: 11,
    floorHeight: 1.65,
    startY: 0.5,
    zOffset: -1.18,
  });
  addSolarArrayBank(rearQuad, reg, solarMat, steelFrameMat, 0, 4.52, -3.2, 1, 6);

  group.add(rearQuad);

  // Far-Right Rear White & Mint Academic/Hostel Wing (behind marble dome)
  const farRight = new THREE.Group();
  farRight.position.set(22.5, 0, -21.5);
  farRight.rotation.y = -0.3;

  const frBody = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.2, 4.6, 4.8)),
    whiteStucco
  );
  frBody.position.y = 2.3;
  frBody.castShadow = true;
  frBody.receiveShadow = true;
  farRight.add(frBody);

  const frMint = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.35, 0.35, 4.95)),
    pastelMint
  );
  frMint.position.y = 2.4;
  farRight.add(frMint);

  const frRoof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(11.6, 0.34, 5.2)),
    coralRed
  );
  frRoof.position.y = 4.75;
  farRight.add(frRoof);

  addRealWindowGrid(farRight, reg, windowMat, whiteStucco, {
    faceWidth: 10.2,
    floors: 3,
    bays: 8,
    floorHeight: 1.35,
    startY: 0.35,
    zOffset: 2.42,
  });

  group.add(farRight);

  return group;
}

function buildEntranceGateAndWalls(
  reg: AssetRegistry,
  tex: TextureBundle,
  lampBulbs: THREE.MeshStandardMaterial[]
): { group: THREE.Group; flagMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const wallCream = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.85,
      roughnessMap: tex.stuccoRoughness,
    })
  );
  const redPortico = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.terracottaTile,
      color: 0xd64833,
      roughness: 0.56,
    })
  );
  const wroughtIron = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.72 })
  );
  const tealMural = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.78 })
  );

  // Helper to build perimeter wall segment with spaced pilasters
  const addWallRun = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    useMural = false
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(-dz, dx);

    const seg = new THREE.Group();
    seg.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    seg.rotation.y = angle;

    const wall = new THREE.Mesh(
      reg.geo(new THREE.BoxGeometry(len, 1.35, 0.28)),
      useMural ? tealMural : wallCream
    );
    wall.position.y = 0.675;
    wall.castShadow = true;
    wall.receiveShadow = true;
    seg.add(wall);

    const coping = new THREE.Mesh(
      reg.geo(new THREE.BoxGeometry(len + 0.1, 0.14, 0.36)),
      wallCream
    );
    coping.position.y = 1.4;
    seg.add(coping);

    const postCount = Math.max(2, Math.floor(len / 3.4));
    const postGeo = reg.geo(new THREE.BoxGeometry(0.4, 1.56, 0.42));
    for (let i = 0; i <= postCount; i++) {
      const px = -len / 2 + (i / postCount) * len;
      const post = new THREE.Mesh(postGeo, wallCream);
      post.position.set(px, 0.78, 0);
      post.castShadow = true;
      seg.add(post);
    }

    group.add(seg);
  };

  // Front-left compound wall up to the entrance gate
  addWallRun(-22.5, 8.6, -2.1, 15.8);
  // Front-right mural compound wall from gate toward right driveway
  addWallRun(4.2, 16.3, 14.5, 9.8, true);
  // Right driveway wall
  addWallRun(14.5, 9.8, 25.0, -9.0, false);

  // Grand Main Entrance Gate at (1.1, 0, 16.0)
  const gate = new THREE.Group();
  gate.position.set(1.05, 0, 16.05);
  gate.rotation.y = -0.15;

  // Guardhouse left of gate
  const guardhouse = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(3.2, 2.25, 2.4)),
    reg.mat(new THREE.MeshStandardMaterial({ color: 0xfaf0ca, roughness: 0.82 }))
  );
  guardhouse.position.set(-3.1, 1.125, -0.3);
  guardhouse.castShadow = true;
  gate.add(guardhouse);

  // Left & Right Red-Gabled Gate Pillars
  const pillarGeo = reg.geo(new THREE.BoxGeometry(0.95, 2.65, 0.95));
  const gableGeo = reg.geo(new THREE.ConeGeometry(0.85, 0.85, 4));
  for (const sx of [-1.85, 1.85]) {
    const p = new THREE.Mesh(pillarGeo, wallCream);
    p.position.set(sx, 1.325, 0);
    p.castShadow = true;
    gate.add(p);

    const cap = new THREE.Mesh(gableGeo, redPortico);
    cap.position.set(sx, 3.05, 0);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    gate.add(cap);
  }

  // Overhead Gateway Arch Beam
  const archBeam = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.75, 0.72, 1.05)),
    wallCream
  );
  archBeam.position.set(0, 2.75, 0);
  archBeam.castShadow = true;
  gate.add(archBeam);

  const topTrim = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(4.95, 0.22, 1.15)),
    redPortico
  );
  topTrim.position.set(0, 3.16, 0);
  gate.add(topTrim);

  // Black Wrought-Iron Double Gates
  const gatePanelGeo = reg.geo(new THREE.BoxGeometry(1.42, 1.75, 0.08));
  for (const gx of [-0.74, 0.74]) {
    const panel = new THREE.Mesh(gatePanelGeo, wroughtIron);
    panel.position.set(gx, 0.92, 0);
    gate.add(panel);
  }

  // Gate Flagpole & Waving School Flag
  const pole = new THREE.Mesh(
    reg.geo(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 8)),
    reg.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 }))
  );
  pole.position.set(0, 4.2, 0);
  gate.add(pole);

  const flagGeo = reg.geo(new THREE.PlaneGeometry(0.95, 0.55, 8, 4));
  flagGeo.translate(0.48, 0, 0);
  const flagMesh = new THREE.Mesh(
    flagGeo,
    reg.mat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.65,
        side: THREE.DoubleSide,
      })
    )
  );
  flagMesh.position.set(0, 4.95, 0);
  gate.add(flagMesh);

  // Courtyard Streetlamp Posts (glow warmly in Evening Campus mode)
  const lampMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xffc864,
      emissiveIntensity: 0,
      roughness: 0.25,
    })
  );
  lampBulbs.push(lampMat);

  const lampSpots: Array<[number, number]> = [
    [-2.5, 13.5],
    [3.5, 13.2],
    [-6.5, 8.2],
    [1.8, 6.0],
    [13.8, 4.2],
  ];
  const lPostGeo = reg.geo(new THREE.CylinderGeometry(0.04, 0.06, 2.5, 8));
  const lHeadGeo = reg.geo(new THREE.SphereGeometry(0.16, 10, 8));
  for (const [lx, lz] of lampSpots) {
    const post = new THREE.Mesh(lPostGeo, wroughtIron);
    post.position.set(lx, 1.25, lz);
    group.add(post);

    const bulb = new THREE.Mesh(lHeadGeo, lampMat);
    bulb.position.set(lx, 2.55, lz);
    group.add(bulb);
  }

  group.add(gate);
  return { group, flagMesh };
}

function buildSchoolBus(
  reg: AssetRegistry,
  busYellowMat: THREE.Material,
  darkGlassMat: THREE.Material,
  tireMat: THREE.Material,
  rimMat: THREE.Material
): THREE.Group {
  const bus = new THREE.Group();

  // Lower chassis & body
  const chassis = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.12, 0.22, 3.05)),
    tireMat
  );
  chassis.position.y = 0.28;
  bus.add(chassis);

  const body = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.16, 0.88, 2.95)),
    busYellowMat
  );
  body.position.y = 0.78;
  body.castShadow = true;
  body.receiveShadow = true;
  bus.add(body);

  // Roof cap + AC vents
  const roof = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.06, 0.1, 2.75)),
    reg.mat(new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.45 }))
  );
  roof.position.y = 1.26;
  bus.add(roof);

  // Side window strip & front windshield
  const sideWin = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.18, 0.34, 2.25)),
    darkGlassMat
  );
  sideWin.position.set(0, 0.9, -0.1);
  bus.add(sideWin);

  const windshield = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.02, 0.42, 0.08)),
    darkGlassMat
  );
  windshield.position.set(0, 0.88, 1.46);
  bus.add(windshield);

  // Front & rear bumpers
  const bumper = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(1.2, 0.14, 0.12)),
    tireMat
  );
  bumper.position.set(0, 0.34, 1.52);
  bus.add(bumper);

  // 4 Grounded Wheels
  const tireGeo = reg.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = reg.geo(new THREE.CylinderGeometry(0.11, 0.11, 0.15, 10));
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wz] of [
    [-0.56, 0.92],
    [0.56, 0.92],
    [-0.56, -0.92],
    [0.56, -0.92],
  ]) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, 0.22, wz);
    tire.castShadow = true;
    bus.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, 0.22, wz);
    bus.add(rim);
  }

  return bus;
}

function buildParkedCar(
  reg: AssetRegistry,
  paintMat: THREE.Material,
  glassMat: THREE.Material,
  tireMat: THREE.Material
): THREE.Group {
  const car = new THREE.Group();

  const lower = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(0.84, 0.3, 1.72)),
    paintMat
  );
  lower.position.y = 0.26;
  lower.castShadow = true;
  lower.receiveShadow = true;
  car.add(lower);

  const cabin = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(0.74, 0.26, 0.92)),
    paintMat
  );
  cabin.position.set(0, 0.52, -0.08);
  cabin.castShadow = true;
  car.add(cabin);

  const cabinGlass = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(0.76, 0.2, 0.78)),
    glassMat
  );
  cabinGlass.position.set(0, 0.51, -0.08);
  car.add(cabinGlass);

  const wGeo = reg.geo(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10));
  wGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.4, 0.52],
    [0.4, 0.52],
    [-0.4, -0.52],
    [0.4, -0.52],
  ]) {
    const wheel = new THREE.Mesh(wGeo, tireMat);
    wheel.position.set(wx, 0.14, wz);
    car.add(wheel);
  }

  return car;
}

function buildPalmTree(
  reg: AssetRegistry,
  barkMat: THREE.Material,
  frondMat: THREE.Material,
  height = 4.2
): { tree: THREE.Group; crown: THREE.Group } {
  const tree = new THREE.Group();

  // Curved ringed trunk
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.18, height * 0.35, 0.08),
    new THREE.Vector3(0.28, height * 0.72, -0.05),
    new THREE.Vector3(0.16, height, -0.08),
  ]);
  const trunk = new THREE.Mesh(
    reg.geo(new THREE.TubeGeometry(curve, 12, 0.14, 8, false)),
    barkMat
  );
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(0.16, height, -0.08);

  const frondGeo = reg.geo(new THREE.ConeGeometry(0.42, 1.95, 5));
  frondGeo.rotateX(Math.PI * 0.44);
  frondGeo.translate(0, -0.15, 0.85);

  const count = 9;
  for (let i = 0; i < count; i++) {
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.rotation.y = (i / count) * Math.PI * 2;
    frond.rotation.x = i % 2 === 0 ? -0.18 : 0.12;
    frond.castShadow = true;
    crown.add(frond);
  }

  tree.add(crown);
  return { tree, crown };
}

function buildCanopyTreeGroves(reg: AssetRegistry, parent: THREE.Group) {
  const trunkMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 })
  );
  const foliageMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff, // Tinted via per-instance setColorAt
      roughness: 0.82,
      metalness: 0.02,
    })
  );

  // Tree locations calibrated to the aerial campus photograph
  const trees: Array<[number, number, number]> = [
    // Lush left-foreground tree grove inside & along courtyard wall
    [-19.2, 6.2, 1.35],
    [-17.4, 7.2, 1.55],
    [-15.2, 8.2, 1.45],
    [-13.0, 9.0, 1.65],
    [-10.8, 9.8, 1.55],
    [-8.5, 10.6, 1.4],
    [-6.2, 11.4, 1.6],
    [-4.1, 12.1, 1.3],
    [-16.2, 10.4, 1.25],
    [-13.8, 11.2, 1.3],
    // Outer avenue boulevard trees along front road
    [-21.5, 11.2, 0.95],
    [-18.8, 12.1, 0.9],
    [-16.0, 13.0, 0.95],
    [-13.2, 13.9, 0.9],
    [-10.4, 14.8, 0.92],
    [-7.6, 15.7, 0.88],
    [-4.8, 16.6, 0.9],
    // Trees framing Main Block right side & entrance garden
    [4.4, 10.5, 1.5],
    [13.6, 5.2, 1.75],
    [14.8, 2.2, 1.65],
    [16.2, -1.0, 1.35],
    // Right driveway trees near marble dome & far right
    [22.2, -3.5, 1.25],
    [24.5, -13.5, 1.35],
    [15.8, -16.2, 1.55],
    // Courtyard & rear campus trees
    [-19.5, -2.5, 1.3],
    [-21.5, -8.2, 1.45],
    [-15.5, -14.8, 1.2],
    [-13.8, -22.5, 1.3],
    [3.5, -18.5, 1.45],
    [9.5, -20.5, 1.35],
    // Distant farmland hedgerow trees
    [-34, -18, 1.6],
    [-28, -32, 1.7],
    [-12, -38, 1.6],
    [6, -36, 1.8],
    [22, -34, 1.65],
    [-38, 4, 1.5],
    [-32, 18, 1.4],
  ];

  const trunkGeo = reg.geo(new THREE.CylinderGeometry(0.14, 0.24, 1.6, 8));
  const lobeGeo = reg.geo(new THREE.IcosahedronGeometry(1.0, 2));

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  // 3 organic canopy lobes per tree for natural volumetric silhouettes
  const lobeInst = new THREE.InstancedMesh(lobeGeo, foliageMat, trees.length * 3);
  lobeInst.castShadow = true;
  lobeInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const greens = [0x2d6a2e, 0x3b7a34, 0x265c27, 0x46883c, 0x336f2f];

  trees.forEach(([tx, tz, sc], idx) => {
    dummy.position.set(tx, 0.8 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.set(0, idx * 1.1, 0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    const offsets: Array<[number, number, number, number]> = [
      [0, 2.05 * sc, 0, 1.18 * sc],
      [0.45 * sc, 1.75 * sc, 0.35 * sc, 0.88 * sc],
      [-0.45 * sc, 1.8 * sc, -0.3 * sc, 0.92 * sc],
    ];
    offsets.forEach(([ox, oy, oz, ls], sub) => {
      dummy.position.set(tx + ox, oy, tz + oz);
      dummy.scale.set(ls, ls * 0.84, ls);
      dummy.rotation.set(sub * 0.4, idx * 0.7 + sub, 0);
      dummy.updateMatrix();
      const lIdx = idx * 3 + sub;
      lobeInst.setMatrixAt(lIdx, dummy.matrix);
      color.setHex(greens[(idx + sub) % greens.length]);
      lobeInst.setColorAt(lIdx, color);
    });
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  lobeInst.instanceMatrix.needsUpdate = true;
  if (lobeInst.instanceColor) lobeInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  lobeInst.computeBoundingSphere();

  parent.add(trunkInst);
  parent.add(lobeInst);
}

export function buildCompleteCampusScene(tex: TextureBundle): CampusSceneRefs {
  const reg = new AssetRegistry();
  const root = new THREE.Group();
  const palmCrowns: THREE.Group[] = [];
  const windowMaterials: THREE.MeshPhysicalMaterial[] = [];
  const lampBulbs: THREE.MeshStandardMaterial[] = [];
  const domeFloodLights: THREE.PointLight[] = [];

  // Shared reflective architectural window materials
  const windowMat = reg.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x164e5a,
      emissive: 0xffc66b,
      emissiveIntensity: 0.0,
      roughness: 0.1,
      metalness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
    })
  );
  windowMaterials.push(windowMat);

  const curtainGlassMat = reg.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x184c7c,
      emissive: 0xffcf7d,
      emissiveIntensity: 0.0,
      roughness: 0.06,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    })
  );
  windowMaterials.push(curtainGlassMat);

  // ---------------------------------------------------------------
  // 1. Expansive Surrounding Agricultural Landscape + Campus Compound Plaza
  // ---------------------------------------------------------------
  const terrain = new THREE.Mesh(
    reg.geo(new THREE.PlaneGeometry(240, 240)),
    reg.mat(
      new THREE.MeshStandardMaterial({
        map: tex.landscapeColor,
        roughness: 0.94,
        metalness: 0.0,
      })
    )
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0;
  terrain.receiveShadow = true;
  root.add(terrain);

  // Paved Red Interlocking Brick Campus Courtyard (Shaped polygon matching compound walls)
  const paverMat = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.paverColor,
      bumpMap: tex.paverBump,
      bumpScale: 0.03,
      roughness: 0.78,
      metalness: 0.02,
    })
  );
  // Campus polygon in (x, -z) rotated -PI/2 around X to lie flat on ground
  const campusPoly = new THREE.Shape();
  campusPoly.moveTo(-22.5, -8.6);
  campusPoly.lineTo(-2.1, -15.8);
  campusPoly.lineTo(4.2, -16.3);
  campusPoly.lineTo(14.5, -9.8);
  campusPoly.lineTo(25.0, 9.0);
  campusPoly.lineTo(25.0, 29.0);
  campusPoly.lineTo(-22.5, 29.0);
  campusPoly.closePath();

  const plazaGeo = reg.geo(new THREE.ShapeGeometry(campusPoly));
  // Normalize UVs smoothly so pavers tile crisply across the plaza
  const posAttr = plazaGeo.attributes.position;
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvArr[i * 2] = (posAttr.getX(i) + 25) / 50;
    uvArr[i * 2 + 1] = (posAttr.getY(i) + 25) / 50;
  }
  plazaGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

  const plaza = new THREE.Mesh(plazaGeo, paverMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.04;
  plaza.receiveShadow = true;
  root.add(plaza);

  // Outer Asphalt Boulevard Road (front-left & right perimeter drive)
  const roadMat = reg.mat(
    new THREE.MeshStandardMaterial({
      map: tex.roadAsphalt,
      roughness: 0.85,
      metalness: 0.02,
    })
  );
  const frontRoad = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(34, 0.03, 3.2)),
    roadMat
  );
  frontRoad.position.set(-10.5, 0.025, 14.4);
  frontRoad.rotation.y = -0.32;
  frontRoad.receiveShadow = true;
  root.add(frontRoad);

  const rightRoad = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(28, 0.03, 2.8)),
    roadMat
  );
  rightRoad.position.set(17.5, 0.025, 4.5);
  rightRoad.rotation.y = 0.98;
  rightRoad.receiveShadow = true;
  root.add(rightRoad);

  // Distant White Campus/Industrial Horizon Complex (seen in upper background of photo)
  const distantComplex = new THREE.Mesh(
    reg.geo(new THREE.BoxGeometry(24, 2.2, 4.5)),
    reg.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 }))
  );
  distantComplex.position.set(-14, 1.1, -56);
  distantComplex.rotation.y = 0.14;
  root.add(distantComplex);

  // ---------------------------------------------------------------
  // 2. Architectural Hero Buildings
  // ---------------------------------------------------------------
  root.add(buildMainAcademicBlock(reg, tex, windowMat, curtainGlassMat));
  root.add(buildMarblePavilion(reg, tex, lampBulbs, domeFloodLights));
  root.add(buildWestCampusWings(reg, tex, windowMat, curtainGlassMat));

  const gateData = buildEntranceGateAndWalls(reg, tex, lampBulbs);
  root.add(gateData.group);

  // ---------------------------------------------------------------
  // 3. Courtyard Yellow School Buses, Parked Cars & Palms
  // ---------------------------------------------------------------
  const busYellowMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0xf5b81d, roughness: 0.34, metalness: 0.12 })
  );
  const vehicleGlassMat = reg.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 1.0,
    })
  );
  const tireMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.86 })
  );
  const rimMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.82 })
  );

  // Two yellow school buses parked at an angle in left-center courtyard
  const bus1 = buildSchoolBus(reg, busYellowMat, vehicleGlassMat, tireMat, rimMat);
  bus1.position.set(-7.6, 0.04, 3.8);
  bus1.rotation.y = 1.05;
  root.add(bus1);

  const bus2 = buildSchoolBus(reg, busYellowMat, vehicleGlassMat, tireMat, rimMat);
  bus2.position.set(-6.9, 0.04, 5.4);
  bus2.rotation.y = 1.05;
  root.add(bus2);

  // Row of 7 parked sedans along the front-right courtyard parking lane
  const carColors = [0xf8fafc, 0xe2e8f0, 0xf1f5f9, 0x94a3b8, 0x475569, 0xf8fafc, 0xcbd5e1];
  carColors.forEach((hex, idx) => {
    const paint = reg.mat(
      new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.24,
        metalness: 0.35,
        clearcoat: 0.9,
      })
    );
    const car = buildParkedCar(reg, paint, vehicleGlassMat, tireMat);
    car.position.set(-1.3 + idx * 0.95, 0.04, 10.6 + idx * 0.26);
    car.rotation.y = -0.65;
    root.add(car);
  });

  // Courtyard Palm Planter Island & Two Signature Palm Trees
  const lawnMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x3c8d3c, roughness: 0.88 })
  );
  const barkMat = reg.mat(
    new THREE.MeshStandardMaterial({ color: 0x7c5c42, roughness: 0.9 })
  );
  const frondMat = reg.mat(
    new THREE.MeshStandardMaterial({
      color: 0x3b8c3b,
      roughness: 0.65,
      side: THREE.DoubleSide,
    })
  );

  const planter = new THREE.Mesh(
    reg.geo(new THREE.CylinderGeometry(2.1, 2.25, 0.14, 18)),
    lawnMat
  );
  planter.position.set(-4.3, 0.09, -0.4);
  planter.receiveShadow = true;
  root.add(planter);

  const palm1 = buildPalmTree(reg, barkMat, frondMat, 4.3);
  palm1.tree.position.set(-4.9, 0.12, -0.6);
  root.add(palm1.tree);
  palmCrowns.push(palm1.crown);

  const palm2 = buildPalmTree(reg, barkMat, frondMat, 3.8);
  palm2.tree.position.set(-3.5, 0.12, -0.1);
  root.add(palm2.tree);
  palmCrowns.push(palm2.crown);

  // ---------------------------------------------------------------
  // 4. Instanced Organic Tree Groves & Avenue Trees
  // ---------------------------------------------------------------
  buildCanopyTreeGroves(reg, root);

  return {
    root,
    palmCrowns,
    flagMesh: gateData.flagMesh,
    windowMaterials,
    lampBulbs,
    domeFloodLights,
    dispose: () => reg.dispose(),
  };
}
