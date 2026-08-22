/**
 * A·R·I·A — Space Mining & Debris Cleanup
 * Improved 3D gameplay core
 */

(() => {
  'use strict';

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const CFG = {
    world: { w: 4000, h: 4000, depth: 800 },
    player: {
      accel: 420,
      maxSpeed: 380,
      damp: 0.985,
      turnRate: 3.8,
      radius: 14,
      maxHull: 100,
      laserCooldown: 0.16,
      laserRange: 420,
      laserDamage: 28,
      netCooldown: 1.4,
      netRange: 160,
      mineRange: 90,
      mineRate: 18 // ore per second
    },
    waves: [
      { debris: 12, asteroids: 8, mines: 2, drones: 1, bonus: 400 },
      { debris: 16, asteroids: 10, mines: 4, drones: 2, bonus: 600 },
      { debris: 20, asteroids: 12, mines: 6, drones: 3, bonus: 900 },
      { debris: 24, asteroids: 14, mines: 8, drones: 4, bonus: 1200 },
      { debris: 28, asteroids: 16, mines: 10, drones: 5, bonus: 1600 },
      { debris: 32, asteroids: 18, mines: 12, drones: 6, bonus: 2000 },
      { debris: 36, asteroids: 20, mines: 14, drones: 8, bonus: 2500 },
      { debris: 40, asteroids: 22, mines: 16, drones: 10, bonus: 3000 },
      { debris: 44, asteroids: 24, mines: 18, drones: 12, bonus: 3600 },
      { debris: 50, asteroids: 28, mines: 22, drones: 14, bonus: 4500 }
    ]
  };
  window.CFG = CFG;

  // ─── STATE ────────────────────────────────────────────────────────────────
  const G = {
    running: false,
    paused: false,
    wave: 0,
    score: 0,
    tokens: 0,
    ore: 0,
    debrisCleared: 0,
    hull: CFG.player.maxHull,
    player: {
      x: CFG.world.w / 2,
      y: CFG.world.h / 2,
      z: 0,
      vx: 0, vy: 0, vz: 0,
      angle: 0,
      pitch: 0,
      roll: 0
    },
    keys: {},
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, left: false, right: false },
    lasers: [],
    nets: [],
    asteroids: [],
    debris: [],
    mines: [],
    drones: [],
    particles: [],
    floatingText: [],
    cooldowns: { laser: 0, net: 0 },
    miningTarget: null,
    base: { x: CFG.world.w / 2, y: CFG.world.h / 2, r: 70 },
    camera: { x: 0, y: 0, z: 500, shake: 0 },
    achievements: new Set(),
    t: 0
  };
  window.G = G;

  // ─── DOM ──────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const titleScreen = document.getElementById('titleScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const waveClearScreen = document.getElementById('waveClearScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ─── INPUT ────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape' && G.running) togglePause();
    if (e.code === 'KeyR' && G.running && !G.paused) tryDock();
    if (e.code === 'KeyE' && G.running && !G.paused) tryMine(true);
  });
  window.addEventListener('keyup', e => { G.keys[e.code] = false; });

  canvas.addEventListener('mousemove', e => {
    G.mouse.x = e.clientX;
    G.mouse.y = e.clientY;
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) G.mouse.left = true;
    if (e.button === 2) G.mouse.right = true;
  });
  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) G.mouse.left = false;
    if (e.button === 2) G.mouse.right = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.getElementById('startBtn')?.addEventListener('click', startGame);
  document.getElementById('resumeBtn')?.addEventListener('click', () => { G.paused = false; pauseScreen.classList.add('hidden'); });
  document.getElementById('restartFromPauseBtn')?.addEventListener('click', startGame);
  document.getElementById('restartBtn')?.addEventListener('click', startGame);
  document.getElementById('nextWaveBtn')?.addEventListener('click', nextWave);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angleTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

  function spawnParticle(x, y, color, life = 0.6, speed = 80) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.3, speed);
    G.particles.push({
      x, y, z: rand(-20, 20),
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      vz: rand(-40, 40),
      life, maxLife: life,
      r: rand(1.5, 4),
      color
    });
  }

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) spawnParticle(x, y, color, rand(0.3, 0.9), rand(60, 180));
  }

  function floatText(x, y, text, color = '#ffc846') {
    G.floatingText.push({ x, y, text, color, life: 1.2, vy: -40 });
  }

  function addScore(n, reason) {
    G.score += n;
    if (reason) floatText(G.player.x, G.player.y - 30, `+${n} ${reason}`, '#ffc846');
  }

  function damagePlayer(amt) {
    G.hull -= amt;
    G.camera.shake = Math.min(12, G.camera.shake + amt * 0.15);
    burst(G.player.x, G.player.y, '#ff4060', 8);
    if (G.hull <= 0) {
      G.hull = 0;
      gameOver();
    }
  }

  function showAchievement(title, reward) {
    const key = title;
    if (G.achievements.has(key)) return;
    G.achievements.add(key);
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `<div class="achievement-title">★ ${title}</div><div class="achievement-reward">${reward}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ─── SPAWNING ─────────────────────────────────────────────────────────────
  function spawnAwayFromPlayer(minDist = 350) {
    let x, y, tries = 0;
    do {
      x = rand(80, CFG.world.w - 80);
      y = rand(80, CFG.world.h - 80);
      tries++;
    } while (Math.hypot(x - G.player.x, y - G.player.y) < minDist && tries < 40);
    return { x, y };
  }

  function spawnWave(waveIndex) {
    const w = CFG.waves[Math.min(waveIndex, CFG.waves.length - 1)];
    G.asteroids = [];
    G.debris = [];
    G.mines = [];
    G.drones = [];
    G.lasers = [];
    G.nets = [];

    for (let i = 0; i < w.asteroids; i++) {
      const p = spawnAwayFromPlayer(300);
      const r = rand(22, 55);
      G.asteroids.push({
        x: p.x, y: p.y, z: rand(-30, 30),
        r,
        ore: Math.floor(r * 1.8),
        maxOre: Math.floor(r * 1.8),
        angle: rand(0, Math.PI * 2),
        spin: rand(-1.2, 1.2),
        vx: rand(-20, 20),
        vy: rand(-20, 20)
      });
    }

    for (let i = 0; i < w.debris; i++) {
      const p = spawnAwayFromPlayer(250);
      G.debris.push({
        x: p.x, y: p.y, z: rand(-15, 15),
        r: rand(8, 16),
        angle: rand(0, Math.PI * 2),
        spin: rand(-2, 2),
        vx: rand(-35, 35),
        vy: rand(-35, 35),
        hp: 20,
        value: Math.floor(rand(15, 40))
      });
    }

    for (let i = 0; i < w.mines; i++) {
      const p = spawnAwayFromPlayer(400);
      G.mines.push({
        x: p.x, y: p.y, z: 0,
        r: 12,
        pulse: rand(0, Math.PI * 2),
        armed: true,
        triggerR: 70
      });
    }

    for (let i = 0; i < w.drones; i++) {
      const p = spawnAwayFromPlayer(450);
      G.drones.push({
        x: p.x, y: p.y, z: rand(-10, 10),
        r: 14,
        angle: rand(0, Math.PI * 2),
        speed: rand(70, 120),
        hp: 40 + waveIndex * 8,
        maxHp: 40 + waveIndex * 8,
        fireCd: rand(0.5, 1.5),
        vx: 0, vy: 0
      });
    }
  }

  // ─── ACTIONS ──────────────────────────────────────────────────────────────
  function fireLaser() {
    if (G.cooldowns.laser > 0) return;
    G.cooldowns.laser = CFG.player.laserCooldown;

    const aim = Math.atan2(G.mouse.worldY - G.player.y, G.mouse.worldX - G.player.x);
    const spread = (Math.random() - 0.5) * 0.04;
    const a = aim + spread;

    G.lasers.push({
      x: G.player.x + Math.cos(a) * 18,
      y: G.player.y + Math.sin(a) * 18,
      vx: Math.cos(a) * 900,
      vy: Math.sin(a) * 900,
      life: CFG.player.laserRange / 900,
      damage: CFG.player.laserDamage
    });

    spawnParticle(G.player.x + Math.cos(a) * 16, G.player.y + Math.sin(a) * 16, '#00c8ff', 0.2, 40);
  }

  function deployNet() {
    if (G.cooldowns.net > 0) return;
    G.cooldowns.net = CFG.player.netCooldown;
    const aim = Math.atan2(G.mouse.worldY - G.player.y, G.mouse.worldX - G.player.x);
    G.nets.push({
      x: G.player.x,
      y: G.player.y,
      tx: G.player.x + Math.cos(aim) * CFG.player.netRange,
      ty: G.player.y + Math.sin(aim) * CFG.player.netRange,
      progress: 0,
      radius: 55,
      life: 1.1
    });
  }

  function tryMine(force = false) {
    let best = null;
    let bestD = CFG.player.mineRange;
    for (const a of G.asteroids) {
      if (a.ore <= 0) continue;
      const d = dist(G.player, a) - a.r;
      if (d < bestD) { bestD = d; best = a; }
    }
    G.miningTarget = best;
    if (!best) return;

    if (force || G.keys['KeyE']) {
      const extracted = Math.min(best.ore, CFG.player.mineRate * (force ? 0.05 : 0));
      // continuous mining handled in update
    }
  }

  function tryDock() {
    if (dist(G.player, G.base) < G.base.r + 30) {
      const healed = CFG.player.maxHull - G.hull;
      if (healed > 0) {
        G.hull = CFG.player.maxHull;
        floatText(G.player.x, G.player.y - 40, 'HULL REPAIRED', '#00e5a0');
        addScore(50, 'DOCK');
      }
      if (G.ore > 0) {
        const value = G.ore * 3;
        addScore(value, 'ORE');
        G.tokens += Math.floor(G.ore / 10);
        floatText(G.player.x, G.player.y - 60, `+${G.ore}kg SOLD`, '#ffc846');
        G.ore = 0;
        showAchievement('FIRST SALE', '+◆ tokens from ore');
      }
    }
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  function updatePlayer(dt) {
    const p = G.player;
    const aim = Math.atan2(G.mouse.worldY - p.y, G.mouse.worldX - p.x);

    // Smooth turn toward aim
    let diff = aim - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += clamp(diff, -CFG.player.turnRate * dt, CFG.player.turnRate * dt);

    // Thrust
    let ax = 0, ay = 0;
    if (G.keys['KeyW'] || G.keys['ArrowUp']) {
      ax += Math.cos(p.angle) * CFG.player.accel;
      ay += Math.sin(p.angle) * CFG.player.accel;
    }
    if (G.keys['KeyS'] || G.keys['ArrowDown']) {
      ax -= Math.cos(p.angle) * CFG.player.accel * 0.55;
      ay -= Math.sin(p.angle) * CFG.player.accel * 0.55;
    }
    if (G.keys['KeyA'] || G.keys['ArrowLeft']) {
      ax += Math.cos(p.angle - Math.PI / 2) * CFG.player.accel * 0.7;
      ay += Math.sin(p.angle - Math.PI / 2) * CFG.player.accel * 0.7;
    }
    if (G.keys['KeyD'] || G.keys['ArrowRight']) {
      ax += Math.cos(p.angle + Math.PI / 2) * CFG.player.accel * 0.7;
      ay += Math.sin(p.angle + Math.PI / 2) * CFG.player.accel * 0.7;
    }

    // Emergency brake
    if (G.keys['ShiftLeft'] || G.keys['ShiftRight']) {
      p.vx *= 0.90;
      p.vy *= 0.90;
    }

    p.vx += ax * dt;
    p.vy += ay * dt;

    // Cap speed
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > CFG.player.maxSpeed) {
      p.vx = (p.vx / sp) * CFG.player.maxSpeed;
      p.vy = (p.vy / sp) * CFG.player.maxSpeed;
    }

    p.vx *= Math.pow(CFG.player.damp, dt * 60);
    p.vy *= Math.pow(CFG.player.damp, dt * 60);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Soft world bounds
    const m = 40;
    if (p.x < m) { p.x = m; p.vx *= -0.4; }
    if (p.y < m) { p.y = m; p.vy *= -0.4; }
    if (p.x > CFG.world.w - m) { p.x = CFG.world.w - m; p.vx *= -0.4; }
    if (p.y > CFG.world.h - m) { p.y = CFG.world.h - m; p.vy *= -0.4; }

    // Visual bank / pitch from velocity
    p.roll = clamp(-p.vx * 0.0015 + diff * 0.3, -0.5, 0.5);
    p.pitch = clamp(p.vy * 0.001, -0.3, 0.3);

    // Engine particles
    if (ax !== 0 || ay !== 0) {
      if (Math.random() < 0.7) {
        spawnParticle(
          p.x - Math.cos(p.angle) * 16,
          p.y - Math.sin(p.angle) * 16,
          '#ff6b35', 0.35, 50
        );
      }
    }

    // Actions
    if (G.mouse.left) fireLaser();
    if (G.mouse.right) deployNet();

    // Continuous mining
    tryMine(false);
    if (G.miningTarget && G.keys['KeyE'] && G.miningTarget.ore > 0) {
      const rate = CFG.player.mineRate * dt;
      const take = Math.min(G.miningTarget.ore, rate);
      G.miningTarget.ore -= take;
      G.ore += take;
      if (Math.random() < 0.4) {
        spawnParticle(G.miningTarget.x, G.miningTarget.y, '#c0a060', 0.4, 40);
      }
      if (G.miningTarget.ore <= 0) {
        burst(G.miningTarget.x, G.miningTarget.y, '#c0a060', 16);
        addScore(80, 'ASTEROID');
        G.asteroids = G.asteroids.filter(a => a !== G.miningTarget);
        G.miningTarget = null;
        showAchievement('ASTEROID CRACKED', 'First asteroid fully mined');
      }
    }
  }

  function updateLasers(dt) {
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const L = G.lasers[i];
      L.x += L.vx * dt;
      L.y += L.vy * dt;
      L.life -= dt;
      if (L.life <= 0) { G.lasers.splice(i, 1); continue; }

      // Hit debris
      for (let j = G.debris.length - 1; j >= 0; j--) {
        const d = G.debris[j];
        if (Math.hypot(L.x - d.x, L.y - d.y) < d.r + 4) {
          d.hp -= L.damage;
          burst(L.x, L.y, '#00c8ff', 6);
          G.lasers.splice(i, 1);
          if (d.hp <= 0) {
            burst(d.x, d.y, '#b06aff', 14);
            addScore(d.value, 'DEBRIS');
            G.debrisCleared++;
            G.tokens += 1;
            G.debris.splice(j, 1);
          }
          break;
        }
      }
      if (!G.lasers[i]) continue;

      // Hit mines
      for (let j = G.mines.length - 1; j >= 0; j--) {
        const m = G.mines[j];
        if (Math.hypot(L.x - m.x, L.y - m.y) < m.r + 6) {
          burst(m.x, m.y, '#ff4060', 20);
          addScore(60, 'MINE');
          G.mines.splice(j, 1);
          G.lasers.splice(i, 1);
          G.camera.shake = 6;
          break;
        }
      }
      if (!G.lasers[i]) continue;

      // Hit drones
      for (let j = G.drones.length - 1; j >= 0; j--) {
        const dr = G.drones[j];
        if (Math.hypot(L.x - dr.x, L.y - dr.y) < dr.r + 5) {
          dr.hp -= L.damage;
          burst(L.x, L.y, '#ff4060', 5);
          G.lasers.splice(i, 1);
          if (dr.hp <= 0) {
            burst(dr.x, dr.y, '#ff4060', 18);
            addScore(120, 'DRONE');
            G.tokens += 3;
            G.drones.splice(j, 1);
            showAchievement('DRONE HUNTER', 'Destroyed a hostile drone');
          }
          break;
        }
      }
    }
  }

  function updateNets(dt) {
    for (let i = G.nets.length - 1; i >= 0; i--) {
      const n = G.nets[i];
      n.progress = Math.min(1, n.progress + dt * 2.2);
      n.life -= dt;
      const cx = n.x + (n.tx - n.x) * n.progress;
      const cy = n.y + (n.ty - n.y) * n.progress;

      if (n.progress >= 0.85) {
        // Capture debris
        for (let j = G.debris.length - 1; j >= 0; j--) {
          const d = G.debris[j];
          if (Math.hypot(cx - d.x, cy - d.y) < n.radius) {
            burst(d.x, d.y, '#00e5a0', 10);
            addScore(d.value + 20, 'CAPTURE');
            G.debrisCleared++;
            G.tokens += 2;
            G.debris.splice(j, 1);
          }
        }
        // Capture / disable drones
        for (let j = G.drones.length - 1; j >= 0; j--) {
          const dr = G.drones[j];
          if (Math.hypot(cx - dr.x, cy - dr.y) < n.radius) {
            burst(dr.x, dr.y, '#00e5a0', 12);
            addScore(150, 'NET');
            G.tokens += 4;
            G.drones.splice(j, 1);
          }
        }
      }
      if (n.life <= 0) G.nets.splice(i, 1);
    }
  }

  function updateEnemies(dt) {
    // Mines
    for (let i = G.mines.length - 1; i >= 0; i--) {
      const m = G.mines[i];
      m.pulse += dt * 4;
      if (dist(G.player, m) < m.triggerR) {
        burst(m.x, m.y, '#ff4060', 24);
        damagePlayer(22);
        G.mines.splice(i, 1);
        G.camera.shake = 10;
      }
    }

    // Drones — chase + shoot
    for (const dr of G.drones) {
      const ang = angleTo(dr, G.player);
      dr.angle = ang;
      dr.vx = Math.cos(ang) * dr.speed;
      dr.vy = Math.sin(ang) * dr.speed;
      dr.x += dr.vx * dt;
      dr.y += dr.vy * dt;

      dr.fireCd -= dt;
      if (dr.fireCd <= 0 && dist(dr, G.player) < 380) {
        dr.fireCd = rand(1.1, 1.8);
        G.lasers.push({
          x: dr.x, y: dr.y,
          vx: Math.cos(ang) * 420,
          vy: Math.sin(ang) * 420,
          life: 1.2,
          damage: 12,
          enemy: true
        });
      }

      if (dist(dr, G.player) < dr.r + CFG.player.radius) {
        damagePlayer(8 * dt * 10);
      }
    }

    // Enemy laser hits player
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const L = G.lasers[i];
      if (!L.enemy) continue;
      L.x += L.vx * dt;
      L.y += L.vy * dt;
      L.life -= dt;
      if (L.life <= 0) { G.lasers.splice(i, 1); continue; }
      if (Math.hypot(L.x - G.player.x, L.y - G.player.y) < CFG.player.radius + 4) {
        damagePlayer(L.damage);
        burst(L.x, L.y, '#ff4060', 6);
        G.lasers.splice(i, 1);
      }
    }
  }

  function updateAsteroids(dt) {
    for (const a of G.asteroids) {
      a.angle += a.spin * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < a.r || a.x > CFG.world.w - a.r) a.vx *= -1;
      if (a.y < a.r || a.y > CFG.world.h - a.r) a.vy *= -1;
    }
    for (const d of G.debris) {
      d.angle += d.spin * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0 || d.x > CFG.world.w) d.vx *= -1;
      if (d.y < 0 || d.y > CFG.world.h) d.vy *= -1;
    }
  }

  function updateParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const P = G.particles[i];
      P.x += P.vx * dt;
      P.y += P.vy * dt;
      P.z += (P.vz || 0) * dt;
      P.life -= dt;
      if (P.life <= 0) G.particles.splice(i, 1);
    }
    for (let i = G.floatingText.length - 1; i >= 0; i--) {
      const f = G.floatingText[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) G.floatingText.splice(i, 1);
    }
  }

  function checkWaveClear() {
    if (G.debris.length === 0 && G.mines.length === 0 && G.drones.length === 0) {
      // Asteroids optional — wave clears when threats gone
      const w = CFG.waves[Math.min(G.wave, CFG.waves.length - 1)];
      G.score += w.bonus;
      G.tokens += 5 + G.wave * 2;
      document.getElementById('waveClearTitle').textContent = `LEVEL ${G.wave + 1} COMPLETE`;
      document.getElementById('waveBonus').textContent = `+${w.bonus}`;
      document.getElementById('totalScoreWave').textContent = G.score.toLocaleString();
      document.getElementById('waveTokens').textContent = `+${5 + G.wave * 2}`;
      document.getElementById('nextWaveMsg').textContent =
        G.wave + 1 >= CFG.waves.length ? 'Final sector cleared — endless mode!' : `Preparing Wave ${G.wave + 2} deployment...`;
      G.running = false;
      waveClearScreen.classList.remove('hidden');
      showAchievement(`WAVE ${G.wave + 1}`, 'Sector cleared');
    }
  }

  function update(dt) {
    if (!G.running || G.paused) return;
    G.t += dt;
    G.cooldowns.laser = Math.max(0, G.cooldowns.laser - dt);
    G.cooldowns.net = Math.max(0, G.cooldowns.net - dt);
    G.camera.shake = Math.max(0, G.camera.shake - dt * 18);

    // Mouse world position (camera-relative)
    const cx = G.player.x;
    const cy = G.player.y;
    G.mouse.worldX = G.mouse.x - canvas.width / 2 + cx;
    G.mouse.worldY = G.mouse.y - canvas.height / 2 + cy;

    updatePlayer(dt);
    updateLasers(dt);
    updateNets(dt);
    updateEnemies(dt);
    updateAsteroids(dt);
    updateParticles(dt);
    checkWaveClear();

    // Camera follow
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
  }
  window.update = update;

  // ─── 2D RENDER (HUD + overlays; 3D scene draws behind) ────────────────────
  function worldToScreen(x, y) {
    const shakeX = (Math.random() - 0.5) * G.camera.shake * 2;
    const shakeY = (Math.random() - 0.5) * G.camera.shake * 2;
    return {
      x: x - G.camera.x + canvas.width / 2 + shakeX,
      y: y - G.camera.y + canvas.height / 2 + shakeY
    };
  }

  function drawShip(p) {
    const s = worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);
    // body
    ctx.fillStyle = '#00c8ff';
    ctx.shadowColor = '#00c8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    // cockpit
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // thruster glow
    const thrust = (G.keys['KeyW'] || G.keys['ArrowUp']) ? 1 : 0.2;
    ctx.fillStyle = `rgba(255,107,53,${0.5 + thrust * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-10 - 8 * thrust - Math.random() * 4, 0);
    ctx.lineTo(-10, 4);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    // Clear with transparent so Three.js layer shows through
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!G.running && titleScreen && !titleScreen.classList.contains('hidden')) {
      return; // title screen only
    }

    // Soft vignette / space dust in 2D
    ctx.fillStyle = 'rgba(2,13,24,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Base station
    {
      const s = worldToScreen(G.base.x, G.base.y);
      ctx.strokeStyle = 'rgba(0,229,160,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, G.base.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,229,160,0.08)';
      ctx.fill();
      ctx.fillStyle = '#00e5a0';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('BASE  [R] DOCK', s.x, s.y + G.base.r + 14);
    }

    // Asteroids (2D fallback / outline)
    for (const a of G.asteroids) {
      const s = worldToScreen(a.x, a.y);
      const orePct = a.ore / a.maxOre;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = `rgba(180,150,80,${0.35 + orePct * 0.4})`;
      ctx.strokeStyle = '#c0a060';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const rr = a.r * (0.75 + Math.sin(i * 2.3) * 0.25);
        i === 0 ? ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr)
                : ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (a === G.miningTarget) {
        ctx.strokeStyle = '#00e5a0';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, a.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Debris
    for (const d of G.debris) {
      const s = worldToScreen(d.x, d.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(d.angle);
      ctx.fillStyle = '#8af';
      ctx.strokeStyle = '#b06aff';
      ctx.lineWidth = 1;
      ctx.fillRect(-d.r * 0.7, -d.r * 0.5, d.r * 1.4, d.r);
      ctx.strokeRect(-d.r * 0.7, -d.r * 0.5, d.r * 1.4, d.r);
      ctx.restore();
    }

    // Mines
    for (const m of G.mines) {
      const s = worldToScreen(m.x, m.y);
      const pulse = 0.5 + Math.sin(m.pulse) * 0.5;
      ctx.strokeStyle = `rgba(255,64,96,${0.3 + pulse * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, m.triggerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgb(255,${40 + pulse * 40},${60 + pulse * 40})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Drones
    for (const dr of G.drones) {
      const s = worldToScreen(dr.x, dr.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(dr.angle);
      ctx.fillStyle = '#ff4060';
      ctx.shadowColor = '#ff4060';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      // hp bar
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#333';
      ctx.fillRect(-10, -16, 20, 3);
      ctx.fillStyle = '#ff4060';
      ctx.fillRect(-10, -16, 20 * (dr.hp / dr.maxHp), 3);
      ctx.restore();
    }

    // Nets
    for (const n of G.nets) {
      const cx = n.x + (n.tx - n.x) * n.progress;
      const cy = n.y + (n.ty - n.y) * n.progress;
      const s = worldToScreen(cx, cy);
      ctx.strokeStyle = `rgba(0,229,160,${n.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, n.radius * n.progress, 0, Math.PI * 2);
      ctx.stroke();
      // spokes
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + G.t * 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(a) * n.radius * n.progress, s.y + Math.sin(a) * n.radius * n.progress);
        ctx.stroke();
      }
    }

    // Lasers
    for (const L of G.lasers) {
      const s = worldToScreen(L.x, L.y);
      ctx.strokeStyle = L.enemy ? '#ff4060' : '#00c8ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - L.vx * 0.02, s.y - L.vy * 0.02);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Particles (2D)
    for (const P of G.particles) {
      const s = worldToScreen(P.x, P.y);
      const alpha = P.life / P.maxLife;
      ctx.fillStyle = P.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, P.r * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Floating text
    for (const f of G.floatingText) {
      const s = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, s.x, s.y);
      ctx.globalAlpha = 1;
    }

    // Player ship (2D silhouette always; 3D mesh is bonus)
    if (G.running) drawShip(G.player);

    // Crosshair
    if (G.running && !G.paused) {
      ctx.strokeStyle = 'rgba(0,200,255,0.7)';
      ctx.lineWidth = 1;
      const mx = G.mouse.x, my = G.mouse.y;
      ctx.beginPath();
      ctx.moveTo(mx - 10, my); ctx.lineTo(mx - 3, my);
      ctx.moveTo(mx + 3, my); ctx.lineTo(mx + 10, my);
      ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my - 3);
      ctx.moveTo(mx, my + 3); ctx.lineTo(mx, my + 10);
      ctx.stroke();
    }

    // HUD
    if (G.running) drawHUD();
  }
  window.render = render;

  function drawHUD() {
    const pad = 16;
    ctx.textAlign = 'left';
    ctx.font = '12px Courier New';

    // Top-left status
    ctx.fillStyle = 'rgba(0,200,255,0.85)';
    ctx.fillText(`SCORE  ${G.score.toLocaleString()}`, pad, pad + 12);
    ctx.fillStyle = 'rgba(0,229,160,0.85)';
    ctx.fillText(`TOKENS ◆ ${G.tokens}`, pad, pad + 28);
    ctx.fillStyle = 'rgba(255,200,70,0.85)';
    ctx.fillText(`ORE  ${Math.floor(G.ore)} kg`, pad, pad + 44);
    ctx.fillStyle = 'rgba(180,230,255,0.6)';
    ctx.fillText(`WAVE  ${G.wave + 1} / ${CFG.waves.length}`, pad, pad + 60);
    ctx.fillText(`DEBRIS  ${G.debrisCleared}`, pad, pad + 76);

    // Hull bar
    const bw = 160, bh = 10;
    const bx = pad, by = canvas.height - pad - bh - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    const hp = G.hull / CFG.player.maxHull;
    ctx.fillStyle = hp > 0.4 ? '#00e5a0' : hp > 0.2 ? '#ffc846' : '#ff4060';
    ctx.fillRect(bx, by, bw * hp, bh);
    ctx.strokeStyle = 'rgba(0,200,255,0.4)';
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(180,230,255,0.7)';
    ctx.font = '10px Courier New';
    ctx.fillText('HULL', bx, by - 4);

    // Cooldowns
    const cx = canvas.width - pad - 100;
    ctx.fillStyle = 'rgba(180,230,255,0.5)';
    ctx.fillText(`LASER ${G.cooldowns.laser > 0 ? G.cooldowns.laser.toFixed(1) + 's' : 'RDY'}`, cx, pad + 12);
    ctx.fillText(`NET   ${G.cooldowns.net > 0 ? G.cooldowns.net.toFixed(1) + 's' : 'RDY'}`, cx, pad + 28);
    if (G.miningTarget) {
      ctx.fillStyle = '#00e5a0';
      ctx.fillText('MINING [E]', cx, pad + 44);
    }

    // Minimap
    const mw = 120, mh = 120;
    const mx = canvas.width - pad - mw;
    const my = canvas.height - pad - mh;
    ctx.fillStyle = 'rgba(0,20,40,0.65)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(0,200,255,0.3)';
    ctx.strokeRect(mx, my, mw, mh);
    const sx = mw / CFG.world.w;
    const sy = mh / CFG.world.h;
    // base
    ctx.fillStyle = '#00e5a0';
    ctx.beginPath();
    ctx.arc(mx + G.base.x * sx, my + G.base.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    // player
    ctx.fillStyle = '#00c8ff';
    ctx.beginPath();
    ctx.arc(mx + G.player.x * sx, my + G.player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    // threats
    ctx.fillStyle = '#ff4060';
    for (const d of G.drones) {
      ctx.fillRect(mx + d.x * sx - 1, my + d.y * sy - 1, 2, 2);
    }
    ctx.fillStyle = '#ff8844';
    for (const m of G.mines) {
      ctx.fillRect(mx + m.x * sx - 1, my + m.y * sy - 1, 2, 2);
    }
    ctx.fillStyle = '#c0a060';
    for (const a of G.asteroids) {
      ctx.fillRect(mx + a.x * sx - 1, my + a.y * sy - 1, 2, 2);
    }
  }

  // ─── FLOW ─────────────────────────────────────────────────────────────────
  function startGame() {
    titleScreen?.classList.add('hidden');
    pauseScreen?.classList.add('hidden');
    waveClearScreen?.classList.add('hidden');
    gameOverScreen?.classList.add('hidden');

    G.running = true;
    G.paused = false;
    G.wave = 0;
    G.score = 0;
    G.tokens = 0;
    G.ore = 0;
    G.debrisCleared = 0;
    G.hull = CFG.player.maxHull;
    G.player.x = CFG.world.w / 2;
    G.player.y = CFG.world.h / 2;
    G.player.vx = 0;
    G.player.vy = 0;
    G.player.angle = 0;
    G.particles = [];
    G.floatingText = [];
    G.achievements = new Set();
    spawnWave(0);

    if (typeof window.initThreeRenderer === 'function') {
      try { window.initThreeRenderer(); } catch (_) {}
    }
  }

  function nextWave() {
    waveClearScreen?.classList.add('hidden');
    G.wave++;
    G.running = true;
    spawnWave(G.wave);
  }

  function togglePause() {
    G.paused = !G.paused;
    pauseScreen?.classList.toggle('hidden', !G.paused);
  }

  function gameOver() {
    G.running = false;
    document.getElementById('finalScore').textContent = G.score.toLocaleString();
    document.getElementById('finalWave').textContent = G.wave;
    document.getElementById('finalDebris').textContent = G.debrisCleared;
    document.getElementById('finalOre').textContent = Math.floor(G.ore) + ' kg';
    document.getElementById('finalTokens').textContent = G.tokens;
    gameOverScreen?.classList.remove('hidden');
  }

  // ─── BOOT ─────────────────────────────────────────────────────────────────
  // gameLoop lives at bottom of original file style — keep RAF here if game.js is sole loop
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    try { update(dt); } catch (e) { console.error('update', e); }
    try { render(); } catch (e) { console.error('render', e); }
    if (typeof window.renderThree === 'function') {
      try { window.renderThree(dt); } catch (e) { console.error('renderThree', e); }
    }
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
})();
