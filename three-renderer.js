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
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x00c8ff, metalness: 0.35, roughness: 0.4,
          emissive: 0x003344, emissiveIntensity: 0.35
        });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(5, 16, 6), bodyMat);
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 8;
        g.add(nose);

        const body = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 6), bodyMat);
        body.position.x = -2;
        g.add(body);

        const wingMat = new THREE.MeshStandardMaterial({ color: 0x0088aa, metalness: 0.5, roughness: 0.35 });
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 10), wingMat);
        wingL.position.set(-2, 0, 6);
        g.add(wingL);
        const wingR = wingL.clone();
        wingR.position.z = -6;
        g.add(wingR);

        const cockMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.9, transparent: true, opacity: 0.9
        });
        const cock = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), cockMat);
        cock.position.set(2, 2, 0);
        cock.userData.emissive = true;
        g.add(cock);

        const thrMat = new THREE.MeshStandardMaterial({
          color: 0xff6b35, emissive: 0xff6b35, emissiveIntensity: 0.7
        });
        const thr = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.8, 5, 8), thrMat);
        thr.rotation.z = Math.PI / 2;
        thr.position.x = -10;
        thr.userData.thruster = true;
        g.add(thr);

        g.scale.setScalar(1.15);
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        return g;
      }

      function init() {
        if (state.scene) return;
        if (typeof CFG === 'undefined') return;

        state.worldCX = CFG.world.w / 2;
        state.worldCY = CFG.world.h / 2;

        state.scene = new THREE.Scene();
        state.scene.fog = new THREE.FogExp2(0x020d18, 0.00035);

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
        state.scene.add(new THREE.AmbientLight(0x668899, 0.55));
        const sun = new THREE.DirectionalLight(0xffffff, 1.05);
        sun.position.set(400, 600, 300);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -900;
        sun.shadow.camera.right = 900;
        sun.shadow.camera.top = 900;
        sun.shadow.camera.bottom = -900;
        sun.shadow.camera.far = 3500;
        state.scene.add(sun);
        const rim = new THREE.DirectionalLight(0x44aaff, 0.25);
        rim.position.set(-500, -200, 200);
        state.scene.add(rim);

        // Stars
        const starN = 1200;
        const starPos = new Float32Array(starN * 3);
        for (let i = 0; i < starN; i++) {
          starPos[i * 3] = (Math.random() - 0.5) * CFG.world.w * 1.4;
          starPos[i * 3 + 1] = (Math.random() - 0.5) * CFG.world.h * 1.4;
          starPos[i * 3 + 2] = -200 - Math.random() * 2500;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        state.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
          color: 0xaaccff, size: 1.8, transparent: true, opacity: 0.85, sizeAttenuation: true
        })));

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

        // Base ring
        const baseGeo = new THREE.RingGeometry(55, 72, 48);
        const baseMat = new THREE.MeshBasicMaterial({
          color: 0x00e5a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.set(0, 0, -5);
        state.scene.add(baseMesh);
        state.baseMesh = baseMesh;

        // Composer + bloom
        const composer = new EffectComposer(state.renderer);
        composer.addPass(new RenderPass(state.scene, state.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.4, 0.2);
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

        // Base — pulse / color when docking
        if (state.baseMesh && G.base) {
          state.baseMesh.position.set(G.base.x - state.worldCX, G.base.y - state.worldCY, -4);
          state.baseMesh.rotation.z = (G.t || 0) * 0.15;
          if (state.baseMesh.material) {
            if (G.docking) {
              state.baseMesh.material.color.setHex(0xffc846);
              state.baseMesh.material.opacity = 0.35 + (G.dockProgress || 0) * 0.45;
              state.baseMesh.scale.setScalar(1 + (G.dockProgress || 0) * 0.12);
            } else {
              state.baseMesh.material.color.setHex(0x00e5a0);
              state.baseMesh.material.opacity = 0.35;
              state.baseMesh.scale.setScalar(1);
            }
          }
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
