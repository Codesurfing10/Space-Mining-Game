*** Begin Patch
*** Update File: game.js
@@
 function gameLoop() {
   const now = Date.now();
   const dt = Math.min((now - lastTime) / 1000, 0.033);
   lastTime = now;
   update(dt);
   render(dt);
+  if (typeof renderThree === 'function') renderThree(dt);
   requestAnimationFrame(gameLoop);
 }
*** End Patch
