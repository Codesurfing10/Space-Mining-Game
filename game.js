// Fixed game loop wrapper: removed patch markers and guarded optional 3D renderer

// ensure lastTime is initialized
let lastTime = Date.now();

function safeCall(fn, dt, name) {
  if (typeof fn === 'function') {
    try {
      return fn(dt);
    } catch (err) {
      console.error(name + ' threw:', err);
    }
  }
  return null;
}

function gameLoop() {
  const now = Date.now();
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  // call update/render if they exist (keeps backward compatibility)
  safeCall(window.update || update, dt, 'update');
  safeCall(window.render || render, dt, 'render');

  // call three-renderer if it was loaded and attached to window
  if (typeof window !== 'undefined' && typeof window.renderThree === 'function') {
    safeCall(window.renderThree, dt, 'renderThree');
  }

  requestAnimationFrame(gameLoop);
}

// start the loop
requestAnimationFrame(gameLoop);
