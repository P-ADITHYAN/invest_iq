/**
 * data/demoHistorical.js — Deterministic DEMO historical price generator.
 *
 * Real historical series aren't available without a live provider, so
 * this generates a repeatable (seeded, not random-per-load) pseudo price
 * walk for each demo symbol that ends at that stock's current `price`
 * from demoStocks.js, plus a NIFTY50 demo benchmark series used for beta
 * calculations. Deterministic seeding means the same symbol always
 * produces the same chart — important so screenshots/demos are stable
 * and the numbers aren't fabricated fresh on every page load.
 */
(function (global) {
  "use strict";

  const TRADING_DAYS = 252; // ~1 trading year

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) || 1;
  }

  function generateSeries(symbol, endPrice, annualVolatilityPct, days) {
    const rand = seededRandom(hashSeed(symbol));
    const dailyVol = (annualVolatilityPct / 100) / Math.sqrt(252);
    // Walk forward from an estimated start price, then rescale so the
    // series ends exactly at the known current price (keeps demoStocks.js
    // and the chart consistent with each other).
    const drifts = [];
    let level = 1;
    for (let i = 0; i < days; i++) {
      const z = (rand() + rand() + rand() - 1.5) / 1.5; // approx normal via averaging
      level *= (1 + dailyVol * z);
      drifts.push(level);
    }
    const scale = endPrice / drifts[drifts.length - 1];
    const today = new Date();
    const series = drifts.map(function (lvl, idx) {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - idx));
      const close = lvl * scale;
      const volume = Math.round(500000 + rand() * 4500000);
      return { date: d.toISOString().slice(0, 10), close: Number(close.toFixed(2)), volume: volume };
    });
    return series;
  }

  const CACHE = {};

  function getSeriesFor(symbol, endPrice, volatility) {
    if (!CACHE[symbol]) {
      CACHE[symbol] = generateSeries(symbol, endPrice, volatility || 22, TRADING_DAYS);
    }
    return CACHE[symbol];
  }

  function getBenchmarkSeries() {
    if (!CACHE.__NIFTY50__) {
      CACHE.__NIFTY50__ = generateSeries("NIFTY50", 24350, 13, TRADING_DAYS);
    }
    return CACHE.__NIFTY50__;
  }

  global.DemoHistorical = { getSeriesFor: getSeriesFor, getBenchmarkSeries: getBenchmarkSeries, TRADING_DAYS: TRADING_DAYS };
})(window);
