/**
 * config.js — Central configuration for InvestIQ.
 *
 * Every tunable constant in the application lives here: branding, demo-mode
 * switches, risk-scoring weights, stock-scoring weights, portfolio
 * construction constraints, and analytics assumptions. Pages and engines
 * read from this object instead of hard-coding numbers, so the whole
 * product can be re-weighted or re-branded by editing this one file.
 *
 * This file must be loaded before any other InvestIQ script.
 */
(function (global) {
  "use strict";

  const CONFIG = {
    // ---- Branding ------------------------------------------------------
    APP_NAME: "InvestIQ",
    APP_TAGLINE: "Invest Smarter. Learn While You Invest.",

    // ---- Environment / data source --------------------------------------
    // When true, every "external service" call is served from the local
    // demo data + localStorage layer (js/data/*, js/api.js). When false,
    // marketData.js and api.js will attempt real HTTPS calls to
    // API_BASE_URL. No secret keys are ever placed in this file or any
    // other frontend file — a real deployment must proxy provider keys
    // through a server-side API and only ever call API_BASE_URL from here.
    DEMO_MODE: true,
    API_BASE_URL: "", // e.g. "https://api.investiq.example.com" in production

    // ---- Market / currency ------------------------------------------------
    MARKET: "NSE",
    CURRENCY: "INR",
    CURRENCY_SYMBOL: "₹",
    BENCHMARK: "NIFTY50",

    // ---- Virtual trading ---------------------------------------------
    DEFAULT_VIRTUAL_CASH: 100000,

    // ---- Risk scoring engine (see js/riskEngine.js) --------------------
    // Weighted contributions must sum to 1.0. Each sub-score is normalized
    // to 0-100 before weighting.
    RISK_WEIGHTS: {
      questionnaire: 0.25, // Step 6: conservative / moderate / aggressive preference
      horizon: 0.20,       // Step 2: investment horizon
      lossTolerance: 0.20, // Step 5: reaction to a paper loss
      goal: 0.15,          // Step 3: investment goal
      experience: 0.10,    // Step 4: self-rated experience
      stability: 0.10      // Step 1: budget size, used as a stability proxy
    },

    RISK_BANDS: [
      { max: 30, category: "Conservative" },
      { max: 60, category: "Moderate" },
      { max: 80, category: "Growth" },
      { max: 100, category: "Aggressive" }
    ],

    // ---- Stock scoring engine (see js/scoringEngine.js) -----------------
    SCORE_WEIGHTS: {
      financialStrength: 0.25,
      growth: 0.20,
      valuation: 0.15,
      risk: 0.15,
      momentum: 0.10,
      profitability: 0.10,
      dividend: 0.05
    },

    // Per-risk-profile multipliers applied on top of SCORE_WEIGHTS before
    // re-normalizing to sum to 1.0. A value of 1 = unchanged emphasis.
    // Risk is never zeroed out, even for Aggressive profiles.
    PROFILE_WEIGHTS: {
      Conservative: { financialStrength: 1.4, risk: 1.5, profitability: 1.3, valuation: 1.2, growth: 0.7, momentum: 0.6, dividend: 1.1 },
      Moderate:     { financialStrength: 1.0, risk: 1.0, profitability: 1.0, valuation: 1.0, growth: 1.0, momentum: 1.0, dividend: 1.0 },
      Growth:       { financialStrength: 0.9, risk: 0.9, profitability: 1.2, valuation: 0.9, growth: 1.4, momentum: 1.2, dividend: 0.7 },
      Aggressive:   { financialStrength: 0.8, risk: 0.8, profitability: 1.1, valuation: 0.7, growth: 1.5, momentum: 1.5, dividend: 0.5 }
    },

    // ---- Portfolio construction constraints (see js/recommendationEngine.js) --
    PORTFOLIO_CONSTRAINTS: {
      maxSingleStockAllocation: 0.30,
      maxSectorAllocation: 0.40,
      minStockCount: 5,
      cashReserveMin: 0.05,
      cashReserveMax: 0.15
    },

    // ---- Analytics assumptions (clearly labeled wherever displayed) -----
    RISK_FREE_RATE_ANNUAL: 0.07, // used only for Sharpe ratio calculation

    // ---- Sector concentration warning threshold --------------------------
    SECTOR_WARNING_THRESHOLD: 0.40,

    // ---- Misc UI ----------------------------------------------------------
    TOAST_DURATION_MS: 4000
  };

  global.CONFIG = CONFIG;
})(window);
