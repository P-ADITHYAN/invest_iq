/**
 * api/fundamentals.js — Vercel serverless proxy for real stock
 * fundamentals via the user's RapidAPI "Yahoo Finance Real Time"
 * subscription (yahoo-finance-real-time1.p.rapidapi.com).
 *
 * The RapidAPI key lives ONLY in the server-side environment variable
 * RAPIDAPI_KEY (set in Vercel Project Settings → Environment Variables)
 * — it is never sent to, or readable from, the browser.
 *
 * Every field returned here is either read directly from a real Yahoo
 * Finance response, or arithmetically derived from real reported
 * figures (ROE, YoY revenue/profit growth, debt/equity). Nothing is
 * invented: if a provider response is missing the underlying data for a
 * field (this happens — some tickers have sparse balance-sheet data
 * through this provider), that field comes back `null` rather than a
 * guessed number, and the frontend must treat `null` as "unavailable"
 * (see js/scoringEngine.js, which excludes null sub-scores from a
 * stock's score instead of penalizing/fabricating them).
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
 */

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
    return res.status(502).json({ error: "Failed to fetch fundamentals.", detail: e.message });
  }
}

async function fetchOneStock(symbol, apiKey) {
  const [statistics, quoteSummary, financials] = await Promise.all([
    rapidGet("/stock/get-statistics", symbol, apiKey).catch(function () { return null; }),
    rapidGet("/stock/get-quote-summary", symbol, apiKey).catch(function () { return null; }),
    rapidGet("/stock/get-financials", symbol, apiKey).catch(function () { return null; })
  ]);

  const stats = statistics && statistics.defaultKeyStatistics;
  const summaryDetail = quoteSummary && quoteSummary.quoteSummary && quoteSummary.quoteSummary.result &&
    quoteSummary.quoteSummary.result[0] && quoteSummary.quoteSummary.result[0].summaryDetail;
  const priceModule = quoteSummary && quoteSummary.quoteSummary && quoteSummary.quoteSummary.result &&
    quoteSummary.quoteSummary.result[0] && quoteSummary.quoteSummary.result[0].price;

  const growth = computeGrowthFromFinancials(financials);
  const debtToEquity = computeDebtToEquity(financials);
  const roe = computeROE(stats);

  return {
    symbol: symbol.replace(/\.NS$/, ""),
    companyName: pick(priceModule && priceModule.longName, priceModule && priceModule.shortName),
    marketCap: pick(summaryDetail && summaryDetail.marketCap, priceModule && priceModule.marketCap),
    pe: pick(summaryDetail && summaryDetail.trailingPE, summaryDetail && summaryDetail.forwardPE, stats && stats.forwardPE),
    pb: pick(stats && stats.priceToBook),
    eps: pick(stats && stats.trailingEps, stats && stats.forwardEps),
    beta: pick(summaryDetail && summaryDetail.beta, stats && stats.beta),
    dividendYield: toPercent(pick(summaryDetail && summaryDetail.dividendYield, summaryDetail && summaryDetail.trailingAnnualDividendYield)),
    roe: roe,
    roce: null, // not reliably derivable from this provider's data (see file header) — always null, never fabricated
    debtToEquity: debtToEquity,
    revenueGrowth: growth.revenueGrowth,
    profitGrowth: growth.profitGrowth,
    fetchedAt: new Date().toISOString(),
    sourcesOk: { statistics: !!stats, quoteSummary: !!summaryDetail, financials: !!financials }
  };
}

function rapidGet(path, symbol, apiKey) {
  const url = BASE_URL + path + "?symbol=" + encodeURIComponent(symbol) + "&region=IN&lang=en-IN";
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 9000);
  return fetch(url, {
    headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": RAPIDAPI_HOST },
    signal: controller.signal
  }).then(function (resp) {
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(path + " responded " + resp.status);
    return resp.json();
  }).finally(function () { clearTimeout(timeout); });
}

// Yahoo's "statistics"/"quoteSummary" endpoints return flat numbers;
// its "financials" endpoint wraps many numbers as {raw, fmt, longFmt}.
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

function computeGrowthFromFinancials(financials) {
  const yearly = financials && financials.financialsChart && financials.financialsChart.yearly;
  if (!yearly || yearly.length < 2) return { revenueGrowth: null, profitGrowth: null };

  // Yahoo returns these in ascending date order; take the latest two.
  const latest = yearly[yearly.length - 1];
  const prev = yearly[yearly.length - 2];
  const revenueGrowth = prev && prev.revenue ? ((latest.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100 : null;
  const profitGrowth = prev && prev.earnings ? ((latest.earnings - prev.earnings) / Math.abs(prev.earnings)) * 100 : null;
  return { revenueGrowth: revenueGrowth, profitGrowth: profitGrowth };
}

function computeDebtToEquity(financials) {
  const statement = financials && financials.balanceSheetHistory && financials.balanceSheetHistory.balanceSheetStatements &&
    financials.balanceSheetHistory.balanceSheetStatements[0];
  if (!statement) return null;
  const totalLiab = rawVal(statement.totalLiab);
  const equity = rawVal(statement.totalStockholderEquity);
  if (totalLiab == null || !equity) return null;
  return totalLiab / equity;
}
