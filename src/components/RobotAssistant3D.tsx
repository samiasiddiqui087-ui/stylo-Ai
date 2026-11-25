import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { RobotState } from '../types/immerso.ts';

interface RobotAssistant3DProps {
  robotState: RobotState;
  speechAmplitudeRef: React.MutableRefObject<number>;
  compact?: boolean;
  className?: string;
}

const _colorIdle = new THREE.Color('#F3DCB1');
const _colorListening = new THREE.Color('#7BE3C4');
const _colorThinking = new THREE.Color('#E3A857');
const _colorSpeaking = new THREE.Color('#FFE8B6');
const _workColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
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

export function RobotAssistant3D({
  robotState,
  speechAmplitudeRef,
  compact = false,
  className = '',
}: RobotAssistant3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<RobotState>(robotState);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    stateRef.current = robotState;
  }, [robotState]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const width = Math.max(container.clientWidth, compact ? 84 : 280);
    const height = Math.max(container.clientHeight, compact ? 84 : 180);
    const initialAspect = width / height;
    const computeFov = (aspect: number) =>
      compact ? 30 : aspect < 0.85 ? 38 : aspect > 1.85 ? 36 : 32;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#16110E');
    scene.fog = new THREE.FogExp2('#16110E', 0.14);

    const camera = new THREE.PerspectiveCamera(
      computeFov(initialAspect),
      initialAspect,
      0.1,
      30
    );
    camera.position.set(0, compact ? 1.54 : 1.42, compact ? 2.15 : 2.95);
    camera.lookAt(0, compact ? 1.46 : 1.24, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl && !compact;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // Studio environment reflection for brushed gold, champagne metal, and ivory ceramic
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = track(pmremGenerator.fromScene(new RoomEnvironment(), 0.04));
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Balanced 3-point warm/cool luxury studio lighting
    const hemiLight = new THREE.HemisphereLight('#D8E2F0', '#382B20', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF1D9', 2.4);
    keyLight.position.set(2.4, 3.6, 3.2);
    if (!isSoftwareGl && !compact) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 10;
      keyLight.shadow.camera.left = -2;
      keyLight.shadow.camera.right = 2;
      keyLight.shadow.camera.top = 2.5;
      keyLight.shadow.camera.bottom = -1.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#B8C9DF', 0.9);
    fillLight.position.set(-2.8, 1.8, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight('#E5B76E', 4.5, 8, 1.8);
    rimLight.position.set(-0.6, 2.4, -2.1);
    scene.add(rimLight);

    // Materials library (varied roughness >= 0.25 between adjacent parts)
    const matIvoryCeramic = track(
      new THREE.MeshPhysicalMaterial({
        color: '#F5EFE4',
        roughness: 0.24,
        metalness: 0.06,
        clearcoat: 0.9,
        clearcoatRoughness: 0.14,
      })
    );

    const matChampagneSatin = track(
      new THREE.MeshPhysicalMaterial({
        color: '#DFC59A',
        roughness: 0.28,
        metalness: 0.84,
        clearcoat: 0.25,
      })
    );

    const matBrushedGold = track(
      new THREE.MeshPhysicalMaterial({
        color: '#C79B52',
        roughness: 0.17,
        metalness: 0.95,
        anisotropy: 0.85,
      })
    );

    const matObsidianFrame = track(
      new THREE.MeshStandardMaterial({
        color: '#191412',
        roughness: 0.62,
        metalness: 0.28,
      })
    );

    const matVisorGlass = track(
      new THREE.MeshPhysicalMaterial({
        color: '#0A0808',
        roughness: 0.06,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    );

    const matEyeGlow = track(
      new THREE.MeshStandardMaterial({
        color: '#FFF2D6',
        emissive: new THREE.Color('#F3DCB1'),
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.1,
      })
    );

    const matPupil = track(
      new THREE.MeshBasicMaterial({
        color: '#0A0807',
      })
    );

    const matMouthHarmonic = track(
      new THREE.MeshStandardMaterial({
        color: '#FFE6B0',
        emissive: new THREE.Color('#D4A359'),
        emissiveIntensity: 1.4,
        roughness: 0.2,
      })
    );

    const matCoreCrystal = track(
      new THREE.MeshStandardMaterial({
        color: '#FFE5B4',
        emissive: new THREE.Color('#CFA054'),
        emissiveIntensity: 1.6,
        roughness: 0.12,
        metalness: 0.2,
      })
    );

    // Root Robot Hierarchy (grounded at bottom-center y = 0)
    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    // Subtle Atelier Pedestal & Gold Telemetry Ring (only in full mode)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.22, 0);
    robotRoot.add(haloGroup);

    const haloRingGeo = track(new THREE.TorusGeometry(0.92, 0.008, 12, 64));
    const haloRingMat = track(
      new THREE.MeshStandardMaterial({
        color: '#D5A962',
        emissive: new THREE.Color('#B58943'),
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.9,
        transparent: true,
        opacity: 0.72,
      })
    );
    const haloRing1 = new THREE.Mesh(haloRingGeo, haloRingMat);
    haloRing1.rotation.x = Math.PI / 2;
    haloGroup.add(haloRing1);

    const haloRing2Geo = track(new THREE.TorusGeometry(0.76, 0.006, 10, 48));
    const haloRing2 = new THREE.Mesh(haloRing2Geo, matBrushedGold);
    haloRing2.rotation.x = Math.PI / 2;
    haloRing2.position.y = 0.04;
    haloGroup.add(haloRing2);

    // Subtle contact grounding shadow disc
    const shadowDiscGeo = track(new THREE.CircleGeometry(1.1, 48));
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0,0,0,0.65)');
      grad.addColorStop(0.55, 'rgba(181,148,91,0.16)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const shadowMat = track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.2;
    robotRoot.add(shadowDisc);

    // 1. Sculpted Couture Bust / Upper Torso (LatheGeometry)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.26, 0);
    robotRoot.add(torsoGroup);

    const torsoPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.28, 0.02),
      new THREE.Vector2(0.26, 0.22),
      new THREE.Vector2(0.23, 0.42),
      new THREE.Vector2(0.32, 0.68),
      new THREE.Vector2(0.37, 0.84),
      new THREE.Vector2(0.25, 0.94),
      new THREE.Vector2(0.14, 0.98),
      new THREE.Vector2(0.01, 0.98),
    ];
    const torsoGeo = track(new THREE.LatheGeometry(torsoPoints, 40));
    const torsoMesh = new THREE.Mesh(torsoGeo, matIvoryCeramic);
    torsoMesh.scale.set(1.06, 1.0, 0.72);
    torsoMesh.castShadow = !isSoftwareGl;
    torsoMesh.receiveShadow = !isSoftwareGl;
    torsoGroup.add(torsoMesh);

    // Champagne torso corset inlay & gold collar trim
    const chestPlateGeo = track(new THREE.CylinderGeometry(0.28, 0.21, 0.46, 32, 1, false, -Math.PI * 0.34, Math.PI * 0.68));
    const chestPlate = new THREE.Mesh(chestPlateGeo, matChampagneSatin);
    chestPlate.position.set(0, 0.64, 0.045);
    chestPlate.scale.set(1.0, 1.0, 0.72);
    torsoGroup.add(chestPlate);

    const collarTrimGeo = track(new THREE.TorusGeometry(0.205, 0.014, 16, 48));
    const collarTrim = new THREE.Mesh(collarTrimGeo, matBrushedGold);
    collarTrim.rotation.x = Math.PI / 2 + 0.18;
    collarTrim.position.set(0, 0.94, 0.015);
    collarTrim.scale.set(1.05, 0.85, 1);
    torsoGroup.add(collarTrim);

    // Luminous Chest Core Assembly
    const chestCoreBezelGeo = track(new THREE.TorusGeometry(0.075, 0.012, 14, 36));
    const chestCoreBezel = new THREE.Mesh(chestCoreBezelGeo, matBrushedGold);
    chestCoreBezel.position.set(0, 0.68, 0.25);
    torsoGroup.add(chestCoreBezel);

    const chestCoreGeo = track(new THREE.OctahedronGeometry(0.056, 1));
    const chestCore = new THREE.Mesh(chestCoreGeo, matCoreCrystal);
    chestCore.position.set(0, 0.68, 0.245);
    chestCore.scale.set(0.85, 1.15, 0.48);
    torsoGroup.add(chestCore);

    // 2. Sculpted Shoulder Pauldrons & Upper Arms
    const buildShoulderArm = (side: -1 | 1) => {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.41, 0.82, 0.0);

      const jointSphere = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.11, 24, 20)),
        matObsidianFrame
      );
      shoulderPivot.add(jointSphere);

      const jointRing = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.115, 0.011, 12, 32)),
        matBrushedGold
      );
      jointRing.rotation.y = Math.PI / 2;
      shoulderPivot.add(jointRing);

      const pauldron = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.145, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62)),
        matIvoryCeramic
      );
      pauldron.rotation.z = side * -0.45;
      pauldron.position.set(side * 0.02, 0.03, 0);
      pauldron.castShadow = !isSoftwareGl;
      shoulderPivot.add(pauldron);

      const upperArm = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.072, 0.36, 12, 20)),
        matChampagneSatin
      );
      upperArm.position.set(side * 0.06, -0.26, 0.02);
      upperArm.rotation.z = side * 0.14;
      upperArm.castShadow = !isSoftwareGl;
      shoulderPivot.add(upperArm);

      const cuff = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.074, 0.01, 12, 28)),
        matBrushedGold
      );
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(side * 0.085, -0.38, 0.02);
      shoulderPivot.add(cuff);

      torsoGroup.add(shoulderPivot);
      return shoulderPivot;
    };

    const armPivotL = buildShoulderArm(-1);
    const armPivotR = buildShoulderArm(1);

    // 3. Articulated Neck Column
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.96, 0);
    torsoGroup.add(neckGroup);

    const neckCore = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.088, 0.105, 0.24, 24)),
      matObsidianFrame
    );
    neckCore.position.y = 0.09;
    neckGroup.add(neckCore);

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.098 - i * 0.004, 0.008, 10, 32)),
        matBrushedGold
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04 + i * 0.055;
      neckGroup.add(ring);
    }

    // 4. Sculpted Humanoid Head Assembly
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.22, 0.02);
    neckGroup.add(headGroup);

    // Cranium outer ivory ceramic shell
    const headPoints = [
      new THREE.Vector2(0.01, -0.02),
      new THREE.Vector2(0.11, 0.02),
      new THREE.Vector2(0.175, 0.14),
      new THREE.Vector2(0.205, 0.29),
      new THREE.Vector2(0.195, 0.43),
      new THREE.Vector2(0.14, 0.52),
      new THREE.Vector2(0.01, 0.55),
    ];
    const craniumGeo = track(new THREE.LatheGeometry(headPoints, 36));
    const craniumMesh = new THREE.Mesh(craniumGeo, matIvoryCeramic);
    craniumMesh.scale.set(0.95, 1.0, 1.04);
    craniumMesh.castShadow = !isSoftwareGl;
    headGroup.add(craniumMesh);

    // Forehead gold filigree tiara / crest line
    const crestGeo = track(new THREE.TorusGeometry(0.195, 0.009, 12, 36, Math.PI));
    const crestMesh = new THREE.Mesh(crestGeo, matBrushedGold);
    crestMesh.rotation.y = Math.PI / 2;
    crestMesh.position.set(0, 0.34, 0.01);
    headGroup.add(crestMesh);

    const browCrownGeo = track(new THREE.TorusGeometry(0.17, 0.007, 10, 32, Math.PI * 0.72));
    const browCrown = new THREE.Mesh(browCrownGeo, matBrushedGold);
    browCrown.rotation.x = Math.PI / 2 - 0.15;
    browCrown.rotation.z = -Math.PI * 0.36;
    browCrown.position.set(0, 0.37, 0.05);
    headGroup.add(browCrown);

    // Glossy Obsidian Recessed Face Visor
    const visorGeo = track(new THREE.SphereGeometry(0.178, 32, 24, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.22, Math.PI * 0.45));
    const visorMesh = new THREE.Mesh(visorGeo, matVisorGlass);
    visorMesh.position.set(0, 0.255, 0.036);
    visorMesh.scale.set(0.96, 0.94, 0.98);
    headGroup.add(visorMesh);

    // Champagne Cheek Contours framing the visor
    for (const side of [-1, 1] as const) {
      const cheek = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.042, 0.11, 8, 16)),
        matChampagneSatin
      );
      cheek.position.set(side * 0.132, 0.155, 0.095);
      cheek.rotation.z = side * -0.42;
      cheek.rotation.y = side * 0.42;
      headGroup.add(cheek);
    }

    // Dual Expressive Digital Eyes + Animated Eyelids + Brows
    const createEyeAssembly = (side: -1 | 1) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.072, 0.265, 0.172);
      eyeSocket.rotation.y = side * 0.22;

      // Glowing iris disc
      const irisRing = new THREE.Mesh(
        track(new THREE.RingGeometry(0.017, 0.032, 28)),
        matEyeGlow
      );
      eyeSocket.add(irisRing);

      // Soft outer halo ring
      const outerHalo = new THREE.Mesh(
        track(new THREE.RingGeometry(0.034, 0.039, 28)),
        matBrushedGold
      );
      outerHalo.position.z = -0.001;
      eyeSocket.add(outerHalo);

      // Pupil (moves slightly toward pointer/attention)
      const pupilGroup = new THREE.Group();
      const pupilMesh = new THREE.Mesh(
        track(new THREE.CircleGeometry(0.0155, 24)),
        matPupil
      );
      pupilMesh.position.z = 0.001;
      pupilGroup.add(pupilMesh);

      const catchlight = new THREE.Mesh(
        track(new THREE.CircleGeometry(0.0045, 12)),
        matEyeGlow
      );
      catchlight.position.set(0.006, 0.007, 0.002);
      pupilGroup.add(catchlight);
      eyeSocket.add(pupilGroup);

      // Upper & Lower Animated Eyelids (for blinking & warm expressions)
      const lidGeo = track(new THREE.PlaneGeometry(0.088, 0.044));
      const upperLid = new THREE.Mesh(lidGeo, matVisorGlass);
      upperLid.position.set(0, 0.046, 0.004);
      eyeSocket.add(upperLid);

      const lowerLid = new THREE.Mesh(lidGeo, matVisorGlass);
      lowerLid.position.set(0, -0.048, 0.004);
      eyeSocket.add(lowerLid);

      // Expressive metallic brow line
      const brow = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.0035, 0.048, 4, 12)),
        matBrushedGold
      );
      brow.rotation.z = Math.PI / 2 - side * 0.08;
      brow.position.set(0, 0.052, 0.006);
      eyeSocket.add(brow);

      headGroup.add(eyeSocket);
      return { eyeSocket, pupilGroup, upperLid, lowerLid, brow, irisRing };
    };

    const eyeL = createEyeAssembly(-1);
    const eyeR = createEyeAssembly(1);

    // Nose bridge delicate contour
    const noseBridge = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.008, 0.055, 6, 12)),
      matChampagneSatin
    );
    noseBridge.position.set(0, 0.21, 0.195);
    noseBridge.rotation.x = -0.22;
    headGroup.add(noseBridge);

    // 5. Articulated Jaw & Synchronized Lip Assembly
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, 0.115, 0.055);
    headGroup.add(jawGroup);

    // Contoured ivory-champagne chin plate (sculpted strictly below the lip line)
    const chinPlate = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.106, 24, 18, -Math.PI * 0.44, Math.PI * 0.88, Math.PI * 0.56, Math.PI * 0.38)),
      matIvoryCeramic
    );
    chinPlate.position.set(0, 0.014, 0.0);
    chinPlate.scale.set(0.94, 0.88, 1.02);
    jawGroup.add(chinPlate);

    // Upper lip fixed on head just above jaw seam (gentle Cupid's bow arc)
    const upperLip = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.036, 0.005, 10, 24, Math.PI)),
      matBrushedGold
    );
    upperLip.position.set(0, 0.114, 0.178);
    upperLip.rotation.z = 0;
    upperLip.scale.set(1.22, 0.35, 0.7);
    headGroup.add(upperLip);

    // Lower lip mounted on articulated jawGroup (curves downward to part cleanly when speaking)
    const lowerLip = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.035, 0.005, 10, 24, Math.PI)),
      matBrushedGold
    );
    lowerLip.position.set(0, -0.003, 0.123);
    lowerLip.rotation.z = Math.PI;
    lowerLip.scale.set(1.2, 0.48, 0.7);
    jawGroup.add(lowerLip);

    // Acoustic Harmonic Voice Bar inside the lips (illuminates & expands during speaking)
    const voiceBar = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.004, 0.052, 6, 12)),
      matMouthHarmonic
    );
    voiceBar.rotation.z = Math.PI / 2;
    voiceBar.position.set(0, 0.109, 0.172);
    voiceBar.scale.set(0.9, 0.25, 0.6);
    headGroup.add(voiceBar);

    // 6. Dual Ear Audio-Transducer Halos (Glow on Listening / Speaking)
    const earHaloMat = track(
      new THREE.MeshStandardMaterial({
        color: '#FFE4A8',
        emissive: new THREE.Color('#B5945B'),
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    const buildEar = (side: -1 | 1) => {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.205, 0.255, 0.01);
      earPivot.rotation.y = side * (Math.PI / 2);

      const disc = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.072, 0.072, 0.028, 28)),
        matObsidianFrame
      );
      disc.rotation.x = Math.PI / 2;
      earPivot.add(disc);

      const outerGold = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.074, 0.008, 12, 32)),
        matBrushedGold
      );
      earPivot.add(outerGold);

      const innerRing = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.052, 0.005, 10, 28)),
        earHaloMat
      );
      innerRing.position.z = 0.012;
      earPivot.add(innerRing);

      headGroup.add(earPivot);
      return earPivot;
    };
    buildEar(-1);
    buildEar(1);

    // 7. Subtle Gold Atelier Ambient Dust Particles (lightweight Points)
    const particleCount = compact ? 18 : 42;
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 3.4;
      pPositions[i * 3 + 1] = 0.3 + Math.random() * 2.1;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 2.2 - 0.4;
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = track(
      new THREE.PointsMaterial({
        color: '#E7C582',
        size: compact ? 0.022 : 0.018,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    const dustPoints = new THREE.Points(pGeo, pMat);
    scene.add(dustPoints);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer tracking
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const handlePointerLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    // ResizeObserver for crisp responsive adaptation across desktop, tablet, and mobile viewports
    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(container.clientWidth, 64);
      const h = Math.max(container.clientHeight, 64);
      const aspect = w / h;
      camera.fov = computeFov(aspect);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation State & Kinematics Variables
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    let nextBlinkAt = 2.4;
    let blinkProgress = 0;
    let isBlinking = false;
    let smoothMouthOpen = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      const mode = stateRef.current;

      // 1. Natural Blinking State Machine
      if (!isBlinking && elapsed >= nextBlinkAt) {
        isBlinking = true;
        blinkProgress = 0;
        nextBlinkAt = elapsed + 2.8 + Math.random() * 2.4;
      }
      let blinkFactor = 0;
      if (isBlinking) {
        blinkProgress += delta * 6.5; // crisp ~300ms natural blink
        if (blinkProgress >= Math.PI) {
          isBlinking = false;
          blinkFactor = 0;
        } else {
          blinkFactor = Math.sin(blinkProgress);
        }
      }

      // 2. Target Pose & Expression by RobotState
      let targetHeadYaw = pointerRef.current.x * 0.22 + Math.sin(elapsed * 0.65) * 0.05;
      let targetHeadPitch = -pointerRef.current.y * 0.14 + Math.sin(elapsed * 0.9) * 0.025;
      let targetHeadRoll = Math.sin(elapsed * 0.5) * 0.02;
      let targetTorsoLeanX = 0;
      let targetArmL = 0.03;
      let targetArmR = -0.03;
      let targetEyeColor = _colorIdle;
      let targetEyeIntensity = 2.0;
      let targetBrowLift = 0;
      let targetLidSquint = 0;
      let targetMouthAmp = 0;

      if (mode === 'listening') {
        targetHeadYaw = pointerRef.current.x * 0.12;
        targetHeadPitch = -0.06; // attentive slight forward tilt
        targetHeadRoll = 0.055; // curious listening tilt
        targetTorsoLeanX = 0.04;
        targetEyeColor = _colorListening;
        targetEyeIntensity = 2.8;
        targetBrowLift = 0.008;
        targetLidSquint = -0.004; // eyes widen slightly
      } else if (mode === 'thinking') {
        targetHeadYaw = Math.sin(elapsed * 1.4) * 0.16;
        targetHeadPitch = -0.11 + Math.cos(elapsed * 1.1) * 0.03;
        targetHeadRoll = -0.07;
        targetEyeColor = _colorThinking;
        targetEyeIntensity = 2.1 + Math.sin(elapsed * 6.0) * 0.7;
        targetBrowLift = -0.004;
        targetLidSquint = 0.007;
      } else if (mode === 'speaking') {
        targetHeadYaw = pointerRef.current.x * 0.12 + Math.sin(elapsed * 2.2) * 0.09;
        targetHeadPitch = Math.sin(elapsed * 3.1) * 0.055 - pointerRef.current.y * 0.08;
        targetHeadRoll = Math.cos(elapsed * 1.7) * 0.045;
        targetTorsoLeanX = 0.02;
        targetArmL = 0.07 + Math.sin(elapsed * 2.5) * 0.04;
        targetArmR = -0.07 - Math.sin(elapsed * 2.5) * 0.04;
        targetEyeColor = _colorSpeaking;
        targetEyeIntensity = 2.5;
        targetBrowLift = 0.005 + Math.sin(elapsed * 3.8) * 0.003;
        targetLidSquint = 0.004; // warm smiling lower lid

        // Combine live Web Audio amplitude with natural speech syllable fallback if amplitude is 0
        const liveAmp = speechAmplitudeRef.current;
        const cadenceFallback =
          0.32 +
          0.34 * Math.abs(Math.sin(elapsed * 11.5)) *
            (0.6 + 0.4 * Math.sin(elapsed * 4.3));
        targetMouthAmp = THREE.MathUtils.clamp(liveAmp > 0.03 ? liveAmp : cadenceFallback, 0, 1);
      }

      // 3. Smooth Damped Kinematics
      const dampLambda = 7.5;
      headGroup.rotation.y = THREE.MathUtils.damp(headGroup.rotation.y, targetHeadYaw, dampLambda, delta);
      headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, targetHeadPitch, dampLambda, delta);
      headGroup.rotation.z = THREE.MathUtils.damp(headGroup.rotation.z, targetHeadRoll, dampLambda, delta);

      // Gentle alive breathing float on torso
      const breathY = Math.sin(elapsed * 1.65) * 0.012;
      torsoGroup.position.y = 0.26 + breathY;
      torsoGroup.rotation.x = THREE.MathUtils.damp(torsoGroup.rotation.x, targetTorsoLeanX, 5.0, delta);
      armPivotL.rotation.x = THREE.MathUtils.damp(armPivotL.rotation.x, -targetArmL, 5.5, delta);
      armPivotR.rotation.x = THREE.MathUtils.damp(armPivotR.rotation.x, targetArmR, 5.5, delta);

      // 4. Synchronized Lip & Jaw Movement
      smoothMouthOpen = THREE.MathUtils.damp(smoothMouthOpen, targetMouthAmp, 22.0, delta);
      jawGroup.position.y = 0.115 - smoothMouthOpen * 0.024;
      jawGroup.rotation.x = smoothMouthOpen * 0.16;
      upperLip.position.y = 0.112 + smoothMouthOpen * 0.005;
      voiceBar.scale.set(
        0.85 + smoothMouthOpen * 0.45,
        0.22 + smoothMouthOpen * 2.4,
        0.65
      );
      matMouthHarmonic.emissiveIntensity = mode === 'speaking' ? 1.5 + smoothMouthOpen * 2.5 : 0.7;

      // 5. Eyes, Pupils, Eyelids & Brows
      _workColor.copy(matEyeGlow.emissive).lerp(targetEyeColor, Math.min(1, delta * 8));
      matEyeGlow.emissive.copy(_workColor);
      matEyeGlow.emissiveIntensity = THREE.MathUtils.damp(
        matEyeGlow.emissiveIntensity,
        targetEyeIntensity,
        8,
        delta
      );

      const pupilOffsetX = THREE.MathUtils.clamp(pointerRef.current.x * 0.007, -0.009, 0.009);
      const pupilOffsetY = THREE.MathUtils.clamp(pointerRef.current.y * 0.005, -0.006, 0.006);
      eyeL.pupilGroup.position.set(pupilOffsetX, pupilOffsetY, 0);
      eyeR.pupilGroup.position.set(pupilOffsetX, pupilOffsetY, 0);

      const upperLidY = 0.046 - blinkFactor * 0.043 - Math.max(0, targetLidSquint) * 0.4;
      const lowerLidY = -0.048 + blinkFactor * 0.041 + targetLidSquint;
      eyeL.upperLid.position.y = upperLidY;
      eyeR.upperLid.position.y = upperLidY;
      eyeL.lowerLid.position.y = lowerLidY;
      eyeR.lowerLid.position.y = lowerLidY;

      eyeL.brow.position.y = THREE.MathUtils.damp(eyeL.brow.position.y, 0.052 + targetBrowLift, 9, delta);
      eyeR.brow.position.y = THREE.MathUtils.damp(eyeR.brow.position.y, 0.052 + targetBrowLift, 9, delta);

      // 6. Core Crystal, Ears & Ambient Telemetry Rings
      chestCore.rotation.y += delta * (mode === 'thinking' ? 2.4 : 0.45);
      matCoreCrystal.emissiveIntensity =
        mode === 'speaking'
          ? 1.8 + smoothMouthOpen * 2.2
          : mode === 'listening'
          ? 2.4 + Math.sin(elapsed * 4) * 0.4
          : 1.3 + Math.sin(elapsed * 1.8) * 0.25;

      earHaloMat.emissive.copy(_workColor);
      earHaloMat.emissiveIntensity =
        mode === 'listening'
          ? 2.6 + Math.sin(elapsed * 7) * 0.6
          : mode === 'speaking'
          ? 1.6 + smoothMouthOpen * 1.5
          : 0.75;

      haloRing1.rotation.z = elapsed * (mode === 'thinking' ? 1.4 : 0.25);
      haloRing2.rotation.z = -elapsed * (mode === 'thinking' ? 1.9 : 0.35);
      dustPoints.rotation.y = elapsed * 0.04;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      });
      renderer.dispose();
    };
  }, [compact, speechAmplitudeRef]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full select-none ${className}`}
      aria-label="IMMERSO 3D AI Concierge Robot"
    />
  );
}
