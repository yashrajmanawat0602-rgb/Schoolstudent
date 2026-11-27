import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCampusTextures } from './campus3d/campusTextures.ts';
import { buildCompleteCampusScene } from './campus3d/campusBuilders.ts';

export type HeroPaletteId = 'daylight-campus' | 'golden-hour' | 'evening-study';
export type CampusCameraPreset =
  | 'overview'
  | 'main-block'
  | 'west-wing'
  | 'courtyard'
  | 'dome';

export interface HeroPaletteConfig {
  id: HeroPaletteId;
  label: string;
  swatchSky: string;
  skyTop: number;
  skyHorizon: number;
  sunHex: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
  windowGlow: number;
  lampGlow: number;
  floodIntensity: number;
}

export const HERO_PALETTES: Record<HeroPaletteId, HeroPaletteConfig> = {
  'daylight-campus': {
    id: 'daylight-campus',
    label: 'Bright Daylight',
    swatchSky: '#60A5FA',
    skyTop: 0x3b82d6,
    skyHorizon: 0xdbeafe,
    sunHex: 0xfff8ea,
    sunIntensity: 2.35,
    sunPos: [-28, 38, 22],
    hemiSky: 0x93c5fd,
    hemiGround: 0x5c7f43,
    hemiIntensity: 0.82,
    exposure: 1.05,
    windowGlow: 0.0,
    lampGlow: 0.0,
    floodIntensity: 0.0,
  },
  'golden-hour': {
    id: 'golden-hour',
    label: 'Golden Sun',
    swatchSky: '#FBBF24',
    skyTop: 0x45628f,
    skyHorizon: 0xfcd39a,
    sunHex: 0xffb15c,
    sunIntensity: 2.65,
    sunPos: [-38, 16, 14],
    hemiSky: 0xfdc58a,
    hemiGround: 0x5b4634,
    hemiIntensity: 0.72,
    exposure: 1.08,
    windowGlow: 0.25,
    lampGlow: 0.4,
    floodIntensity: 4.0,
  },
  'evening-study': {
    id: 'evening-study',
    label: 'Evening Campus',
    swatchSky: '#0F172A',
    skyTop: 0x070d1f,
    skyHorizon: 0x1b3362,
    sunHex: 0x93c5fd,
    sunIntensity: 0.75,
    sunPos: [22, 28, -18],
    hemiSky: 0x2b4578,
    hemiGround: 0x111827,
    hemiIntensity: 0.55,
    exposure: 1.15,
    windowGlow: 1.15,
    lampGlow: 1.9,
    floodIntensity: 22.0,
  },
};

const CAMPUS_PHOTO_URL =
  '/assets/aistudio/Aerial_View_of_a_Vibrant_Campus_Complex_08569615.png';

const CAMERA_PRESETS: Record<
  CampusCameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; label: string }
> = {
  overview: {
    pos: [1.5, 22.0, 36.5],
    target: [-0.5, 1.8, -1.5],
    label: 'Aerial View',
  },
  'main-block': {
    pos: [-4.5, 10.2, 18.5],
    target: [7.6, 4.2, 2.2],
    label: 'Main Block',
  },
  'west-wing': {
    pos: [-4.2, 12.2, 16.5],
    target: [-13.8, 2.8, -3.5],
    label: 'West Wings',
  },
  courtyard: {
    pos: [-2.5, 6.2, 25.0],
    target: [-2.8, 1.2, 7.5],
    label: 'Gate & Buses',
  },
  dome: {
    pos: [8.0, 8.6, 6.5],
    target: [17.8, 3.6, -7.8],
    label: 'Marble Dome',
  },
};

const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _sunPosTarget = new THREE.Vector3();
const _cTopTarget = new THREE.Color();
const _cHorTarget = new THREE.Color();
const _cSunTarget = new THREE.Color();
const _cHemiSkyTarget = new THREE.Color();
const _cHemiGndTarget = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface SchoolHero3DCanvasProps {
  paletteId: HeroPaletteId;
  cameraPreset: CampusCameraPreset;
  autoOrbit: boolean;
  resetSignal: number;
  showPhotoMode: boolean;
  className?: string;
}

export const SchoolHero3DCanvas: React.FC<SchoolHero3DCanvasProps> = ({
  paletteId,
  cameraPreset,
  autoOrbit,
  resetSignal,
  showPhotoMode,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const paletteRef = useRef<HeroPaletteId>(paletteId);
  const presetRef = useRef<CampusCameraPreset>(cameraPreset);
  const autoOrbitRef = useRef<boolean>(autoOrbit);
  const resetFlagRef = useRef<number>(resetSignal);
  const cameraAnimatingRef = useRef<boolean>(false);

  useEffect(() => {
    paletteRef.current = paletteId;
  }, [paletteId]);

  useEffect(() => {
    presetRef.current = cameraPreset;
    cameraAnimatingRef.current = true;
  }, [cameraPreset]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
  }, [autoOrbit]);

  useEffect(() => {
    if (resetSignal > 0) {
      resetFlagRef.current = resetSignal;
      cameraAnimatingRef.current = true;
    }
  }, [resetSignal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || reducedMotion || showPhotoMode) return;

    const testCanvas = document.createElement('canvas');
    if (!testCanvas.getContext('webgl2')) {
      setWebglUnavailable(true);
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const initialPalette = HERO_PALETTES[paletteRef.current];

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = initialPalette.exposure;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.outline = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialPalette.skyHorizon);
    const fog = new THREE.FogExp2(initialPalette.skyHorizon, 0.0055);
    scene.fog = fog;

    // Procedural Studio IBL Environment (RoomEnvironment) for glass, metal & brass realism
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Procedural Sky Gradient Dome
    const skyUniforms = {
      uSkyTop: { value: new THREE.Color(initialPalette.skyTop) },
      uSkyHorizon: { value: new THREE.Color(initialPalette.skyHorizon) },
    };
    const skyGeo = new THREE.SphereGeometry(155, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
          float curve = pow(h, 0.55);
          vec3 col = mix(uSkyHorizon, uSkyTop, curve);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // 3-Point Outdoor Architectural Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialPalette.hemiSky,
      initialPalette.hemiGround,
      initialPalette.hemiIntensity
    );
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      initialPalette.sunHex,
      initialPalette.sunIntensity
    );
    sunLight.position.set(...initialPalette.sunPos);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 115;
    const sBounds = 34;
    sunLight.shadow.camera.left = -sBounds;
    sunLight.shadow.camera.right = sBounds;
    sunLight.shadow.camera.top = sBounds;
    sunLight.shadow.camera.bottom = -sBounds;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.025;
    sunLight.shadow.radius = 2.5;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xc7d2fe, 0.48);
    rimLight.position.set(30, 18, -32);
    scene.add(rimLight);

    // Build Procedural PBR Textures & Complete 3D Campus Model
    const texBundle = createCampusTextures(renderer.capabilities.getMaxAnisotropy());
    const campus = buildCompleteCampusScene(texBundle);
    scene.add(campus.root);

    // Store initial flag vertex Y/Z positions for smooth breeze animation
    const flagGeo = campus.flagMesh?.geometry;
    const flagOrigPos = flagGeo
      ? new Float32Array(flagGeo.attributes.position.array)
      : null;

    // Camera & Full 360-Degree OrbitControls
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.25, 240);
    const initCam = CAMERA_PRESETS[presetRef.current];
    camera.position.set(...initCam.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.enablePan = true;
    controls.panSpeed = 0.65;
    controls.enableZoom = true;
    controls.minDistance = 8.0;
    controls.maxDistance = 68.0;
    controls.minPolarAngle = 0.16;
    controls.maxPolarAngle = Math.PI * 0.455;
    controls.autoRotate = autoOrbitRef.current && !isSoftwareGl;
    controls.autoRotateSpeed = 0.42;
    controls.target.set(...initCam.target);
    controls.update();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const cancelAutoGlide = () => {
      cameraAnimatingRef.current = false;
    };
    controls.addEventListener('start', cancelAutoGlide);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    handleResize();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const handleContextRestored = () => {
      setWebglUnavailable(false);
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastReset = resetFlagRef.current;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();

      // 1. Subtle courtyard breeze animation on palm crowns & entrance flag
      campus.palmCrowns.forEach((crown, idx) => {
        crown.rotation.z = Math.sin(elapsed * 1.45 + idx * 1.3) * 0.045;
        crown.rotation.x = Math.cos(elapsed * 1.15 + idx) * 0.03;
      });
      if (flagGeo && flagOrigPos) {
        const posAttr = flagGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          const ox = flagOrigPos[i * 3];
          const oz = flagOrigPos[i * 3 + 2];
          const amp = Math.max(0, ox) * 0.09;
          posAttr.setZ(i, oz + Math.sin(elapsed * 4.2 + ox * 5.0) * amp);
        }
        posAttr.needsUpdate = true;
      }

      // 2. Smooth Lighting Mood Transitions (Bright Daylight / Golden Sun / Evening Campus)
      const pal = HERO_PALETTES[paletteRef.current];
      const dampStep = 1 - Math.exp(-3.8 * delta);

      _cTopTarget.setHex(pal.skyTop);
      _cHorTarget.setHex(pal.skyHorizon);
      _cSunTarget.setHex(pal.sunHex);
      _cHemiSkyTarget.setHex(pal.hemiSky);
      _cHemiGndTarget.setHex(pal.hemiGround);
      _sunPosTarget.set(...pal.sunPos);

      skyUniforms.uSkyTop.value.lerp(_cTopTarget, dampStep);
      skyUniforms.uSkyHorizon.value.lerp(_cHorTarget, dampStep);
      fog.color.copy(skyUniforms.uSkyHorizon.value);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(skyUniforms.uSkyHorizon.value);
      }

      sunLight.color.lerp(_cSunTarget, dampStep);
      sunLight.intensity = THREE.MathUtils.damp(
        sunLight.intensity,
        pal.sunIntensity,
        3.8,
        delta
      );
      sunLight.position.lerp(_sunPosTarget, dampStep);

      hemiLight.color.lerp(_cHemiSkyTarget, dampStep);
      hemiLight.groundColor.lerp(_cHemiGndTarget, dampStep);
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        pal.hemiIntensity,
        3.8,
        delta
      );

      renderer.toneMappingExposure = THREE.MathUtils.damp(
        renderer.toneMappingExposure,
        pal.exposure,
        3.8,
        delta
      );

      campus.windowMaterials.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.damp(
          m.emissiveIntensity,
          pal.windowGlow,
          3.8,
          delta
        );
      });
      campus.lampBulbs.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.damp(
          m.emissiveIntensity,
          pal.lampGlow,
          3.8,
          delta
        );
      });
      campus.domeFloodLights.forEach((light) => {
        light.intensity = THREE.MathUtils.damp(
          light.intensity,
          pal.floodIntensity,
          3.8,
          delta
        );
      });

      // 3. Smooth Camera Preset Glide + 360-degree Auto-Orbit
      if (lastReset !== resetFlagRef.current) {
        lastReset = resetFlagRef.current;
        cameraAnimatingRef.current = true;
      }

      controls.autoRotate =
        autoOrbitRef.current && !isSoftwareGl && !cameraAnimatingRef.current;

      if (cameraAnimatingRef.current) {
        const presetCfg = CAMERA_PRESETS[presetRef.current];
        _camPosTarget.set(...presetCfg.pos);
        _camLookTarget.set(...presetCfg.target);

        const rate = 4.2;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _camPosTarget.x,
          rate,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _camPosTarget.y,
          rate,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _camPosTarget.z,
          rate,
          delta
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          _camLookTarget.x,
          rate,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          _camLookTarget.y,
          rate,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          _camLookTarget.z,
          rate,
          delta
        );

        if (
          camera.position.distanceTo(_camPosTarget) < 0.08 &&
          controls.target.distanceTo(_camLookTarget) < 0.08
        ) {
          cameraAnimatingRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', cancelAutoGlide);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      controls.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      envTarget.dispose();
      campus.dispose();
      texBundle.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion, showPhotoMode]);

  if (showPhotoMode || webglUnavailable || reducedMotion) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-slate-900 ${className}`}
      >
        <img
          src={CAMPUS_PHOTO_URL}
          alt="Aerial view of Macro Vision Academy Burhanpur campus complex"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      aria-label="Interactive 3D architectural model of the school campus complex"
      className={`w-full h-full cursor-grab active:cursor-grabbing ${className}`}
    />
  );
};
