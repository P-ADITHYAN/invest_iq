/**
 * marketData.js — MarketDataService: the sole source of stock data for
 * the rest of the app.
 *
 * Exposes: getStocks(filters), getStock(symbol), getHistoricalPrices(symbol),
 * getFundamentals(symbol) — every page and engine calls these, never the
 * demo data files or a fetch() call directly.
 *
 * Live mode (CONFIG.DEMO_MODE = false, the default) sources every
 * numeric field from real data across two proxies:
 *   - price / day range / 52-week range / historical charts:
 *     Yahoo's free, unauthenticated chart endpoint via api/yahoo.js
 *   - P/E, P/B, EPS, beta, market cap, dividend yield, and real-derived
 *     ROE / revenue growth / profit growth / debt-to-equity:
 *     the user's RapidAPI "Yahoo Finance Real Time" subscription, via
 *     api/fundamentals.js (see that file for exactly what's derived vs.
 *     read directly, and why ROCE is always null rather than guessed)
 *   - volatility: computed here from the real historical daily closes
 *     (annualized standard deviation of returns) — never a fixed number
 *
 * Per-field null handling: if api/fundamentals.js returns `null` for a
 * specific field (that stock's underlying provider data was incomplete),
 * that null is preserved as-is — it is NEVER silently replaced with the
 * offline demo estimate, because that demo number is not real and doing
 * so would misrepresent stale/estimated data as live. The UI shows "N/A"
 * and js/scoringEngine.js excludes null sub-scores from that stock's
 * score. The offline demoStocks.js numbers are used only as a *whole*
 * when a live fetch fails outright (network error, quota exhausted,
 * timeout) — that fallback is always reflected in getStatus().live.
 */
(function (global) {
  "use strict";

  const priceOverrides = {}; // symbol -> price, demo-only override used by the alerts "simulate price update" control
  const cache = {}; // key -> { data, expiresAt }
  const QUOTE_TTL_MS = 45 * 1000;
  const HISTORY_TTL_MS = 10 * 60 * 1000;
  const FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1000; // 6h client-side, on top of the 12h CDN cache in api/fundamentals.js

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

  function allDemoStocks() {
    return DEMO_STOCKS.map(withOverrides);
  }

  // Merge a live Yahoo chart quote (price/52-week/name) onto a demo base.
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

  // Merge live RapidAPI fundamentals onto a stock record. Per the header
  // comment: a null field from the provider stays null (unavailable),
  // it is NOT backfilled with the demo estimate.
  function mergeLiveFundamentals(stock, fx) {
    if (!fx || fx.error) return stock;
    return Object.assign({}, stock, {
      companyName: fx.companyName || stock.companyName,
      marketCap: fx.marketCap != null ? fx.marketCap : stock.marketCap,
      pe: fx.pe,
      pb: fx.pb,
      eps: fx.eps,
      beta: fx.beta != null ? fx.beta : stock.beta,
      dividendYield: fx.dividendYield,
      roe: fx.roe,
      roce: null, // never sourced live — see api/fundamentals.js
      debtToEquity: fx.debtToEquity,
      revenueGrowth: fx.revenueGrowth,
      profitGrowth: fx.profitGrowth,
      _fundamentalsLive: true,
      _fundamentalsSources: fx.sourcesOk || null
    });
  }

  function annualizedVolatilityFromSeries(series) {
    if (!series || series.length < 3) return null;
    const returns = [];
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].close;
      if (prev) returns.push((series[i].close - prev) / prev);
    }
    if (!returns.length) return null;
    const mean = returns.reduce(function (a, b) { return a + b; }, 0) / returns.length;
    const variance = returns.reduce(function (sum, r) { return sum + Math.pow(r - mean, 2); }, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  function markStatus(live, error) {
    status = { live: live, lastError: error ? String(error.message || error) : null, lastCheckedAt: new Date().toISOString() };
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

  function fetchLiveFundamentals(symbols) {
    const cacheKey = "fundamentals:all";
    const cached = fromCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    const yahooSymbols = symbols.map(toYahooSymbol).join(",");
    const url = CONFIG.FUNDAMENTALS_PROXY_URL + "?symbols=" + encodeURIComponent(yahooSymbols);
    return fetchWithTimeout(url, 12000).then(function (resp) {
      if (!resp.ok) throw new Error("Fundamentals proxy responded " + resp.status);
      return resp.json();
    }).then(function (json) {
      if (json.error) throw new Error(json.error);
      const list = json.fundamentals || [];
      toCache(cacheKey, list, FUNDAMENTALS_TTL_MS);
      return list;
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

    const cacheKey = "stocks:merged";
    const cached = fromCache(cacheKey);
    if (cached) { markStatus(true, null); return Promise.resolve(applyFilters(cached)); }

    const symbols = DEMO_STOCKS.map(function (s) { return s.symbol; });

    return Promise.all([
      fetchLiveQuotes(symbols).catch(function (err) { console.warn("MarketDataService: quotes fetch failed.", err); return null; }),
      fetchLiveFundamentals(symbols).catch(function (err) { console.warn("MarketDataService: fundamentals fetch failed.", err); return null; }),
      Promise.all(symbols.map(function (sym) {
        return fetchLiveHistory(sym, "1y", "1d").then(function (data) { return { symbol: sym, history: data.history }; }).catch(function () { return null; });
      }))
    ]).then(function (results) {
      const quotes = results[0];
      const fundamentals = results[1];
      const historyList = results[2];

      if (!quotes) throw new Error("Live quotes unavailable");

      const quoteBySymbol = {};
      quotes.forEach(function (q) { if (q && q.symbol) quoteBySymbol[q.symbol] = q; });
      const fxBySymbol = {};
      (fundamentals || []).forEach(function (f) { if (f && f.symbol) fxBySymbol[f.symbol] = f; });
      const historyBySymbol = {};
      historyList.forEach(function (h) { if (h && h.symbol) historyBySymbol[h.symbol] = h.history; });

      const merged = DEMO_STOCKS.map(function (base) {
        let stock = mergeLiveQuote(base, quoteBySymbol[base.symbol]);
        if (fundamentals) stock = mergeLiveFundamentals(stock, fxBySymbol[base.symbol]);
        const realVol = annualizedVolatilityFromSeries(historyBySymbol[base.symbol]);
        if (realVol != null) stock = Object.assign({}, stock, { volatility: realVol, _volatilityLive: true });
        return stock;
      });

      toCache(cacheKey, merged, QUOTE_TTL_MS);
      markStatus(true, null);
      return applyFilters(merged);
    }).catch(function (err) {
      console.warn("MarketDataService: live stocks fetch failed, falling back to demo data.", err);
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

    const cached = fromCache("stocks:merged");
    if (cached) {
      const found = cached.find(function (s) { return s.symbol === symbol; });
      markStatus(true, null);
      return Promise.resolve(withOverrides(found || demoBase));
    }

    // Not cached yet on this page — fetch quote + fundamentals for just
    // this one symbol rather than the whole universe.
    return Promise.all([
      fetchLiveQuotes([symbol]).then(function (q) { return q[0]; }).catch(function () { return null; }),
      fetchLiveFundamentals([symbol]).then(function (f) { return f[0]; }).catch(function () { return null; })
    ]).then(function (results) {
      let stock = mergeLiveQuote(demoBase, results[0]);
      stock = mergeLiveFundamentals(stock, results[1]);
      markStatus(true, null);
      return withOverrides(stock);
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
    const demoBase = demoStockFor(symbol);
    if (!demoBase) return Promise.reject(new Error("Stock not found: " + symbol));

    return getStock(symbol).then(function (stock) {
      const live = !!stock._fundamentalsLive;
      return {
        pe: live ? stock.pe : demoBase.pe,
        pb: live ? stock.pb : demoBase.pb,
        eps: live ? stock.eps : demoBase.eps,
        roe: live ? stock.roe : demoBase.roe,
        roce: null, // never available — see api/fundamentals.js
        debtToEquity: live ? stock.debtToEquity : demoBase.debtToEquity,
        revenueGrowth: live ? stock.revenueGrowth : demoBase.revenueGrowth,
        profitGrowth: live ? stock.profitGrowth : demoBase.profitGrowth,
        dividendYield: live ? stock.dividendYield : demoBase.dividendYield,
        beta: stock.beta != null ? stock.beta : demoBase.beta,
        volatility: stock.volatility != null ? stock.volatility : demoBase.volatility,
        high52: stock.high52 != null ? stock.high52 : demoBase.high52,
        low52: stock.low52 != null ? stock.low52 : demoBase.low52,
        estimated: !live
      };
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
    const cachedAll = fromCache("stocks:merged");
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
