/**
 * api/fundamentals.js — Vercel serverless proxy for real stock
 * fundamentals via the user's RapidAPI "Yahoo Finance Real Time"
 * subscription (yahoo-finance-real-time1.p.rapidapi.com).
 *
 * The RapidAPI key lives ONLY in the server-side environment variable
 * RAPIDAPI_KEY (set in Vercel Project Settings → Environment Variables)
 * — it is never sent to, or readable from, the browser.
 *
 * Sourced entirely from a single endpoint, /stock/get-summary — verified
 * against a real response for an NSE stock to return defaultKeyStatistics,
 * summaryDetail, price, and financialData together in one call, which is
 * both cheaper on the free-tier quota (1 call/stock instead of 3) and
 * more internally consistent than pulling different modules from
 * different endpoint calls at slightly different snapshot times (an
 * earlier version of this file did that and produced visibly
 * inconsistent numbers — e.g. trailingPE was absent from one endpoint's
 * summaryDetail for some tickers, silently falling back to forwardPE).
 *
 * Every field returned here is either read directly from that response,
 * or arithmetically derived from real reported figures in it (ROE from
 * real net income ÷ real book equity). Nothing is invented: if the
 * response is missing the underlying data for a field, that field comes
 * back `null` rather than a guessed number, and the frontend must treat
 * `null` as "unavailable" (see js/scoringEngine.js, which excludes null
 * sub-scores from a stock's score instead of penalizing/fabricating
 * them). `roce` is always null — no field in this provider's response
 * (checked: defaultKeyStatistics, financialData) exposes it or the raw
 * EBIT/capital-employed figures needed to derive it honestly.
 *
 * This is a free-tier RapidAPI subscription, so this endpoint is
 * deliberately cache-friendly: responses are cached at Vercel's CDN
 * edge for 12 hours (stale-while-revalidate for 24h beyond that), so
 * repeat visitors within that window are served from cache instead of
 * re-hitting RapidAPI. Fundamentals don't meaningfully change
 * intraday, so this is an honest trade-off, not staleness masquerading
 * as "live".
 *
 * Usage: GET /api/fundamentals?symbols=RELIANCE.NS,TCS.NS,...  (max 10)
 *
 * Timeout note: Vercel's Hobby (free) plan defaults serverless functions
 * to a 10-second max execution time unless maxDuration is configured
 * (and even then, Hobby plans may cap it below what's requested here).
 * Per-symbol fetches run in parallel and each have their own timeout
 * kept safely under that default, so a slow/hung provider call produces
 * this code's own clean per-symbol error instead of the platform
 * killing the whole function with no useful detail.
 */

export const config = { maxDuration: 15 };

const RAPIDAPI_HOST = "yahoo-finance-real-time1.p.rapidapi.com";
const BASE_URL = "https://" + RAPIDAPI_HOST;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY is not configured on the server." });
  }

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: "symbols is required, e.g. ?symbols=RELIANCE.NS,TCS.NS" });

  const list = symbols.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (list.length > 10) return res.status(400).json({ error: "Too many symbols in one request (max 10, matching the free-tier stock universe)." });

  try {
    const results = await Promise.all(list.map(function (symbol) { return fetchOneStock(symbol, apiKey); }));
    return res.status(200).json({ fundamentals: results });
  } catch (e) {
    return res.status(502).json({ error: "Failed to fetch fundamentals.", detail: redact(e.message, apiKey) });
  }
}

async function fetchOneStock(symbol, apiKey) {
  let summary = null, fetchError = null;
  try {
    summary = await rapidGet("/stock/get-summary", symbol, apiKey);
  } catch (e) {
    fetchError = e.name === "AbortError" ? "Timed out waiting for the provider to respond (>8.5s)." : redact(e.message, apiKey);
  }
  if (!summary) return { symbol: symbol.replace(/\.NS$/, ""), error: fetchError || "No response from provider" };

  const stats = summary.defaultKeyStatistics || null;
  const summaryDetail = summary.summaryDetail || null;
  const priceModule = summary.price || null;
  const financialData = summary.financialData || null;

  return {
    symbol: symbol.replace(/\.NS$/, ""),
    companyName: pick(priceModule && priceModule.longName, priceModule && priceModule.shortName),
    marketCap: pick(summaryDetail && summaryDetail.marketCap, priceModule && priceModule.marketCap),
    // Real trailing P/E first (what most stock screeners show by default);
    // only fall back to forward P/E if the provider truly has no trailing figure for this stock.
    pe: pick(summaryDetail && summaryDetail.trailingPE, summaryDetail && summaryDetail.forwardPE, stats && stats.forwardPE),
    peIsForward: !(summaryDetail && summaryDetail.trailingPE != null),
    pb: pick(stats && stats.priceToBook),
    eps: pick(stats && stats.trailingEps, stats && stats.forwardEps),
    epsIsForward: !(stats && stats.trailingEps != null),
    beta: pick(summaryDetail && summaryDetail.beta, stats && stats.beta),
    dividendYield: toPercent(pick(summaryDetail && summaryDetail.dividendYield)),
    roe: computeROE(stats),
    roce: null, // never sourced live — see file header
    // financialData.debtToEquity is reported as a percentage (e.g. 5.517 = 0.05517 ratio) — real Yahoo-computed figure.
    debtToEquity: pick(toRatio(financialData && financialData.debtToEquity)),
    // financialData.revenueGrowth/earningsGrowth are real Yahoo-computed
    // quarter-over-quarter YoY figures (matches earningsQuarterlyGrowth
    // in defaultKeyStatistics) — the same convention most screener sites
    // default to, and more internally consistent than deriving our own
    // annual figure from a separate financialsChart call.
    revenueGrowth: toPercent(financialData && financialData.revenueGrowth),
    profitGrowth: toPercent(financialData && financialData.earningsGrowth),
    fetchedAt: new Date().toISOString(),
    sourcesOk: { defaultKeyStatistics: !!stats, summaryDetail: !!summaryDetail, price: !!priceModule, financialData: !!financialData }
  };
}

// Strips the raw API key (or any whitespace-separated fragment of it —
// covers a malformed value with embedded newlines/duplication) out of
// any string before it's ever allowed into an error response. Error
// text can otherwise leak the exact header value verbatim (e.g. from a
// native `Headers.append` rejection when the value is malformed), and
// this endpoint's errors are visible to any caller — key material must
// never appear in a response body.
function redact(text, apiKey) {
  if (!text) return text;
  let out = String(text);
  if (apiKey) {
    out = out.split(apiKey).join("[REDACTED]");
    String(apiKey).split(/\s+/).forEach(function (fragment) {
      if (fragment.length >= 8) out = out.split(fragment).join("[REDACTED]");
    });
  }
  return out;
}

function rapidGet(path, symbol, apiKey) {
  const url = BASE_URL + path + "?symbol=" + encodeURIComponent(symbol) + "&region=IN&lang=en-IN";
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 8500);
  let resp;
  try {
    resp = fetch(url, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": RAPIDAPI_HOST },
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeout);
    throw new Error(redact(e.message, apiKey));
  }
  return resp.then(function (resp) {
    clearTimeout(timeout);
    if (!resp.ok) {
      // Surface RapidAPI's actual error body (e.g. "not subscribed",
      // "quota exceeded") instead of just the bare status code — this
      // is the difference between a diagnosable message and a guess.
      return resp.text().then(function (bodyText) {
        throw new Error(redact(path + " responded " + resp.status + ": " + bodyText.slice(0, 300), apiKey));
      });
    }
    return resp.json();
  }).finally(function () { clearTimeout(timeout); });
}

// Yahoo's flat modules return plain numbers directly (not {raw,fmt} wrappers).
function rawVal(x) {
  if (x == null) return null;
  if (typeof x === "object" && "raw" in x) return x.raw;
  return typeof x === "number" ? x : null;
}

function pick() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] != null) return arguments[i];
  }
  return null;
}

function toPercent(decimalValue) {
  return decimalValue == null ? null : decimalValue * 100;
}

// financialData.debtToEquity comes back as a percentage (e.g. 41.2 means
// a 0.412 ratio) in this provider's response — convert to a plain ratio
// to match how the rest of the app (and most comparison sites) show it.
function toRatio(percentValue) {
  return percentValue == null ? null : percentValue / 100;
}

function computeROE(stats) {
  if (!stats) return null;
  const netIncome = rawVal(stats.netIncomeToCommon);
  const book = rawVal(stats.bookValue);
  const shares = rawVal(stats.sharesOutstanding);
  if (netIncome == null || !book || !shares) return null;
  const equity = book * shares;
  if (!equity) return null;
  return (netIncome / equity) * 100;
}
