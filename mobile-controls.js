/**
 * TIMARC SPACE — mobile / touch on-screen controls
 * Drives the same window.G.keys + window.G.mouse state (and keydown
 * side-effects) that desktop keyboard/mouse already use. Desktop input
 * paths in game.js are untouched.
 */
(() => {
  'use strict';

  const overlay = document.getElementById('mobileControls');
  const stickBase = document.getElementById('mcStick');
  const stickKnob = document.getElementById('mcStickKnob');
  const canvas = document.getElementById('gameCanvas');
  if (!overlay || !stickBase || !stickKnob || !canvas) return;

  const DEADZONE = 0.22;
  const STICK_RADIUS = 54;
  const AIM_DIST = 180;

  /** @type {number|null} */
  let stickPointerId = null;
  let stickActive = false;
  let stickNX = 0;
  let stickNY = 0;

  /** held synthetic codes so we only clear what we set */
  const heldKeys = new Set();
  let heldLeft = false;
  let heldRight = false;
  let aimFromStick = false;
  let aimFromTouch = false;
  let touchAimX = 0;
  let touchAimY = 0;

  function needsTouchControls() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    const touchPoints = (navigator.maxTouchPoints || 0) > 0;
    const hasTouch = touchPoints || 'ontouchstart' in window;
    // Show when coarse pointer, or touch + (narrow OR no fine pointer)
    return coarse || (hasTouch && (narrow || !fine));
  }

  function setTouchMode(on) {
    document.documentElement.classList.toggle('touch-controls', on);
    document.body.classList.toggle('touch-controls', on);
    overlay.hidden = !on;
    overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function synthKey(code, type) {
    const keyMap = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyR: 'r',
      KeyU: 'u', KeyB: 'b', Escape: 'Escape', ShiftLeft: 'Shift'
    };
    const ev = new KeyboardEvent(type, {
      code,
      key: keyMap[code] || code,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(ev);
  }

  function setKey(code, down) {
    const G = window.G;
    if (!G || !G.keys) return;
    if (down) {
      if (!heldKeys.has(code)) {
        heldKeys.add(code);
        G.keys[code] = true;
      }
    } else if (heldKeys.has(code)) {
      heldKeys.delete(code);
      G.keys[code] = false;
    }
  }

  function clearHeldKeys() {
    const G = window.G;
    for (const code of [...heldKeys]) {
      if (G && G.keys) G.keys[code] = false;
    }
    heldKeys.clear();
  }

  function setMouseBtn(side, down) {
    const G = window.G;
    if (!G || !G.mouse) return;
    if (side === 'left') {
      heldLeft = down;
      G.mouse.left = down;
    } else {
      heldRight = down;
      G.mouse.right = down;
    }
  }

  function clearMouseBtns() {
    const G = window.G;
    if (!G || !G.mouse) return;
    if (heldLeft) G.mouse.left = false;
    if (heldRight) G.mouse.right = false;
    heldLeft = false;
    heldRight = false;
  }

  function releaseAll() {
    clearHeldKeys();
    clearMouseBtns();
    stickPointerId = null;
    stickActive = false;
    stickNX = 0;
    stickNY = 0;
    aimFromStick = false;
    stickKnob.style.transform = 'translate(-50%, -50%)';
    stickBase.classList.remove('active');
  }

  function applyStickKeys() {
    const mag = Math.hypot(stickNX, stickNY);
    if (!stickActive || mag < DEADZONE) {
      setKey('KeyW', false);
      setKey('KeyS', false);
      setKey('KeyA', false);
      setKey('KeyD', false);
      aimFromStick = false;
      return;
    }
    // Aim along stick; thrust forward (W). Optional reverse / strafe from stick axes
    // relative to current facing so the same WASD handlers drive motion.
    aimFromStick = true;
    const G = window.G;
    const ang = Math.atan2(stickNY, stickNX);
    let facing = (G && G.player) ? G.player.angle : ang;
    let diff = ang - facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Primary: always thrust W when stick engaged (ship turns toward stick aim)
    setKey('KeyW', true);
    setKey('KeyS', false);

    // Light strafe assist when stick is clearly off the nose (same KeyA/KeyD path)
    const strafe = Math.sin(diff);
    setKey('KeyA', strafe < -0.45);
    setKey('KeyD', strafe > 0.45);
  }

  function applyAim() {
    const G = window.G;
    if (!G || !G.mouse) return;
    const cw = canvas.width || window.innerWidth;
    const ch = canvas.height || window.innerHeight;

    if (aimFromTouch) {
      G.mouse.x = touchAimX;
      G.mouse.y = touchAimY;
      return;
    }

    if (aimFromStick && stickActive) {
      const mag = Math.hypot(stickNX, stickNY);
      if (mag >= DEADZONE) {
        const nx = stickNX / mag;
        const ny = stickNY / mag;
        G.mouse.x = cw / 2 + nx * AIM_DIST;
        G.mouse.y = ch / 2 + ny * AIM_DIST;
        return;
      }
    }

    // Keep aim ahead of ship so fire/net still work without a mouse
    if (G.player && document.body.classList.contains('touch-controls')) {
      const a = G.player.angle || 0;
      G.mouse.x = cw / 2 + Math.cos(a) * AIM_DIST;
      G.mouse.y = ch / 2 + Math.sin(a) * AIM_DIST;
    }
  }

  function updateStickFromEvent(clientX, clientY) {
    const rect = stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS;
      dy = (dy / dist) * STICK_RADIUS;
    }
    stickNX = dx / STICK_RADIUS;
    stickNY = dy / STICK_RADIUS;
    stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    applyStickKeys();
  }

  stickBase.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('touch-controls')) return;
    if (stickPointerId != null) return;
    e.preventDefault();
    stickPointerId = e.pointerId;
    stickActive = true;
    stickBase.classList.add('active');
    stickBase.setPointerCapture(e.pointerId);
    updateStickFromEvent(e.clientX, e.clientY);
  });

  stickBase.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointerId) return;
    e.preventDefault();
    updateStickFromEvent(e.clientX, e.clientY);
  });

  function endStick(e) {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    stickActive = false;
    stickNX = 0;
    stickNY = 0;
    aimFromStick = false;
    stickKnob.style.transform = 'translate(-50%, -50%)';
    stickBase.classList.remove('active');
    setKey('KeyW', false);
    setKey('KeyS', false);
    setKey('KeyA', false);
    setKey('KeyD', false);
  }
  stickBase.addEventListener('pointerup', endStick);
  stickBase.addEventListener('pointercancel', endStick);

  function bindHoldButton(el, onDown, onUp) {
    if (!el) return;
    let pid = null;
    const down = (e) => {
      if (!document.body.classList.contains('touch-controls')) return;
      if (pid != null) return;
      e.preventDefault();
      pid = e.pointerId;
      el.classList.add('pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      onDown();
    };
    const up = (e) => {
      if (pid == null || (e && e.pointerId !== pid)) return;
      pid = null;
      el.classList.remove('pressed');
      onUp();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', () => {
      if (pid == null) return;
      pid = null;
      el.classList.remove('pressed');
      onUp();
    });
  }

  function bindTapButton(el, onTap) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('touch-controls')) return;
      e.preventDefault();
      el.classList.add('pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      onTap();
    });
    const clear = () => el.classList.remove('pressed');
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
  }

  // Action buttons → same G.keys / G.mouse / keydown handlers as desktop
  bindHoldButton(document.getElementById('mcFire'), () => setMouseBtn('left', true), () => setMouseBtn('left', false));
  bindHoldButton(document.getElementById('mcNet'), () => setMouseBtn('right', true), () => setMouseBtn('right', false));
  bindHoldButton(document.getElementById('mcMine'), () => {
    setKey('KeyE', true);
    synthKey('KeyE', 'keydown');
  }, () => {
    setKey('KeyE', false);
    synthKey('KeyE', 'keyup');
  });
  bindHoldButton(document.getElementById('mcBrake'), () => setKey('ShiftLeft', true), () => setKey('ShiftLeft', false));

  bindTapButton(document.getElementById('mcDock'), () => {
    synthKey('KeyR', 'keydown');
    synthKey('KeyR', 'keyup');
  });
  bindTapButton(document.getElementById('mcShop'), () => {
    synthKey('KeyU', 'keydown');
    synthKey('KeyU', 'keyup');
  });
  bindTapButton(document.getElementById('mcPause'), () => {
    synthKey('Escape', 'keydown');
    synthKey('Escape', 'keyup');
  });

  // Canvas touch aim (touch events only — does not alter desktop mousemove path)
  function onCanvasTouch(e) {
    if (!document.body.classList.contains('touch-controls')) return;
    if (!window.G || !window.G.running) return;
    // Ignore touches that started on the overlay controls
    const t = e.changedTouches[0] || e.touches[0];
    if (!t) return;
    const top = document.elementFromPoint(t.clientX, t.clientY);
    if (top && overlay.contains(top)) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    touchAimX = (t.clientX - rect.left) * sx;
    touchAimY = (t.clientY - rect.top) * sy;
    aimFromTouch = true;
    applyAim();
  }
  function onCanvasTouchEnd(e) {
    if (!e.touches || e.touches.length === 0) aimFromTouch = false;
  }
  canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });
  canvas.addEventListener('touchmove', onCanvasTouch, { passive: false });
  canvas.addEventListener('touchend', onCanvasTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onCanvasTouchEnd, { passive: true });

  function refreshMode() {
    const want = needsTouchControls();
    const was = document.body.classList.contains('touch-controls');
    if (want !== was) {
      setTouchMode(want);
      if (!want) releaseAll();
    }
    const G = window.G;
    const playing = !!(G && G.running);
    const show = want && playing;
    if (!show && overlay.classList.contains('mc-playing')) releaseAll();
    overlay.classList.toggle('mc-playing', show);
  }

  function tick() {
    refreshMode();
    if (document.body.classList.contains('touch-controls')) {
      applyStickKeys();
      applyAim();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', refreshMode);
  window.matchMedia('(pointer: coarse)').addEventListener?.('change', refreshMode);
  window.matchMedia('(max-width: 900px)').addEventListener?.('change', refreshMode);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  setTouchMode(needsTouchControls());
  requestAnimationFrame(tick);
})();
