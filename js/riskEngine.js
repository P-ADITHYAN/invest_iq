/**
 * riskEngine.js — Deterministic investor risk-scoring engine.
 *
 * Converts the 6-step onboarding answers into a single 0-100 risk score
 * using the weights in CONFIG.RISK_WEIGHTS, then maps that score onto a
 * risk category via CONFIG.RISK_BANDS. Every sub-score below is a fixed,
 * documented lookup table — nothing here is randomized.
 */
(function (global) {
  "use strict";

  // Each option maps to a 0-100 sub-score for its dimension.
  const SCALES = {
    questionnaire: { conservative: 20, moderate: 55, aggressive: 90 },
    horizon: { "<1y": 10, "1-3y": 35, "3-5y": 60, "5-10y": 80, "10y+": 100 },
    lossTolerance: { sell: 10, wait: 50, analyze: 65, invest_more: 100 },
    goal: {
      capital_preservation: 15,
      dividend_income: 35,
      learning: 45,
      wealth_creation: 65,
      long_term_growth: 75,
      short_term_opportunities: 90
    },
    experience: { complete_beginner: 20, beginner: 40, intermediate: 70, advanced: 100 },
    budgetBand: { "1000-5000": 20, "5000-10000": 40, "10000-25000": 60, "25000-50000": 80, "50000+": 100 }
  };

  function budgetStabilityScore(answers) {
    if (answers.budgetBand && answers.budgetBand !== "custom") {
      return SCALES.budgetBand[answers.budgetBand] != null ? SCALES.budgetBand[answers.budgetBand] : 50;
    }
    // Custom amount: scale on a capped log-ish curve so ₹1L+ tops out at 100.
    const amt = Number(answers.budgetAmount) || 0;
    const score = Math.min(100, (amt / 100000) * 100);
    return Math.round(score);
  }

  function clamp0to100(n) {
    return Math.max(0, Math.min(100, n));
  }

  function categoryFor(score) {
    const band = CONFIG.RISK_BANDS.find(function (b) { return score <= b.max; });
    return band ? band.category : CONFIG.RISK_BANDS[CONFIG.RISK_BANDS.length - 1].category;
  }

  function explanationFor(category, answers) {
    const horizonLabel = {
      "<1y": "under a year", "1-3y": "1-3 years", "3-5y": "3-5 years", "5-10y": "5-10 years", "10y+": "10+ years"
    }[answers.horizon] || "your stated horizon";

    const byCategory = {
      Conservative: "You appear to prioritize protecting your capital over chasing higher returns, so a portfolio weighted toward financially stable, lower-volatility companies fits you best.",
      Moderate: "You appear comfortable with moderate market fluctuations and have a long enough investment horizon (" + horizonLabel + ") to consider a diversified, growth-oriented portfolio.",
      Growth: "You're comfortable accepting above-average short-term swings in exchange for stronger long-term growth potential, so your portfolio can lean further into growth and momentum characteristics.",
      Aggressive: "You're comfortable with significant fluctuations for higher potential growth, so your portfolio can emphasize growth and momentum more heavily — while still keeping baseline risk checks in place."
    };
    return byCategory[category] || byCategory.Moderate;
  }

  /**
   * computeRiskProfile(answers)
   * answers: {
   *   budgetBand: "1000-5000"|"5000-10000"|"10000-25000"|"25000-50000"|"50000+"|"custom",
   *   budgetAmount: number,               // required if budgetBand === "custom"
   *   horizon: "<1y"|"1-3y"|"3-5y"|"5-10y"|"10y+",
   *   goal: "wealth_creation"|"long_term_growth"|"capital_preservation"|"dividend_income"|"learning"|"short_term_opportunities",
   *   experience: "complete_beginner"|"beginner"|"intermediate"|"advanced",
   *   lossTolerance: "sell"|"wait"|"analyze"|"invest_more",
   *   questionnaire: "conservative"|"moderate"|"aggressive"
   * }
   */
  function computeRiskProfile(answers) {
    const sub = {
      questionnaire: SCALES.questionnaire[answers.questionnaire] != null ? SCALES.questionnaire[answers.questionnaire] : 50,
      horizon: SCALES.horizon[answers.horizon] != null ? SCALES.horizon[answers.horizon] : 50,
      lossTolerance: SCALES.lossTolerance[answers.lossTolerance] != null ? SCALES.lossTolerance[answers.lossTolerance] : 50,
      goal: SCALES.goal[answers.goal] != null ? SCALES.goal[answers.goal] : 50,
      experience: SCALES.experience[answers.experience] != null ? SCALES.experience[answers.experience] : 50,
      stability: budgetStabilityScore(answers)
    };

    const w = CONFIG.RISK_WEIGHTS;
    const rawScore =
      sub.questionnaire * w.questionnaire +
      sub.horizon * w.horizon +
      sub.lossTolerance * w.lossTolerance +
      sub.goal * w.goal +
      sub.experience * w.experience +
      sub.stability * w.stability;

    const score = Math.round(clamp0to100(rawScore));
    const category = categoryFor(score);

    return {
      score: score,
      category: category,
      breakdown: sub,
      horizonLabel: answers.horizon,
      goal: answers.goal,
      explanation: explanationFor(category, answers),
      computedAt: new Date().toISOString()
    };
  }

  global.RiskEngine = { computeRiskProfile: computeRiskProfile, SCALES: SCALES };
})(window);
