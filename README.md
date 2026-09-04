# A·R·I·A — Space Mining & Debris Cleanup

Improved **3D** space mining / debris-cleanup arcade game with ship systems, upgrades, and radar.

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
| **W A S D** | Thrust (consumes fuel) |
| **Mouse** | Aim turret |
| **Left click** | Fire laser (uses a little fuel) |
| **Right click** | Deploy capture net |
| **E** | Mine asteroid (hold near one; uses fuel, fills cargo) |
| **R** | Dock at base (repair, refuel, restore shield, sell ore) |
| **U** | Open upgrade shop (spend tokens) |
| **Shift** | Emergency brake |
| **Esc** | Pause / close shop |

## Features (v5.2 — dynamic ops)

### Dashboard & payments
- Live top dashboard (score, tokens, wave, ore, combo)
- Side action rail: upgrades · Stripe packs · wallet · mission dashboard
- **Wallet connect** via `window.ethereum` (MetaMask etc.) + optional balance/auth APIs
- **Stripe token packs** (demo grants by default; Payment Link or Checkout API when configured)

### Ship systems

### Ship systems
- **Fuel** — burns while thrusting, mining, and firing. Empty tank = weak thrust only. Dock to refuel.
- **Shield** — absorbs damage before hull. Regens after a short delay out of combat.
- **Cargo hold** — ore goes into cargo (capacity limit). Dock to sell for score + tokens.
- **Hull** — last line of defense; reaches 0 → mission failed.

### Economy & upgrades
- Sell ore at the base for score and **tokens ◆**.
- Spend tokens in the **Upgrade Shop** (`U`):
  - Mining Arm, Laser Power, Net Radius, Engine, Cargo Hold, Shield Gen, Fuel Tank
- Starting tokens: 8. Wave clears and achievements also award tokens.

### Scoring
- Ore mass × quality at dock
- Debris / drones get distance + rarity multipliers
- Combo window for chained kills
- Wave clear bonuses

### Radar / minimap
- Colored icons (asteroids, debris, rare debris gold, mines blink, drones scale by threat distance)
- Range rings around the player
- Player facing indicator

### Other
- Inertial 3D flight with banking and chase camera
- Proximity mines and hostile drones
- 10 escalating waves + endless continuation
- Bloom, stars, instanced asteroids/debris, particle FX
- Graceful fallback to pure 2D if Three.js fails to load

## Defaults (easy to tweak in `CFG` inside `game.js`)

| Setting | Value |
|---------|--------|
| Starting / max fuel | 100 |
| Fuel burn (thrust) | ~9 / s |
| Fuel burn (mine) | ~4 / s |
| Max shield | 50 (+ upgrades) |
| Shield regen | 4.5 / s after 2.2 s delay |
| Cargo capacity | 50 kg (+18 kg per Cargo upgrade) |
| Ore sell | 4 score / kg, tokens = floor(kg / 8) |
| First upgrade costs | ~10–16 tokens |

## Files

- `index.html` — UI shells (title / pause / shop / wave clear / game over)
- `game.js` — gameplay: physics, combat, waves, ship systems, HUD, shop
- `three-renderer.js` — Three.js scene, ship, instancing, bloom, docking base ring

## Tech

- Vanilla JS
- Three.js r158 (CDN) + EffectComposer / UnrealBloomPass
- No build step required

## Branch

`feat/ship-base-upgrades-radar` — ship systems, upgrades, cargo/fuel/shield, improved radar.
