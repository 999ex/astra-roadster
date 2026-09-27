import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const PEDESTAL_HEIGHT = 0.08;

function createPolarGrid() {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x3a4050, transparent: true, opacity: 0.55 });
  for (const r of [4, 6, 8, 11, 15, 20]) {
    const pts = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const p = (r) => new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p(3.4), p(20)]), mat));
  }
  return g;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(5.6, 2.4, 4.8);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.55, 0);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 16, maxPolarAngle: 1.5, enablePan: false });

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  key.shadow.bias = -0.0005;
  const rim = new THREE.DirectionalLight(0xffe2c4, 1.0);
  rim.position.set(-5, 3, -4);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.35);
  scene.add(key, rim, hemi);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, PEDESTAL_HEIGHT, 96), new THREE.MeshStandardMaterial({ color: 0xd9ccb4, metalness: 0.2, roughness: 0.45 }));
  disc.position.y = PEDESTAL_HEIGHT / 2;
  disc.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.025, 12, 128), new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = PEDESTAL_HEIGHT;
  const inset = new THREE.Mesh(new THREE.CircleGeometry(2.7, 96), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.35 }));
  inset.rotation.x = -Math.PI / 2;
  inset.position.y = PEDESTAL_HEIGHT + 0.001;
  inset.receiveShadow = true;
  scene.add(disc, ring, inset);

  const grid = createPolarGrid();
  const mirror = new Reflector(new THREE.CircleGeometry(40, 64), { textureWidth: 1024, textureHeight: 1024, color: 0x888888 });
  mirror.rotation.x = -Math.PI / 2;
  const tint = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({ color: 0xe9ddd0, transparent: true, opacity: 0.78 }));
  tint.rotation.x = -Math.PI / 2;
  tint.position.y = 0.002;
  scene.add(grid, mirror, tint);

  const car = new THREE.Group();
  car.position.y = PEDESTAL_HEIGHT;
  scene.add(car);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, controls, car, floors: { grid, mirror, tint }, lights: { key, rim, hemi } };
}
