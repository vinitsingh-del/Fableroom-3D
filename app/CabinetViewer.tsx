"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

type Crop = { x: number; y: number; width: number; height: number };
type ViewerState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  cabinet: THREE.Group;
  leftDoor: THREE.Group;
  rightDoor: THREE.Group;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FRONT = `${BASE_PATH}/product/cabinet-front.png`;
const ANGLED = `${BASE_PATH}/product/cabinet-three-quarter.png`;
const REAR = `${BASE_PATH}/product/cabinet-rear.png`;
const OPEN = `${BASE_PATH}/product/cabinet-open.png`;

const INITIAL_CAMERA = new THREE.Vector3(5.6, 4.15, 7.2);
const CAMERA_TARGET = new THREE.Vector3(0, 1.92, 0);

function Icon({ name }: { name: "reset" | "rotate" | "door" | "expand" | "photo" | "download" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    reset: <><path d="M5 7H2V4"/><path d="M2.7 7.1A9 9 0 1 1 4 18.5"/></>,
    rotate: <><path d="M4 12a8 8 0 0 1 13.2-6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.2 6L4 16"/><path d="M4 20v-4h4"/></>,
    door: <><path d="M5 3h13v18H5z"/><path d="m12 4 5 2v13l-5 1z"/><circle cx="15" cy="12" r=".7" fill="currentColor" stroke="none"/></>,
    expand: <><path d="M8 3H3v5"/><path d="m3 3 6 6"/><path d="M16 3h5v5"/><path d="m21 3-6 6"/><path d="M8 21H3v-5"/><path d="m3 21 6-6"/><path d="M16 21h5v-5"/><path d="m21 21-6-6"/></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 5-4 3 2 3-3 5 5"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function loadCrop(renderer: THREE.WebGLRenderer, url: string, crop: Crop, width = 1024) {
  return new Promise<THREE.CanvasTexture>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.max(16, Math.round(width * crop.height / crop.width));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        reject(new Error("Canvas is unavailable"));
        return;
      }
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function standardMaterial(map: THREE.Texture | null, color = 0x8f5d33, roughness = 0.63) {
  return new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness: 0.02,
  });
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material | THREE.Material[],
  castShadow = true,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

async function createCabinet(renderer: THREE.WebGLRenderer, onProgress: (value: number) => void) {
  const [leftFront, rightFront, rear, side, top, leftBack, rightBack] = await Promise.all([
    loadCrop(renderer, FRONT, { x: 286, y: 525, width: 420, height: 1004 }),
    loadCrop(renderer, FRONT, { x: 713, y: 525, width: 420, height: 1004 }),
    loadCrop(renderer, REAR, { x: 382, y: 505, width: 815, height: 1085 }),
    loadCrop(renderer, ANGLED, { x: 1000, y: 545, width: 185, height: 955 }, 420),
    loadCrop(renderer, ANGLED, { x: 420, y: 488, width: 765, height: 118 }, 1024),
    loadCrop(renderer, OPEN, { x: 155, y: 666, width: 350, height: 820 }, 600),
    loadCrop(renderer, OPEN, { x: 760, y: 655, width: 330, height: 905 }, 600),
  ]);
  onProgress(72);
  const cabinet = new THREE.Group();
  cabinet.name = "Hand-Carved Cabinet";

  const width = 3.2;
  const bodyHeight = 3.56;
  const depth = 1.66;
  const baseHeight = 0.32;
  const bodyCenterY = baseHeight + bodyHeight / 2;
  const frontZ = depth / 2 + 0.065;

  const wood = standardMaterial(side, 0xa56e3f, 0.58);
  const innerWood = standardMaterial(null, 0x835233, 0.74);
  const innerBack = standardMaterial(null, 0x704129, 0.79);
  const rearMat = standardMaterial(rear, 0xa06a3d, 0.67);
  const topMat = standardMaterial(top, 0xa87444, 0.55);
  const shelfMaterial = standardMaterial(null, 0x8c5937, 0.66);
  const black = new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 0.31, metalness: 0.56 });

  // A true hollow carcass: separate panels create real depth, corners and occlusion.
  const panelThickness = 0.14;
  const backThickness = 0.08;
  const panelDepth = depth - backThickness;
  const panelCenterZ = backThickness / 2;
  const innerWidth = width - panelThickness * 2;

  const leftSideMaterials: THREE.Material[] = [innerWood, wood, wood, wood, wood, wood];
  const rightSideMaterials: THREE.Material[] = [wood, innerWood, wood, wood, wood, wood];
  const topPanelMaterials: THREE.Material[] = [wood, wood, topMat, innerWood, wood, wood];
  const bottomPanelMaterials: THREE.Material[] = [wood, wood, innerWood, wood, wood, wood];
  const backPanelMaterials: THREE.Material[] = [wood, wood, wood, wood, innerBack, rearMat];

  addBox(
    cabinet,
    [panelThickness, bodyHeight, panelDepth],
    [-width / 2 + panelThickness / 2, bodyCenterY, panelCenterZ],
    leftSideMaterials,
  );
  addBox(
    cabinet,
    [panelThickness, bodyHeight, panelDepth],
    [width / 2 - panelThickness / 2, bodyCenterY, panelCenterZ],
    rightSideMaterials,
  );
  addBox(
    cabinet,
    [innerWidth, panelThickness, panelDepth],
    [0, baseHeight + bodyHeight - panelThickness / 2, panelCenterZ],
    topPanelMaterials,
  );
  addBox(
    cabinet,
    [innerWidth, panelThickness, panelDepth],
    [0, baseHeight + panelThickness / 2, panelCenterZ],
    bottomPanelMaterials,
  );
  addBox(
    cabinet,
    [innerWidth, bodyHeight - panelThickness * 2, backThickness],
    [0, bodyCenterY, -depth / 2 + backThickness / 2],
    backPanelMaterials,
  );

  // The shelf is a full-depth solid board, not a texture painted onto the back.
  addBox(cabinet, [innerWidth - 0.05, 0.11, panelDepth - 0.12], [0, 2.03, panelCenterZ + 0.02], shelfMaterial);
  addBox(cabinet, [innerWidth - 0.05, 0.07, 0.055], [0, 2.03, depth / 2 - 0.045], wood);

  addBox(cabinet, [3.0, baseHeight, 1.48], [0, baseHeight / 2, 0.04], wood);
  addBox(cabinet, [3.38, 0.12, 1.76], [0, baseHeight + bodyHeight + 0.015, 0], topMat);

  const frameDepth = 0.13;
  addBox(cabinet, [0.18, bodyHeight, frameDepth], [-width / 2 + 0.09, bodyCenterY, frontZ], wood);
  addBox(cabinet, [0.18, bodyHeight, frameDepth], [width / 2 - 0.09, bodyCenterY, frontZ], wood);
  addBox(cabinet, [width - 0.24, 0.18, frameDepth], [0, baseHeight + bodyHeight - 0.09, frontZ], wood);
  addBox(cabinet, [width - 0.24, 0.18, frameDepth], [0, baseHeight + 0.09, frontZ], wood);

  const doorHeight = 3.11;
  const doorWidth = 1.385;
  const doorY = baseHeight + 0.22 + doorHeight / 2;
  const doorThickness = 0.10;

  const doorSide = standardMaterial(null, 0x5a331e, 0.67);
  const leftFrontMat = standardMaterial(leftFront, 0xffffff, 0.61);
  const rightFrontMat = standardMaterial(rightFront, 0xffffff, 0.61);
  const leftBackMat = standardMaterial(leftBack, 0xffffff, 0.71);
  const rightBackMat = standardMaterial(rightBack, 0xffffff, 0.71);

  const leftDoor = new THREE.Group();
  leftDoor.name = "Left carved door";
  leftDoor.position.set(-width / 2 + 0.165, doorY, frontZ + 0.11);
  const leftDoorMaterials = [doorSide, doorSide, doorSide, doorSide, leftFrontMat, leftBackMat];
  addBox(leftDoor, [doorWidth, doorHeight, doorThickness], [doorWidth / 2, 0, 0], leftDoorMaterials, false);
  cabinet.add(leftDoor);

  const rightDoor = new THREE.Group();
  rightDoor.name = "Right carved door";
  rightDoor.position.set(width / 2 - 0.165, doorY, frontZ + 0.11);
  const rightDoorMaterials = [doorSide, doorSide, doorSide, doorSide, rightFrontMat, rightBackMat];
  addBox(rightDoor, [doorWidth, doorHeight, doorThickness], [-doorWidth / 2, 0, 0], rightDoorMaterials, false);
  cabinet.add(rightDoor);

  const knobGeometry = new THREE.SphereGeometry(0.105, 24, 16);
  const leftKnob = new THREE.Mesh(knobGeometry, black);
  leftKnob.position.set(doorWidth - 0.13, 0, doorThickness / 2 + 0.07);
  leftKnob.castShadow = true;
  leftDoor.add(leftKnob);
  const rightKnob = leftKnob.clone();
  rightKnob.position.x = -doorWidth + 0.13;
  rightDoor.add(rightKnob);

  const hingeGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.19, 12);
  for (const group of [leftDoor, rightDoor]) {
    for (const y of [-1.2, 1.2]) {
      const hinge = new THREE.Mesh(hingeGeometry, black);
      hinge.position.set(0, y, 0.01);
      group.add(hinge);
    }
  }

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4e2d1b, transparent: true, opacity: 0.15 });
  const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width, bodyHeight, depth)), edgeMaterial);
  bodyEdges.position.set(0, bodyCenterY, 0);
  cabinet.add(bodyEdges);

  onProgress(100);
  return { cabinet, leftDoor, rightDoor };
}

function ControlButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`viewer-control${active ? " is-active" : ""}`} type="button" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export default function CabinetViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewerState | null>(null);
  const frameRef = useRef(0);
  const doorTargetRef = useRef(0);
  const doorsOpenRef = useRef(false);
  const [loading, setLoading] = useState(8);
  const [ready, setReady] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [photoPanel, setPhotoPanel] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [helpVisible, setHelpVisible] = useState(true);
  const [exporting, setExporting] = useState(false);

  const setDoorState = (next: boolean) => {
    doorsOpenRef.current = next;
    setDoorsOpen(next);
    doorTargetRef.current = next ? 1.9 : 0;
    if (next && stateRef.current) {
      stateRef.current.camera.position.lerp(new THREE.Vector3(4.8, 3.65, 6.3), 0.45);
      stateRef.current.controls.target.set(0, 1.9, 0.3);
    }
  };

  const toggleDoors = () => setDoorState(!doorsOpenRef.current);

  const photos = [
    { src: FRONT, label: "Front" },
    { src: ANGLED, label: "Three-quarter" },
    { src: REAR, label: "Rear" },
    { src: OPEN, label: "Open storage" },
    { src: `${BASE_PATH}/product/cabinet-detail.png`, label: "Carving detail" },
    { src: `${BASE_PATH}/product/cabinet-room.png`, label: "In room" },
  ];

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd7d0c4);
    scene.fog = new THREE.Fog(0xd7d0c4, 12, 22);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.copy(INITIAL_CAMERA);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D cabinet viewer");
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.56;
    controls.zoomSpeed = 0.82;
    controls.panSpeed = 0.62;
    controls.minDistance = 4.25;
    controls.maxDistance = 13;
    controls.minPolarAngle = 0.16;
    controls.maxPolarAngle = Math.PI * 0.89;
    controls.autoRotateSpeed = 1.2;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    scene.add(new THREE.HemisphereLight(0xfffbf4, 0x56473e, 2.15));
    const keyLight = new THREE.DirectionalLight(0xfff2dc, 4.2);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.00035;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0xb5c8d2, 1.55);
    rim.position.set(-5, 4, -5);
    scene.add(rim);
    const frontFill = new THREE.PointLight(0xffd5a8, 14, 14, 2);
    frontFill.position.set(-3.6, 3.7, 5.2);
    scene.add(frontFill);
    const interiorFill = new THREE.PointLight(0xffdfbf, 7.5, 9, 2);
    interiorFill.position.set(0, 2.2, 3.25);
    scene.add(interiorFill);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xc5bbae, roughness: 0.88, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.45, 2.48, 96),
      new THREE.MeshBasicMaterial({ color: 0x8c8176, transparent: true, opacity: 0.19, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    scene.add(ring);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const hideHelp = () => setHelpVisible(false);
    renderer.domElement.addEventListener("pointerdown", hideHelp, { once: true });
    renderer.domElement.addEventListener("wheel", hideHelp, { once: true, passive: true });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerStart = new THREE.Vector2();
    let didDrag = false;

    const onCabinetPointerDown = (event: PointerEvent) => {
      pointerStart.set(event.clientX, event.clientY);
      didDrag = false;
      renderer.domElement.style.cursor = "grabbing";
    };

    const onCabinetPointerMove = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) return;
      if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 7) didDrag = true;
    };

    const onCabinetPointerUp = (event: PointerEvent) => {
      renderer.domElement.style.cursor = "grab";
      const state = stateRef.current;
      if (!state || didDrag) return;

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(state.cabinet, true)[0];
      if (!hit) return;

      const next = !doorsOpenRef.current;
      doorsOpenRef.current = next;
      setDoorsOpen(next);
      doorTargetRef.current = next ? 1.9 : 0;
      setHelpVisible(false);
      if (next) {
        camera.position.lerp(new THREE.Vector3(4.8, 3.65, 6.3), 0.45);
        controls.target.set(0, 1.9, 0.3);
      }
    };

    const onCabinetPointerLeave = () => {
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onCabinetPointerDown);
    renderer.domElement.addEventListener("pointermove", onCabinetPointerMove);
    renderer.domElement.addEventListener("pointerup", onCabinetPointerUp);
    renderer.domElement.addEventListener("pointercancel", onCabinetPointerLeave);
    renderer.domElement.addEventListener("pointerleave", onCabinetPointerLeave);

    createCabinet(renderer, setLoading).then(({ cabinet, leftDoor, rightDoor }) => {
      if (disposed) return;
      scene.add(cabinet);
      stateRef.current = { scene, camera, controls, renderer, cabinet, leftDoor, rightDoor };
      setReady(true);
      setTimeout(() => setHelpVisible(true), 300);
    }).catch(() => {
      if (!disposed) setLoading(-1);
    });

    const clock = new THREE.Clock();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);
      controls.update(delta);
      const state = stateRef.current;
      if (state) {
        const target = doorTargetRef.current;
        state.leftDoor.rotation.y = THREE.MathUtils.damp(state.leftDoor.rotation.y, -target, 7, delta);
        state.rightDoor.rotation.y = THREE.MathUtils.damp(state.rightDoor.rotation.y, target, 7, delta);
      }
      renderer.render(scene, camera);
    };
    animate();

    const keyHandler = (event: KeyboardEvent) => {
      if (!stateRef.current) return;
      if (event.key === "r" || event.key === "R") resetView();
      if (event.key === " ") {
        event.preventDefault();
        setAutoRotate((value) => !value);
      }
      if (event.key === "+" || event.key === "=") {
        camera.position.lerp(controls.target, 0.08);
      }
      if (event.key === "-") {
        camera.position.lerp(controls.target, -0.08);
      }
    };
    window.addEventListener("keydown", keyHandler);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      window.removeEventListener("keydown", keyHandler);
      renderer.domElement.removeEventListener("pointerdown", onCabinetPointerDown);
      renderer.domElement.removeEventListener("pointermove", onCabinetPointerMove);
      renderer.domElement.removeEventListener("pointerup", onCabinetPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onCabinetPointerLeave);
      renderer.domElement.removeEventListener("pointerleave", onCabinetPointerLeave);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      stateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stateRef.current) stateRef.current.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  const resetView = () => {
    const state = stateRef.current;
    if (!state) return;
    state.camera.position.copy(INITIAL_CAMERA);
    state.controls.target.copy(CAMERA_TARGET);
    state.controls.update();
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (!document.fullscreenElement) await shellRef.current.requestFullscreen();
    else await document.exitFullscreen();
  };

  const exportModel = async () => {
    const state = stateRef.current;
    if (!state || exporting) return;
    setExporting(true);
    const previousLeft = state.leftDoor.rotation.y;
    const previousRight = state.rightDoor.rotation.y;
    state.leftDoor.rotation.y = 0;
    state.rightDoor.rotation.y = 0;
    const exporter = new GLTFExporter();
    try {
      const result = await exporter.parseAsync(state.cabinet, { binary: true, onlyVisible: true });
      const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "hand-carved-cabinet.glb";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } finally {
      state.leftDoor.rotation.y = previousLeft;
      state.rightDoor.rotation.y = previousRight;
      setExporting(false);
    }
  };

  return (
    <div ref={shellRef} className="viewer-shell">
      <div ref={mountRef} className="canvas-mount" />

      <header className="model-header">
        <div>
          <div className="model-kicker"><span /> Interactive 3D asset</div>
          <h1>Hand-Carved Cabinet</h1>
          <p>Click or tap the cabinet to open it and inspect the shelves inside.</p>
        </div>
      </header>

      {!ready && (
        <div className="loading-screen" role="status" aria-live="polite">
          {loading >= 0 ? (
            <>
              <div className="loading-orbit"><i /><i /><i /></div>
              <strong>Building the cabinet</strong>
              <span>{loading}% · mapping original details</span>
              <div className="loading-track"><b style={{ width: `${loading}%` }} /></div>
            </>
          ) : (
            <><strong>3D could not start</strong><span>Please refresh or use a WebGL-capable browser.</span></>
          )}
        </div>
      )}

      {ready && helpVisible && (
        <div className="gesture-help" aria-hidden="true">
          <div className="mouse-gesture"><i /></div>
          <strong>Click the cabinet to open</strong>
          <span>Drag to rotate · scroll or pinch to zoom</span>
        </div>
      )}

      <div className="control-rail" aria-label="3D viewer controls">
        <ControlButton icon="reset" label="Reset view" onClick={resetView} />
        <ControlButton icon="rotate" label={autoRotate ? "Stop rotation" : "Auto rotate"} active={autoRotate} onClick={() => setAutoRotate((value) => !value)} />
        <ControlButton icon="door" label={doorsOpen ? "Close doors" : "Open doors"} active={doorsOpen} onClick={toggleDoors} />
        <ControlButton icon="photo" label="Original photos" active={photoPanel} onClick={() => setPhotoPanel((value) => !value)} />
        <ControlButton icon="download" label={exporting ? "Preparing asset" : "Download GLB"} onClick={exportModel} />
        <ControlButton icon="expand" label="Fullscreen" onClick={toggleFullscreen} />
      </div>

      <div className="viewer-footer">
        <div className="interaction-key"><b>Click cabinet</b> open / close <span>·</span> <b>Orbit</b> 360° <span>·</span> <b>Zoom</b> 4×</div>
        <button type="button" className="door-cta" onClick={toggleDoors} aria-pressed={doorsOpen}>
          <span>{doorsOpen ? "Close cabinet" : "Open cabinet"}</span>
          <i className={doorsOpen ? "open" : ""}>↗</i>
        </button>
      </div>

      <aside className={`photo-panel${photoPanel ? " is-open" : ""}`} aria-hidden={!photoPanel}>
        <div className="photo-panel-head">
          <div><small>Source imagery</small><strong>Original photos</strong></div>
          <button type="button" onClick={() => setPhotoPanel(false)} aria-label="Close original photos">×</button>
        </div>
        <div className="active-photo">
          {/* The original file is displayed directly, without filters or retouching. */}
          <img src={photos[activePhoto].src} alt={`${photos[activePhoto].label} view of the hand-carved cabinet`} />
          <span>{photos[activePhoto].label}</span>
        </div>
        <div className="photo-thumbnails">
          {photos.map((photo, index) => (
            <button type="button" key={photo.src} className={activePhoto === index ? "is-active" : ""} onClick={() => setActivePhoto(index)} aria-label={`Show ${photo.label} photo`}>
              <img src={photo.src} alt="" />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
