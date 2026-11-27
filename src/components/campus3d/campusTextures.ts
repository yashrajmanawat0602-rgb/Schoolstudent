import * as THREE from 'three';

export interface TextureBundle {
  textures: THREE.Texture[];
  paverColor: THREE.CanvasTexture;
  paverBump: THREE.CanvasTexture;
  terracottaTile: THREE.CanvasTexture;
  metalRoofColor: THREE.CanvasTexture;
  solarPanelColor: THREE.CanvasTexture;
  landscapeColor: THREE.CanvasTexture;
  roadAsphalt: THREE.CanvasTexture;
  marbleArchColor: THREE.CanvasTexture;
  stuccoRoughness: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function registerTex(
  list: THREE.Texture[],
  canvas: HTMLCanvasElement,
  anisotropy: number,
  options: {
    srgb?: boolean;
    repeatX?: number;
    repeatY?: number;
  } = {}
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = options.srgb !== false ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (options.repeatX !== undefined && options.repeatY !== undefined) {
    tex.repeat.set(options.repeatX, options.repeatY);
  }
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  list.push(tex);
  return tex;
}

export function createCampusTextures(maxAnisotropy: number): TextureBundle {
  const textures: THREE.Texture[] = [];
  const aniso = Math.max(1, Math.min(maxAnisotropy, 16));

  // 1. Interlocking Red/Terracotta Courtyard Pavers (Color + Bump)
  const [paverC, pCtx] = makeCanvas(512, 512);
  const [paverB, bCtx] = makeCanvas(512, 512);
  pCtx.fillStyle = '#c46a52';
  pCtx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#555555';
  bCtx.fillRect(0, 0, 512, 512);

  const brickW = 32;
  const brickH = 16;
  const palette = ['#c96f57', '#be624b', '#d17860', '#b75c46', '#c66c55'];
  for (let row = 0; row < 512 / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < 512 / brickW + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      const shade = palette[(row * 7 + col * 13 + 99) % palette.length];
      pCtx.fillStyle = shade;
      pCtx.fillRect(x + 1.5, y + 1.5, brickW - 3, brickH - 3);
      bCtx.fillStyle = '#d4d4d4';
      bCtx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
    }
  }
  // Subtle surface grain
  for (let i = 0; i < 1800; i++) {
    const gx = (i * 193) % 512;
    const gy = (i * 317) % 512;
    pCtx.fillStyle = i % 2 === 0 ? 'rgba(255,235,220,0.08)' : 'rgba(60,20,10,0.08)';
    pCtx.fillRect(gx, gy, 2, 2);
  }

  const paverColor = registerTex(textures, paverC, aniso, {
    srgb: true,
    repeatX: 16,
    repeatY: 16,
  });
  const paverBump = registerTex(textures, paverB, aniso, {
    srgb: false,
    repeatX: 16,
    repeatY: 16,
  });

  // 2. Terracotta Roof Tiles
  const [tileC, tCtx] = makeCanvas(512, 512);
  tCtx.fillStyle = '#c45136';
  tCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 24) {
    tCtx.fillStyle = 'rgba(0,0,0,0.16)';
    tCtx.fillRect(0, y, 512, 3);
    for (let x = 0; x < 512; x += 28) {
      const grad = tCtx.createLinearGradient(x, y, x + 28, y);
      grad.addColorStop(0, 'rgba(255,210,180,0.12)');
      grad.addColorStop(0.5, 'rgba(215,90,55,0.0)');
      grad.addColorStop(1, 'rgba(70,20,10,0.22)');
      tCtx.fillStyle = grad;
      tCtx.fillRect(x, y + 3, 28, 21);
    }
  }
  const terracottaTile = registerTex(textures, tileC, aniso, {
    srgb: true,
    repeatX: 5,
    repeatY: 5,
  });

  // 3. Standing-Seam White Metal Auditorium Roof
  const [metalC, mCtx] = makeCanvas(512, 512);
  mCtx.fillStyle = '#f2f6fa';
  mCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 16) {
    mCtx.fillStyle = '#dce4ee';
    mCtx.fillRect(x, 0, 2, 512);
    mCtx.fillStyle = '#ffffff';
    mCtx.fillRect(x + 2, 0, 2, 512);
  }
  for (let y = 0; y < 512; y += 128) {
    mCtx.fillStyle = 'rgba(148,163,184,0.25)';
    mCtx.fillRect(0, y, 512, 2);
  }
  const metalRoofColor = registerTex(textures, metalC, aniso, {
    srgb: true,
    repeatX: 6,
    repeatY: 4,
  });

  // 4. Photovoltaic Solar Array Texture
  const [solarC, sCtx] = makeCanvas(512, 512);
  sCtx.fillStyle = '#0f2342';
  sCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 48) {
      const grad = sCtx.createLinearGradient(x, y, x + 48, y + 64);
      grad.addColorStop(0, '#163663');
      grad.addColorStop(0.5, '#0f274a');
      grad.addColorStop(1, '#1c467e');
      sCtx.fillStyle = grad;
      sCtx.fillRect(x + 2, y + 2, 44, 60);
      sCtx.strokeStyle = 'rgba(191,219,254,0.35)';
      sCtx.lineWidth = 1;
      sCtx.strokeRect(x + 2, y + 2, 44, 60);
    }
  }
  // Silver frame borders
  sCtx.strokeStyle = '#cbd5e1';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(0, 0, 512, 512);
  const solarPanelColor = registerTex(textures, solarC, aniso, {
    srgb: true,
    repeatX: 2,
    repeatY: 1,
  });

  // 5. Surrounding Agricultural Landscape (Green Fields + Plowed Brown Field on Right)
  const [landC, lCtx] = makeCanvas(1024, 1024);
  lCtx.fillStyle = '#5a8f43';
  lCtx.fillRect(0, 0, 1024, 1024);
  // Quilted agricultural plots matching the aerial view
  const fieldRects: Array<[number, number, number, number, string]> = [
    [0, 0, 420, 420, '#629848'],
    [0, 420, 380, 340, '#6aa34e'],
    [0, 760, 460, 264, '#73aa52'],
    [420, 0, 320, 350, '#54873e'],
    [740, 0, 284, 410, '#619647'],
    // Characteristic plowed brown field to the right-front of the campus
    [610, 480, 414, 544, '#9a6b43'],
    [660, 520, 364, 504, '#a27249'],
  ];
  for (const [fx, fy, fw, fh, col] of fieldRects) {
    lCtx.fillStyle = col;
    lCtx.fillRect(fx, fy, fw, fh);
  }
  // Furrow lines on plowed brown field
  lCtx.strokeStyle = 'rgba(72,42,20,0.22)';
  lCtx.lineWidth = 2;
  for (let i = 480; i < 1024; i += 9) {
    lCtx.beginPath();
    lCtx.moveTo(615, i);
    lCtx.lineTo(1024, i - 140);
    lCtx.stroke();
  }
  // Hedgerow dark green strips & organic grass variation
  for (let i = 0; i < 3200; i++) {
    const px = (i * 397) % 1024;
    const py = (i * 613) % 1024;
    if (px < 605 || py < 475) {
      lCtx.fillStyle = i % 3 === 0 ? 'rgba(34,70,22,0.12)' : 'rgba(134,189,90,0.12)';
      lCtx.fillRect(px, py, 10, 10);
    }
  }
  const landscapeColor = registerTex(textures, landC, aniso, {
    srgb: true,
    repeatX: 1,
    repeatY: 1,
  });

  // 6. Asphalt Road with Center Line
  const [roadC, rCtx] = makeCanvas(512, 512);
  rCtx.fillStyle = '#5c5b58';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3500; i++) {
    const rx = (i * 151) % 512;
    const ry = (i * 277) % 512;
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    rCtx.fillRect(rx, ry, 2, 2);
  }
  rCtx.fillStyle = 'rgba(241,245,249,0.55)';
  rCtx.fillRect(0, 8, 512, 6);
  rCtx.fillRect(0, 498, 512, 6);
  const roadAsphalt = registerTex(textures, roadC, aniso, {
    srgb: true,
    repeatX: 8,
    repeatY: 1,
  });

  // 7. White Marble Mughal-Style Arched Facade Texture for the Dome Pavilion
  const [archC, aCtx] = makeCanvas(512, 512);
  aCtx.fillStyle = '#f4f6f9';
  aCtx.fillRect(0, 0, 512, 512);
  // Subtle marble veins
  aCtx.strokeStyle = 'rgba(203,213,225,0.45)';
  aCtx.lineWidth = 1.5;
  for (let i = 0; i < 24; i++) {
    aCtx.beginPath();
    aCtx.moveTo(0, (i * 23) % 512);
    aCtx.bezierCurveTo(170, (i * 37) % 512, 340, (i * 53) % 512, 512, (i * 19) % 512);
    aCtx.stroke();
  }
  // 3 symmetrical arched bays (tall central pishtaq + flanking 2-tier arches)
  const drawArch = (cx: number, bottomY: number, w: number, h: number, fill: string) => {
    const half = w / 2;
    const springY = bottomY - h * 0.58;
    aCtx.fillStyle = fill;
    aCtx.beginPath();
    aCtx.moveTo(cx - half, bottomY);
    aCtx.lineTo(cx - half, springY);
    aCtx.quadraticCurveTo(cx - half, bottomY - h * 0.85, cx, bottomY - h);
    aCtx.quadraticCurveTo(cx + half, bottomY - h * 0.85, cx + half, springY);
    aCtx.lineTo(cx + half, bottomY);
    aCtx.closePath();
    aCtx.fill();
  };
  // Recessed dark interior arches
  drawArch(256, 488, 128, 360, '#1e293b');
  drawArch(256, 488, 96, 290, '#0f172a');
  // Left upper & lower arches
  drawArch(92, 488, 74, 175, '#1e293b');
  drawArch(92, 260, 74, 165, '#1e293b');
  // Right upper & lower arches
  drawArch(420, 488, 74, 175, '#1e293b');
  drawArch(420, 260, 74, 165, '#1e293b');

  // Decorative panel border around central arch
  aCtx.strokeStyle = '#cbd5e1';
  aCtx.lineWidth = 4;
  aCtx.strokeRect(174, 80, 164, 412);

  const marbleArchColor = registerTex(textures, archC, aniso, {
    srgb: true,
    repeatX: 1,
    repeatY: 1,
  });

  // 8. Architectural Stucco Roughness Map
  const [stuccoC, stCtx] = makeCanvas(256, 256);
  stCtx.fillStyle = '#c8c8c8';
  stCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const sx = (i * 89) % 256;
    const sy = (i * 173) % 256;
    stCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,120,0.08)';
    stCtx.fillRect(sx, sy, 2, 2);
  }
  const stuccoRoughness = registerTex(textures, stuccoC, aniso, {
    srgb: false,
    repeatX: 4,
    repeatY: 4,
  });

  return {
    textures,
    paverColor,
    paverBump,
    terracottaTile,
    metalRoofColor,
    solarPanelColor,
    landscapeColor,
    roadAsphalt,
    marbleArchColor,
    stuccoRoughness,
    dispose: () => {
      textures.forEach((t) => t.dispose());
    },
  };
}
