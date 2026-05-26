'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const CFG = {
  world: { w: 5000, h: 5000 },
  player: { thrust: 210, maxSpeed: 310, drag: 0.994, rotSpeed: 4.5, maxHull: 100, maxFuel: 100, maxPower: 100, maxNets: 6, laserRange: 360, mineRange: 90, dockRange: 80, collisionR: 18 },
  laser: { damage: 90, powerDrain: 28, cooldown: 0.08, beamTime: 0.12, color: '#00c8ff', hitColor: '#ffffff' },
  net: { speed: 240, maxRadius: 130, expandTime: 1.4, lifetime: 9, catchRange: 30 },
  mine: { rate: 18, range: 90, powerDrain: 8 },
  base: { dockRange: 80, refuelRate: 40, repairRate: 30, reloadRate: 2 },
  debris: { small: { r: 8, hp: 60, pts: 100, speed: [20,55], rotSpeed: [0.5,2.5] }, medium: { r: 18, hp: 160, pts: 250, speed: [12,35], rotSpeed: [0.2,1.2] }, large: { r: 34, hp: 400, pts: 500, speed: [8,20], rotSpeed: [0.1,0.8] } },
  asteroid: { small: { r: 28, ore: 60, speed: [5,18] }, medium: { r: 48, ore: 130, speed: [3,12] }, large: { r: 72, ore: 260, speed: [2,8] } },
  netBonusMult: 1.5,
  waveBonusBase: 500,
  hazard: { radiation: { hullDrain: 6, powerDrain: 0, fuelDrain: 0, col: '#ff4060', name: 'RADIATION BELT' }, ion_storm: { hullDrain: 0, powerDrain: 18, fuelDrain: 0, col: '#b06aff', name: 'ION STORM' }, debris_cloud: { hullDrain: 0, powerDrain: 0, fuelDrain: 4, col: '#999999', name: 'DEBRIS CLOUD' } },
  mine_obs: { r: 16, hp: 30, pts: 60, proximityR: 58, countdown: 2.0, damage: 42 },
  drone: { r: 14, hp: 120, pts: 300, speed: 78, alertR: 390, ramDamage: 14 },
  radar: { range: 800, radarSize: 120, centerX: 0, centerY: 0 },
};

const ACHIEVEMENTS = [
  { id: 'first_blood', label: 'FIRST BLOOD', desc: 'Destroy your first debris', check: g => g.debrisCleared >= 1, tokens: 10 },
  { id: 'debris_10', label: 'NEUTRALISER', desc: 'Destroy 10 debris', check: g => g.debrisCleared >= 10, tokens: 25 },
  { id: 'debris_50', label: 'CLEAN SWEEP', desc: 'Destroy 50 debris', check: g => g.debrisCleared >= 50, tokens: 75 },
  { id: 'ore_100', label: 'PROSPECTOR', desc: 'Mine 100 kg ore', check: g => g.player.totalOre >= 100, tokens: 50 },
  { id: 'ore_500', label: 'MOTHERLODE', desc: 'Mine 500 kg ore', check: g => g.player.totalOre >= 500, tokens: 150 },
  { id: 'wave_3', label: 'SURVIVOR', desc: 'Reach wave 3', check: g => g.wave >= 3, tokens: 40 },
  { id: 'wave_5', label: 'ELITE PILOT', desc: 'Reach wave 5', check: g => g.wave >= 5, tokens: 100 },
  { id: 'net_ace', label: 'NET ACE', desc: '5 net captures this session', check: g => g.netCaptures >= 5, tokens: 60 },
  { id: 'score_5k', label: 'HIGH SCORER', desc: 'Reach 5,000 points', check: g => g.score >= 5000, tokens: 80 },
  { id: 'score_20k', label: 'LEGEND', desc: 'Reach 20,000 points', check: g => g.score >= 20000, tokens: 250 },
  { id: 'hazard_survive', label: 'HAZARD PAY', desc: 'Survive 5 s inside a hazard zone', check: g => g.hazardTime >= 5, tokens: 45 },
];

const WAVES = [
  { name: 'SECTOR ALPHA · ENTRY ZONE', briefing: 'Clear the approach corridor and establish a presence.', debris: [{t:'small',n:4},{t:'medium',n:1}], asteroids: [{t:'small',n:3}], mines: 0, drones: 0, oreTarget: 50 },
  { name: 'SECTOR BETA · DEBRIS BELT', briefing: 'Dense debris field detected. Proximity mines litter the lane.', debris: [{t:'small',n:7},{t:'medium',n:3}], asteroids: [{t:'small',n:2},{t:'medium',n:2}], mines: 4, drones: 0, oreTarget: 100 },
  { name: 'SECTOR GAMMA · ION STORM', briefing: 'Ion storm active — power bus vulnerability high. One hostile drone scouting.', debris: [{t:'small',n:8},{t:'medium',n:4},{t:'large',n:1}], asteroids: [{t:'small',n:3},{t:'medium',n:2}], mines: 3, drones: 1, oreTarget: 150 },
  { name: 'SECTOR DELTA · MINE FIELD', briefing: 'Scattered proximity mines blanket the sector. Advance with caution.', debris: [{t:'small',n:6},{t:'medium',n:4},{t:'large',n:1}], asteroids: [{t:'small',n:2},{t:'medium',n:3}], mines: 8, drones: 0, oreTarget: 180 },
  { name: 'SECTOR EPSILON · DRONE SWARM', briefing: 'Rogue mining drones have turned hostile. Neutralise the swarm.', debris: [{t:'small',n:10},{t:'medium',n:5},{t:'large',n:2}], asteroids: [{t:'small',n:4},{t:'medium',n:2}], mines: 2, drones: 3, oreTarget: 220 },
  { name: 'SECTOR ZETA · RADIATION BELT', briefing: 'Heavy radiation — hull integrity will decay. Drones are closing in.', debris: [{t:'small',n:12},{t:'medium',n:6},{t:'large',n:2}], asteroids: [{t:'medium',n:3},{t:'large',n:1}], mines: 4, drones: 2, oreTarget: 280 },
  { name: 'SECTOR ETA · SATELLITE GRAVEYARD', briefing: 'Dead satellites everywhere. Heavy drone patrols. Maximum caution.', debris: [{t:'small',n:14},{t:'medium',n:8},{t:'large',n:3}], asteroids: [{t:'medium',n:4},{t:'large',n:2}], mines: 6, drones: 4, oreTarget: 320 },
  { name: 'SECTOR THETA · STORM FRONT', briefing: 'Multiple hazard zones converge. Mines and drones defend the perimeter.', debris: [{t:'small',n:16},{t:'medium',n:8},{t:'large',n:4}], asteroids: [{t:'medium',n:5},{t:'large',n:2}], mines: 10, drones: 3, oreTarget: 380 },
  { name: 'SECTOR IOTA · SIEGE MODE', briefing: 'Full-scale assault. All systems critical. Hold the line.', debris: [{t:'small',n:18},{t:'medium',n:10},{t:'large',n:5}], asteroids: [{t:'medium',n:6},{t:'large',n:3}], mines: 12, drones: 5, oreTarget: 450 },
  { name: 'SECTOR KAPPA · FINAL STAND', briefing: 'Last known debris concentration. Finish this.', debris: [{t:'small',n:20},{t:'medium',n:12},{t:'large',n:6}], asteroids: [{t:'medium',n:8},{t:'large',n:4}], mines: 15, drones: 6, oreTarget: 500 },
];

let G = null;

function mkPlayer() {
  return { x: CFG.world.w / 2, y: CFG.world.h / 2 + 60, vx: 0, vy: 0, angle: -Math.PI / 2, hull: CFG.player.maxHull, fuel: CFG.player.maxFuel, power: CFG.player.maxPower, nets: CFG.player.maxNets, ore: 0, totalOre: 0, docked: false, laserCooldown: 0, dockTimer: 0, miningTimer: 0, id: 'PLAYER' };
}

function initGame() {
  G = { state: 'PLAYING', score: 0, wave: 1, debrisCleared: 0, netCaptures: 0, hazardTime: 0, tokens: 0, time: 0, player: mkPlayer(), debris: [], asteroids: [], particles: [], nets: [], ore: [], mines: [], drones: [], hazards: [], base: { x: CFG.world.w / 2, y: CFG.world.h / 2, r: 50, id: 'BASE' }, log: [], stars: genStars(), cam: { x: CFG.world.w / 2, y: CFG.world.h / 2 }, shakeTimer: 0, shakeAmt: 0, waveActive: true, waveGoals: { debrisTarget: 0, dronesTarget: 0, oreTarget: 0, oreAtWaveStart: 0 }, unlockedAchievements: new Set() };
  spawnWave(1);
}

function genStars() {
  const layers = [];
  [220, 140, 80].forEach((count, i) => {
    const arr = [];
    for (let j = 0; j < count; j++) {
      arr.push({ x: Math.random() * CFG.world.w, y: Math.random() * CFG.world.h, r: 0.2 + Math.random() * (1.2 - i * 0.3), a: 0.2 + Math.random() * 0.7, da: (Math.random() - 0.5) * 0.02 });
    }
    layers.push({ stars: arr, parallax: 0.2 + i * 0.3 });
  });
  return layers;
}

function waveData(n) { return WAVES[Math.min(n - 1, WAVES.length - 1)]; }
function randomEdgePos(margin) {
  margin = margin || 300;
  const base = G.base;
  let x, y, dist = 0;
  while (dist < 800) {
    x = margin + Math.random() * (CFG.world.w - margin * 2);
    y = margin + Math.random() * (CFG.world.h - margin * 2);
    dist = Math.hypot(x - base.x, y - base.y);
  }
  return { x, y };
}

function randSpeed(range) {
  const s = range[0] + Math.random() * (range[1] - range[0]);
  const a = Math.random() * Math.PI * 2;
  return { vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}

function mkDebrisShape(r, n) {
  const pts = [];
  n = n || (6 + Math.floor(Math.random() * 5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.55 + Math.random() * 0.55);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  return pts;
}

function mkAsteroidShape(r) {
  const pts = [];
  const n = 9 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.6 + Math.random() * 0.48);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  return pts;
}

function spawnWave(waveNum) {
  const wd = waveData(waveNum);
  G.levelName = wd.name;
  G.waveTokensEarned = 0;
  let totalDebris = 0;
  wd.debris.forEach(d => {
    for (let i = 0; i < d.n; i++) {
      const pos = randomEdgePos();
      const dc = CFG.debris[d.t];
      const vel = randSpeed(dc.speed);
      G.debris.push({ x: pos.x, y: pos.y, vx: vel.vx, vy: vel.vy, angle: Math.random() * Math.PI * 2, rotSpeed: (dc.rotSpeed[0] + Math.random() * (dc.rotSpeed[1] - dc.rotSpeed[0])) * (Math.random() < 0.5 ? 1 : -1), r: dc.r, hp: dc.hp, maxHp: dc.hp, type: d.t, shape: mkDebrisShape(dc.r), glint: Math.random() * Math.PI * 2, id: 'DEBRIS_' + (Math.random() * 1e9 | 0), pts: dc.pts });
      totalDebris++;
    }
  });
  wd.asteroids.forEach(a => {
    for (let i = 0; i < a.n; i++) {
      const pos = randomEdgePos();
      const ac = CFG.asteroid[a.t];
      const vel = randSpeed(ac.speed);
      G.asteroids.push({ x: pos.x, y: pos.y, vx: vel.vx, vy: vel.vy, angle: Math.random() * Math.PI * 2, rotSpeed: (0.02 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1), r: ac.r, ore: ac.ore, maxOre: ac.ore, shape: mkAsteroidShape(ac.r), id: 'ASTEROID_' + (Math.random() * 1e9 | 0) });
    }
  });
  spawnHazards(waveNum);
  spawnMines(wd.mines || 0);
  spawnDrones(wd.drones || 0);
  G.waveGoals.debrisTarget = totalDebris;
  G.waveGoals.dronesTarget = wd.drones || 0;
  G.waveGoals.oreTarget = wd.oreTarget || 50 * waveNum;
  G.waveGoals.oreAtWaveStart = G.player.totalOre;
  addLog('LEVEL ' + waveNum + ': ' + wd.name, 'ok');
  addLog(wd.briefing, 'info');
}

function spawnHazards(waveNum) {
  G.hazards = [];
  const types = ['radiation', 'ion_storm', 'debris_cloud'];
  const count = Math.min(1 + Math.floor(waveNum / 2), 4);
  for (let i = 0; i < count; i++) {
    const pos = randomEdgePos(500);
    const type = types[i % types.length];
    const r = 100 + Math.random() * 150;
    G.hazards.push({ x: pos.x, y: pos.y, r: r, type: type, pulse: Math.random() * Math.PI * 2, warnLogCooldown: 0 });
  }
  addLog(count + ' hazard zone(s) detected this wave', 'warn');
}

function spawnMines(count) {
  G.mines = [];
  const mc = CFG.mine_obs;
  for (let i = 0; i < count; i++) {
    const pos = randomEdgePos(200);
    const drift = (Math.random() - 0.5) * 6;
    const drift2 = (Math.random() - 0.5) * 6;
    G.mines.push({ x: pos.x, y: pos.y, vx: drift, vy: drift2, r: mc.r, hp: mc.hp, maxHp: mc.hp, armed: true, beeping: false, countdown: 0, beepTimer: 0, pulse: Math.random() * Math.PI * 2, id: 'MINE_' + (Math.random() * 1e9 | 0) });
  }
  if (count > 0) addLog(count + ' proximity mine(s) deployed in sector', 'warn');
}

function spawnDrones(count) {
  G.drones = [];
  const dc = CFG.drone;
  for (let i = 0; i < count; i++) {
    const pos = randomEdgePos(400);
    const patrolAngle = Math.random() * Math.PI * 2;
    G.drones.push({ x: pos.x, y: pos.y, vx: Math.cos(patrolAngle) * dc.speed * 0.3, vy: Math.sin(patrolAngle) * dc.speed * 0.3, r: dc.r, hp: dc.hp, maxHp: dc.hp, angle: patrolAngle, state: 'patrol', patrolAngle: patrolAngle, patrolTimer: 2 + Math.random() * 3, id: 'DRONE_' + (Math.random() * 1e9 | 0) });
  }
  if (count > 0) addLog(count + ' hostile drone(s) detected in sector', 'crit');
}

function addLog(msg, type) {
  const now = new Date();
  const ts = String(now.getUTCHours()).padStart(2,'0') + ':' + String(now.getUTCMinutes()).padStart(2,'0') + ':' + String(now.getUTCSeconds()).padStart(2,'0');
  G.log.unshift({ ts, msg, type: type || 'info' });
  if (G.log.length > 8) G.log.pop();
}

function checkAndUnlockAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!G.unlockedAchievements.has(ach.id) && ach.check(G)) {
      G.unlockedAchievements.add(ach.id);
      G.tokens += ach.tokens;
      G.waveTokensEarned += ach.tokens;
      addLog('ACHIEVEMENT UNLOCKED: ' + ach.label + ' (+' + ach.tokens + ' tokens◆)', 'ok');
      showAchievementToast(ach);
    }
  });
}

function showAchievementToast(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<div class="achievement-title">✦ ${achievement.label}</div><div>${achievement.desc}</div><div class="achievement-reward"><span class="crypto-badge">+${achievement.tokens} TOKENS◆</span></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

const keys = {};
const mouse = { x: 0, y: 0, left: false, right: false };
let ctxMenu = false;

window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Escape') togglePause(); e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.left = true; if (e.button === 2) mouse.right = true; if (e.button === 2) ctxMenu = true; });
canvas.addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('startBtn').addEventListener('click', () => { hideAllScreens(); initGame(); });
document.getElementById('resumeBtn').addEventListener('click', () => { hideAllScreens(); G.state = 'PLAYING'; });
document.getElementById('restartFromPauseBtn').addEventListener('click', () => { hideAllScreens(); initGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { hideAllScreens(); initGame(); });
document.getElementById('nextWaveBtn').addEventListener('click', () => { hideAllScreens(); G.wave++; G.mines = []; G.drones = []; spawnWave(G.wave); G.state = 'PLAYING'; G.waveActive = true; });

function hideAllScreens() {
  ['titleScreen','pauseScreen','waveClearScreen','gameOverScreen'].forEach(id => { document.getElementById(id).classList.add('hidden'); });
}

function togglePause() {
  if (!G || G.state === 'TITLE') return;
  if (G.state === 'PLAYING') {
    G.state = 'PAUSED';
    document.getElementById('pauseScreen').classList.remove('hidden');
  } else if (G.state === 'PAUSED') {
    G.state = 'PLAYING';
    document.getElementById('pauseScreen').classList.add('hidden');
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function fmt(n) { return n.toLocaleString(); }
function fmtPct(n) { return Math.round(n) + '%'; }

function spawnParticles(x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, color: color, r: size * (0.3 + Math.random() * 0.7) });
  }
}

function spawnThrustParticle(p) {
  const back = p.angle + Math.PI;
  const spread = 0.35;
  const a = back + (Math.random() - 0.5) * spread;
  const s = 80 + Math.random() * 120;
  G.particles.push({ x: p.x + Math.cos(back) * 22, y: p.y + Math.sin(back) * 22, vx: Math.cos(a) * s + p.vx * 0.4, vy: Math.sin(a) * s + p.vy * 0.4, life: 0.25 + Math.random() * 0.2, maxLife: 0.4, color: '#ffaa55', r: 1.5 + Math.random() * 1 });
}

function spawnMineParticle(x, y) {
  const a = Math.random() * Math.PI * 2;
  const s = 30 + Math.random() * 60;
  G.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 0.4+Math.random()*0.4, maxLife:0.8, color: ['#ffc846','#ff8040','#ffaa00'][Math.floor(Math.random()*3)], r: 1 + Math.random() * 1.5 });
}

function spawnExplosion(x, y, size) {
  const n = Math.floor(size * 1.2 + 10);
  spawnParticles(x, y, n, '#ff4060', size * 2.5 + 40, 0.6, size * 0.12 + 2);
  spawnParticles(x, y, Math.floor(n*0.6), '#ffc846', size * 1.5 + 20, 0.4, size * 0.08 + 1.5);
  spawnParticles(x, y, Math.floor(n*0.4), '#ffffff', size * 3 + 60, 0.25, 1.5);
}

let laserBeam = null;

function fireLaser(dt) {
  const p = G.player;
  if (p.power <= 0) return;
  if (p.laserCooldown > 0) return;
  const mx = mouse.x - canvas.width/2 + G.cam.x;
  const my = mouse.y - canvas.height/2 + G.cam.y;
  const dx = mx - p.x, dy = my - p.y;
  const d = Math.hypot(dx, dy);
  if (d > CFG.player.laserRange * 1.1) return;
  let best = null, bestDist = Infinity;
  const ux = dx / d, uy = dy / d;
  [...G.debris, ...G.asteroids, ...G.mines, ...G.drones].forEach(obj => {
    const tx = obj.x - p.x, ty = obj.y - p.y;
    const proj = tx * ux + ty * uy;
    if (proj < 0 || proj > CFG.player.laserRange) return;
    const perp = Math.abs(tx * uy - ty * ux);
    if (perp < obj.r + 8 && proj < bestDist) { bestDist = proj; best = obj; }
  });
  const endX = best ? best.x : p.x + ux * CFG.player.laserRange;
  const endY = best ? best.y : p.y + uy * CFG.player.laserRange;
  laserBeam = { x1: p.x, y1: p.y, x2: endX, y2: endY, timer: CFG.laser.beamTime, hitX: endX, hitY: endY, hit: !!best };
  if (best) {
    const isMine = G.mines.indexOf(best) !== -1;
    const isDrone = G.drones.indexOf(best) !== -1;
    if (isMine) {
      best.hp -= CFG.laser.damage;
      spawnParticles(best.x, best.y, 4, '#ffc846', 70, 0.3, 2);
      if (best.hp <= 0) {
        spawnExplosion(best.x, best.y, best.r * 1.8);
        G.score += 60;
        addLog('Mine neutralised: ' + best.id + ' (+60 pts)', 'ok');
        G.mines.splice(G.mines.indexOf(best), 1);
      }
    } else if (isDrone) {
      best.hp -= CFG.laser.damage;
      spawnParticles(best.x, best.y, 6, '#ff4060', 90, 0.3, 2.5);
      if (best.hp <= 0) {
        spawnExplosion(best.x, best.y, best.r * 2);
        G.score += CFG.drone.pts;
        addLog('Drone destroyed: ' + best.id + ' (+' + CFG.drone.pts + ' pts)', 'ok');
        G.drones.splice(G.drones.indexOf(best), 1);
      }
    } else if (best.hp !== undefined) {
      best.hp -= CFG.laser.damage;
      spawnParticles(best.x, best.y, 5, '#00c8ff', 80, 0.25, 2);
      if (best.hp <= 0) {
        spawnExplosion(best.x, best.y, best.r);
        G.score += best.pts;
        G.debrisCleared++;
        addLog('Debris neutralised: ' + best.id + ' (+' + best.pts + ' pts)', 'ok');
        G.debris.splice(G.debris.indexOf(best), 1);
      }
    } else {
      const mined = Math.min(best.ore, 5);
      best.ore -= mined;
      p.ore += mined;
      p.totalOre += mined;
      spawnParticles(best.x, best.y, 3, '#ffc846', 50, 0.3, 2);
      if (best.ore <= 0) {
        spawnExplosion(best.x, best.y, best.r * 0.5);
        addLog('Asteroid depleted: ' + best.id, 'warn');
        G.asteroids.splice(G.asteroids.indexOf(best), 1);
      }
    }
  }
  p.power -= CFG.laser.powerDrain * dt * 8;
  p.laserCooldown = CFG.laser.cooldown;
  G.shakeTimer = 0.08; G.shakeAmt = 1.5;
}

function deployNet() {
  const p = G.player;
  if (p.nets <= 0) { addLog('No nets remaining — dock to reload', 'warn'); return; }
  const mx = mouse.x - canvas.width/2 + G.cam.x;
  const my = mouse.y - canvas.height/2 + G.cam.y;
  const dx = mx - p.x, dy = my - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = CFG.net.speed;
  G.nets.push({ x: p.x, y: p.y, vx: (dx/d) * spd, vy: (dy/d) * spd, radius: 0, maxRadius: CFG.net.maxRadius, life: CFG.net.lifetime, maxLife: CFG.net.lifetime, active: true, caught: [], expanding: true, expandTimer: 0 });
  p.nets--;
  addLog('Net deployed toward ' + (Math.round(Math.atan2(dy,dx)*180/Math.PI)) + '°', 'info');
  G.shakeTimer = 0.05; G.shakeAmt = 1;
}

let netDeployCooldown = 0;

function doMining(dt) {
  const p = G.player;
  if (p.power < 5) return;
  let closest = null, closestD = Infinity;
  G.asteroids.forEach(a => {
    const d = dist(p, a) - a.r;
    if (d < CFG.mine.range && d < closestD) { closestD = d; closest = a; }
  });
  if (!closest) { addLog('No asteroid in mining range', 'warn'); return; }
  p.miningTimer += dt;
  const mined = Math.min(closest.ore, CFG.mine.rate * dt);
  closest.ore -= mined;
  p.ore += mined;
  p.totalOre += mined;
  p.power -= CFG.mine.powerDrain * dt;
  if (Math.random() < dt * 15) spawnMineParticle(closest.x + (Math.random() - 0.5) * closest.r, closest.y + (Math.random() - 0.5) * closest.r);
  if (closest.ore <= 0) {
    G.score += Math.round(closest.maxOre) * 10;
    addLog('Asteroid mined out: ' + closest.id + ' (+' + Math.round(closest.maxOre * 10) + ' pts)', 'ok');
    spawnExplosion(closest.x, closest.y, closest.r * 0.4);
    G.asteroids.splice(G.asteroids.indexOf(closest), 1);
  }
}

function doDocking(dt) {
  const p = G.player;
  const b = G.base;
  const d = dist(p, b);
  if (d > CFG.base.dockRange + CFG.player.collisionR + 5) { addLog('Too far from base — move closer', 'warn'); return; }
  p.docked = true;
  p.dockTimer += dt;
  p.vx *= 0.85; p.vy *= 0.85;
  p.fuel = Math.min(CFG.player.maxFuel, p.fuel + CFG.base.refuelRate * dt);
  p.hull = Math.min(CFG.player.maxHull, p.hull + CFG.base.repairRate * dt);
  p.power = Math.min(CFG.player.maxPower, p.power + 30 * dt);
  if (p.nets < CFG.player.maxNets && Math.random() < dt * CFG.base.reloadRate) p.nets = Math.min(CFG.player.maxNets, p.nets + 1);
  if (p.ore > 0) {
    const banked = p.ore;
    G.score += Math.round(banked) * 12;
    addLog('Banked ' + Math.round(banked) + ' kg ore (+' + Math.round(banked * 12) + ' pts)', 'ok');
    p.ore = 0;
  }
}

function update(dt) {
  if (!G || G.state !== 'PLAYING') return;
  G.time += dt;
  const p = G.player;
  p.docked = false;
  if (p.laserCooldown > 0) p.laserCooldown -= dt;
  if (netDeployCooldown > 0) netDeployCooldown -= dt;
  if (laserBeam) { laserBeam.timer -= dt; if (laserBeam.timer <= 0) laserBeam = null; }
  if (G.shakeTimer > 0) G.shakeTimer -= dt;
  p.power = Math.min(CFG.player.maxPower, p.power + 5 * dt);
  const thrusting = { x: 0, y: 0 };
  if (keys['KeyW'] || keys['ArrowUp']) thrusting.y = -1;
  if (keys['KeyS'] || keys['ArrowDown']) thrusting.y = 1;
  if (keys['KeyA'] || keys['ArrowLeft']) thrusting.x = -1;
  if (keys['KeyD'] || keys['ArrowRight']) thrusting.x = 1;
  const thrustLen = Math.hypot(thrusting.x, thrusting.y);
  if (thrustLen > 0 && p.fuel > 0) {
    const tx = thrusting.x / thrustLen * CFG.player.thrust;
    const ty = thrusting.y / thrustLen * CFG.player.thrust;
    p.vx += tx * dt;
    p.vy += ty * dt;
    p.fuel -= dt * 3.5;
    if (Math.random() < dt * 25) spawnThrustParticle(p);
  }
  if (keys['ShiftLeft'] || keys['ShiftRight']) { p.vx *= 0.90; p.vy *= 0.90; }
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > CFG.player.maxSpeed) {
    p.vx = p.vx / speed * CFG.player.maxSpeed;
    p.vy = p.vy / speed * CFG.player.maxSpeed;
  }
  p.vx *= CFG.player.drag; p.vy *= CFG.player.drag;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.fuel = Math.max(0, p.fuel);
  const mx = mouse.x - canvas.width/2 + G.cam.x;
  const my = mouse.y - canvas.height/2 + G.cam.y;
  const target = Math.atan2(my - p.y, mx - p.x);
  let da = target - p.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  p.angle += clamp(da, -CFG.player.rotSpeed * dt, CFG.player.rotSpeed * dt);
  const W = CFG.world.w, H = CFG.world.h;
  if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
  if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
  if (mouse.left && p.laserCooldown <= 0 && p.power > 5) fireLaser(dt);
  if (mouse.right && netDeployCooldown <= 0) { deployNet(); netDeployCooldown = 0.6; }
  if (keys['KeyE']) doMining(dt);
  if (keys['KeyR']) doDocking(dt);
  G.debris.forEach(d => {
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.angle += d.rotSpeed * dt;
    d.glint += dt * 1.5;
    if (d.x < 0) d.x += W; if (d.x > W) d.x -= W;
    if (d.y < 0) d.y += H; if (d.y > H) d.y -= H;
    if (dist(p, d) < CFG.player.collisionR + d.r) {
      const dmg = d.type === 'large' ? 25 : d.type === 'medium' ? 12 : 6;
      p.hull -= dmg * dt * 4;
      spawnParticles(p.x, p.y, 4, '#ff4060', 60, 0.3, 2);
      G.shakeTimer = 0.2; G.shakeAmt = 4;
    }
  });
  G.asteroids.forEach(a => {
    a.x += a.vx * dt; a.y += a.vy * dt;
    a.angle += a.rotSpeed * dt;
    if (a.x < 0) a.x += W; if (a.x > W) a.x -= W;
    if (a.y < 0) a.y += H; if (a.y > H) a.y -= H;
  });
  G.nets.forEach((net, ni) => {
    net.life -= dt;
    net.x += net.vx * dt; net.y += net.vy * dt;
    if (net.expanding) {
      net.expandTimer += dt;
      net.radius = Math.min(net.maxRadius, (net.expandTimer / CFG.net.expandTime) * net.maxRadius);
      if (net.expandTimer >= CFG.net.expandTime) net.expanding = false;
    }
    if (net.radius > 10) {
      G.debris.forEach((d, di) => {
        if (dist(net, d) < net.radius + CFG.net.catchRange - d.r) {
          const bonus = Math.round(d.pts * CFG.netBonusMult);
          G.score += bonus;
          G.debrisCleared++;
          G.netCaptures++;
          addLog('Net capture: ' + d.id + ' (+' + bonus + ' pts) ✦ RECYCLE', 'ok');
          spawnParticles(d.x, d.y, 12, '#00c8ff', 50, 0.5, 3);
          net.caught.push(d.id);
          G.debris.splice(di, 1);
          G.shakeTimer = 0.1; G.shakeAmt = 2;
        }
      });
      for (let di = G.drones.length - 1; di >= 0; di--) {
        const dr = G.drones[di];
        if (dist(net, dr) < net.radius + CFG.net.catchRange - dr.r) {
          const bonus = Math.round(CFG.drone.pts * CFG.netBonusMult);
          G.score += bonus;
          G.netCaptures++;
          addLog('Net snared drone: ' + dr.id + ' (+' + bonus + ' pts)', 'ok');
          spawnParticles(dr.x, dr.y, 14, '#b06aff', 60, 0.5, 3);
          net.caught.push(dr.id);
          G.drones.splice(di, 1);
          G.shakeTimer = 0.1; G.shakeAmt = 2;
        }
      }
    }
    if (net.life <= 0 || net.caught.length >= 3) G.nets.splice(ni, 1);
  });
  G.particles = G.particles.filter(p => {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.97; p.vy *= 0.97;
    return p.life > 0;
  });
  G.cam.x = lerp(G.cam.x, p.x, dt * 5);
  G.cam.y = lerp(G.cam.y, p.y, dt * 5);
  G.stars.forEach(layer => {
    layer.stars.forEach(s => {
      s.a += s.da;
      if (s.a < 0.05 || s.a > 0.9) s.da *= -1;
    });
  });
  let inHazard = false;
  G.hazards.forEach(h => {
    h.pulse += dt * 1.8;
    const d = dist(p, h);
    if (d < h.r) {
      inHazard = true;
      G.hazardTime += dt;
      const haz = CFG.hazard[h.type];
      p.hull -= haz.hullDrain * dt;
      p.power -= haz.powerDrain * dt;
      p.fuel -= haz.fuelDrain * dt;
      if (Math.random() < dt * 8) spawnParticles(p.x + (Math.random()-0.5)*20, p.y + (Math.random()-0.5)*20, 1, haz.col, 30, 0.4, 1.5);
      if (h.warnLogCooldown <= 0) {
        addLog('Hull stress in ' + haz.name, 'crit');
        h.warnLogCooldown = 3;
      }
    }
    if (h.warnLogCooldown > 0) h.warnLogCooldown -= dt;
  });
  G.mines.forEach((mine, mi) => {
    const d = dist(p, mine);
    if (d < CFG.mine_obs.proximityR && !mine.beeping) {
      mine.beeping = true;
      mine.countdown = CFG.mine_obs.countdown;
      addLog('MINE PROXIMITY ALARM! ' + mine.id, 'crit');
    }
    if (mine.beeping) {
      mine.countdown -= dt;
      mine.beepTimer += dt;
      if (mine.countdown <= 0) {
        spawnExplosion(mine.x, mine.y, mine.r * 2.5);
        p.hull -= CFG.mine_obs.damage;
        G.score -= 100;
        addLog('MINE DETONATION: ' + mine.id + ' (-100 pts, hull dmg)', 'crit');
        G.mines.splice(mi, 1);
        G.shakeTimer = 0.3; G.shakeAmt = 6;
      }
    }
  });
  G.drones.forEach((dr, di) => {
    const dist_to_player = dist(p, dr);
    if (dr.state === 'patrol') {
      dr.patrolTimer -= dt;
      if (dist_to_player < CFG.drone.alertR) {
        dr.state = 'chase';
        addLog('Drone ' + dr.id + ' hostile!', 'crit');
      } else if (dr.patrolTimer <= 0) {
        dr.patrolAngle = Math.random() * Math.PI * 2;
        dr.patrolTimer = 2 + Math.random() * 3;
      }
      dr.vx = Math.cos(dr.patrolAngle) * CFG.drone.speed * 0.3;
      dr.vy = Math.sin(dr.patrolAngle) * CFG.drone.speed * 0.3;
    } else if (dr.state === 'chase') {
      if (dist_to_player > CFG.drone.alertR * 1.5) {
        dr.state = 'patrol';
        dr.patrolTimer = 2 + Math.random() * 3;
      } else {
        const target_angle = angleTo(dr, p);
        let da = target_angle - dr.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        dr.angle += clamp(da, -CFG.player.rotSpeed * dt * 0.6, CFG.player.rotSpeed * dt * 0.6);
        dr.vx = Math.cos(dr.angle) * CFG.drone.speed;
        dr.vy = Math.sin(dr.angle) * CFG.drone.speed;
        if (dist_to_player < 50) {
          p.hull -= CFG.drone.ramDamage * dt;
          G.shakeTimer = 0.15; G.shakeAmt = 3;
        }
      }
    }
    dr.x += dr.vx * dt; dr.y += dr.vy * dt;
    if (dr.x < 0) dr.x += W; if (dr.x > W) dr.x -= W;
    if (dr.y < 0) dr.y += H; if (dr.y > H) dr.y -= H;
  });
  checkAndUnlockAchievements();
  if (p.hull <= 0) {
    G.state = 'GAME_OVER';
    document.getElementById('finalScore').textContent = fmt(G.score);
    document.getElementById('finalWave').textContent = G.wave;
    document.getElementById('finalDebris').textContent = G.debrisCleared;
    document.getElementById('finalOre').textContent = Math.round(G.player.totalOre) + ' kg';
    document.getElementById('finalTokens').textContent = G.tokens;
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }
  if (G.waveActive && G.debris.length === 0 && G.drones.length === 0) {
    G.waveActive = false;
    const waveBonus = CFG.waveBonusBase + G.wave * 100;
    G.score += waveBonus;
    G.tokens += Math.round(waveBonus / 5);
    G.waveTokensEarned += Math.round(waveBonus / 5);
    document.getElementById('waveClearTitle').textContent = 'LEVEL ' + G.wave + ' COMPLETE';
    document.getElementById('waveClearSubtitle').textContent = WAVES[Math.min(G.wave - 1, WAVES.length - 1)].name;
    document.getElementById('waveBonus').textContent = '+' + waveBonus;
    document.getElementById('totalScoreWave').textContent = fmt(G.score);
    document.getElementById('waveTokens').textContent = '+' + G.waveTokensEarned;
    document.getElementById('waveClearScreen').classList.remove('hidden');
    if (G.wave >= WAVES.length) {
      document.getElementById('nextWaveMsg').textContent = 'MISSION COMPLETE! All sectors cleared.';
      document.getElementById('nextWaveBtn').textContent = '▶ BACK TO TITLE';
    } else {
      document.getElementById('nextWaveMsg').textContent = 'Preparing Wave ' + (G.wave + 1) + ' deployment...';
      document.getElementById('nextWaveBtn').textContent = '▶ NEXT WAVE';
    }
    G.state = 'WAVE_CLEAR';
  }
}

let lastTime = Date.now();
function gameLoop() {
  const now = Date.now();
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render(dt);
  requestAnimationFrame(gameLoop);
}

// MEGA SATELLITE: Larger with improved graphics and enhanced details
function renderSatellite(dr, ctx) {
  ctx.save();
  ctx.translate(dr.x, dr.y);
  ctx.rotate(dr.angle);
  
  const scale = 2.2; // Scale factor for size increase
  
  // OUTER SHELL - Main body - rectangular satellite bus
  ctx.fillStyle = '#6a5aff';
  ctx.fillRect(-20 * scale, -16 * scale, 40 * scale, 32 * scale);
  
  // Body highlight edge - dual stripe design
  ctx.strokeStyle = '#8a7aff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-20 * scale, -16 * scale, 40 * scale, 32 * scale);
  
  // Middle accent stripe
  ctx.fillStyle = '#4a3aff';
  ctx.fillRect(-20 * scale, -4 * scale, 40 * scale, 8 * scale);
  
  // Central core - pulsing element
  ctx.fillStyle = '#3a2aff';
  ctx.fillRect(-14 * scale, -8 * scale, 28 * scale, 16 * scale);
  
  // Body accent/window with intense glow
  ctx.fillStyle = '#ff00ff';
  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 15;
  ctx.fillRect(-8 * scale, -5 * scale, 16 * scale, 10 * scale);
  
  // Secondary window
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#00ffff';
  ctx.fillRect(-4 * scale, -2 * scale, 8 * scale, 4 * scale);
  
  // Left solar panel array - LARGE
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1a5a9f';
  ctx.fillRect(-35 * scale, -12 * scale, 16 * scale, 24 * scale);
  ctx.fillStyle = '#2a7abf';
  ctx.strokeStyle = '#3a9aff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const y = -10 * scale + i * 4 * scale;
    ctx.fillRect(-34 * scale, y, 14 * scale, 3 * scale);
    ctx.strokeRect(-34 * scale, y, 14 * scale, 3 * scale);
  }
  
  // Right solar panel array - LARGE
  ctx.fillStyle = '#1a5a9f';
  ctx.fillRect(19 * scale, -12 * scale, 16 * scale, 24 * scale);
  ctx.fillStyle = '#2a7abf';
  ctx.strokeStyle = '#3a9aff';
  for (let i = 0; i < 6; i++) {
    const y = -10 * scale + i * 4 * scale;
    ctx.fillRect(20 * scale, y, 14 * scale, 3 * scale);
    ctx.strokeRect(20 * scale, y, 14 * scale, 3 * scale);
  }
  
  // Top antenna array - MASSIVE
  ctx.strokeStyle = '#ff66ff';
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8 * scale, -16 * scale);
    ctx.lineTo(i * 12 * scale, -28 * scale);
    ctx.stroke();
  }
  
  // Antenna tips with intense glow
  ctx.fillStyle = '#ff00ff';
  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 12;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(i * 12 * scale, -28 * scale, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Bottom thruster ports - GLOWING
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ff6b35';
  ctx.fillRect(-12 * scale, 16 * scale, 5 * scale, 8 * scale);
  ctx.fillRect(7 * scale, 16 * scale, 5 * scale, 8 * scale);
  ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
  ctx.shadowColor = '#ff6b35';
  ctx.shadowBlur = 10;
  ctx.fillRect(-12 * scale, 16 * scale, 5 * scale, 8 * scale);
  ctx.fillRect(7 * scale, 16 * scale, 5 * scale, 8 * scale);
  
  // Directional indicator lights - LED style
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#00ff00';
  ctx.shadowColor = '#00ff00';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-22 * scale, 0, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff0000';
  ctx.shadowColor = '#ff0000';
  ctx.beginPath();
  ctx.arc(22 * scale, 0, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Center marker - pulsing element
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(0, 0, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Active state glow aura - STRONGER
  if (dr.state === 'chase') {
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, (dr.r + 15) * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Danger pulse
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (dr.r + 18) * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

// Enhanced base station rendering
// Called from WITHIN camera transformation context - uses world coords
function renderBase(baseObj, ctx) {
  ctx.save();
  ctx.translate(baseObj.x, baseObj.y);
  
  // Outer defensive ring
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, Math.PI * 2);
  ctx.stroke();
  
  // Secondary ring
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();
  
  // Main base structure - hexagon
  ctx.fillStyle = '#00d488';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 30;
    const y = Math.sin(angle) * 30;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Inner hexagon accent
  ctx.fillStyle = '#00a060';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 18;
    const y = Math.sin(angle) * 18;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  
  // Central core with glow
  ctx.fillStyle = '#00ff88';
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  
  // Docking ports (6 around the base)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 38;
    const y = Math.sin(angle) * 38;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  
  // Rotating detection array
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const r = 25 + i * 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

function renderRadar() {
  const p = G.player;
  const radarX = 50;
  const radarY = canvas.height - 50;
  const radarSize = 100;
  const radarRange = CFG.radar.range;
  
  ctx.save();
  ctx.translate(radarX, radarY);
  
  // Radar background
  ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, radarSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Radar border
  ctx.strokeStyle = '#00c8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radarSize, 0, Math.PI * 2);
  ctx.stroke();
  
  // Radar grid lines
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.2)';
  ctx.lineWidth = 1;
  for (let r = radarSize / 3; r <= radarSize; r += radarSize / 3) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Cardinal directions
  ctx.fillStyle = 'rgba(0, 200, 255, 0.4)';
  ctx.font = '9px "Courier New"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -radarSize - 8);
  ctx.fillText('S', 0, radarSize + 8);
  ctx.fillText('E', radarSize + 8, 0);
  ctx.fillText('W', -radarSize - 8, 0);
  
  // Plot entities
  const plotEntity = (obj, color) => {
    const dx = obj.x - p.x;
    const dy = obj.y - p.y;
    const distance = Math.hypot(dx, dy);
    if (distance > radarRange) return;
    
    const rx = (dx / radarRange) * radarSize;
    const ry = (dy / radarRange) * radarSize;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  };
  
  G.debris.forEach(d => plotEntity(d, '#00c8ff'));
  G.asteroids.forEach(a => plotEntity(a, '#ffc846'));
  G.mines.forEach(m => plotEntity(m, '#ff4060'));
  G.drones.forEach(d => plotEntity(d, '#b06aff'));
  plotEntity(G.base, '#00e5a0');
  
  // Player at center
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function render(dt) {
  if (!G) return;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#020d18';
  ctx.fillRect(0, 0, W, H);
  
  // Render stars
  G.stars.forEach(layer => {
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    layer.stars.forEach(s => {
      const sx = (s.x - G.cam.x * layer.parallax) % CFG.world.w;
      const sy = (s.y - G.cam.y * layer.parallax) % CFG.world.h;
      ctx.globalAlpha = s.a;
      ctx.fillRect(sx - W/2, sy - H/2, s.r, s.r);
      ctx.globalAlpha = 1;
    });
  });
  
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (G.shakeTimer > 0) {
    const shakeX = (Math.random() - 0.5) * G.shakeAmt * 2;
    const shakeY = (Math.random() - 0.5) * G.shakeAmt * 2;
    ctx.translate(shakeX, shakeY);
  }
  ctx.translate(-G.cam.x, -G.cam.y);
  
  // Grid
  ctx.strokeStyle = 'rgba(0,200,255,.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CFG.world.w; x += 500) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CFG.world.h);
    ctx.stroke();
  }
  for (let y = 0; y < CFG.world.h; y += 500) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CFG.world.w, y);
    ctx.stroke();
  }
  
  // Base station with new graphics - FIXED: now in camera transform, uses world coords
  renderBase(G.base, ctx);
  
  // Asteroids
  G.asteroids.forEach(a => {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.fillStyle = '#c0a060';
    ctx.beginPath();
    a.shape.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });
  
  // Debris with enhanced graphics
  G.debris.forEach(d => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    d.shape.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#00c8ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Damage marks
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) {
      const a = (Math.PI * 2 * i) / 2;
      const len = d.r * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * d.r * 0.3, Math.sin(a) * d.r * 0.3);
      ctx.lineTo(Math.cos(a + 0.3) * len, Math.sin(a + 0.3) * len);
      ctx.stroke();
    }
    
    // Glint effect
    d.glint += dt * 1.5;
    if (Math.sin(d.glint) > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(-d.r * 0.3, -d.r * 0.2, d.r * 0.6, d.r * 0.1);
    }
    ctx.restore();
  });
  
  // Mines
  G.mines.forEach(m => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = m.beeping ? '#ff4060' : '#ffc846';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = m.r * (i % 2 ? 1 : 0.6);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (m.beeping && Math.sin(m.beepTimer * 10) > 0) {
      ctx.strokeStyle = '#ff4060';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  });
  
  // MEGA satellites with improved graphics - FIXED: now in camera transform, uses world coords
  G.drones.forEach(dr => {
    renderSatellite(dr, ctx);
  });
  
  // Nets
  G.nets.forEach(net => {
    ctx.save();
    ctx.translate(net.x, net.y);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.lineWidth = 1.5;
    if (net.radius > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, net.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (net.expanding) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, net.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
  
  // Particles (including thruster fire)
  G.particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  
  // Laser beam - FIXED: now uses world coords (no camera offset needed)
  if (laserBeam) {
    const alpha = laserBeam.timer / CFG.laser.beamTime;
    ctx.strokeStyle = `rgba(0, 200, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laserBeam.x1, laserBeam.y1);
    ctx.lineTo(laserBeam.x2, laserBeam.y2);
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(laserBeam.hitX, laserBeam.hitY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Hazards
  G.hazards.forEach(h => {
    const haz = CFG.hazard[h.type];
    ctx.fillStyle = `rgba(${haz.col.substring(1, 3)}, ${haz.col.substring(3, 5)}, ${haz.col.substring(5, 7)}, 0.15)`;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = `${haz.col}`;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5 + Math.sin(h.pulse) * 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  
  // Player spacecraft
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  
  ctx.fillStyle = '#00c8ff';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  ctx.restore();
  
  // HUD
  ctx.fillStyle = 'rgba(0, 200, 255, 0.3)';
  ctx.font = 'bold 14px "Courier New"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  let hudY = 20;
  ctx.fillText(`HULL: ${Math.ceil(G.player.hull)}%`, 20, hudY); hudY += 25;
  ctx.fillText(`FUEL: ${Math.ceil(G.player.fuel)}%`, 20, hudY); hudY += 25;
  ctx.fillText(`POWER: ${Math.ceil(G.player.power)}%`, 20, hudY); hudY += 25;
  ctx.fillText(`NETS: ${G.player.nets}/${CFG.player.maxNets}`, 20, hudY); hudY += 25;
  ctx.fillText(`ORE: ${Math.round(G.player.ore)} kg`, 20, hudY);
  
  ctx.fillStyle = '#ffc846';
  ctx.font = 'bold 18px "Courier New"';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE: ${fmt(G.score)}`, W - 20, 20);
  ctx.fillText(`WAVE ${G.wave}`, W - 20, 50);
  
  ctx.fillStyle = 'rgba(0, 200, 255, 0.4)';
  ctx.font = '11px "Courier New"';
  ctx.textAlign = 'left';
  for (let i = 0; i < Math.min(G.log.length, 3); i++) {
    const log = G.log[i];
    const color = log.type === 'ok' ? '#00e5a0' : log.type === 'crit' ? '#ff4060' : log.type === 'warn' ? '#ffc846' : '#00c8ff';
    ctx.fillStyle = color;
    ctx.fillText(`[${log.ts}] ${log.msg}`, 20, H - 80 + i * 20);
  }
  
  renderRadar();
}

gameLoop();
