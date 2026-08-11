/**
 * scoringEngine.js — Deterministic 0-100 stock scoring engine.
 *
 * Every fundamental metric is min-max normalized across the current
 * stock universe *before* being weighted (raw P/E and raw ROE are on
 * totally different scales, so comparing them directly would be
 * meaningless). Base factor weights come from CONFIG.SCORE_WEIGHTS;
 * CONFIG.PROFILE_WEIGHTS then re-weights those factors per investor risk
 * category (Conservative/Moderate/Growth/Aggressive) without ever
 * zeroing out the Risk factor.
 */
(function (global) {
  "use strict";

  function eligible(stock) {
    const requiredFields = ["price", "pe", "pb", "eps", "roe", "roce", "debtToEquity", "revenueGrowth", "profitGrowth", "dividendYield", "beta", "volatility", "high52", "low52", "marketCap"];
    return requiredFields.every(function (f) { return stock[f] != null && !isNaN(stock[f]); }) && stock.marketCap > 0 && stock.price > 0;
  }

  // Min-max normalize a metric across the universe to 0-100.
  // invert=true means "lower raw value is better" (e.g. P/E, debt/equity).
  function normalize(stocks, key, invert) {
    const values = stocks.map(function (s) { return s[key]; });
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const range = max - min;
    const scores = {};
    stocks.forEach(function (s) {
      let pct = range === 0 ? 50 : ((s[key] - min) / range) * 100;
      if (invert) pct = 100 - pct;
      scores[s.symbol] = clamp(pct);
    });
    return scores;
  }

  function clamp(n) { return Math.max(0, Math.min(100, n)); }

  function labelFor(score) {
    if (score >= 75) return "Strong";
    if (score >= 55) return "Good";
    if (score >= 35) return "Fair";
    return "Weak";
  }

  function scoreUniverse(rawStocks, riskCategory) {
    const stocks = rawStocks.filter(eligible);

    const roceN = normalize(stocks, "roce", false);
    const debtN = normalize(stocks, "debtToEquity", true);
    const roeN = normalize(stocks, "roe", false);
    const revGrowthN = normalize(stocks, "revenueGrowth", false);
    const profitGrowthN = normalize(stocks, "profitGrowth", false);
    const peN = normalize(stocks, "pe", true);
    const pbN = normalize(stocks, "pb", true);
    const betaN = normalize(stocks, "beta", true);
    const volN = normalize(stocks, "volatility", true);
    const divN = normalize(stocks, "dividendYield", false);

    const profileMultipliers = (CONFIG.PROFILE_WEIGHTS[riskCategory]) || CONFIG.PROFILE_WEIGHTS.Moderate;
    const base = CONFIG.SCORE_WEIGHTS;
    const weighted = {};
    let weightSum = 0;
    Object.keys(base).forEach(function (k) {
      weighted[k] = base[k] * (profileMultipliers[k] != null ? profileMultipliers[k] : 1);
      weightSum += weighted[k];
    });
    // Re-normalize so weights sum back to 1.
    Object.keys(weighted).forEach(function (k) { weighted[k] = weighted[k] / weightSum; });

    return stocks.map(function (s) {
      const momentum = clamp(((s.price - s.low52) / Math.max(1, (s.high52 - s.low52))) * 100);
      const financialStrength = (roceN[s.symbol] * 0.5) + (debtN[s.symbol] * 0.5);
      const profitability = roeN[s.symbol];
      const growth = (revGrowthN[s.symbol] * 0.5) + (profitGrowthN[s.symbol] * 0.5);
      const valuation = (peN[s.symbol] * 0.6) + (pbN[s.symbol] * 0.4);
      const risk = (betaN[s.symbol] * 0.5) + (volN[s.symbol] * 0.5);
      const dividend = divN[s.symbol];

      const subScores = { financialStrength, growth, valuation, risk, momentum, profitability, dividend };

      const score = Math.round(clamp(
        subScores.financialStrength * weighted.financialStrength +
        subScores.growth * weighted.growth +
        subScores.valuation * weighted.valuation +
        subScores.risk * weighted.risk +
        subScores.momentum * weighted.momentum +
        subScores.profitability * weighted.profitability +
        subScores.dividend * weighted.dividend
      ));

      const labels = {};
      Object.keys(subScores).forEach(function (k) { labels[k] = labelFor(subScores[k]); });

      return Object.assign({}, s, {
        score: score,
        subScores: subScores,
        labels: labels,
        eligible: true
      });
    }).sort(function (a, b) { return b.score - a.score; });
  }

  global.ScoringEngine = { scoreUniverse: scoreUniverse, eligible: eligible, labelFor: labelFor };
})(window);
