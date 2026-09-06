/**
 * srx-bridge.js — Space Mining Game ↔ Space Resource Exchange client
 *
 * Include after game.js / CFG is available:
 *   <script src="srx-bridge.js"></script>
 *
 * Configure in game CFG or window.SRX_CONFIG:
 *   baseUrl:  'https://your-srx.onrender.com'  (or http://localhost:8000)
 *   apiKey:   optional shared secret (X-API-Key)
 *   siteUrl:  public exchange website for "Open Exchange" button
 */

(function (global) {
  const DEFAULTS = {
    baseUrl: 'https://space-resource-exchange.onrender.com', // override after deploy
    siteUrl: 'https://github.com/Codesurfing10/SPACEREASOURCEEXCHANGE',
    apiKey: '',
    pollMs: 60000,
    resourceMap: {
      // game ore → exchange resource codes
      ore: 'ASTEROID_ORE',
      debris: 'IRON_NICKEL',
      rare: 'PGM',
      ice: 'LUNAR_ICE',
      helium: 'HELIUM3'
    }
  };

  function cfg() {
    const fromGame = (global.CFG && global.CFG.srx) || {};
    const fromWin = global.SRX_CONFIG || {};
    return Object.assign({}, DEFAULTS, fromGame, fromWin);
  }

  function playerId() {
    try {
      let id = localStorage.getItem('aria_player_id');
      if (!id) {
        id = 'pilot_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem('aria_player_id', id);
      }
      return id;
    } catch (_) {
      return 'pilot_anon';
    }
  }

  async function api(path, opts = {}) {
    const c = cfg();
    const headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, opts.headers || {});
    if (c.apiKey) headers['X-API-Key'] = c.apiKey;
    const url = c.baseUrl.replace(/\/$/, '') + path;
    const res = await fetch(url, { ...opts, headers, mode: 'cors' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('SRX ' + res.status + ' ' + text.slice(0, 200));
    }
    return res.json();
  }

  const state = {
    prices: {},
    account: null,
    lastError: null,
    lastDeposit: null,
    connected: false
  };

  async function refreshPrices() {
    try {
      const data = await api('/api/mining/prices');
      state.prices = {};
      (data.prices || []).forEach((p) => {
        state.prices[p.resource] = p;
      });
      state.connected = true;
      state.lastError = null;
      global.dispatchEvent(new CustomEvent('srx:prices', { detail: state.prices }));
      return state.prices;
    } catch (e) {
      state.connected = false;
      state.lastError = String(e.message || e);
      return null;
    }
  }

  async function refreshAccount() {
    try {
      const data = await api('/api/mining/account/' + encodeURIComponent(playerId()));
      state.account = data;
      global.dispatchEvent(new CustomEvent('srx:account', { detail: data }));
      return data;
    } catch (e) {
      state.lastError = String(e.message || e);
      return null;
    }
  }

  /**
   * Credit mined cargo to the exchange account at live mark prices.
   * items: [{ resource, quantity_kg, quality }]
   */
  async function depositHaul(items, meta = {}) {
    const body = {
      player_id: playerId(),
      wallet_address: (global.G && global.G.wallet && global.G.wallet.address) || null,
      session_id: (global.G && String(global.G.wave)) || null,
      items,
      source: 'ARIA_MINING_GAME',
      metadata: meta
    };
    const data = await api('/api/mining/deposit', { method: 'POST', body: JSON.stringify(body) });
    state.lastDeposit = data;
    await refreshAccount();
    global.dispatchEvent(new CustomEvent('srx:deposit', { detail: data }));
    return data;
  }

  /** Map in-game ore kg to exchange ASTEROID_ORE (quality from session). */
  async function depositGameOre(kg, quality = 1) {
    if (!kg || kg <= 0) return null;
    return depositHaul([{ resource: 'ASTEROID_ORE', quantity_kg: kg, quality }]);
  }

  function markUsd(resource, kg) {
    const p = state.prices[resource];
    if (!p) return null;
    return Math.round(kg * p.price_usd * 100) / 100;
  }

  function openExchange() {
    const c = cfg();
    const url = c.siteUrl || c.baseUrl;
    window.open(url, '_blank', 'noopener');
  }

  function startPolling() {
    refreshPrices();
    refreshAccount();
    const c = cfg();
    setInterval(refreshPrices, c.pollMs || 60000);
  }

  global.SRX = {
    cfg,
    playerId,
    state,
    refreshPrices,
    refreshAccount,
    depositHaul,
    depositGameOre,
    markUsd,
    openExchange,
    startPolling,
    api
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(startPolling, 800));
  } else {
    setTimeout(startPolling, 800);
  }
})(window);
