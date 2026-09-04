/**
 * A·R·I·A — Space Mining & Debris Cleanup
 * v5.2 — ship systems, upgrades, live dashboard, wallet + Stripe hooks
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
      netRadius: 55,
      mineRange: 90,
      mineRate: 18,
      maxFuel: 100,
      fuelBurnThrust: 9,
      fuelBurnMine: 4,
      maxShield: 50,
      shieldRegen: 4.5,
      shieldRegenDelay: 2.2,
      cargoCap: 50,
      oreSellScore: 4,
      oreSellTokenDiv: 8
    },
    upgrades: {
      miningSpeed:  { name: 'Mining Arm',   max: 5, costBase: 12, costScale: 1.55, perLevel: 0.22 },
      laserDamage:  { name: 'Laser Power',  max: 5, costBase: 15, costScale: 1.6,  perLevel: 0.18 },
      netRadius:    { name: 'Net Radius',   max: 4, costBase: 10, costScale: 1.5,  perLevel: 0.25 },
      enginePower:  { name: 'Engine',       max: 5, costBase: 14, costScale: 1.55, perLevel: 0.12 },
      cargoCap:     { name: 'Cargo Hold',   max: 6, costBase: 10, costScale: 1.45, perLevel: 18 },
      shieldMax:    { name: 'Shield Gen',   max: 4, costBase: 16, costScale: 1.6,  perLevel: 12 },
      fuelTank:     { name: 'Fuel Tank',    max: 4, costBase: 12, costScale: 1.5,  perLevel: 20 }
    },
    // ── Wallet + payments (wire real endpoints / keys for production) ──
    wallet: {
      chainId: '0xaa36a7', // Sepolia testnet hex; use '0x1' for mainnet
      chainName: 'Sepolia',
      balanceApiUrl: '',    // e.g. 'https://api.yourgame.com/wallet/balance'
      authApiUrl: '',       // e.g. 'https://api.yourgame.com/wallet/auth'
      demoMode: true
    },
    payments: {
      stripePublishableKey: '', // pk_test_... when ready
      checkoutApiUrl: '',       // backend: POST { packId } -> { url }
      demoMode: true,           // grants tokens locally without charge
      packs: [
        { id: 'starter',  name: 'Starter Pack',  tokens: 50,  priceUsd: 4.99,  paymentLink: '', priceId: '' },
        { id: 'pilot',    name: 'Pilot Pack',    tokens: 150, priceUsd: 9.99,  paymentLink: '', priceId: '' },
        { id: 'captain',  name: 'Captain Pack',  tokens: 400, priceUsd: 19.99, paymentLink: '', priceId: '' },
        { id: 'fleet',    name: 'Fleet Pack',    tokens: 1000,priceUsd: 39.99, paymentLink: '', priceId: '' }
      ]
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
    ore: 0,                 // current cargo kg
    debrisCleared: 0,
    hull: CFG.player.maxHull,
    fuel: CFG.player.maxFuel,
    shield: CFG.player.maxShield,
    shieldHitT: 0,          // time since last shield hit
    docking: false,
    dockProgress: 0,
    player: {
      x: CFG.world.w / 2,
      y: CFG.world.h / 2,
      z: 0,
      vx: 0, vy: 0, vz: 0,
      angle: 0,
      pitch: 0,
      roll: 0
    },
    // Upgrade levels (0 = stock)
    upgrades: {
      miningSpeed: 0,
      laserDamage: 0,
      netRadius: 0,
      enginePower: 0,
      cargoCap: 0,
      shieldMax: 0,
      fuelTank: 0
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
    combo: { count: 0, timer: 0 },
    sessionStats: { oreSold: 0, damageBlocked: 0, upgradesBought: 0, tokensBought: 0 },
    wallet: { connected: false, address: null, chainId: null },
    t: 0
  };
  window.G = G;

  // ─── DERIVED STATS ────────────────────────────────────────────────────────
  function getStat(key) {
    const u = G.upgrades[key] || 0;
    const def = CFG.upgrades[key];
    if (!def) return 0;
    if (key === 'cargoCap') return CFG.player.cargoCap + u * def.perLevel;
    if (key === 'shieldMax') return CFG.player.maxShield + u * def.perLevel;
    if (key === 'fuelTank') return CFG.player.maxFuel + u * def.perLevel;
    return 1 + u * def.perLevel;
  }

  function effectiveMineRate() {
    return CFG.player.mineRate * getStat('miningSpeed');
  }
  function effectiveLaserDamage() {
    return CFG.player.laserDamage * getStat('laserDamage');
  }
  function effectiveNetRadius() {
    return CFG.player.netRadius * getStat('netRadius');
  }
  function effectiveAccel() {
    return CFG.player.accel * getStat('enginePower');
  }
  function effectiveMaxSpeed() {
    return CFG.player.maxSpeed * (1 + (G.upgrades.enginePower || 0) * 0.08);
  }
  function maxCargo() { return getStat('cargoCap'); }
  function maxShield() { return getStat('shieldMax'); }
  function maxFuel() { return getStat('fuelTank'); }

  function upgradeCost(key) {
    const def = CFG.upgrades[key];
    const lvl = G.upgrades[key] || 0;
    if (lvl >= def.max) return null;
    return Math.floor(def.costBase * Math.pow(def.costScale, lvl));
  }

  // ─── DOM ──────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const titleScreen = document.getElementById('titleScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const waveClearScreen = document.getElementById('waveClearScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const shopScreen = document.getElementById('shopScreen');
  const buyScreen = document.getElementById('buyScreen');
  const walletScreen = document.getElementById('walletScreen');
  const missionDashScreen = document.getElementById('missionDashScreen');
  const liveDash = document.getElementById('liveDash');
  const actionRail = document.getElementById('actionRail');
  const walletPill = document.getElementById('walletPill');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function anyPanelOpen() {
    return [shopScreen, buyScreen, walletScreen, missionDashScreen]
      .some(el => el && !el.classList.contains('hidden'));
  }

  function closeAllPanels() {
    shopScreen?.classList.add('hidden');
    buyScreen?.classList.add('hidden');
    walletScreen?.classList.add('hidden');
    missionDashScreen?.classList.add('hidden');
  }

  // ─── INPUT ────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape') {
      if (anyPanelOpen()) {
        closeAllPanels();
        if (G.running) G.paused = false;
        return;
      }
      if (G.running) togglePause();
    }
    if (!G.running || G.paused) return;
    if (e.code === 'KeyR') tryDock();
    if (e.code === 'KeyE') tryMine(true);
    if (e.code === 'KeyU') openShop();
    if (e.code === 'KeyB') openBuy();
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
  document.getElementById('resumeBtn')?.addEventListener('click', () => {
    G.paused = false;
    pauseScreen.classList.add('hidden');
  });
  document.getElementById('restartFromPauseBtn')?.addEventListener('click', startGame);
  document.getElementById('restartBtn')?.addEventListener('click', startGame);
  document.getElementById('nextWaveBtn')?.addEventListener('click', nextWave);
  document.getElementById('shopBtn')?.addEventListener('click', openShop);
  document.getElementById('closeShopBtn')?.addEventListener('click', closeShop);
  document.getElementById('shopFromPauseBtn')?.addEventListener('click', () => {
    pauseScreen?.classList.add('hidden');
    openShop();
  });
  document.getElementById('buyFromPauseBtn')?.addEventListener('click', () => {
    pauseScreen?.classList.add('hidden');
    openBuy();
  });
  document.getElementById('walletFromPauseBtn')?.addEventListener('click', () => {
    pauseScreen?.classList.add('hidden');
    openWallet();
  });
  document.getElementById('closeBuyBtn')?.addEventListener('click', () => {
    buyScreen?.classList.add('hidden');
    if (G.running) G.paused = false;
  });
  document.getElementById('closeWalletBtn')?.addEventListener('click', () => {
    walletScreen?.classList.add('hidden');
    if (G.running) G.paused = false;
  });
  document.getElementById('closeMissionDashBtn')?.addEventListener('click', () => {
    missionDashScreen?.classList.add('hidden');
    if (G.running) G.paused = false;
  });
  document.getElementById('railShop')?.addEventListener('click', openShop);
  document.getElementById('railBuy')?.addEventListener('click', openBuy);
  document.getElementById('railWallet')?.addEventListener('click', openWallet);
  document.getElementById('railDash')?.addEventListener('click', openMissionDash);
  document.getElementById('walletPill')?.addEventListener('click', openWallet);
  document.getElementById('connectWalletBtn')?.addEventListener('click', connectWallet);
  document.getElementById('syncWalletBtn')?.addEventListener('click', syncWalletBalance);

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
    // Combo window
    if (G.combo.timer > 0) {
      G.combo.count++;
      const mult = 1 + Math.min(0.5, G.combo.count * 0.05);
      n = Math.floor(n * mult);
    } else {
      G.combo.count = 1;
    }
    G.combo.timer = 2.5;
    G.score += n;
    if (reason) floatText(G.player.x, G.player.y - 30, `+${n} ${reason}`, '#ffc846');
  }

  function damagePlayer(amt) {
    // Shield absorbs first
    if (G.shield > 0) {
      const absorbed = Math.min(G.shield, amt);
      G.shield -= absorbed;
      G.sessionStats.damageBlocked += absorbed;
      amt -= absorbed;
      G.shieldHitT = 0;
      if (absorbed > 0) {
        burst(G.player.x, G.player.y, '#44aaff', 5);
        floatText(G.player.x, G.player.y - 20, `SHIELD -${Math.floor(absorbed)}`, '#44aaff');
      }
    }
    if (amt <= 0) return;
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
    // Token rewards for some achievements
    let tokenGain = 0;
    if (title.includes('SALE') || title.includes('ASTEROID')) tokenGain = 2;
    if (title.includes('DRONE') || title.includes('WAVE')) tokenGain = 3;
    if (title.includes('FULL CARGO') || title.includes('SHIELD MASTER')) tokenGain = 5;
    if (tokenGain > 0) G.tokens += tokenGain;
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `<div class="achievement-title">★ ${title}</div>
      <div class="achievement-reward">${reward}${tokenGain ? ` · +${tokenGain} ◆` : ''}</div>`;
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
      const quality = rand(0.7, 1.35); // ore quality multiplier
      G.asteroids.push({
        x: p.x, y: p.y, z: rand(-30, 30),
        r,
        ore: Math.floor(r * 1.8 * quality),
        maxOre: Math.floor(r * 1.8 * quality),
        quality,
        angle: rand(0, Math.PI * 2),
        spin: rand(-1.2, 1.2),
        vx: rand(-20, 20),
        vy: rand(-20, 20)
      });
    }

    for (let i = 0; i < w.debris; i++) {
      const p = spawnAwayFromPlayer(250);
      const rarity = Math.random();
      const valueMult = rarity > 0.92 ? 2.2 : rarity > 0.75 ? 1.5 : 1;
      G.debris.push({
        x: p.x, y: p.y, z: rand(-15, 15),
        r: rand(8, 16),
        angle: rand(0, Math.PI * 2),
        spin: rand(-2, 2),
        vx: rand(-35, 35),
        vy: rand(-35, 35),
        hp: 20,
        value: Math.floor(rand(15, 40) * valueMult),
        rarity: valueMult
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
    if (G.fuel < 0.5) {
      floatText(G.player.x, G.player.y - 25, 'NO FUEL', '#ff4060');
      return;
    }
    G.cooldowns.laser = CFG.player.laserCooldown;
    G.fuel = Math.max(0, G.fuel - 0.4);

    const aim = Math.atan2(G.mouse.worldY - G.player.y, G.mouse.worldX - G.player.x);
    const spread = (Math.random() - 0.5) * 0.04;
    const a = aim + spread;

    G.lasers.push({
      x: G.player.x + Math.cos(a) * 18,
      y: G.player.y + Math.sin(a) * 18,
      vx: Math.cos(a) * 900,
      vy: Math.sin(a) * 900,
      life: CFG.player.laserRange / 900,
      damage: effectiveLaserDamage()
    });

    spawnParticle(G.player.x + Math.cos(a) * 16, G.player.y + Math.sin(a) * 16, '#00c8ff', 0.2, 40);
  }

  function deployNet() {
    if (G.cooldowns.net > 0) return;
    if (G.fuel < 1.5) {
      floatText(G.player.x, G.player.y - 25, 'NO FUEL', '#ff4060');
      return;
    }
    G.cooldowns.net = CFG.player.netCooldown;
    G.fuel = Math.max(0, G.fuel - 1.2);
    const aim = Math.atan2(G.mouse.worldY - G.player.y, G.mouse.worldX - G.player.x);
    const r = effectiveNetRadius();
    G.nets.push({
      x: G.player.x,
      y: G.player.y,
      tx: G.player.x + Math.cos(aim) * CFG.player.netRange,
      ty: G.player.y + Math.sin(aim) * CFG.player.netRange,
      progress: 0,
      radius: r,
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
  }

  function tryDock() {
    const d = dist(G.player, G.base);
    if (d < G.base.r + 40) {
      G.docking = true;
      // Instant repair + sell when fully docked (progress handled in update)
    }
  }

  function completeDock() {
    // Repair hull
    const healed = CFG.player.maxHull - G.hull;
    if (healed > 0) {
      G.hull = CFG.player.maxHull;
      floatText(G.player.x, G.player.y - 40, 'HULL REPAIRED', '#00e5a0');
      addScore(40, 'DOCK');
    }
    // Refuel + shield top-up
    G.fuel = maxFuel();
    G.shield = maxShield();
    floatText(G.player.x, G.player.y - 55, 'REFUEL + SHIELD', '#44aaff');

    // Sell ore
    if (G.ore > 0) {
      const kg = G.ore;
      const value = Math.floor(kg * CFG.player.oreSellScore);
      const tok = Math.floor(kg / CFG.player.oreSellTokenDiv);
      addScore(value, 'ORE');
      G.tokens += tok;
      G.sessionStats.oreSold += kg;
      floatText(G.player.x, G.player.y - 70, `+${Math.floor(kg)}kg → +${tok}◆`, '#ffc846');
      G.ore = 0;
      showAchievement('FIRST SALE', 'Sold ore at base station');
      if (kg >= maxCargo() * 0.95) {
        showAchievement('FULL CARGO', 'Docked with a full hold');
      }
    }
    G.docking = false;
    G.dockProgress = 0;
  }

  function buyUpgrade(key) {
    const cost = upgradeCost(key);
    if (cost === null) return false;
    if (G.tokens < cost) {
      floatText(G.player.x, G.player.y - 30, 'NOT ENOUGH ◆', '#ff4060');
      return false;
    }
    G.tokens -= cost;
    G.upgrades[key] = (G.upgrades[key] || 0) + 1;
    G.sessionStats.upgradesBought++;
    // Apply immediate capacity bumps
    if (key === 'shieldMax') G.shield = Math.min(G.shield + CFG.upgrades.shieldMax.perLevel, maxShield());
    if (key === 'fuelTank') G.fuel = Math.min(G.fuel + CFG.upgrades.fuelTank.perLevel, maxFuel());
    showAchievement('UPGRADE', `${CFG.upgrades[key].name} Lv.${G.upgrades[key]}`);
    renderShopList();
    return true;
  }
  window.buyUpgrade = buyUpgrade;

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  function updatePlayer(dt) {
    const p = G.player;
    const aim = Math.atan2(G.mouse.worldY - p.y, G.mouse.worldX - p.x);

    let diff = aim - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += clamp(diff, -CFG.player.turnRate * dt, CFG.player.turnRate * dt);

    let ax = 0, ay = 0;
    let thrusting = false;
    const accel = effectiveAccel();

    if (G.keys['KeyW'] || G.keys['ArrowUp']) {
      ax += Math.cos(p.angle) * accel;
      ay += Math.sin(p.angle) * accel;
      thrusting = true;
    }
    if (G.keys['KeyS'] || G.keys['ArrowDown']) {
      ax -= Math.cos(p.angle) * accel * 0.55;
      ay -= Math.sin(p.angle) * accel * 0.55;
      thrusting = true;
    }
    if (G.keys['KeyA'] || G.keys['ArrowLeft']) {
      ax += Math.cos(p.angle - Math.PI / 2) * accel * 0.7;
      ay += Math.sin(p.angle - Math.PI / 2) * accel * 0.7;
      thrusting = true;
    }
    if (G.keys['KeyD'] || G.keys['ArrowRight']) {
      ax += Math.cos(p.angle + Math.PI / 2) * accel * 0.7;
      ay += Math.sin(p.angle + Math.PI / 2) * accel * 0.7;
      thrusting = true;
    }

    // Fuel burn for thrust
    if (thrusting) {
      if (G.fuel <= 0) {
        ax *= 0.15;
        ay *= 0.15;
      } else {
        G.fuel = Math.max(0, G.fuel - CFG.player.fuelBurnThrust * dt);
      }
    }

    if (G.keys['ShiftLeft'] || G.keys['ShiftRight']) {
      p.vx *= 0.90;
      p.vy *= 0.90;
    }

    p.vx += ax * dt;
    p.vy += ay * dt;

    const maxSp = effectiveMaxSpeed();
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSp) {
      p.vx = (p.vx / sp) * maxSp;
      p.vy = (p.vy / sp) * maxSp;
    }

    p.vx *= Math.pow(CFG.player.damp, dt * 60);
    p.vy *= Math.pow(CFG.player.damp, dt * 60);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const m = 40;
    if (p.x < m) { p.x = m; p.vx *= -0.4; }
    if (p.y < m) { p.y = m; p.vy *= -0.4; }
    if (p.x > CFG.world.w - m) { p.x = CFG.world.w - m; p.vx *= -0.4; }
    if (p.y > CFG.world.h - m) { p.y = CFG.world.h - m; p.vy *= -0.4; }

    p.roll = clamp(-p.vx * 0.0015 + diff * 0.3, -0.5, 0.5);
    p.pitch = clamp(p.vy * 0.001, -0.3, 0.3);

    if (thrusting && G.fuel > 0 && Math.random() < 0.7) {
      spawnParticle(
        p.x - Math.cos(p.angle) * 16,
        p.y - Math.sin(p.angle) * 16,
        '#ff6b35', 0.35, 50
      );
    }

    if (G.mouse.left) fireLaser();
    if (G.mouse.right) deployNet();

    // Continuous mining with fuel + cargo limits
    tryMine(false);
    if (G.miningTarget && G.keys['KeyE'] && G.miningTarget.ore > 0) {
      if (G.fuel <= 0) {
        floatText(p.x, p.y - 25, 'NO FUEL', '#ff4060');
      } else if (G.ore >= maxCargo()) {
        floatText(p.x, p.y - 25, 'CARGO FULL', '#ffc846');
        showAchievement('FULL CARGO', 'Hold is at capacity — dock to sell');
      } else {
        G.fuel = Math.max(0, G.fuel - CFG.player.fuelBurnMine * dt);
        const rate = effectiveMineRate() * dt;
        const space = maxCargo() - G.ore;
        const take = Math.min(G.miningTarget.ore, rate, space);
        G.miningTarget.ore -= take;
        G.ore += take;
        if (Math.random() < 0.4) {
          spawnParticle(G.miningTarget.x, G.miningTarget.y, '#c0a060', 0.4, 40);
        }
        if (G.miningTarget.ore <= 0) {
          const qualityBonus = Math.floor(80 * (G.miningTarget.quality || 1));
          burst(G.miningTarget.x, G.miningTarget.y, '#c0a060', 16);
          addScore(qualityBonus, 'ASTEROID');
          G.asteroids = G.asteroids.filter(a => a !== G.miningTarget);
          G.miningTarget = null;
          showAchievement('ASTEROID CRACKED', 'First asteroid fully mined');
        }
      }
    }

    // Shield regen
    G.shieldHitT += dt;
    if (G.shieldHitT > CFG.player.shieldRegenDelay && G.shield < maxShield()) {
      G.shield = Math.min(maxShield(), G.shield + CFG.player.shieldRegen * dt);
    }

    // Docking progress
    if (G.docking) {
      if (dist(p, G.base) > G.base.r + 45) {
        G.docking = false;
        G.dockProgress = 0;
      } else {
        G.dockProgress = Math.min(1, G.dockProgress + dt * 0.85);
        if (G.dockProgress >= 1) completeDock();
      }
    } else if (dist(p, G.base) < G.base.r + 30 && G.keys['KeyR']) {
      G.docking = true;
    }
  }

  function updateLasers(dt) {
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const L = G.lasers[i];
      L.x += L.vx * dt;
      L.y += L.vy * dt;
      L.life -= dt;
      if (L.life <= 0) { G.lasers.splice(i, 1); continue; }

      for (let j = G.debris.length - 1; j >= 0; j--) {
        const d = G.debris[j];
        if (Math.hypot(L.x - d.x, L.y - d.y) < d.r + 4) {
          d.hp -= L.damage;
          burst(L.x, L.y, '#00c8ff', 6);
          G.lasers.splice(i, 1);
          if (d.hp <= 0) {
            const distBonus = 1 + Math.min(0.4, dist(G.player, d) / 800);
            const score = Math.floor(d.value * distBonus * (d.rarity || 1));
            burst(d.x, d.y, '#b06aff', 14);
            addScore(score, 'DEBRIS');
            G.debrisCleared++;
            G.tokens += d.rarity > 1.5 ? 2 : 1;
            G.debris.splice(j, 1);
          }
          break;
        }
      }
      if (!G.lasers[i]) continue;

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

      for (let j = G.drones.length - 1; j >= 0; j--) {
        const dr = G.drones[j];
        if (Math.hypot(L.x - dr.x, L.y - dr.y) < dr.r + 5) {
          dr.hp -= L.damage;
          burst(L.x, L.y, '#ff4060', 5);
          G.lasers.splice(i, 1);
          if (dr.hp <= 0) {
            const distBonus = 1 + Math.min(0.35, dist(G.player, dr) / 700);
            burst(dr.x, dr.y, '#ff4060', 18);
            addScore(Math.floor(120 * distBonus), 'DRONE');
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
      const w = CFG.waves[Math.min(G.wave, CFG.waves.length - 1)];
      G.score += w.bonus;
      const waveTok = 5 + G.wave * 2;
      G.tokens += waveTok;
      document.getElementById('waveClearTitle').textContent = `LEVEL ${G.wave + 1} COMPLETE`;
      document.getElementById('waveBonus').textContent = `+${w.bonus}`;
      document.getElementById('totalScoreWave').textContent = G.score.toLocaleString();
      document.getElementById('waveTokens').textContent = `+${waveTok}`;
      const detail = document.getElementById('waveDetail');
      if (detail) {
        detail.textContent = `Ore in hold: ${Math.floor(G.ore)} kg · Cargo ${Math.floor(G.ore)}/${Math.floor(maxCargo())} · Shield ${Math.floor(G.shield)}/${Math.floor(maxShield())}`;
      }
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
    if (G.combo.timer > 0) G.combo.timer -= dt;
    else G.combo.count = 0;

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

    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
  }
  window.update = update;

  // ─── 2D RENDER ────────────────────────────────────────────────────────────
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
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Shield ring when active
    if (G.shield > 0) {
      const sp = G.shield / maxShield();
      ctx.strokeStyle = `rgba(68,170,255,${0.25 + sp * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    const thrust = (G.keys['KeyW'] || G.keys['ArrowUp']) && G.fuel > 0 ? 1 : 0.2;
    ctx.fillStyle = `rgba(255,107,53,${0.5 + thrust * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-10 - 8 * thrust - Math.random() * 4, 0);
    ctx.lineTo(-10, 4);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!G.running && titleScreen && !titleScreen.classList.contains('hidden')) {
      return;
    }

    ctx.fillStyle = 'rgba(2,13,24,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Base station
    {
      const s = worldToScreen(G.base.x, G.base.y);
      const dockColor = G.docking ? '#ffc846' : 'rgba(0,229,160,0.5)';
      ctx.strokeStyle = dockColor;
      ctx.lineWidth = G.docking ? 3 : 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, G.base.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = G.docking ? 'rgba(255,200,70,0.12)' : 'rgba(0,229,160,0.08)';
      ctx.fill();
      if (G.docking && G.dockProgress > 0) {
        ctx.strokeStyle = '#ffc846';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, G.base.r + 8, -Math.PI / 2, -Math.PI / 2 + G.dockProgress * Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#00e5a0';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(G.docking ? 'DOCKING…' : 'BASE  [R] DOCK', s.x, s.y + G.base.r + 14);
    }

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

    for (const d of G.debris) {
      const s = worldToScreen(d.x, d.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(d.angle);
      ctx.fillStyle = d.rarity > 1.5 ? '#ffc846' : '#8af';
      ctx.strokeStyle = d.rarity > 1.5 ? '#ffc846' : '#b06aff';
      ctx.lineWidth = 1;
      ctx.fillRect(-d.r * 0.7, -d.r * 0.5, d.r * 1.4, d.r);
      ctx.strokeRect(-d.r * 0.7, -d.r * 0.5, d.r * 1.4, d.r);
      ctx.restore();
    }

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
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#333';
      ctx.fillRect(-10, -16, 20, 3);
      ctx.fillStyle = '#ff4060';
      ctx.fillRect(-10, -16, 20 * (dr.hp / dr.maxHp), 3);
      ctx.restore();
    }

    for (const n of G.nets) {
      const cx = n.x + (n.tx - n.x) * n.progress;
      const cy = n.y + (n.ty - n.y) * n.progress;
      const s = worldToScreen(cx, cy);
      ctx.strokeStyle = `rgba(0,229,160,${n.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, n.radius * n.progress, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + G.t * 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(a) * n.radius * n.progress, s.y + Math.sin(a) * n.radius * n.progress);
        ctx.stroke();
      }
    }

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

    for (const f of G.floatingText) {
      const s = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, s.x, s.y);
      ctx.globalAlpha = 1;
    }

    if (G.running) drawShip(G.player);

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

    if (G.running) drawHUD();
  }
  window.render = render;

  function drawBar(x, y, w, h, pct, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = 'rgba(0,30,50,0.9)';
    ctx.fillRect(x, y, w, h);
    const p = clamp(pct, 0, 1);
    if (p > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(x, y, w * p, h);
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = 'rgba(0,200,255,0.35)';
    ctx.strokeRect(x, y, w, h);
    if (label) {
      ctx.fillStyle = 'rgba(180,230,255,0.8)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(label, x, y - 4);
      ctx.fillStyle = 'rgba(180,230,255,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(p * 100) + '%', x + w, y - 4);
      ctx.textAlign = 'left';
    }
  }

  function drawHUD() {
    updateLiveDash();
    const pad = 14;

    // Bars only (score/tokens live in HTML dashboard)
    const bw = 168, bh = 10;
    let by = canvas.height - pad - 6;
    drawBar(pad, by - bh, bw, bh, G.hull / CFG.player.maxHull,
      G.hull > 40 ? '#00e5a0' : G.hull > 20 ? '#ffc846' : '#ff4060', 'HULL');
    by -= 24;
    drawBar(pad, by - bh, bw, bh, G.shield / maxShield(), '#4488ff', 'SHIELD');
    by -= 24;
    drawBar(pad, by - bh, bw, bh, G.fuel / maxFuel(),
      G.fuel > 25 ? '#ffaa33' : '#ff4060', 'FUEL');
    by -= 24;
    drawBar(pad, by - bh, bw, bh, G.ore / maxCargo(), '#c0a060', 'CARGO');

    const cx = canvas.width - pad - 120;
    ctx.font = '11px Courier New';
    ctx.textAlign = 'left';
    ctx.fillStyle = G.cooldowns.laser > 0 ? 'rgba(180,230,255,0.45)' : 'rgba(0,200,255,0.85)';
    ctx.fillText(`LASER ${G.cooldowns.laser > 0 ? G.cooldowns.laser.toFixed(1) + 's' : 'RDY'}`, cx, pad + 48);
    ctx.fillStyle = G.cooldowns.net > 0 ? 'rgba(180,230,255,0.45)' : 'rgba(0,229,160,0.85)';
    ctx.fillText(`NET   ${G.cooldowns.net > 0 ? G.cooldowns.net.toFixed(1) + 's' : 'RDY'}`, cx, pad + 64);
    if (G.miningTarget) {
      ctx.fillStyle = '#00e5a0';
      ctx.fillText('◉ MINING', cx, pad + 80);
    }
    if (G.fuel < 15) {
      ctx.fillStyle = '#ff4060';
      ctx.fillText('LOW FUEL', cx, pad + 96);
    }

    // Improved radar / minimap
    const mw = 140, mh = 140;
    const mx = canvas.width - pad - mw;
    const my = canvas.height - pad - mh;
    ctx.fillStyle = 'rgba(0,15,30,0.72)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(0,200,255,0.4)';
    ctx.strokeRect(mx, my, mw, mh);

    // Range rings
    const sx = mw / CFG.world.w;
    const sy = mh / CFG.world.h;
    const prx = mx + G.player.x * sx;
    const pry = my + G.player.y * sy;
    ctx.strokeStyle = 'rgba(0,200,255,0.12)';
    ctx.lineWidth = 1;
    for (const ring of [200, 500, 1000]) {
      ctx.beginPath();
      ctx.ellipse(prx, pry, ring * sx, ring * sy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Base
    ctx.fillStyle = '#00e5a0';
    ctx.beginPath();
    ctx.arc(mx + G.base.x * sx, my + G.base.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Asteroids (brown)
    ctx.fillStyle = '#c0a060';
    for (const a of G.asteroids) {
      const sz = 1.5 + (a.r / 55) * 1.5;
      ctx.fillRect(mx + a.x * sx - sz / 2, my + a.y * sy - sz / 2, sz, sz);
    }
    // Debris (purple / gold if rare)
    for (const d of G.debris) {
      ctx.fillStyle = d.rarity > 1.5 ? '#ffc846' : '#b06aff';
      ctx.fillRect(mx + d.x * sx - 1, my + d.y * sy - 1, 2.5, 2.5);
    }
    // Mines — blink
    const blink = Math.sin(G.t * 8) > 0;
    ctx.fillStyle = blink ? '#ff4060' : '#aa2030';
    for (const m of G.mines) {
      ctx.beginPath();
      ctx.arc(mx + m.x * sx, my + m.y * sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Drones — threat size by distance
    for (const d of G.drones) {
      const dd = dist(G.player, d);
      const sz = clamp(4 - dd / 400, 2, 4);
      ctx.fillStyle = dd < 300 ? '#ff2040' : '#ff6080';
      ctx.beginPath();
      ctx.arc(mx + d.x * sx, my + d.y * sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player
    ctx.fillStyle = '#00c8ff';
    ctx.beginPath();
    ctx.arc(prx, pry, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Player facing
    ctx.strokeStyle = '#00c8ff';
    ctx.beginPath();
    ctx.moveTo(prx, pry);
    ctx.lineTo(prx + Math.cos(G.player.angle) * 8, pry + Math.sin(G.player.angle) * 8);
    ctx.stroke();

    // Dock progress UI near ship if docking
    if (G.docking) {
      const s = worldToScreen(G.player.x, G.player.y);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(s.x - 40, s.y - 36, 80, 8);
      ctx.fillStyle = '#ffc846';
      ctx.fillRect(s.x - 40, s.y - 36, 80 * G.dockProgress, 8);
      ctx.fillStyle = '#ffc846';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('DOCKING', s.x, s.y - 40);
    }
  }

  // ─── LIVE DASHBOARD ───────────────────────────────────────────────────────
  function setHudChrome(on) {
    liveDash?.classList.toggle('on', on);
    actionRail?.classList.toggle('on', on);
    walletPill?.classList.toggle('on', on);
  }

  function updateLiveDash() {
    const el = (id) => document.getElementById(id);
    if (el('dashScore')) el('dashScore').textContent = G.score.toLocaleString();
    if (el('dashTokens')) el('dashTokens').textContent = G.tokens;
    if (el('dashWave')) el('dashWave').textContent = `${G.wave + 1}`;
    if (el('dashOre')) el('dashOre').textContent = `${Math.floor(G.ore)} kg`;
    if (el('dashCombo')) {
      el('dashCombo').textContent = (G.combo.count > 1 && G.combo.timer > 0) ? `x${G.combo.count}` : '—';
    }
  }

  function updateWalletPill() {
    if (!walletPill) return;
    const text = document.getElementById('walletPillText');
    if (G.wallet.connected && G.wallet.address) {
      walletPill.classList.add('connected');
      const a = G.wallet.address;
      if (text) text.textContent = a.slice(0, 6) + '…' + a.slice(-4);
    } else {
      walletPill.classList.remove('connected');
      if (text) text.textContent = 'WALLET';
    }
  }

  // ─── WALLET ───────────────────────────────────────────────────────────────
  async function connectWallet() {
    const status = document.getElementById('walletStatusText');
    const addrBox = document.getElementById('walletAddressBox');
    const syncBtn = document.getElementById('syncWalletBtn');
    const btn = document.getElementById('connectWalletBtn');

    if (G.wallet.connected) {
      G.wallet = { connected: false, address: null, chainId: null };
      if (status) status.textContent = 'Disconnected';
      if (addrBox) { addrBox.classList.add('hidden'); addrBox.textContent = ''; }
      if (syncBtn) syncBtn.disabled = true;
      if (btn) btn.textContent = 'CONNECT';
      updateWalletPill();
      return;
    }

    try {
      const eth = window.ethereum;
      if (!eth) {
        if (CFG.wallet.demoMode) {
          const demo = '0xDEMO' + Math.random().toString(16).slice(2, 10).padEnd(34, '0');
          G.wallet = { connected: true, address: demo, chainId: CFG.wallet.chainId };
          if (status) status.innerHTML = '<span class="status-warn">Demo wallet (no extension)</span>';
          if (addrBox) { addrBox.classList.remove('hidden'); addrBox.textContent = demo; }
          if (syncBtn) syncBtn.disabled = false;
          if (btn) btn.textContent = 'DISCONNECT';
          updateWalletPill();
          showAchievement('WALLET LINKED', 'Demo address connected');
          return;
        }
        if (status) status.innerHTML = '<span class="status-err">No wallet extension found</span>';
        return;
      }

      if (btn) btn.textContent = '…';
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      let chainId = await eth.request({ method: 'eth_chainId' });
      if (CFG.wallet.chainId && chainId !== CFG.wallet.chainId) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CFG.wallet.chainId }]
          });
          chainId = CFG.wallet.chainId;
        } catch (_) { /* user may reject */ }
      }
      G.wallet = { connected: true, address, chainId };
      if (status) status.innerHTML = '<span class="status-ok">Connected · ' + (CFG.wallet.chainName || chainId) + '</span>';
      if (addrBox) { addrBox.classList.remove('hidden'); addrBox.textContent = address; }
      if (syncBtn) syncBtn.disabled = false;
      if (btn) btn.textContent = 'DISCONNECT';
      updateWalletPill();
      showAchievement('WALLET LINKED', 'Address connected');

      // Optional SIWE-style auth hook
      if (CFG.wallet.authApiUrl) {
        try {
          await fetch(CFG.wallet.authApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, chainId })
          });
        } catch (err) {
          console.warn('wallet auth API', err);
        }
      }
    } catch (err) {
      console.warn('connectWallet', err);
      if (status) status.innerHTML = '<span class="status-err">Connection failed</span>';
      if (btn) btn.textContent = 'CONNECT';
    }
  }

  async function syncWalletBalance() {
    const hint = document.getElementById('walletHint');
    if (!G.wallet.address) return;
    if (!CFG.wallet.balanceApiUrl) {
      if (hint) hint.textContent = 'No balanceApiUrl configured — tokens remain local.';
      return;
    }
    try {
      const url = CFG.wallet.balanceApiUrl + (CFG.wallet.balanceApiUrl.includes('?') ? '&' : '?') +
        'address=' + encodeURIComponent(G.wallet.address);
      const res = await fetch(url);
      const data = await res.json();
      if (typeof data.tokens === 'number') {
        G.tokens = Math.max(G.tokens, Math.floor(data.tokens));
        if (hint) hint.innerHTML = '<span class="status-ok">Synced · balance applied</span>';
        updateLiveDash();
      }
    } catch (err) {
      if (hint) hint.innerHTML = '<span class="status-err">Sync failed</span>';
      console.warn('syncWallet', err);
    }
  }

  function openWallet() {
    closeAllPanels();
    pauseScreen?.classList.add('hidden');
    if (G.running) G.paused = true;
    walletScreen?.classList.remove('hidden');
    const status = document.getElementById('walletStatusText');
    const addrBox = document.getElementById('walletAddressBox');
    const btn = document.getElementById('connectWalletBtn');
    const syncBtn = document.getElementById('syncWalletBtn');
    if (G.wallet.connected) {
      if (status) status.innerHTML = '<span class="status-ok">Connected</span>';
      if (addrBox) { addrBox.classList.remove('hidden'); addrBox.textContent = G.wallet.address; }
      if (btn) btn.textContent = 'DISCONNECT';
      if (syncBtn) syncBtn.disabled = false;
    } else {
      if (status) status.textContent = 'Not connected';
      if (addrBox) addrBox.classList.add('hidden');
      if (btn) btn.textContent = 'CONNECT';
      if (syncBtn) syncBtn.disabled = true;
    }
  }

  // ─── STRIPE / TOKEN PACKS ─────────────────────────────────────────────────
  function renderPackList() {
    const list = document.getElementById('packList');
    if (!list) return;
    list.innerHTML = '';
    for (const pack of CFG.payments.packs) {
      const row = document.createElement('div');
      row.className = 'pack-row';
      row.innerHTML = `
        <div>
          <div class="pack-name">${pack.name}</div>
          <div class="pack-meta">+${pack.tokens} ◆ · $${pack.priceUsd.toFixed(2)}</div>
        </div>
        <button class="buy-btn stripe" data-pack="${pack.id}">BUY</button>`;
      list.appendChild(row);
    }
    list.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => purchasePack(btn.getAttribute('data-pack')));
    });
    const st = document.getElementById('stripeStatus');
    if (st) {
      if (CFG.payments.demoMode) st.innerHTML = 'Status: <span class="status-warn">demo mode — packs grant tokens, no charge</span>';
      else if (CFG.payments.checkoutApiUrl || CFG.payments.packs.some(p => p.paymentLink))
        st.innerHTML = 'Status: <span class="status-ok">live checkout configured</span>';
      else st.innerHTML = 'Status: <span class="status-err">set paymentLink or checkoutApiUrl</span>';
    }
  }

  async function purchasePack(packId) {
    const pack = CFG.payments.packs.find(p => p.id === packId);
    if (!pack) return;

    // 1) Prefer backend Checkout Session
    if (CFG.payments.checkoutApiUrl && !CFG.payments.demoMode) {
      try {
        const res = await fetch(CFG.payments.checkoutApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packId: pack.id,
            priceId: pack.priceId,
            wallet: G.wallet.address || null
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } catch (err) {
        console.warn('checkout API', err);
      }
    }

    // 2) Stripe Payment Link
    if (pack.paymentLink && !CFG.payments.demoMode) {
      window.open(pack.paymentLink, '_blank', 'noopener');
      return;
    }

    // 3) Demo grant
    G.tokens += pack.tokens;
    G.sessionStats.tokensBought += pack.tokens;
    floatText(G.player.x, G.player.y - 40, `+${pack.tokens} ◆`, '#00e5a0');
    showAchievement('TOKEN PACK', `${pack.name} credited`);
    updateLiveDash();
    const st = document.getElementById('stripeStatus');
    if (st) st.innerHTML = `<span class="status-ok">Demo: +${pack.tokens} tokens added</span>`;
  }

  function openBuy() {
    closeAllPanels();
    pauseScreen?.classList.add('hidden');
    if (G.running) G.paused = true;
    buyScreen?.classList.remove('hidden');
    renderPackList();
  }

  function openMissionDash() {
    closeAllPanels();
    pauseScreen?.classList.add('hidden');
    if (G.running) G.paused = true;
    missionDashScreen?.classList.remove('hidden');
    const el = (id) => document.getElementById(id);
    if (el('mdScore')) el('mdScore').textContent = G.score.toLocaleString();
    if (el('mdTokens')) el('mdTokens').textContent = G.tokens;
    if (el('mdOre')) el('mdOre').textContent = Math.floor(G.ore);
    if (el('mdDebris')) el('mdDebris').textContent = G.debrisCleared;
    if (el('mdSystems')) {
      el('mdSystems').innerHTML =
        `HULL ${Math.floor(G.hull)}/${CFG.player.maxHull} · ` +
        `SHIELD ${Math.floor(G.shield)}/${Math.floor(maxShield())} · ` +
        `FUEL ${Math.floor(G.fuel)}/${Math.floor(maxFuel())} · ` +
        `CARGO ${Math.floor(G.ore)}/${Math.floor(maxCargo())}<br>` +
        `Upgrades bought: ${G.sessionStats.upgradesBought} · ` +
        `Ore sold: ${Math.floor(G.sessionStats.oreSold)} kg · ` +
        `Damage blocked: ${Math.floor(G.sessionStats.damageBlocked)} · ` +
        `Tokens purchased: ${G.sessionStats.tokensBought}`;
    }
    if (el('mdWalletLine')) {
      el('mdWalletLine').textContent = G.wallet.connected
        ? `Wallet: ${G.wallet.address}`
        : 'Wallet: not linked';
    }
  }

  // ─── SHOP UI ──────────────────────────────────────────────────────────────
  function renderShopList() {
    const list = document.getElementById('shopList');
    if (!list) return;
    list.innerHTML = '';
    const tokEl = document.getElementById('shopTokens');
    if (tokEl) tokEl.textContent = G.tokens;

    for (const key of Object.keys(CFG.upgrades)) {
      const def = CFG.upgrades[key];
      const lvl = G.upgrades[key] || 0;
      const cost = upgradeCost(key);
      const row = document.createElement('div');
      row.className = 'shop-row';
      const maxed = cost === null;
      let effect = '';
      if (key === 'cargoCap') effect = `+${def.perLevel} kg`;
      else if (key === 'shieldMax') effect = `+${def.perLevel} shield`;
      else if (key === 'fuelTank') effect = `+${def.perLevel} fuel`;
      else effect = `+${Math.round(def.perLevel * 100)}%`;

      row.innerHTML = `
        <div class="shop-info">
          <div class="shop-name">${def.name}</div>
          <div class="shop-meta">Lv ${lvl}/${def.max} · ${effect}</div>
        </div>
        <button class="buy-btn" data-key="${key}" ${maxed || G.tokens < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : cost + ' ◆'}
        </button>`;
      list.appendChild(row);
    }

    list.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-key');
        if (buyUpgrade(k)) renderShopList();
      });
    });
  }

  function openShop() {
    if (!shopScreen) return;
    closeAllPanels();
    G.paused = true;
    pauseScreen?.classList.add('hidden');
    shopScreen.classList.remove('hidden');
    renderShopList();
  }

  function closeShop() {
    shopScreen?.classList.add('hidden');
    if (G.running) G.paused = false;
  }

  // ─── FLOW ─────────────────────────────────────────────────────────────────
  function startGame() {
    titleScreen?.classList.add('hidden');
    pauseScreen?.classList.add('hidden');
    waveClearScreen?.classList.add('hidden');
    gameOverScreen?.classList.add('hidden');
    closeAllPanels();

    G.running = true;
    G.paused = false;
    G.wave = 0;
    G.score = 0;
    G.tokens = 8;
    G.ore = 0;
    G.debrisCleared = 0;
    G.hull = CFG.player.maxHull;
    G.fuel = CFG.player.maxFuel;
    G.shield = CFG.player.maxShield;
    G.shieldHitT = 99;
    G.docking = false;
    G.dockProgress = 0;
    G.upgrades = {
      miningSpeed: 0, laserDamage: 0, netRadius: 0,
      enginePower: 0, cargoCap: 0, shieldMax: 0, fuelTank: 0
    };
    G.player.x = CFG.world.w / 2;
    G.player.y = CFG.world.h / 2;
    G.player.vx = 0;
    G.player.vy = 0;
    G.player.angle = 0;
    G.particles = [];
    G.floatingText = [];
    G.achievements = new Set();
    G.combo = { count: 0, timer: 0 };
    G.sessionStats = { oreSold: 0, damageBlocked: 0, upgradesBought: 0, tokensBought: 0 };
    // keep wallet connection across restarts
    spawnWave(0);
    setHudChrome(true);
    updateLiveDash();
    updateWalletPill();

    if (typeof window.initThreeRenderer === 'function') {
      try { window.initThreeRenderer(); } catch (_) {}
    }
  }

  function nextWave() {
    waveClearScreen?.classList.add('hidden');
    G.wave++;
    G.running = true;
    // Soft refuel between waves
    G.fuel = Math.min(maxFuel(), G.fuel + maxFuel() * 0.35);
    G.shield = Math.min(maxShield(), G.shield + maxShield() * 0.4);
    spawnWave(G.wave);
  }

  function togglePause() {
    G.paused = !G.paused;
    pauseScreen?.classList.toggle('hidden', !G.paused);
  }

  function gameOver() {
    G.running = false;
    setHudChrome(false);
    closeAllPanels();
    document.getElementById('finalScore').textContent = G.score.toLocaleString();
    document.getElementById('finalWave').textContent = G.wave;
    document.getElementById('finalDebris').textContent = G.debrisCleared;
    document.getElementById('finalOre').textContent = Math.floor(G.sessionStats.oreSold) + ' kg';
    document.getElementById('finalTokens').textContent = G.tokens;
    const extra = document.getElementById('finalExtra');
    if (extra) {
      extra.textContent = `Blocked ${Math.floor(G.sessionStats.damageBlocked)} dmg · ${G.sessionStats.upgradesBought} upgrades · Bought ${G.sessionStats.tokensBought} ◆`;
    }
    gameOverScreen?.classList.remove('hidden');
  }

  // ─── BOOT ─────────────────────────────────────────────────────────────────
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
