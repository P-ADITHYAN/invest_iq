/**
 * pages/recommendations.js — Recommendation review + portfolio builder
 * with live customization (spec §25-28).
 */
(function () {
  "use strict";

  document.title = "Your Personalized Portfolio — " + CONFIG.APP_NAME;
  const root = document.getElementById("recoContent");

  let profile = null;
  let draft = null;
  let scoredUniverse = [];
  let view = "review";

  root.innerHTML = UI.loadingState("Building your personalized portfolio...");

  Promise.all([api.getRiskProfile(), api.getPortfolio()]).then(function (results) {
    profile = results[0];
    const portfolio = results[1];
    if (!profile) { window.location.href = "onboarding.html"; return; }
    if (portfolio.confirmed) {
      root.innerHTML = '<div class="card text-center"><h3>You already have a virtual portfolio</h3><p class="text-muted">Head to your portfolio to review holdings, or use Trade to adjust positions.</p><a href="portfolio.html" class="btn btn-primary">Go to Portfolio</a></div>';
      return;
    }
    return Promise.all([api.getRecommendations(), api.getStocks()]).then(function (r2) {
      draft = r2[0];
      scoredUniverse = ScoringEngine.scoreUniverse(r2[1], profile.category);
      render();
    });
  }).catch(function (err) {
    root.innerHTML = UI.errorState(err.message);
  });

  const HORIZON_LABEL = { "<1y": "Under 1 year", "1-3y": "1-3 Years", "3-5y": "3-5 Years", "5-10y": "5-10 Years", "10y+": "10+ Years" };
  const GOAL_LABEL = { wealth_creation: "Wealth Creation", long_term_growth: "Long-Term Growth", capital_preservation: "Capital Preservation", dividend_income: "Dividend Income", learning: "Learning", short_term_opportunities: "Short-Term Opportunities" };

  function avgScore() {
    if (!draft.positions.length) return 0;
    return Math.round(draft.positions.reduce(function (s, p) { return s + p.score; }, 0) / draft.positions.length);
  }

  function render() {
    if (view === "review") renderReview();
    else renderBuild();
  }

  function renderReview() {
    root.innerHTML =
      '<div class="reco-summary-bar">' +
      summaryCard("Budget", UI.formatINR(draft.budget, { decimals: 0 })) +
      summaryCard("Risk", profile.category) +
      summaryCard("Horizon", HORIZON_LABEL[profile.horizonLabel] || profile.horizonLabel) +
      summaryCard("Goal", GOAL_LABEL[profile.goal] || profile.goal) +
      summaryCard("Portfolio Score", avgScore() + "/100") +
      "</div>" +
      (draft.error ? '<div class="card"><p class="text-danger">' + draft.error + "</p></div>" : "") +
      '<div class="grid grid-2" id="stockCardsGrid" style="margin-bottom:var(--space-6)">' +
      draft.positions.map(stockCard).join("") +
      "</div>" +
      (draft.positions.length ? '<div class="card row-between" style="position:sticky;bottom:var(--space-4)"><div><strong>' + draft.positions.length + ' stocks selected</strong><p class="text-muted" style="margin:0">' + UI.formatPercent(draft.cashPct * 100, 0).replace("+", "") + ' cash reserve</p></div><button class="btn btn-primary btn-lg" id="buildBtn">Build This Portfolio</button></div>' : "");

    const buildBtn = document.getElementById("buildBtn");
    if (buildBtn) buildBtn.addEventListener("click", function () { view = "build"; render(); });
  }

  function summaryCard(label, value) {
    return '<div class="card"><div class="card-title">' + label + '</div><div style="font-weight:700">' + value + "</div></div>";
  }

  function stockCard(p) {
    const subBadges = Object.keys(p.labels).map(function (k) {
      const friendly = { financialStrength: "Financial Strength", growth: "Growth", valuation: "Valuation", risk: "Risk", momentum: "Momentum", profitability: "Profitability", dividend: "Dividend" }[k];
      const cls = { Strong: "badge-success", Good: "badge-info", Fair: "badge-warning", Weak: "badge-danger" }[p.labels[k]];
      return '<span class="badge ' + cls + '">' + friendly + ": " + p.labels[k] + "</span>";
    }).join("");

    return (
      '<div class="card stock-reco-card">' +
      '<div class="stock-reco-head"><div><h4 style="margin-bottom:2px">' + p.companyName + '</h4><span class="text-muted">' + p.symbol + " · " + p.sector + "</span></div>" +
      '<span class="badge badge-neutral">Score ' + p.score + "/100</span></div>" +
      '<div class="grid grid-3">' +
      miniStat("Allocation", UI.formatPercent(p.allocationPct * 100, 1).replace("+", "")) +
      miniStat("Investment", UI.formatINR(p.amount, { decimals: 0 })) +
      miniStat("Shares", p.shares) +
      "</div>" +
      '<div><strong>Why this stock?</strong><div class="mini-score-row" style="margin-top:6px">' + subBadges + "</div></div>" +
      '<p class="text-muted" style="margin:0">' + p.whyThisStock + " Portfolio fit: <strong>" + p.portfolioFit + "</strong></p>" +
      "</div>"
    );
  }

  function miniStat(label, value) {
    return '<div><div class="text-muted" style="font-size:var(--font-size-xs)">' + label + '</div><div style="font-weight:700">' + value + "</div></div>";
  }

  // ---------------- Build / Customize view ----------------
  function analyticsForDraft() {
    const holdings = draft.positions.filter(function (p) { return p.shares > 0; }).map(function (p) {
      return { symbol: p.symbol, sector: p.sector, currentValue: p.shares * p.price, quantity: p.shares, currentPrice: p.price, volatility: p.volatility, subScores: p.subScores };
    });
    return PortfolioAnalytics.computeHealth(holdings, draft.cashAmount);
  }

  function recalcDraft() {
    let totalInvested = 0;
    draft.positions.forEach(function (p) { totalInvested += p.shares * p.price; });
    draft.totalInvested = totalInvested;
    draft.cashAmount = draft.budget - totalInvested;
    draft.cashPct = draft.budget > 0 ? draft.cashAmount / draft.budget : 0;
    draft.positions.forEach(function (p) { p.allocationPct = draft.budget > 0 ? (p.shares * p.price) / draft.budget : 0; p.amount = p.shares * p.price; });
  }

  function renderBuild() {
    recalcDraft();
    const analytics = analyticsForDraft();
    const diversificationLabel = analytics.breakdown.diversification >= 70 ? "Good" : analytics.breakdown.diversification >= 45 ? "Fair" : "Needs Improvement";

    const addOptions = scoredUniverse.filter(function (s) {
      return !draft.positions.some(function (p) { return p.symbol === s.symbol; });
    }).map(function (s) { return '<option value="' + s.symbol + '">' + s.symbol + " — " + s.companyName + "</option>"; }).join("");

    root.innerHTML =
      '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<h3>Your Virtual Portfolio</h3>' +
      '<div class="grid grid-4">' +
      summaryCard("Budget", UI.formatINR(draft.budget, { decimals: 0 })) +
      summaryCard("Stocks", draft.positions.filter(function (p) { return p.shares > 0; }).length) +
      summaryCard("Cash", UI.formatPercent(draft.cashPct * 100, 1).replace("+", "")) +
      summaryCard("Diversification", diversificationLabel) +
      "</div>" +
      '<div style="margin-top:var(--space-4)">' + SvgCharts.renderBarRows(analytics.sectorExposure.map(function (r, i) { return { label: r.sector, pct: r.pct, colorIndex: i, warn: r.sector !== "Cash" && r.pct > CONFIG.SECTOR_WARNING_THRESHOLD * 100 }; })) + "</div>" +
      "</div>" +

      '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="row-between"><h3>Customize</h3><div class="row gap-2"><select class="select" id="addStockSelect"><option value="">Add a stock...</option>' + addOptions + '</select><button class="btn btn-outline btn-sm" id="addStockBtn">Add</button></div></div>' +
      draft.positions.map(customizeRow).join("") +
      "</div>" +

      '<div class="row gap-3">' +
      '<button class="btn btn-outline" id="backToReviewBtn">Back</button>' +
      '<button class="btn btn-primary btn-lg" id="confirmBtn">Confirm Portfolio</button>' +
      "</div>";

    document.getElementById("backToReviewBtn").addEventListener("click", function () { view = "review"; render(); });
    document.getElementById("confirmBtn").addEventListener("click", confirmPortfolio);
    document.getElementById("addStockBtn").addEventListener("click", function () {
      const symbol = document.getElementById("addStockSelect").value;
      if (!symbol) return;
      const stock = scoredUniverse.find(function (s) { return s.symbol === symbol; });
      draft.positions.push({
        symbol: stock.symbol, companyName: stock.companyName, sector: stock.sector, score: stock.score,
        subScores: stock.subScores, labels: stock.labels, price: stock.price, volatility: stock.volatility,
        allocationPct: 0, amount: 0, shares: 0, portfolioFit: "Growing", whyThisStock: RecommendationEngine.explainStock(stock)
      });
      render();
    });

    UI.qsa(".qty-stepper button", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        const symbol = btn.getAttribute("data-symbol");
        const delta = Number(btn.getAttribute("data-delta"));
        const pos = draft.positions.find(function (p) { return p.symbol === symbol; });
        pos.shares = Math.max(0, pos.shares + delta);
        render();
      });
    });
    UI.qsa(".remove-position-btn", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        const symbol = btn.getAttribute("data-symbol");
        draft.positions = draft.positions.filter(function (p) { return p.symbol !== symbol; });
        render();
      });
    });
  }

  function customizeRow(p) {
    return (
      '<div class="customize-row">' +
      '<div><strong>' + p.symbol + '</strong><div class="text-muted" style="font-size:var(--font-size-xs)">' + p.sector + " · " + UI.formatINR(p.price) + "/share</div></div>" +
      '<div class="qty-stepper">' +
      '<button type="button" data-symbol="' + p.symbol + '" data-delta="-1">-</button>' +
      '<span>' + p.shares + " shares</span>" +
      '<button type="button" data-symbol="' + p.symbol + '" data-delta="1">+</button>' +
      "</div>" +
      '<div style="min-width:110px;text-align:right">' + UI.formatINR(p.shares * p.price, { decimals: 0 }) + " (" + UI.formatPercent((p.shares * p.price / draft.budget) * 100, 1).replace("+", "") + ")</div>" +
      '<button type="button" class="btn btn-ghost btn-sm remove-position-btn" data-symbol="' + p.symbol + '">Remove</button>' +
      "</div>"
    );
  }

  function confirmPortfolio() {
    const btn = document.getElementById("confirmBtn");
    btn.disabled = true;
    btn.textContent = "Building your portfolio...";
    api.confirmPortfolio(draft).then(function () {
      UI.toast("Your virtual portfolio has been built!", "success");
      window.location.href = "dashboard.html";
    }).catch(function (err) {
      UI.toast(err.message, "danger");
      btn.disabled = false;
      btn.textContent = "Confirm Portfolio";
    });
  }
})();
