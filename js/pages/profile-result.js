/**
 * pages/profile-result.js — Displays the computed investor profile
 * (spec §13) immediately after onboarding.
 */
(function () {
  "use strict";

  if (!Store.getSession()) { window.location.href = "login.html"; return; }
  document.getElementById("brandName").textContent = CONFIG.APP_NAME;
  document.title = "Your Investor Profile — " + CONFIG.APP_NAME;

  const content = document.getElementById("resultContent");
  content.innerHTML = UI.loadingState("Calculating your investor profile...");

  const HORIZON_LABEL = { "<1y": "Under 1 year", "1-3y": "1-3 Years", "3-5y": "3-5 Years", "5-10y": "5-10 Years", "10y+": "10+ Years" };
  const GOAL_LABEL = {
    wealth_creation: "Wealth Creation", long_term_growth: "Long-Term Growth", capital_preservation: "Capital Preservation",
    dividend_income: "Dividend Income", learning: "Learning", short_term_opportunities: "Short-Term Opportunities"
  };

  api.getRiskProfile().then(function (profile) {
    if (!profile) { window.location.href = "onboarding.html"; return; }

    const badgeClass = { Conservative: "badge-info", Moderate: "badge-success", Growth: "badge-warning", Aggressive: "badge-danger" }[profile.category] || "badge-neutral";

    content.innerHTML =
      '<div class="text-center" style="margin-bottom:var(--space-5)">' +
      '<p class="text-muted" style="margin-bottom:4px">Your Investor Profile</p>' +
      '<h1 style="margin-bottom:var(--space-2)">' + profile.category.toUpperCase() + ' INVESTOR</h1>' +
      '<span class="badge ' + badgeClass + '">Risk Score ' + profile.score + '/100</span>' +
      "</div>" +
      '<div class="grid grid-3" style="margin-bottom:var(--space-5)">' +
      statBlock("Risk Level", profile.category) +
      statBlock("Investment Horizon", HORIZON_LABEL[profile.horizonLabel] || profile.horizonLabel) +
      statBlock("Goal", GOAL_LABEL[profile.goal] || profile.goal) +
      "</div>" +
      '<div class="card" style="background:var(--color-surface-alt);border:none;margin-bottom:var(--space-5)">' +
      '<p style="margin:0;color:var(--color-text)">' + profile.explanation + "</p>" +
      "</div>" +
      '<a href="recommendations.html" class="btn btn-primary btn-lg btn-block">See My Portfolio</a>';
  }).catch(function (err) {
    content.innerHTML = UI.errorState(err.message);
  });

  function statBlock(label, value) {
    return '<div class="card" style="text-align:center;padding:var(--space-4)"><div class="card-title">' + label + '</div><div style="font-weight:700;font-size:var(--font-size-md)">' + value + "</div></div>";
  }
})();
