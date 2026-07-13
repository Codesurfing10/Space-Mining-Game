import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// three-renderer.js (ES module)
// Full 3D renderer: InstancedMesh asteroids, 3D ship, shadows, bloom, and particle Points synced to the game's particle list (G.particles).
// Exposes window.renderThree(dt) and window.initThreeRenderer() for the existing game loop.

const threeState = {
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  ship: null,
  asteroidInst: null,
  particlePoints: null,
  maxAsteroids: 600,
  worldCenterX: 0,
  worldCenterY: 0,
  tempMat: new THREE.Matrix4()
};

function createShipMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    metalness: 0.25,
    roughness: 0.45,
    emissive: 0x001a22,
    emissiveIntensity: 0.3
  });

  // nose
  const noseGeo = new THREE.ConeGeometry(6, 14, 6);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.x = 6;
  nose.castShadow = true;
  nose.receiveShadow = true;
  group.add(nose);

  // mid body
  const midGeo = new THREE.BoxGeometry(6, 6, 6);
  const mid = new THREE.Mesh(midGeo, bodyMat);
  mid.position.x = -2;
  mid.castShadow = true;
  mid.receiveShadow = true;
  group.add(mid);

  // cockpit - emissive (bloom target)
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.9 });
  const cockpitGeo = new THREE.SphereGeometry(2.2, 12, 8);
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.x = 2.8;
  cockpit.position.z = 1.2;
  cockpit.castShadow = false;
  cockpit.receiveShadow = false;
  // mark cockpit as high-emissive by setting userData
  cockpit.userData.isEmissive = true;
  group.add(cockpit);

  // thruster outer
  const thrusterMat = new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0xff6b35, emissiveIntensity: 0.45 });
  const thrGeo = new THREE.CylinderGeometry(1.5, 2.6, 5, 8);
  const thr = new THREE.Mesh(thrGeo, thrusterMat);
  thr.rotation.z = Math.PI / 2;
  thr.position.x = -8;
  thr.castShadow = false;
  thr.receiveShadow = false;
  thr.userData.isEmissive = true;
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
  threeState.renderer.outputEncoding = THREE.sRGBEncoding;
  threeState.renderer.shadowMap.enabled = true;
  threeState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  threeState.renderer.setSize(window.innerWidth, window.innerHeight);
  threeState.renderer.domElement.style.position = 'absolute';
  threeState.renderer.domElement.style.inset = '0';
  threeState.renderer.domElement.style.zIndex = '0';
  threeState.renderer.domElement.style.pointerEvents = 'none';
  document.getElementById('threeContainer').appendChild(threeState.renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0x909aa7, 0.6);
  threeState.scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(0.6, 1, 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -800;
  sun.shadow.camera.right = 800;
  sun.shadow.camera.top = 800;
  sun.shadow.camera.bottom = -800;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 4000;
  threeState.scene.add(sun);

  const rim = new THREE.DirectionalLight(0x66ccff, 0.18);
  rim.position.set(-1, -0.4, 0.3).normalize();
  threeState.scene.add(rim);

  // Ship
  threeState.ship = createShipMesh();
  threeState.ship.scale.set(1.4, 1.4, 1.4);
  threeState.ship.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  threeState.scene.add(threeState.ship);

  // Instanced asteroids (low-poly but 3D)
  const astGeo = new THREE.IcosahedronGeometry(1, 1);
  const astMat = new THREE.MeshStandardMaterial({
    color: 0xc0a060,
    roughness: 0.78,
    metalness: 0.06,
    emissive: 0x050000,
    emissiveIntensity: 0.08
  });
  threeState.asteroidInst = new THREE.InstancedMesh(astGeo, astMat, threeState.maxAsteroids);
  threeState.asteroidInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  threeState.asteroidInst.castShadow = true;
  threeState.asteroidInst.receiveShadow = true;
  threeState.asteroidInst.frustumCulled = false;
  threeState.scene.add(threeState.asteroidInst);

  // ground plane for shadows (invisible, just receive shadows slightly) - large disk
  const planeGeo = new THREE.PlaneGeometry(CFG.world.w * 2, CFG.world.h * 2);
  const planeMat = new THREE.ShadowMaterial({ opacity: 0.12 });
  const shadowPlane = new THREE.Mesh(planeGeo, planeMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.z = -200; // put far below so it doesn't intersect
  shadowPlane.receiveShadow = true;
  threeState.scene.add(shadowPlane);

  // starfield
  const starCount = 1100;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    pos[i*3]   = (Math.random() - 0.5) * CFG.world.w;
    pos[i*3+1] = (Math.random() - 0.5) * CFG.world.h;
    pos[i*3+2] = -300 - Math.random() * 1500;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.9 });
  const stars = new THREE.Points(starGeo, starMat);
  threeState.scene.add(stars);

  // Particles Points (we will update positions from G.particles each frame)
  const maxParticles = 1200;
  const pPositions = new Float32Array(maxParticles * 3);
  const pSizes = new Float32Array(maxParticles);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));
  const spriteCanvas = document.createElement('canvas'); spriteCanvas.width = 64; spriteCanvas.height = 64;
  const sc = spriteCanvas.getContext('2d');
  sc.fillStyle = 'black'; sc.fillRect(0,0,64,64);
  sc.globalCompositeOperation = 'lighter';
  const grd = sc.createRadialGradient(32,32,2,32,32,30);
  grd.addColorStop(0,'rgba(255,255,255,1)');
  grd.addColorStop(0.25,'rgba(255,200,120,0.9)');
  grd.addColorStop(1,'rgba(255,120,40,0)');
  sc.fillStyle = grd; sc.fillRect(0,0,64,64);
  const spriteTex = new THREE.CanvasTexture(spriteCanvas);
  spriteTex.encoding = THREE.sRGBEncoding;
  const pMat = new THREE.PointsMaterial({ map: spriteTex, size: 8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  threeState.particlePoints = { points, maxParticles, pPositions, pSizes, geo: pGeo };
  threeState.scene.add(points);

  // composer + bloom (global bloom applied; emissive elements will bloom strongly)
  const composer = new EffectComposer(threeState.renderer);
  composer.addPass(new RenderPass(threeState.scene, threeState.camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.1, 0.45, 0.12);
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

// helper vectors
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

function updateInstancedAsteroids() {
  if (!threeState.asteroidInst || !G) return;
  const count = Math.min(G.asteroids.length, threeState.maxAsteroids);
  let i = 0;
  for (; i < count; i++) {
    const a = G.asteroids[i];
    // map world xy to scene, add slight z variance for depth
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
  // cockpit pulse linked to speed
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const cockpit = threeState.ship.children.find(c => c.userData && c.userData.isEmissive);
  if (cockpit && cockpit.material) {
    const intensity = Math.min(1.6, 0.6 + speed * 0.003);
    cockpit.material.emissiveIntensity = intensity;
    cockpit.material.needsUpdate = true;
  }
}

function updateParticles() {
  if (!threeState.particlePoints || !G) return;
  const pp = threeState.particlePoints;
  const max = pp.maxParticles;
  const positions = pp.pPositions;
  const sizes = pp.pSizes;
  const len = Math.min(G.particles.length, max);
  for (let i = 0; i < len; i++) {
    const P = G.particles[i];
    positions[i*3] = P.x - threeState.worldCenterX;
    positions[i*3+1] = P.y - threeState.worldCenterY;
    positions[i*3+2] = -10 + (P.r || 2) * 0.3; // slight Z offset
    sizes[i] = (P.r || 1) * 2.5;
  }
  // hide remainder
  for (let i = len; i < max; i++) {
    positions[i*3] = 99999; positions[i*3+1] = 99999; positions[i*3+2] = 99999; sizes[i] = 0;
  }
  pp.geo.attributes.position.needsUpdate = true;
  pp.geo.attributes.size.needsUpdate = true;
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
  updateParticles();

  // render scene with bloom composer
  threeState.composer.render();
}

// expose to non-module code
window.initThreeRenderer = initThreeRendererIfNeeded;
window.renderThree = renderThree;
