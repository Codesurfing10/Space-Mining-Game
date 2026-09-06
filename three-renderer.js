/**
 * three-renderer.js — Improved 3D layer for A·R·I·A
 * Loads Three.js + bloom; syncs ship, asteroids, debris, drones, mines, particles.
 */

(function () {
  window.renderThree = function () {};
  window.initThreeRenderer = function () {};

  async function bootstrap() {
    try {
      const THREE = await import('https://unpkg.com/three@0.158.0/build/three.module.js');
      const { EffectComposer } = await import('https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js');
      const { RenderPass } = await import('https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js');
      const { UnrealBloomPass } = await import('https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js');

      const state = {
        scene: null,
        camera: null,
        renderer: null,
        composer: null,
        ship: null,
        asteroidInst: null,
        debrisInst: null,
        droneMeshes: [],
        mineMeshes: [],
        laserGroup: null,
        particlePoints: null,
        maxAsteroids: 80,
        maxDebris: 80,
        maxDrones: 20,
        maxMines: 30,
        worldCX: 0,
        worldCY: 0,
        tempMat: new THREE.Matrix4(),
        tmpPos: new THREE.Vector3(),
        tmpQuat: new THREE.Quaternion(),
        tmpScale: new THREE.Vector3(),
        tmpEuler: new THREE.Euler()
      };

      function createShip() {
        const g = new THREE.Group();
        const hullMat = new THREE.MeshStandardMaterial({
          color: 0x1a9ec4, metalness: 0.55, roughness: 0.32,
          emissive: 0x003850, emissiveIntensity: 0.4
        });
        const accentMat = new THREE.MeshStandardMaterial({
          color: 0x00e5ff, metalness: 0.6, roughness: 0.25,
          emissive: 0x00aacc, emissiveIntensity: 0.55
        });
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x0a6a8a, metalness: 0.65, roughness: 0.28,
          emissive: 0x002233, emissiveIntensity: 0.25
        });
        const cargoMat = new THREE.MeshStandardMaterial({
          color: 0x2a3a48, metalness: 0.4, roughness: 0.55,
          emissive: 0x111820, emissiveIntensity: 0.2
        });
        const cargoGlow = new THREE.MeshStandardMaterial({
          color: 0xffc846, metalness: 0.3, roughness: 0.4,
          emissive: 0xaa7700, emissiveIntensity: 0.35
        });
        const cockMat = new THREE.MeshStandardMaterial({
          color: 0xaaffff, emissive: 0x00ffff, emissiveIntensity: 1.1,
          transparent: true, opacity: 0.92, metalness: 0.1, roughness: 0.1
        });
        const thrMat = new THREE.MeshStandardMaterial({
          color: 0xff6b35, emissive: 0xff4400, emissiveIntensity: 1.2
        });

        // Main fuselage
        const body = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 5.5), hullMat);
        body.position.set(-1, 0, 0);
        g.add(body);

        // Nose cone
        const nose = new THREE.Mesh(new THREE.ConeGeometry(3.2, 12, 8), hullMat);
        nose.rotation.z = -Math.PI / 2;
        nose.position.set(10, 0, 0);
        g.add(nose);

        // Cargo hull (rear belly bay)
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7.5), cargoMat);
        cargo.position.set(-8, -1.2, 0);
        cargo.userData.cargoHull = true;
        g.add(cargo);
        // Cargo stripe lights
        for (let i = 0; i < 3; i++) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 6.8), cargoGlow);
          stripe.position.set(-5 - i * 2.2, -3.2, 0);
          g.add(stripe);
        }
        // Cargo door frame
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 5), accentMat);
        door.position.set(-12.5, -1, 0);
        g.add(door);

        // Swept wings
        const wingShape = (side) => {
          const w = new THREE.Group();
          const main = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 14), wingMat);
          main.position.set(-2, 0, side * 9);
          main.rotation.y = side * 0.18;
          main.rotation.z = side * 0.08;
          w.add(main);
          // Wing tip fin
          const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.6), accentMat);
          fin.position.set(-4, 1.5, side * 15);
          w.add(fin);
          // Engine pod under wing
          const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 5, 8), hullMat);
          pod.rotation.z = Math.PI / 2;
          pod.position.set(-3, -1.5, side * 10);
          w.add(pod);
          const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 8), thrMat);
          glow.rotation.z = Math.PI / 2;
          glow.position.set(-5.5, -1.5, side * 10);
          glow.userData.thruster = true;
          w.add(glow);
          return w;
        };
        g.add(wingShape(1));
        g.add(wingShape(-1));

        // Dorsal fin
        const fin = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 0.7), wingMat);
        fin.position.set(-3, 4, 0);
        fin.rotation.z = 0.15;
        g.add(fin);

        // Cockpit canopy
        const cock = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), cockMat);
        cock.position.set(4, 2.8, 0);
        cock.scale.set(1.3, 0.85, 1);
        cock.userData.emissive = true;
        g.add(cock);

        // Main rear thruster
        const thr = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 6, 10), thrMat);
        thr.rotation.z = Math.PI / 2;
        thr.position.set(-14, 0, 0);
        thr.userData.thruster = true;
        g.add(thr);

        // Hull running lights
        for (const z of [-2.5, 2.5]) {
          const lite = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 2 })
          );
          lite.position.set(6, 0.5, z);
          g.add(lite);
        }

        g.scale.setScalar(1.05);
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        return g;
      }

      function init() {
        if (state.scene) return;
        if (typeof CFG === 'undefined') return;

        state.worldCX = CFG.world.w / 2;
        state.worldCY = CFG.world.h / 2;

        state.scene = new THREE.Scene();
        state.scene.fog = new THREE.FogExp2(0x030a14, 0.00028);
        state.scene.background = null;

        state.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 2, 12000);

        state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        state.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.outputColorSpace = THREE.SRGBColorSpace;
        state.renderer.shadowMap.enabled = true;
        state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        state.renderer.domElement.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;';
        document.getElementById('threeContainer')?.appendChild(state.renderer.domElement);

        // Lights
        state.scene.add(new THREE.AmbientLight(0x445566, 0.4));
        state.scene.add(new THREE.HemisphereLight(0x224466, 0x020810, 0.55));
        const sun = new THREE.DirectionalLight(0xfff0dd, 1.25);
        sun.position.set(400, 600, 300);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -900;
        sun.shadow.camera.right = 900;
        sun.shadow.camera.top = 900;
        sun.shadow.camera.bottom = -900;
        sun.shadow.camera.far = 3500;
        state.scene.add(sun);
        const rim = new THREE.DirectionalLight(0x4488ff, 0.45);
        const point = new THREE.PointLight(0x00c8ff, 0.8, 2000);
        point.position.set(0, 0, 120);
        state.scene.add(point);
        state.pointLight = point;
        rim.position.set(-500, -200, 200);
        state.scene.add(rim);

        // Stars
        const starN = 2800;
        const starPos = new Float32Array(starN * 3);
        for (let i = 0; i < starN; i++) {
          starPos[i * 3] = (Math.random() - 0.5) * CFG.world.w * 1.4;
          starPos[i * 3 + 1] = (Math.random() - 0.5) * CFG.world.h * 1.4;
          starPos[i * 3 + 2] = -200 - Math.random() * 2500;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        state.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
          color: 0xcce8ff, size: 2.2, transparent: true, opacity: 0.9, sizeAttenuation: true
        })));

        // Nebula clouds (soft sprites)
        const nebulaGroup = new THREE.Group();
        const nebulaColors = [0x0a2040, 0x1a1040, 0x042030, 0x201028];
        for (let i = 0; i < 14; i++) {
          const geo = new THREE.SphereGeometry(180 + Math.random() * 320, 16, 12);
          const mat = new THREE.MeshBasicMaterial({
            color: nebulaColors[i % nebulaColors.length],
            transparent: true, opacity: 0.04 + Math.random() * 0.05,
            depthWrite: false
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(
            (Math.random() - 0.5) * CFG.world.w * 0.9,
            (Math.random() - 0.5) * CFG.world.h * 0.9,
            -400 - Math.random() * 1200
          );
          nebulaGroup.add(mesh);
        }
        state.scene.add(nebulaGroup);
        state.nebulaGroup = nebulaGroup;

        // Ship
        state.ship = createShip();
        state.scene.add(state.ship);

        // Asteroids instanced
        const astGeo = new THREE.IcosahedronGeometry(1, 1);
        const astMat = new THREE.MeshStandardMaterial({
          color: 0xc0a060, roughness: 0.82, metalness: 0.08,
          emissive: 0x1a0a00, emissiveIntensity: 0.1
        });
        state.asteroidInst = new THREE.InstancedMesh(astGeo, astMat, state.maxAsteroids);
        state.asteroidInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        state.asteroidInst.castShadow = true;
        state.asteroidInst.receiveShadow = true;
        state.asteroidInst.frustumCulled = false;
        state.scene.add(state.asteroidInst);

        // Debris instanced
        const debGeo = new THREE.BoxGeometry(1, 0.6, 0.4);
        const debMat = new THREE.MeshStandardMaterial({
          color: 0x8899cc, metalness: 0.6, roughness: 0.35,
          emissive: 0x223355, emissiveIntensity: 0.2
        });
        state.debrisInst = new THREE.InstancedMesh(debGeo, debMat, state.maxDebris);
        state.debrisInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        state.debrisInst.frustumCulled = false;
        state.scene.add(state.debrisInst);

        // Drone pool
        const droneGeo = new THREE.ConeGeometry(5, 14, 5);
        const droneMat = new THREE.MeshStandardMaterial({
          color: 0xff4060, emissive: 0xff2040, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.4
        });
        for (let i = 0; i < state.maxDrones; i++) {
          const m = new THREE.Mesh(droneGeo, droneMat.clone());
          m.visible = false;
          m.castShadow = true;
          state.scene.add(m);
          state.droneMeshes.push(m);
        }

        // Mine pool
        const mineGeo = new THREE.SphereGeometry(6, 10, 8);
        const mineMat = new THREE.MeshStandardMaterial({
          color: 0xff4060, emissive: 0xff0000, emissiveIntensity: 0.6, roughness: 0.3
        });
        for (let i = 0; i < state.maxMines; i++) {
          const m = new THREE.Mesh(mineGeo, mineMat.clone());
          m.visible = false;
          state.scene.add(m);
          state.mineMeshes.push(m);
        }

        // Laser lines group
        state.laserGroup = new THREE.Group();
        state.scene.add(state.laserGroup);

        // Particles
        const maxP = 500;
        const pPos = new Float32Array(maxP * 3);
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        const pMat = new THREE.PointsMaterial({
          color: 0xffaa55, size: 6, transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        });
        state.particlePoints = { points: new THREE.Points(pGeo, pMat), max: maxP, pos: pPos, geo: pGeo };
        state.particlePoints.points.frustumCulled = false;
        state.scene.add(state.particlePoints.points);

        // Station groups (HQ / docks / control centers)
        state.stationMeshes = [];
        function makeStationMesh(type) {
          const g = new THREE.Group();
          if (type === 'hq') {
            // Large command deck platform
            const deck = new THREE.Mesh(
              new THREE.CylinderGeometry(120, 130, 8, 8),
              new THREE.MeshStandardMaterial({
                color: 0x0a2830, metalness: 0.6, roughness: 0.35,
                emissive: 0x0a4038, emissiveIntensity: 0.35
              })
            );
            deck.rotation.x = Math.PI / 2;
            g.add(deck);
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(115, 3, 8, 8),
              new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x2dd4bf, emissiveIntensity: 1.1 })
            );
            ring.position.z = 5;
            g.add(ring);
            const ring2 = new THREE.Mesh(
              new THREE.TorusGeometry(70, 2, 8, 8),
              new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.9 })
            );
            ring2.position.z = 8;
            g.add(ring2);
            // Superstructure
            const keep = new THREE.Mesh(
              new THREE.BoxGeometry(50, 40, 28),
              new THREE.MeshStandardMaterial({ color: 0x1a3a48, metalness: 0.55, roughness: 0.3, emissive: 0x0a2028, emissiveIntensity: 0.3 })
            );
            keep.position.z = 22;
            g.add(keep);
            // Bridge tower
            const bridge = new THREE.Mesh(
              new THREE.BoxGeometry(22, 18, 36),
              new THREE.MeshStandardMaterial({ color: 0x245060, metalness: 0.5, roughness: 0.28, emissive: 0x00e5a0, emissiveIntensity: 0.25 })
            );
            bridge.position.set(0, 0, 48);
            g.add(bridge);
            // Core glow
            const core = new THREE.Mesh(
              new THREE.SphereGeometry(12, 16, 12),
              new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x5eead4, emissiveIntensity: 1.4 })
            );
            core.position.z = 12;
            g.add(core);
            const pl = new THREE.PointLight(0x5eead4, 2.0, 600);
            pl.position.z = 40;
            g.add(pl);
          } else if (type === 'dock') {
            // Hangar box
            const bay = new THREE.Mesh(
              new THREE.BoxGeometry(90, 55, 12),
              new THREE.MeshStandardMaterial({ color: 0x0c1a2e, metalness: 0.55, roughness: 0.4, emissive: 0x0a1525, emissiveIntensity: 0.25 })
            );
            bay.rotation.x = Math.PI / 2;
            g.add(bay);
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(70, 35, 4),
              new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.3 })
            );
            frame.position.z = 8;
            g.add(frame);
            // Approach strip
            const strip = new THREE.Mesh(
              new THREE.BoxGeometry(8, 80, 1.5),
              new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.2 })
            );
            strip.position.set(0, 0, 2);
            g.add(strip);
            const pl = new THREE.PointLight(0x38bdf8, 1.4, 400);
            pl.position.z = 20;
            g.add(pl);
          } else {
            // Control tower
            const shaft = new THREE.Mesh(
              new THREE.BoxGeometry(22, 22, 70),
              new THREE.MeshStandardMaterial({ color: 0x2a1848, metalness: 0.5, roughness: 0.35, emissive: 0x1a0a30, emissiveIntensity: 0.3 })
            );
            shaft.position.z = 35;
            g.add(shaft);
            const head = new THREE.Mesh(
              new THREE.CylinderGeometry(16, 14, 14, 8),
              new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x7c3aed, emissiveIntensity: 0.85, metalness: 0.4, roughness: 0.3 })
            );
            head.rotation.x = Math.PI / 2;
            head.position.z = 72;
            g.add(head);
            const dish = new THREE.Mesh(
              new THREE.SphereGeometry(10, 12, 8),
              new THREE.MeshStandardMaterial({ color: 0xe9d5ff, emissive: 0xc084fc, emissiveIntensity: 1.2 })
            );
            dish.position.z = 85;
            g.add(dish);
            const pl = new THREE.PointLight(0xc084fc, 1.6, 450);
            pl.position.z = 80;
            g.add(pl);
          }
          g.visible = false;
          state.scene.add(g);
          return g;
        }
        const types = ['hq','dock','dock','dock','control'];
        for (const t of types) state.stationMeshes.push(makeStationMesh(t));
        state.baseMesh = state.stationMeshes[0];

        // Composer + bloom
        const composer = new EffectComposer(state.renderer);
        composer.addPass(new RenderPass(state.scene, state.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.15, 0.5, 0.18);
        composer.addPass(bloom);
        state.composer = composer;

        window.addEventListener('resize', () => {
          state.camera.aspect = window.innerWidth / window.innerHeight;
          state.camera.updateProjectionMatrix();
          state.renderer.setSize(window.innerWidth, window.innerHeight);
          state.composer.setSize(window.innerWidth, window.innerHeight);
        }, { passive: true });

        window._three_state = state;
        console.log('Three.js 3D renderer ready');
      }

      function hideExtra(meshes, from) {
        for (let i = from; i < meshes.length; i++) meshes[i].visible = false;
      }

      function sync() {
        if (!window.G || !state.scene) return;
        const G = window.G;
        const { tmpPos, tmpQuat, tmpScale, tmpEuler, tempMat } = state;

        // Ship
        const p = G.player;
        state.ship.position.set(p.x - state.worldCX, p.y - state.worldCY, p.z || 0);
        state.ship.rotation.set(p.pitch || 0, 0, p.angle);
        state.ship.rotation.z = p.angle;
        // bank
        state.ship.rotation.x = p.roll || 0;
        const speed = Math.hypot(p.vx || 0, p.vy || 0);
        state.ship.traverse(c => {
          if (c.userData?.emissive && c.material) {
            c.material.emissiveIntensity = 0.6 + Math.min(1, speed / 300);
          }
          if (c.userData?.thruster && c.material) {
            c.material.emissiveIntensity = 0.4 + (speed > 20 ? 0.8 : 0.2);
          }
        });

        // Camera — chase cam with slight lag and height based on speed
        const desiredZ = 380 + Math.min(220, speed * 0.55);
        const camTarget = new THREE.Vector3(
          p.x - state.worldCX,
          p.y - state.worldCY,
          0
        );
        const camPos = new THREE.Vector3(
          camTarget.x - Math.cos(p.angle) * 40,
          camTarget.y - Math.sin(p.angle) * 40,
          desiredZ
        );
        if (G.camera?.shake) {
          camPos.x += (Math.random() - 0.5) * G.camera.shake * 1.5;
          camPos.y += (Math.random() - 0.5) * G.camera.shake * 1.5;
        }
        state.camera.position.lerp(camPos, 0.08);
        state.camera.lookAt(camTarget);

        // Asteroids
        const ac = Math.min(G.asteroids.length, state.maxAsteroids);
        for (let i = 0; i < ac; i++) {
          const a = G.asteroids[i];
          tmpPos.set(a.x - state.worldCX, a.y - state.worldCY, a.z || Math.sin(a.angle * 2) * 8);
          tmpEuler.set(a.angle * 0.7, a.angle, a.angle * 0.3);
          tmpQuat.setFromEuler(tmpEuler);
          const s = Math.max(0.15, a.r / 11);
          tmpScale.setScalar(s);
          tempMat.compose(tmpPos, tmpQuat, tmpScale);
          state.asteroidInst.setMatrixAt(i, tempMat);
        }
        for (let i = ac; i < state.maxAsteroids; i++) {
          tmpPos.set(99999, 99999, 99999);
          tmpScale.setScalar(0.001);
          tempMat.compose(tmpPos, tmpQuat.identity(), tmpScale);
          state.asteroidInst.setMatrixAt(i, tempMat);
        }
        state.asteroidInst.count = ac;
        state.asteroidInst.instanceMatrix.needsUpdate = true;

        // Debris
        const dc = Math.min(G.debris.length, state.maxDebris);
        for (let i = 0; i < dc; i++) {
          const d = G.debris[i];
          tmpPos.set(d.x - state.worldCX, d.y - state.worldCY, d.z || 0);
          tmpEuler.set(d.angle, d.angle * 0.5, d.angle * 1.2);
          tmpQuat.setFromEuler(tmpEuler);
          tmpScale.set(d.r * 0.9, d.r * 0.7, d.r * 0.5);
          tempMat.compose(tmpPos, tmpQuat, tmpScale);
          state.debrisInst.setMatrixAt(i, tempMat);
        }
        for (let i = dc; i < state.maxDebris; i++) {
          tmpPos.set(99999, 99999, 99999);
          tmpScale.setScalar(0.001);
          tempMat.compose(tmpPos, tmpQuat.identity(), tmpScale);
          state.debrisInst.setMatrixAt(i, tempMat);
        }
        state.debrisInst.count = dc;
        state.debrisInst.instanceMatrix.needsUpdate = true;

        // Drones
        const dnc = Math.min(G.drones.length, state.maxDrones);
        for (let i = 0; i < dnc; i++) {
          const dr = G.drones[i];
          const m = state.droneMeshes[i];
          m.visible = true;
          m.position.set(dr.x - state.worldCX, dr.y - state.worldCY, dr.z || 0);
          m.rotation.z = dr.angle - Math.PI / 2;
        }
        hideExtra(state.droneMeshes, dnc);

        // Mines
        const mc = Math.min(G.mines.length, state.maxMines);
        for (let i = 0; i < mc; i++) {
          const mine = G.mines[i];
          const m = state.mineMeshes[i];
          m.visible = true;
          const pulse = 0.5 + Math.sin(mine.pulse || 0) * 0.5;
          m.position.set(mine.x - state.worldCX, mine.y - state.worldCY, 0);
          m.scale.setScalar(0.7 + pulse * 0.35);
          if (m.material) m.material.emissiveIntensity = 0.4 + pulse * 0.6;
        }
        hideExtra(state.mineMeshes, mc);

        // Stations sync
        if (state.stationMeshes && G.stations) {
          const n = Math.min(G.stations.length, state.stationMeshes.length);
          for (let i = 0; i < n; i++) {
            const st = G.stations[i];
            let mesh = state.stationMeshes[i];
            // Rebuild type if needed (simple: scale/rotate by type)
            mesh.visible = true;
            mesh.position.set(st.x - state.worldCX, st.y - state.worldCY, st.z || 0);
            const active = G.docking && G.activeStation === st;
            const spin = st.type === 'control' ? (G.t || 0) * 0.6 : (G.t || 0) * 0.15;
            mesh.rotation.z = spin;
            const scl = active ? 1 + (G.dockProgress || 0) * 0.15 : 1;
            mesh.scale.setScalar(scl);
            mesh.traverse(c => {
              if (c.isMesh && c.material && c.material.color && c.material.transparent) {
                if (active) {
                  c.material.color.setHex(0xffc846);
                  c.material.opacity = 0.35 + (G.dockProgress || 0) * 0.4;
                } else if (st.type === 'hq') {
                  c.material.color.setHex(0x00e5a0);
                } else if (st.type === 'dock') {
                  c.material.color.setHex(0x44aaff);
                } else {
                  c.material.color.setHex(0xb06aff);
                }
              }
            });
          }
          for (let i = n; i < state.stationMeshes.length; i++) state.stationMeshes[i].visible = false;
        }

        // Particles
        const pp = state.particlePoints;
        const len = Math.min(G.particles.length, pp.max);
        for (let i = 0; i < len; i++) {
          const P = G.particles[i];
          pp.pos[i * 3] = P.x - state.worldCX;
          pp.pos[i * 3 + 1] = P.y - state.worldCY;
          pp.pos[i * 3 + 2] = P.z || 0;
        }
        for (let i = len; i < pp.max; i++) {
          pp.pos[i * 3] = 99999;
          pp.pos[i * 3 + 1] = 99999;
          pp.pos[i * 3 + 2] = 99999;
        }
        pp.geo.attributes.position.needsUpdate = true;
      }

      function renderThreeImpl() {
        if (!window.G) return;
        init();
        if (!state.scene) return;
        sync();
        state.composer.render();
      }

      window.initThreeRenderer = init;
      window.renderThree = function (dt) {
        try {
          renderThreeImpl(dt);
        } catch (e) {
          console.error('3D render error', e);
          window.renderThree = function () {};
        }
      };
    } catch (err) {
      console.warn('3D modules unavailable — 2D only', err);
      window.renderThree = function () {};
      window.initThreeRenderer = function () {};
    }
  }

  bootstrap();
})();
