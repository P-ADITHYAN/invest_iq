/**
 * data/demoStocks.js — DEMO / SAMPLE stock universe.
 *
 * These figures are illustrative sample data for prototyping only — they
 * are NOT live market data and must never be presented to a user as
 * current, real prices or fundamentals. Every page that renders this
 * data shows a "Demo Mode" flag (see nav.js topbar) for this reason.
 *
 * When CONFIG.DEMO_MODE is false, marketData.js sources this same shape
 * of data from a real provider via CONFIG.API_BASE_URL instead.
 *
 * Field units: price in INR, marketCap in INR crore, ratios as decimals
 * (e.g. debtToEquity 0.4), growth/yield/roe/roce as percentages.
 */
(function (global) {
  "use strict";

  const DEMO_STOCKS = [
    // ---- Banking ----
    { symbol: "HDFCBANK", companyName: "HDFC Bank Ltd", exchange: "NSE", sector: "Banking", industry: "Private Bank", price: 1642.30, marketCap: 1249000, pe: 19.8, pb: 2.9, eps: 82.9, roe: 16.8, roce: 8.9, debtToEquity: 0.85, revenueGrowth: 14.2, profitGrowth: 12.1, dividendYield: 1.1, beta: 0.92, volatility: 21.4, high52: 1791.90, low52: 1363.55 },
    { symbol: "ICICIBANK", companyName: "ICICI Bank Ltd", exchange: "NSE", sector: "Banking", industry: "Private Bank", price: 1128.60, marketCap: 793000, pe: 18.4, pb: 3.2, eps: 61.3, roe: 17.9, roce: 9.4, debtToEquity: 0.78, revenueGrowth: 16.8, profitGrowth: 17.5, dividendYield: 0.9, beta: 1.05, volatility: 23.7, high52: 1257.65, low52: 899.50 },
    { symbol: "SBIN", companyName: "State Bank of India", exchange: "NSE", sector: "Banking", industry: "Public Bank", price: 812.45, marketCap: 725000, pe: 10.2, pb: 1.6, eps: 79.6, roe: 16.1, roce: 7.5, debtToEquity: 1.15, revenueGrowth: 12.5, profitGrowth: 21.4, dividendYield: 1.6, beta: 1.18, volatility: 27.9, high52: 912.10, low52: 654.80 },
    { symbol: "KOTAKBANK", companyName: "Kotak Mahindra Bank Ltd", exchange: "NSE", sector: "Banking", industry: "Private Bank", price: 1756.20, marketCap: 349000, pe: 20.6, pb: 2.7, eps: 85.2, roe: 13.4, roce: 8.1, debtToEquity: 0.62, revenueGrowth: 11.3, profitGrowth: 9.8, dividendYield: 0.1, beta: 0.88, volatility: 22.6, high52: 1953.00, low52: 1544.15 },

    // ---- IT ----
    { symbol: "TCS", companyName: "Tata Consultancy Services Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 3842.75, marketCap: 1391000, pe: 28.9, pb: 13.1, eps: 133.0, roe: 45.3, roce: 58.7, debtToEquity: 0.02, revenueGrowth: 8.6, profitGrowth: 9.2, dividendYield: 1.5, beta: 0.71, volatility: 17.8, high52: 4259.75, low52: 3311.05 },
    { symbol: "INFY", companyName: "Infosys Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 1548.90, marketCap: 643000, pe: 24.7, pb: 8.2, eps: 62.7, roe: 33.6, roce: 41.5, debtToEquity: 0.09, revenueGrowth: 7.1, profitGrowth: 8.0, dividendYield: 2.3, beta: 0.76, volatility: 19.2, high52: 1953.90, low52: 1351.65 },
    { symbol: "WIPRO", companyName: "Wipro Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 486.15, marketCap: 254000, pe: 21.3, pb: 3.4, eps: 22.8, roe: 16.1, roce: 19.9, debtToEquity: 0.13, revenueGrowth: 3.2, profitGrowth: 4.6, dividendYield: 1.0, beta: 0.79, volatility: 20.5, high52: 572.30, low52: 388.15 },
    { symbol: "HCLTECH", companyName: "HCL Technologies Ltd", exchange: "NSE", sector: "IT", industry: "IT Services", price: 1712.40, marketCap: 464000, pe: 25.1, pb: 6.8, eps: 68.2, roe: 27.4, roce: 33.8, debtToEquity: 0.06, revenueGrowth: 6.4, profitGrowth: 7.9, dividendYield: 3.2, beta: 0.73, volatility: 18.9, high52: 1953.75, low52: 1356.30 },

    // ---- Energy ----
    { symbol: "RELIANCE", companyName: "Reliance Industries Ltd", exchange: "NSE", sector: "Energy", industry: "Oil, Gas & Retail Conglomerate", price: 2914.55, marketCap: 1972000, pe: 26.2, pb: 2.3, eps: 111.2, roe: 9.1, roce: 8.7, debtToEquity: 0.41, revenueGrowth: 9.8, profitGrowth: 6.5, dividendYield: 0.4, beta: 1.02, volatility: 22.1, high52: 3217.90, low52: 2220.30 },
    { symbol: "ONGC", companyName: "Oil & Natural Gas Corp Ltd", exchange: "NSE", sector: "Energy", industry: "Oil Exploration", price: 268.30, marketCap: 337000, pe: 8.1, pb: 1.1, eps: 33.1, roe: 14.2, roce: 15.6, debtToEquity: 0.35, revenueGrowth: 4.1, profitGrowth: -2.8, dividendYield: 4.8, beta: 1.24, volatility: 29.3, high52: 345.00, low52: 178.35 },
    { symbol: "NTPC", companyName: "NTPC Ltd", exchange: "NSE", sector: "Energy", industry: "Power Generation", price: 362.75, marketCap: 352000, pe: 16.4, pb: 2.1, eps: 22.1, roe: 13.1, roce: 10.4, debtToEquity: 1.42, revenueGrowth: 7.9, profitGrowth: 8.8, dividendYield: 2.4, beta: 0.68, volatility: 19.6, high52: 448.45, low52: 254.20 },

    // ---- FMCG ----
    { symbol: "HINDUNILVR", companyName: "Hindustan Unilever Ltd", exchange: "NSE", sector: "FMCG", industry: "Household & Personal Products", price: 2412.60, marketCap: 567000, pe: 51.3, pb: 10.9, eps: 47.0, roe: 21.4, roce: 27.8, debtToEquity: 0.02, revenueGrowth: 5.8, profitGrowth: 6.2, dividendYield: 1.7, beta: 0.54, volatility: 15.1, high52: 2769.65, low52: 2172.05 },
    { symbol: "ITC", companyName: "ITC Ltd", exchange: "NSE", sector: "FMCG", industry: "Diversified Consumer Goods", price: 438.90, marketCap: 548000, pe: 27.8, pb: 6.7, eps: 15.8, roe: 24.1, roce: 32.5, debtToEquity: 0.01, revenueGrowth: 8.3, profitGrowth: 9.7, dividendYield: 3.1, beta: 0.61, volatility: 16.4, high52: 528.00, low52: 393.10 },
    { symbol: "NESTLEIND", companyName: "Nestle India Ltd", exchange: "NSE", sector: "FMCG", industry: "Packaged Foods", price: 2274.15, marketCap: 219000, pe: 63.7, pb: 34.2, eps: 35.7, roe: 53.7, roce: 71.2, debtToEquity: 0.03, revenueGrowth: 7.5, profitGrowth: 6.9, dividendYield: 1.2, beta: 0.48, volatility: 14.6, high52: 2769.90, low52: 2076.40 },

    // ---- Healthcare ----
    { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical Industries Ltd", exchange: "NSE", sector: "Healthcare", industry: "Pharmaceuticals", price: 1682.20, marketCap: 403000, pe: 34.9, pb: 6.1, eps: 48.2, roe: 17.6, roce: 20.3, debtToEquity: 0.05, revenueGrowth: 10.6, profitGrowth: 15.2, dividendYield: 0.7, beta: 0.63, volatility: 18.3, high52: 1961.75, low52: 1332.05 },
    { symbol: "DRREDDY", companyName: "Dr Reddy's Laboratories Ltd", exchange: "NSE", sector: "Healthcare", industry: "Pharmaceuticals", price: 1218.65, marketCap: 203000, pe: 18.2, pb: 3.5, eps: 67.0, roe: 19.8, roce: 22.9, debtToEquity: 0.08, revenueGrowth: 9.1, profitGrowth: 11.4, dividendYield: 0.6, beta: 0.58, volatility: 19.9, high52: 1420.90, low52: 1053.30 },
    { symbol: "CIPLA", companyName: "Cipla Ltd", exchange: "NSE", sector: "Healthcare", industry: "Pharmaceuticals", price: 1489.30, marketCap: 120000, pe: 24.6, pb: 4.4, eps: 60.5, roe: 17.9, roce: 20.1, debtToEquity: 0.04, revenueGrowth: 8.4, profitGrowth: 13.7, dividendYield: 0.7, beta: 0.55, volatility: 17.6, high52: 1702.45, low52: 1180.00 },

    // ---- Automotive ----
    { symbol: "MARUTI", companyName: "Maruti Suzuki India Ltd", exchange: "NSE", sector: "Automotive", industry: "Passenger Vehicles", price: 12684.50, marketCap: 384000, pe: 27.1, pb: 4.3, eps: 468.1, roe: 16.2, roce: 20.6, debtToEquity: 0.03, revenueGrowth: 11.9, profitGrowth: 14.8, dividendYield: 1.0, beta: 1.08, volatility: 24.2, high52: 13680.00, low52: 9737.20 },
    { symbol: "TATAMOTORS", companyName: "Tata Motors Ltd", exchange: "NSE", sector: "Automotive", industry: "Auto Manufacturer", price: 942.80, marketCap: 347000, pe: 12.8, pb: 4.9, eps: 73.7, roe: 38.9, roce: 17.4, debtToEquity: 0.68, revenueGrowth: 13.5, profitGrowth: 32.1, dividendYield: 0.1, beta: 1.46, volatility: 33.5, high52: 1179.00, low52: 614.75 },
    { symbol: "M&M", companyName: "Mahindra & Mahindra Ltd", exchange: "NSE", sector: "Automotive", industry: "Auto Manufacturer", price: 2864.15, marketCap: 356000, pe: 29.4, pb: 5.8, eps: 97.4, roe: 19.8, roce: 15.7, debtToEquity: 0.44, revenueGrowth: 15.7, profitGrowth: 19.3, dividendYield: 0.6, beta: 1.12, volatility: 25.8, high52: 3222.60, low52: 1809.20 },

    // ---- Telecom ----
    { symbol: "BHARTIARTL", companyName: "Bharti Airtel Ltd", exchange: "NSE", sector: "Telecom", industry: "Telecom Services", price: 1587.90, marketCap: 951000, pe: 71.2, pb: 12.8, eps: 22.3, roe: 18.9, roce: 11.2, debtToEquity: 1.31, revenueGrowth: 17.2, profitGrowth: 41.6, dividendYield: 0.5, beta: 0.84, volatility: 21.9, high52: 1779.00, low52: 1101.05 },

    // ---- Industrials ----
    { symbol: "LT", companyName: "Larsen & Toubro Ltd", exchange: "NSE", sector: "Industrials", industry: "Construction & Engineering", price: 3612.40, marketCap: 500000, pe: 32.6, pb: 5.1, eps: 110.8, roe: 15.9, roce: 13.8, debtToEquity: 0.71, revenueGrowth: 16.1, profitGrowth: 12.9, dividendYield: 0.8, beta: 1.21, volatility: 26.4, high52: 3999.65, low52: 3123.05 },
    { symbol: "ADANIPORTS", companyName: "Adani Ports & SEZ Ltd", exchange: "NSE", sector: "Industrials", industry: "Port & Logistics", price: 1298.75, marketCap: 281000, pe: 25.3, pb: 4.7, eps: 51.3, roe: 19.2, roce: 14.6, debtToEquity: 0.89, revenueGrowth: 21.4, profitGrowth: 27.8, dividendYield: 0.3, beta: 1.38, volatility: 31.7, high52: 1621.40, low52: 967.05 },
    { symbol: "ULTRACEMCO", companyName: "UltraTech Cement Ltd", exchange: "NSE", sector: "Industrials", industry: "Cement", price: 11248.60, marketCap: 324000, pe: 39.8, pb: 4.9, eps: 282.6, roe: 12.6, roce: 11.9, debtToEquity: 0.28, revenueGrowth: 9.3, profitGrowth: 5.1, dividendYield: 0.5, beta: 0.97, volatility: 23.1, high52: 12144.85, low52: 8691.20 }
  ];

  // Every stock in this demo universe is treated as eligible-by-default
  // (see js/scoringEngine.js for the actual eligibility checks run
  // against these fields at score time).
  global.DEMO_STOCKS = DEMO_STOCKS;
})(window);
