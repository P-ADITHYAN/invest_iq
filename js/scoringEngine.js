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
 *
 * Null-tolerant by design: since fundamentals now come from a live
 * provider (see js/marketData.js / api/fundamentals.js), any individual
 * metric can legitimately be `null` for a given stock (that provider
 * response was incomplete for it) rather than fabricated. This engine
 * never substitutes a guessed number for a null — a sub-factor built
 * from a null metric is itself excluded from that stock's score, and
 * that stock's remaining weights are renormalized so it isn't unfairly
 * penalized or boosted by the gap. `roce` is always null (see
 * api/fundamentals.js) and therefore no longer feeds any sub-factor.
 */
(function (global) {
  "use strict";

  // Only fields that are essentially always available (price + the free,
  // unauthenticated chart data) are required for a stock to be scored at
  // all. Every fundamental ratio is optional from here on.
  function eligible(stock) {
    const requiredFields = ["price", "high52", "low52", "marketCap"];
    return requiredFields.every(function (f) { return stock[f] != null && !isNaN(stock[f]); }) && stock.marketCap > 0 && stock.price > 0;
  }

  // Min-max normalize a metric across the universe to 0-100. Stocks with
  // a null value for `key` get `null` back (not a guessed midpoint) and
  // are excluded from the min/max calculation itself.
  // invert=true means "lower raw value is better" (e.g. P/E, debt/equity).
  function normalize(stocks, key, invert) {
    const present = stocks.filter(function (s) { return s[key] != null && !isNaN(s[key]); });
    const scores = {};
    if (!present.length) {
      stocks.forEach(function (s) { scores[s.symbol] = null; });
      return scores;
    }
    const values = present.map(function (s) { return s[key]; });
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const range = max - min;
    stocks.forEach(function (s) {
      if (s[key] == null || isNaN(s[key])) { scores[s.symbol] = null; return; }
      let pct = range === 0 ? 50 : ((s[key] - min) / range) * 100;
      if (invert) pct = 100 - pct;
      scores[s.symbol] = clamp(pct);
    });
    return scores;
  }

  function clamp(n) { return Math.max(0, Math.min(100, n)); }

  // Null-tolerant weighted blend of [value, weight] pairs — averages over
  // whichever parts are non-null, renormalizing their weights. Returns
  // null only if every part is null.
  function blend(pairs) {
    let sum = 0, weightUsed = 0;
    pairs.forEach(function (p) {
      if (p[0] != null) { sum += p[0] * p[1]; weightUsed += p[1]; }
    });
    return weightUsed > 0 ? sum / weightUsed : null;
  }

  function labelFor(score) {
    if (score == null) return "N/A";
    if (score >= 75) return "Strong";
    if (score >= 55) return "Good";
    if (score >= 35) return "Fair";
    return "Weak";
  }

  function scoreUniverse(rawStocks, riskCategory) {
    const stocks = rawStocks.filter(eligible);

    const debtN = normalize(stocks, "debtToEquity", true); // financialStrength: lower leverage is stronger
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
      const financialStrength = debtN[s.symbol]; // roce is always null now (see api/fundamentals.js) — no longer blended in
      const profitability = roeN[s.symbol];
      const growth = blend([[revGrowthN[s.symbol], 0.5], [profitGrowthN[s.symbol], 0.5]]);
      const valuation = blend([[peN[s.symbol], 0.6], [pbN[s.symbol], 0.4]]);
      const risk = blend([[betaN[s.symbol], 0.5], [volN[s.symbol], 0.5]]);
      const dividend = divN[s.symbol];

      const subScores = { financialStrength, growth, valuation, risk, momentum, profitability, dividend };

      // Weighted average over only the sub-factors this stock actually
      // has data for, renormalizing weights so missing data is excluded
      // rather than treated as good, bad, or a fabricated midpoint.
      let scoreSum = 0, weightUsed = 0;
      Object.keys(subScores).forEach(function (k) {
        if (subScores[k] != null) { scoreSum += subScores[k] * weighted[k]; weightUsed += weighted[k]; }
      });
      const score = Math.round(clamp(weightUsed > 0 ? scoreSum / weightUsed : 50));

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
