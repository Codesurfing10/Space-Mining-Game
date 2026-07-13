import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// three-renderer.js (ES module)
// Adds instanced asteroids, a 3D ship mesh, a starfield, and bloom postprocessing.
// Exposes window.renderThree(dt) and window.initThreeRenderer() for the existing game loop.

const threeState = {
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  ship: null,
  asteroidInst: null,
  maxAsteroids: 500,
  worldCenterX: 0,
  worldCenterY: 0,
  tempMat: new THREE.Matrix4()
};

function createShipMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    metalness: 0.2,
    roughness: 0.4,
    emissive: 0x002233,
    emissiveIntensity: 0.25
  });

  const noseGeo = new THREE.ConeGeometry(6, 14, 6);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.x = 6;
  group.add(nose);

  const midGeo = new THREE.BoxGeometry(6, 6, 6);
  const mid = new THREE.Mesh(midGeo, bodyMat);
  mid.position.x = -2;
  group.add(mid);

  // cockpit (emissive)
  const cockpitMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const cockpitGeo = new THREE.SphereGeometry(2.2, 12, 8);
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.x = 2.8;
  cockpit.position.z = 1.2;
  group.add(cockpit);

  // thruster glow
  const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.9 });
  const thrGeo = new THREE.CylinderGeometry(1.5, 2.6, 5, 8);
  const thr = new THREE.Mesh(thrGeo, thrusterMat);
  thr.rotation.z = Math.PI / 2;
  thr.position.x = -8;
  group.add(thr);

  return group;
}

function initThreeRendererIfNeeded() {
  if (threeState.scene) return;

  threeState.worldCenterX = CFG.world.w / 2;
  threeState.worldCenterY = CFG.world.h / 2;

  threeState.scene = new THREE.Scene();
  threeState.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);

  threeState.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  threeState.renderer.setSize(window.innerWidth, window.innerHeight);
  threeState.renderer.domElement.style.position = 'absolute';
  threeState.renderer.domElement.style.inset = '0';
  threeState.renderer.domElement.style.zIndex = '0';
  threeState.renderer.domElement.style.pointerEvents = 'none';
  document.getElementById('threeContainer').appendChild(threeState.renderer.domElement);

  // Lighting
  threeState.scene.add(new THREE.AmbientLight(0x888888, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(1, 1, 0.7).normalize();
  threeState.scene.add(dir);
  const rim = new THREE.DirectionalLight(0x66ccff, 0.22);
  rim.position.set(-1, -0.4, 0.3).normalize();
  threeState.scene.add(rim);

  // Ship
  threeState.ship = createShipMesh();
  threeState.ship.scale.set(1.4, 1.4, 1.4);
  threeState.scene.add(threeState.ship);

  // Instanced asteroids
  const astGeo = new THREE.IcosahedronGeometry(1, 1);
  const astMat = new THREE.MeshStandardMaterial({
    color: 0xc0a060,
    roughness: 0.78,
    metalness: 0.05,
    emissive: 0x080000,
    emissiveIntensity: 0.15
  });
  threeState.asteroidInst = new THREE.InstancedMesh(astGeo, astMat, threeState.maxAsteroids);
  threeState.asteroidInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  threeState.asteroidInst.frustumCulled = false;
  threeState.scene.add(threeState.asteroidInst);

  // Starfield
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i*3]   = (Math.random() - 0.5) * CFG.world.w;
    positions[i*3+1] = (Math.random() - 0.5) * CFG.world.h;
    positions[i*3+2] = -300 - Math.random() * 1500;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.9 });
  const stars = new THREE.Points(starGeo, starMat);
  threeState.scene.add(stars);

  // Composer + bloom
  const composer = new EffectComposer(threeState.renderer);
  composer.addPass(new RenderPass(threeState.scene, threeState.camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.35, 0.15);
  composer.addPass(bloom);
  threeState.composer = composer;
  threeState._bloomPass = bloom;

  window.addEventListener('resize', () => {
    threeState.camera.aspect = window.innerWidth / window.innerHeight;
    threeState.camera.updateProjectionMatrix();
    threeState.renderer.setSize(window.innerWidth, window.innerHeight);
    threeState.composer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  window._three_state = threeState;
}

// helpers for instanced updates
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

function updateInstancedAsteroids() {
  if (!threeState.asteroidInst || !G) return;
  const count = Math.min(G.asteroids.length, threeState.maxAsteroids);
  let i = 0;
  for (; i < count; i++) {
    const a = G.asteroids[i];
    tmpPos.set(a.x - threeState.worldCenterX, a.y - threeState.worldCenterY, Math.sin(a.angle*3 + a.x*0.001) * 6);
    tmpQuat.setFromEuler(new THREE.Euler(0, 0, a.angle));
    tmpScale.setScalar(Math.max(0.12, a.r / 12));
    threeState.tempMat.compose(tmpPos, tmpQuat, tmpScale);
    threeState.asteroidInst.setMatrixAt(i, threeState.tempMat);
  }
  for (; i < threeState.maxAsteroids; i++) {
    tmpPos.set(99999, 99999, 99999);
    tmpQuat.identity();
    tmpScale.setScalar(0.0001);
    threeState.tempMat.compose(tmpPos, tmpQuat, tmpScale);
    threeState.asteroidInst.setMatrixAt(i, threeState.tempMat);
  }
  threeState.asteroidInst.instanceMatrix.needsUpdate = true;
  threeState.asteroidInst.count = count;
}

function syncShipMesh() {
  const p = G.player;
  threeState.ship.position.set(p.x - threeState.worldCenterX, p.y - threeState.worldCenterY, 0);
  threeState.ship.rotation.set(0, 0, -p.angle + Math.PI / 2);
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const cockpit = threeState.ship.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
  if (cockpit && cockpit.material) {
    const intensity = Math.min(1.6, 0.6 + speed * 0.003);
    cockpit.material.opacity = Math.min(1, intensity);
    cockpit.material.needsUpdate = true;
  }
}

export function renderThree(dt = 0) {
  if (typeof G === 'undefined' || !G) return;
  initThreeRendererIfNeeded();

  const p = G.player;
  const camX = p.x - threeState.worldCenterX;
  const camY = p.y - threeState.worldCenterY;
  const desiredZ = Math.max(420, 220 + Math.hypot(p.vx || 0, p.vy || 0) * 6);
  threeState.camera.position.lerp(new THREE.Vector3(camX, camY, desiredZ), 0.06);
  threeState.camera.lookAt(new THREE.Vector3(camX, camY, 0));

  updateInstancedAsteroids();
  syncShipMesh();

  threeState.composer.render();
}

// expose to non-module code
window.initThreeRenderer = initThreeRendererIfNeeded;
window.renderThree = renderThree;
