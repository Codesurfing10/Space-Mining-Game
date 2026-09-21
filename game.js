  const CFG = {
    srx: {
      baseUrl: 'https://space-resource-exchange.onrender.com', // set to your Render URL
      siteUrl: 'https://github.com/Codesurfing10/SPACEREASOURCEEXCHANGE',
      apiKey: '', // optional shared secret matching MINING_GAME_API_KEY
      enabled: true
    },
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
      stripePublishableKey: '',  // pk_test_... when ready
      stripeAccountId: 'acct_replace_with_your_stripe_account',
      cryptoWalletAddress: '0x0000000000000000000000000000000000000000',
      feeDestination: 'stripe', // 'stripe' or 'wallet'
      buyerFeePercent: 0.05,
      sellerFeePercent: 0.05,
      feePercent: 0.05,
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
