/**
 * data/demoStocks.js — Stock universe identity list + OFFLINE FALLBACK
 * figures only.
 *
 * As of this build, InvestIQ sources every numeric field for these 10
 * stocks from real data:
 *   - price / day range / 52-week range / historical charts → Yahoo
 *     Finance's free chart endpoint, via api/yahoo.js
 *   - P/E, P/B, EPS, beta, market cap, dividend yield → your RapidAPI
 *     "Yahoo Finance Real Time" subscription, via api/fundamentals.js
 *   - ROE, revenue growth, profit growth → computed from real Yahoo
 *     reported figures (net income, equity, yearly revenue/earnings) —
 *     arithmetic on real numbers, never invented
 *   - debt-to-equity → attempted from real balance-sheet data; shown as
 *     unavailable (not fabricated) for any stock where that data isn't
 *     populated by the provider
 *   - volatility → computed from real historical daily price movements
 *
 * The numeric fields BELOW exist only as an offline fallback for when
 * the live proxies are unreachable (no internet, RapidAPI quota
 * exhausted, temporary outage) — js/marketData.js only falls back to
 * them after a live fetch attempt fails, and the UI's "Demo Data" badge
 * makes that fallback state visible whenever it's in effect. They will
 * drift from reality over time and must never be read as current.
 *
 * Universe kept to 10 stocks (free-tier RapidAPI quota) with a
 * deliberate sector/risk spread — 2 Banking, 2 IT, 2 Automotive
 * (moderate + higher-volatility), 1 each Energy, FMCG, Healthcare,
 * Telecom — so recommendations still vary meaningfully across risk
 * profiles (see js/recommendationEngine.js's sector-diversification cap).
 */
(function (global) {
  "use strict";

  const DEMO_STOCKS = [
    // ---- Banking ----
    { symbol: "HDFCBANK", companyName: "HDFC Bank Ltd", exchange: "NSE", sector: "Banking", industry: "Private Bank", price: 1642.30, marketCap: 1249000, pe: 19.8, pb: 2.9, eps: 82.9, roe: 16.8, roce: 8.9, debtToEquity: 0.85, revenueGrowth: 14.2, profitGrowth: 12.1, dividendYield: 1.1, beta: 0.92, volatility: 21.4, high52: 1791.90, low52: 1363.55 },
    { symbol: "ICICIBANK", companyName: "ICICI Bank Ltd", exchange: "NSE", sector: "Banking", industry: "Private Bank", price: 1128.60, marketCap: 793000, pe: 18.4, pb: 3.2, eps: 61.3, roe: 17.9, roce: 9.4, debtToEquity: 0.78, revenueGrowth: 16.8, profitGrowth: 17.5, dividendYield: 0.9, beta: 1.05, volatility: 23.7, high52: 1257.65, low52: 899.50 },

    // ---- IT ----
    { symbol: "TCS", companyName: "Tata Consultancy Services Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 3842.75, marketCap: 1391000, pe: 28.9, pb: 13.1, eps: 133.0, roe: 45.3, roce: 58.7, debtToEquity: 0.02, revenueGrowth: 8.6, profitGrowth: 9.2, dividendYield: 1.5, beta: 0.71, volatility: 17.8, high52: 4259.75, low52: 3311.05 },
    { symbol: "INFY", companyName: "Infosys Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 1548.90, marketCap: 643000, pe: 24.7, pb: 8.2, eps: 62.7, roe: 33.6, roce: 41.5, debtToEquity: 0.09, revenueGrowth: 7.1, profitGrowth: 8.0, dividendYield: 2.3, beta: 0.76, volatility: 19.2, high52: 1953.90, low52: 1351.65 },

    // ---- Energy ----
    { symbol: "RELIANCE", companyName: "Reliance Industries Ltd", exchange: "NSE", sector: "Energy", industry: "Oil, Gas & Retail Conglomerate", price: 2914.55, marketCap: 1972000, pe: 26.2, pb: 2.3, eps: 111.2, roe: 9.1, roce: 8.7, debtToEquity: 0.41, revenueGrowth: 9.8, profitGrowth: 6.5, dividendYield: 0.4, beta: 1.02, volatility: 22.1, high52: 3217.90, low52: 2220.30 },

    // ---- FMCG ----
    { symbol: "HINDUNILVR", companyName: "Hindustan Unilever Ltd", exchange: "NSE", sector: "FMCG", industry: "Household & Personal Products", price: 2412.60, marketCap: 567000, pe: 51.3, pb: 10.9, eps: 47.0, roe: 21.4, roce: 27.8, debtToEquity: 0.02, revenueGrowth: 5.8, profitGrowth: 6.2, dividendYield: 1.7, beta: 0.54, volatility: 15.1, high52: 2769.65, low52: 2172.05 },

    // ---- Healthcare ----
    { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical Industries Ltd", exchange: "NSE", sector: "Healthcare", industry: "Pharmaceuticals", price: 1682.20, marketCap: 403000, pe: 34.9, pb: 6.1, eps: 48.2, roe: 17.6, roce: 20.3, debtToEquity: 0.05, revenueGrowth: 10.6, profitGrowth: 15.2, dividendYield: 0.7, beta: 0.63, volatility: 18.3, high52: 1961.75, low52: 1332.05 },

    // ---- Automotive ----
    { symbol: "MARUTI", companyName: "Maruti Suzuki India Ltd", exchange: "NSE", sector: "Automotive", industry: "Passenger Vehicles", price: 12684.50, marketCap: 384000, pe: 27.1, pb: 4.3, eps: 468.1, roe: 16.2, roce: 20.6, debtToEquity: 0.03, revenueGrowth: 11.9, profitGrowth: 14.8, dividendYield: 1.0, beta: 1.08, volatility: 24.2, high52: 13680.00, low52: 9737.20 },
    { symbol: "TATAMOTORS", companyName: "Tata Motors Ltd", exchange: "NSE", sector: "Automotive", industry: "Auto Manufacturer", price: 942.80, marketCap: 347000, pe: 12.8, pb: 4.9, eps: 73.7, roe: 38.9, roce: 17.4, debtToEquity: 0.68, revenueGrowth: 13.5, profitGrowth: 32.1, dividendYield: 0.1, beta: 1.46, volatility: 33.5, high52: 1179.00, low52: 614.75 },

    // ---- Telecom ----
    { symbol: "BHARTIARTL", companyName: "Bharti Airtel Ltd", exchange: "NSE", sector: "Telecom", industry: "Telecom Services", price: 1587.90, marketCap: 951000, pe: 71.2, pb: 12.8, eps: 22.3, roe: 18.9, roce: 11.2, debtToEquity: 1.31, revenueGrowth: 17.2, profitGrowth: 41.6, dividendYield: 0.5, beta: 0.84, volatility: 21.9, high52: 1779.00, low52: 1101.05 }
  ];

  // Every stock in this universe is treated as eligible-by-default (see
  // js/scoringEngine.js for the actual eligibility checks, which now
  // tolerate individual missing/unavailable real-data fields rather than
  // requiring every field to be present).
  global.DEMO_STOCKS = DEMO_STOCKS;
})(window);
