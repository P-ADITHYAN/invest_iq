/**
 * ai.js — Optional AI explanation service interface (spec §44).
 *
 * The rest of the app never calls a language model directly — every page
 * that wants a natural-language explanation calls one of these functions.
 * The functions receive only structured, already-computed application
 * data (scores, fundamentals, risk numbers) and are responsible for
 * turning it into readable text. They must NEVER invent numbers that
 * aren't present in the structured input.
 *
 * Demo-mode implementation: composes explanations from the same
 * deterministic sub-scores RecommendationEngine/ScoringEngine already
 * computed (no network call). To wire up a real LLM later, replace the
 * body of each function with a call to CONFIG.API_BASE_URL + "/ai/..."
 * passing the same structured payload documented on each function, and
 * keep the "never invent data" contract server-side too.
 *
 * ---------------------------------------------------------------------
 * Phase 10 stub interfaces (documented, not implemented in this MVP):
 *
 *   WhatIfSimulator.simulate({ baseDraft, changes })
 *     changes: { budget?, riskCategory?, removeSymbol?, addSymbol?,
 *                sectorTiltPct?: {sector, pct} }
 *     -> returns a hypothetical RecommendationEngine.buildPortfolio()-shaped
 *        draft WITHOUT persisting or mutating the user's real portfolio.
 *
 *   Backtester.run({ initialCapital, startDate, endDate, strategy, benchmark })
 *     strategy: a deterministic rule (e.g. "hold selected portfolio",
 *               "rebalance monthly to target weights")
 *     -> returns { totalReturn, annualizedReturn, volatility, sharpeRatio,
 *                  maxDrawdown, benchmarkComparison }
 *
 * Both would be built on top of DemoHistorical / PortfolioAnalytics once
 * the MVP is stable, per spec §75 ("do not overengineer the first
 * version"). Left unimplemented intentionally.
 * ---------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  function explainStock(payload) {
    // payload: { stock, score, subScores, labels, portfolioFit }
    return Promise.resolve(RecommendationEngine.explainStock(payload.stock));
  }

  function explainPortfolio(draft) {
    const sectorCount = new Set(draft.positions.map(function (p) { return p.sector; })).size;
    const text =
      "This portfolio spreads " + UI.formatINR(draft.totalInvested || 0) + " across " + draft.positions.length +
      " stocks in " + sectorCount + " sector" + (sectorCount === 1 ? "" : "s") + ", built for a " +
      draft.riskCategory + " risk profile. " +
      UI.formatPercent(draft.cashPct * 100, 0) + " reserve cash is kept aside as a buffer, in line with your risk category.";
    return Promise.resolve(text);
  }

  const METRIC_EXPLANATIONS = {
    pe: "Compares a company's share price with its earnings per share. A lower P/E can mean a stock is cheaper relative to its profits, but very low values can also signal risk.",
    pb: "Compares share price to the company's book (net asset) value per share.",
    eps: "Earnings Per Share — how much profit the company makes for each outstanding share.",
    roe: "Return on Equity — how efficiently a company generates profit from shareholders' capital.",
    debtToEquity: "How much debt a company uses relative to shareholder equity. Lower generally means less financial risk.",
    revenueGrowth: "Year-over-year growth in the company's total sales.",
    profitGrowth: "Year-over-year growth in the company's net profit.",
    dividendYield: "Annual dividend paid per share, as a percentage of the current share price.",
    beta: "Indicates how sensitive a stock has historically been to overall market movements. 1.0 means it moves roughly with the market.",
    volatility: "How much a stock's price has swung, annualized. Higher volatility means bigger price swings in both directions.",
    sharpeRatio: "Measures return earned per unit of risk taken, relative to a risk-free rate assumption.",
    maxDrawdown: "The largest peak-to-trough decline the portfolio has experienced over the period shown."
  };

  function explainMetric(key) {
    return Promise.resolve(METRIC_EXPLANATIONS[key] || "No explanation available for this metric yet.");
  }

  function summarizePerformance(analytics) {
    const dir = analytics.raw.annualizedVolatilityPct > 25 ? "higher-than-average" : "moderate";
    const text =
      "Your portfolio's health score is " + analytics.overall + "/100. Annualized volatility is around " +
      analytics.raw.annualizedVolatilityPct.toFixed(1) + "%, which is " + dir + " for a diversified equity portfolio. " +
      (analytics.sectorWarning ? "One sector currently exceeds the recommended concentration threshold — consider rebalancing." : "Sector concentration is currently within recommended limits.");
    return Promise.resolve(text);
  }

  function answerLearningQuestion(question) {
    // Demo mode has no live model connected; route the user to the
    // Learn section instead of fabricating an answer.
    return Promise.resolve(
      "AI answers aren't connected in demo mode. Try the Learn section for an explanation of \"" + question + "\", or check the ⓘ tooltip next to related metrics."
    );
  }

  global.AIService = { explainStock, explainPortfolio, explainMetric, summarizePerformance, answerLearningQuestion };
})(window);
