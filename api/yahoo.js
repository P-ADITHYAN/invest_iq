/**
 * api/yahoo.js — Vercel serverless proxy for Yahoo Finance's public,
 * unauthenticated chart endpoint (query1.finance.yahoo.com/v8/finance/chart).
 *
 * This exists purely to work around the browser's CORS restriction —
 * Yahoo's endpoint doesn't send an Access-Control-Allow-Origin header, so
 * the static frontend can't call it directly. This function fetches
 * server-side (no CORS involved server-to-server) and re-serves the data
 * with permissive CORS headers for our own frontend.
 *
 * No API key is used or required — the v8 chart endpoint is publicly
 * accessible without authentication. Yahoo's *other* endpoints (batch
 * quotes, quoteSummary/fundamentals) now require a session cookie + crumb
 * token; this proxy deliberately does not attempt to replicate that
 * handshake, so fundamentals (P/E, ROE, ROCE, debt/equity, etc.) are not
 * available live and remain sourced from js/data/demoStocks.js, clearly
 * labeled as estimated/demo figures wherever shown.
 *
 * Usage:
 *   GET /api/yahoo?mode=quotes&symbols=TCS.NS,INFY.NS   -> lightweight current price + 52w range per symbol
 *   GET /api/yahoo?mode=history&symbol=TCS.NS&range=1y&interval=1d -> full historical series for one symbol
 */

const ALLOWED_RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"];
const ALLOWED_INTERVALS = ["1d", "1wk", "1mo"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { mode, symbol, symbols, range, interval } = req.query;
  const safeRange = ALLOWED_RANGES.includes(range) ? range : "1y";
  const safeInterval = ALLOWED_INTERVALS.includes(interval) ? interval : "1d";

  try {
    if (mode === "history") {
      if (!symbol) return res.status(400).json({ error: "symbol is required for mode=history" });
      const data = await fetchChart(symbol, safeRange, safeInterval);
      return res.status(200).json(data);
    }

    if (mode === "quotes") {
      if (!symbols) return res.status(400).json({ error: "symbols is required for mode=quotes" });
      const list = symbols.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (list.length > 60) return res.status(400).json({ error: "Too many symbols in one request (max 60)." });

      const results = await Promise.all(list.map(async function (sym) {
        try {
          const data = await fetchChart(sym, "5d", "1d");
          return data;
        } catch (e) {
          return { symbol: sym, error: e.message };
        }
      }));
      return res.status(200).json({ quotes: results });
    }

    return res.status(400).json({ error: 'mode must be "quotes" or "history"' });
  } catch (e) {
    return res.status(502).json({ error: "Failed to fetch data from Yahoo Finance.", detail: e.message });
  }
}

async function fetchChart(symbol, range, interval) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?range=" + range + "&interval=" + interval;

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 8000);

  let resp;
  try {
    resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error("Yahoo Finance responded with status " + resp.status);
  const json = await resp.json();
  const result = json.chart && json.chart.result && json.chart.result[0];
  if (!result) {
    const errMsg = (json.chart && json.chart.error && json.chart.error.description) || "No data returned for " + symbol;
    throw new Error(errMsg);
  }

  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};

  const history = timestamps.map(function (t, i) {
    return {
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: round2(quote.close ? quote.close[i] : null),
      open: round2(quote.open ? quote.open[i] : null),
      high: round2(quote.high ? quote.high[i] : null),
      low: round2(quote.low ? quote.low[i] : null),
      volume: quote.volume ? quote.volume[i] : null
    };
  }).filter(function (d) { return d.close != null; });

  return {
    symbol: (meta.symbol || symbol).replace(/\.NS$/, ""),
    yahooSymbol: meta.symbol || symbol,
    companyName: meta.longName || meta.shortName || symbol,
    exchange: meta.fullExchangeName || meta.exchangeName || "NSE",
    currency: meta.currency || "INR",
    price: round2(meta.regularMarketPrice),
    previousClose: round2(meta.chartPreviousClose),
    dayHigh: round2(meta.regularMarketDayHigh),
    dayLow: round2(meta.regularMarketDayLow),
    high52: round2(meta.fiftyTwoWeekHigh),
    low52: round2(meta.fiftyTwoWeekLow),
    volume: meta.regularMarketVolume || null,
    fetchedAt: new Date().toISOString(),
    history: history
  };
}

function round2(n) {
  return typeof n === "number" ? Math.round(n * 100) / 100 : n;
}
