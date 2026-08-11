/**
 * marketData.js — MarketDataService: the sole source of stock data for
 * the rest of the app.
 *
 * Exposes: getStocks(filters), getStock(symbol), getHistoricalPrices(symbol),
 * getFundamentals(symbol) — every page and engine calls these, never the
 * demo data files or a fetch() call directly.
 *
 * Live mode (CONFIG.DEMO_MODE = false, the default): price, 52-week
 * range, company name and historical charts come from Yahoo Finance via
 * the same-origin serverless proxy at CONFIG.YAHOO_PROXY_URL
 * (api/yahoo.js on Vercel). Fundamentals (P/E, ROE, ROCE, debt/equity,
 * dividend yield, beta, growth, volatility) are NOT available from
 * Yahoo's public unauthenticated endpoint, so they always come from
 * js/data/demoStocks.js and are labeled as estimated/demo figures
 * wherever the UI shows them.
 *
 * If the proxy is unreachable (plain static hosting with no serverless
 * functions, network failure, Yahoo outage, timeout) every function here
 * falls back to full demo data automatically — the app keeps working,
 * it just silently serves demo prices instead of live ones. Call
 * MarketDataService.getStatus() to check whether the last fetch attempt
 * actually used live data, for an optional "Live"/"Demo" UI indicator.
 */
(function (global) {
  "use strict";

  const priceOverrides = {}; // symbol -> price, demo-only override used by the alerts "simulate price update" control
  const cache = {}; // key -> { data, expiresAt }
  const QUOTE_TTL_MS = 45 * 1000;
  const HISTORY_TTL_MS = 10 * 60 * 1000;

  let status = { live: false, lastError: null, lastCheckedAt: null };

  function toYahooSymbol(symbol) {
    return symbol + ".NS";
  }

  function fromCache(key) {
    const entry = cache[key];
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    return null;
  }
  function toCache(key, data, ttl) {
    cache[key] = { data: data, expiresAt: Date.now() + ttl };
  }

  function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, ms || 7000);
    return fetch(url, { signal: controller.signal }).finally(function () { clearTimeout(timer); });
  }

  function withOverrides(stock) {
    if (priceOverrides[stock.symbol] == null) return stock;
    return Object.assign({}, stock, { price: priceOverrides[stock.symbol] });
  }

  function demoStockFor(symbol) {
    return DEMO_STOCKS.find(function (s) { return s.symbol === symbol; });
  }

  // Merge a live Yahoo quote onto a demo base record: live price/company
  // name/52-week range win when available, every fundamental ratio still
  // comes from the demo dataset (Yahoo's free endpoint doesn't have them).
  function mergeLiveQuote(demoBase, liveQuote) {
    if (!liveQuote || liveQuote.error) return demoBase;
    return Object.assign({}, demoBase, {
      companyName: liveQuote.companyName || demoBase.companyName,
      price: liveQuote.price != null ? liveQuote.price : demoBase.price,
      high52: liveQuote.high52 != null ? liveQuote.high52 : demoBase.high52,
      low52: liveQuote.low52 != null ? liveQuote.low52 : demoBase.low52,
      _live: true
    });
  }

  function markStatus(live, error) {
    status = { live: live, lastError: error ? String(error.message || error) : null, lastCheckedAt: new Date().toISOString() };
  }

  function allDemoStocks() {
    return DEMO_STOCKS.map(withOverrides);
  }

  // ---- Live fetch helpers ------------------------------------------------
  function fetchLiveQuotes(symbols) {
    const yahooSymbols = symbols.map(toYahooSymbol).join(",");
    const url = CONFIG.YAHOO_PROXY_URL + "?mode=quotes&symbols=" + encodeURIComponent(yahooSymbols);
    return fetchWithTimeout(url, 8000).then(function (resp) {
      if (!resp.ok) throw new Error("Proxy responded " + resp.status);
      return resp.json();
    }).then(function (json) {
      return json.quotes || [];
    });
  }

  function fetchLiveHistory(symbol, range, interval) {
    const url = CONFIG.YAHOO_PROXY_URL + "?mode=history&symbol=" + encodeURIComponent(toYahooSymbol(symbol)) +
      "&range=" + (range || "1y") + "&interval=" + (interval || "1d");
    return fetchWithTimeout(url, 8000).then(function (resp) {
      if (!resp.ok) throw new Error("Proxy responded " + resp.status);
      return resp.json();
    }).then(function (json) {
      if (json.error) throw new Error(json.error);
      return json;
    });
  }

  // ---- Public API ---------------------------------------------------------
  function getStocks(filters) {
    filters = filters || {};

    function applyFilters(list) {
      let out = list;
      if (filters.search) {
        const q = filters.search.trim().toLowerCase();
        out = out.filter(function (s) { return s.symbol.toLowerCase().indexOf(q) !== -1 || s.companyName.toLowerCase().indexOf(q) !== -1; });
      }
      if (filters.sector && filters.sector !== "All") {
        out = out.filter(function (s) { return s.sector === filters.sector; });
      }
      return out.map(withOverrides);
    }

    if (CONFIG.DEMO_MODE) {
      markStatus(false, null);
      return Promise.resolve(applyFilters(allDemoStocks()));
    }

    const cacheKey = "quotes:all";
    const cached = fromCache(cacheKey);
    if (cached) { markStatus(true, null); return Promise.resolve(applyFilters(cached)); }

    const symbols = DEMO_STOCKS.map(function (s) { return s.symbol; });
    return fetchLiveQuotes(symbols).then(function (quotes) {
      const bySymbol = {};
      quotes.forEach(function (q) { if (q && q.symbol) bySymbol[q.symbol] = q; });
      const merged = DEMO_STOCKS.map(function (base) { return mergeLiveQuote(base, bySymbol[base.symbol]); });
      toCache(cacheKey, merged, QUOTE_TTL_MS);
      markStatus(true, null);
      return applyFilters(merged);
    }).catch(function (err) {
      console.warn("MarketDataService: live quotes fetch failed, falling back to demo data.", err);
      markStatus(false, err);
      return applyFilters(allDemoStocks());
    });
  }

  function getStock(symbol) {
    const demoBase = demoStockFor(symbol);
    if (!demoBase) return Promise.reject(new Error("Stock not found: " + symbol));

    if (CONFIG.DEMO_MODE) {
      markStatus(false, null);
      return Promise.resolve(withOverrides(demoBase));
    }

    const cacheKey = "quotes:all";
    const cached = fromCache(cacheKey);
    if (cached) {
      const found = cached.find(function (s) { return s.symbol === symbol; });
      markStatus(true, null);
      return Promise.resolve(withOverrides(found || demoBase));
    }

    return fetchLiveQuotes([symbol]).then(function (quotes) {
      markStatus(true, null);
      return withOverrides(mergeLiveQuote(demoBase, quotes[0]));
    }).catch(function (err) {
      console.warn("MarketDataService: live quote fetch failed for " + symbol + ", falling back to demo data.", err);
      markStatus(false, err);
      return withOverrides(demoBase);
    });
  }

  function getHistoricalPrices(symbol) {
    const demoBase = demoStockFor(symbol);
    if (!demoBase) return Promise.reject(new Error("Stock not found: " + symbol));

    if (CONFIG.DEMO_MODE) {
      return Promise.resolve(DemoHistorical.getSeriesFor(symbol, demoBase.price, demoBase.volatility));
    }

    const cacheKey = "history:" + symbol;
    const cached = fromCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    return fetchLiveHistory(symbol, "1y", "1d").then(function (data) {
      const series = (data.history || []).map(function (h) { return { date: h.date, close: h.close, volume: h.volume }; });
      if (!series.length) throw new Error("No historical data returned for " + symbol);
      toCache(cacheKey, series, HISTORY_TTL_MS);
      return series;
    }).catch(function (err) {
      console.warn("MarketDataService: live history fetch failed for " + symbol + ", falling back to demo data.", err);
      return DemoHistorical.getSeriesFor(symbol, demoBase.price, demoBase.volatility);
    });
  }

  function getFundamentals(symbol) {
    // Always demo/estimated — Yahoo's free endpoint has no fundamentals.
    const demoBase = demoStockFor(symbol);
    if (!demoBase) return Promise.reject(new Error("Stock not found: " + symbol));
    return Promise.resolve({
      pe: demoBase.pe, pb: demoBase.pb, eps: demoBase.eps, roe: demoBase.roe, roce: demoBase.roce,
      debtToEquity: demoBase.debtToEquity, revenueGrowth: demoBase.revenueGrowth,
      profitGrowth: demoBase.profitGrowth, dividendYield: demoBase.dividendYield,
      beta: demoBase.beta, volatility: demoBase.volatility, high52: demoBase.high52, low52: demoBase.low52,
      estimated: true
    });
  }

  function getBenchmarkSeries() {
    if (CONFIG.DEMO_MODE) return Promise.resolve(DemoHistorical.getBenchmarkSeries());

    const cacheKey = "history:__NIFTY50__";
    const cached = fromCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    const url = CONFIG.YAHOO_PROXY_URL + "?mode=history&symbol=" + encodeURIComponent(CONFIG.NIFTY50_YAHOO_SYMBOL) + "&range=1y&interval=1d";
    return fetchWithTimeout(url, 8000).then(function (resp) {
      if (!resp.ok) throw new Error("Proxy responded " + resp.status);
      return resp.json();
    }).then(function (data) {
      if (data.error || !data.history || !data.history.length) throw new Error(data.error || "No NIFTY50 data");
      const series = data.history.map(function (h) { return { date: h.date, close: h.close, volume: h.volume }; });
      toCache(cacheKey, series, HISTORY_TTL_MS);
      return series;
    }).catch(function (err) {
      console.warn("MarketDataService: live NIFTY50 benchmark fetch failed, falling back to demo series.", err);
      return DemoHistorical.getBenchmarkSeries();
    });
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
    const cachedAll = fromCache("quotes:all");
    const base = (cachedAll && cachedAll.find(function (s) { return s.symbol === symbol; })) || demoStockFor(symbol) || {};
    return withOverrides(base).price;
  }

  function getStatus() {
    return Object.assign({}, status);
  }

  global.MarketDataService = {
    getStocks, getStock, getHistoricalPrices, getFundamentals, getBenchmarkSeries, getSectors,
    setDemoPrice, getLastKnownPrice, getStatus
  };
})(window);
