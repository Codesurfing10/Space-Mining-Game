# A·R·I·A — Space Mining & Debris Cleanup

Improved **3D** space mining / debris-cleanup arcade game.

## Play

Open `index.html` in a modern browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open the local URL and click **LAUNCH MISSION**.

## Controls

| Input | Action |
|--------|--------|
| **W A S D** | Thrust (forward / strafe / reverse) |
| **Mouse** | Aim turret |
| **Left click** | Fire laser |
| **Right click** | Deploy capture net |
| **E** | Mine asteroid (hold near one) |
| **R** | Dock at base (repair + sell ore) |
| **Shift** | Emergency brake |
| **Esc** | Pause |

## Features (v5)

- Inertial 3D flight with banking and chase camera
- Asteroid mining → ore → sell at base for score & tokens
- Debris laser destruction or net capture
- Proximity mines and hostile drones
- 10 escalating waves + endless continuation
- Bloom, stars, instanced asteroids/debris, particle FX
- 2D HUD (hull, score, minimap, cooldowns) over the 3D scene
- Graceful fallback to pure 2D if Three.js fails to load

## Files

- `index.html` — UI shells (title / pause / wave clear / game over)
- `game.js` — full gameplay: physics, combat, waves, HUD
- `three-renderer.js` — Three.js scene, ship, instancing, bloom

## Tech

- Vanilla JS
- Three.js r158 (CDN) + EffectComposer / UnrealBloomPass
- No build step required
