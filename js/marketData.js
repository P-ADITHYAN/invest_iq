/**
 * marketData.js — MarketDataService: the sole source of stock data for
 * the rest of the app.
 *
 * Exposes: getStocks(filters), getStock(symbol), getHistoricalPrices(symbol),
 * getFundamentals(symbol) — every page and engine calls these, never the
 * demo data files directly, so pointing the app at a real Indian-market
 * API later only means rewriting the bodies of these four functions
 * (e.g. to call CONFIG.API_BASE_URL + "/stocks" via fetch()).
 *
 * Demo-mode behavior: reads js/data/demoStocks.js + demoHistorical.js,
 * with an in-memory price-override map so the alerts page can simulate a
 * price tick (see api.simulatePriceUpdate) without mutating the base
 * demo dataset.
 */
(function (global) {
  "use strict";

  const priceOverrides = {}; // symbol -> price, demo-only, in-memory

  function withOverrides(stock) {
    if (priceOverrides[stock.symbol] == null) return stock;
    return Object.assign({}, stock, { price: priceOverrides[stock.symbol] });
  }

  function simulatedDelay(value) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (value instanceof Error) reject(value);
        else resolve(value);
      }, 150);
    });
  }

  function allDemoStocks() {
    return DEMO_STOCKS.map(withOverrides);
  }

  function getStocks(filters) {
    if (!CONFIG.DEMO_MODE) {
      return fetch(CONFIG.API_BASE_URL + "/stocks").then(function (r) { return r.json(); });
    }
    let list = allDemoStocks();
    filters = filters || {};
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(function (s) { return s.symbol.toLowerCase().indexOf(q) !== -1 || s.companyName.toLowerCase().indexOf(q) !== -1; });
    }
    if (filters.sector && filters.sector !== "All") {
      list = list.filter(function (s) { return s.sector === filters.sector; });
    }
    return simulatedDelay(list);
  }

  function getStock(symbol) {
    if (!CONFIG.DEMO_MODE) {
      return fetch(CONFIG.API_BASE_URL + "/stocks/" + symbol).then(function (r) { return r.json(); });
    }
    const found = allDemoStocks().find(function (s) { return s.symbol === symbol; });
    if (!found) return simulatedDelay(new Error("Stock not found: " + symbol));
    return simulatedDelay(found);
  }

  function getHistoricalPrices(symbol) {
    if (!CONFIG.DEMO_MODE) {
      return fetch(CONFIG.API_BASE_URL + "/stocks/" + symbol + "/history").then(function (r) { return r.json(); });
    }
    const stock = DEMO_STOCKS.find(function (s) { return s.symbol === symbol; });
    if (!stock) return simulatedDelay(new Error("Stock not found: " + symbol));
    return simulatedDelay(DemoHistorical.getSeriesFor(symbol, stock.price, stock.volatility));
  }

  function getFundamentals(symbol) {
    return getStock(symbol).then(function (s) {
      return {
        pe: s.pe, pb: s.pb, eps: s.eps, roe: s.roe, roce: s.roce,
        debtToEquity: s.debtToEquity, revenueGrowth: s.revenueGrowth,
        profitGrowth: s.profitGrowth, dividendYield: s.dividendYield,
        beta: s.beta, volatility: s.volatility, high52: s.high52, low52: s.low52
      };
    });
  }

  function getBenchmarkSeries() {
    return simulatedDelay(DemoHistorical.getBenchmarkSeries());
  }

  function getSectors() {
    const sectors = Array.from(new Set(DEMO_STOCKS.map(function (s) { return s.sector; })));
    return ["All"].concat(sectors.sort());
  }

  // ---- Demo-only helpers used by the alert simulation control ----------
  function setDemoPrice(symbol, price) {
    priceOverrides[symbol] = price;
  }
  function getLastKnownPrice(symbol) {
    const s = DEMO_STOCKS.find(function (x) { return x.symbol === symbol; });
    return withOverrides(s || {}).price;
  }

  global.MarketDataService = {
    getStocks, getStock, getHistoricalPrices, getFundamentals, getBenchmarkSeries, getSectors,
    setDemoPrice, getLastKnownPrice
  };
})(window);
