/**
 * pages/dashboard.js — Home dashboard: value/P&L/return/cash cards,
 * performance chart, holdings, allocation, health, sector exposure,
 * recent transactions, and active alerts (spec §32, §61).
 */
(function () {
  "use strict";

  document.title = "Dashboard — " + CONFIG.APP_NAME;
  const session = Store.getSession();
  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = greetingWord + (session ? ", " + session.name.split(" ")[0] : "");

  const root = document.getElementById("dashboardContent");
  root.innerHTML = UI.loadingState("Loading your dashboard...");

  Promise.all([api.getPortfolio(), api.getTransactions(), api.getAlerts(), api.getRiskProfile()])
    .then(function (results) {
      render(results[0], results[1], results[2], results[3]);
    })
    .catch(function (err) {
      root.innerHTML = UI.errorState(err.message);
    });

  function render(portfolio, transactions, alerts, riskProfile) {
    const holdings = portfolio.holdings;
    const investedTotal = holdings.reduce(function (s, h) { return s + h.investedValue; }, 0);
    const currentHoldingsValue = holdings.reduce(function (s, h) { return s + h.currentValue; }, 0);
    const portfolioValue = currentHoldingsValue + portfolio.cash;
    const totalReturnPct = ((portfolioValue - CONFIG.DEFAULT_VIRTUAL_CASH) / CONFIG.DEFAULT_VIRTUAL_CASH) * 100;

    // Today's P&L approximated from each holding's simulated day change,
    // applied to its current value (demo mode has no live tick feed).
    const todaysPnl = holdings.reduce(function (sum, h) {
      const chgPct = UI.deterministicPseudo(h.symbol + new Date().toDateString(), -3, 3) / 100;
      return sum + h.currentValue * chgPct;
    }, 0);

    if (!holdings.length && !portfolio.confirmed) {
      root.innerHTML =
        '<div class="stat-grid" style="margin-bottom:var(--space-5)">' +
        statCard("Portfolio Value", UI.formatINR(portfolioValue, { decimals: 0 })) +
        statCard("Today's P&L", UI.formatINR(0), "text-muted") +
        statCard("Total Return", UI.formatPercent(0)) +
        statCard("Available Cash", UI.formatINR(portfolio.cash, { decimals: 0 })) +
        "</div>" +
        '<div class="card text-center"><h3>You haven\'t built a portfolio yet</h3><p class="text-muted">Answer a few questions to get a personalized set of Indian stocks, explained in plain English.</p><a href="recommendations.html" class="btn btn-primary btn-lg">Get My Recommendations</a></div>';
      return;
    }

    const analytics = PortfolioAnalytics.computeHealth(holdings, portfolio.cash);
    const valueSeries = PortfolioAnalytics.buildValueSeries(holdings);
    const cashSeries = valueSeries.map(function (v) { return v + portfolio.cash; });

    root.innerHTML =
      '<div class="stat-grid" style="margin-bottom:var(--space-5)">' +
      statCard("Portfolio Value", UI.formatINR(portfolioValue, { decimals: 0 })) +
      statCard("Today's P&L", (todaysPnl >= 0 ? "+" : "") + UI.formatINR(todaysPnl, { decimals: 0 }), todaysPnl >= 0 ? "text-success" : "text-danger") +
      statCard("Total Return", UI.formatPercent(totalReturnPct), totalReturnPct >= 0 ? "text-success" : "text-danger") +
      statCard("Available Cash", UI.formatINR(portfolio.cash, { decimals: 0 })) +
      "</div>" +

      '<div class="card" style="margin-bottom:var(--space-5)">' +
      "<h3>Performance</h3>" +
      (cashSeries.length > 1 ? SvgCharts.renderLineChart(cashSeries, { showArea: true }) : '<p class="text-muted">Not enough history yet.</p>') +
      "</div>" +

      '<div class="dashboard-grid">' +
        '<div>' +
          '<div class="card" style="margin-bottom:var(--space-5)">' +
          '<div class="row-between"><h3>Holdings</h3><a href="portfolio.html" class="text-muted" style="font-size:var(--font-size-sm)">View all &rarr;</a></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Stock</th><th>Qty</th><th>Current Value</th><th>P&L</th></tr></thead><tbody>' +
          holdings.slice(0, 6).map(function (h) {
            return "<tr class=\"clickable\" onclick=\"window.location.href='stock-detail.html?symbol=" + h.symbol + "'\"><td><strong>" + h.symbol + "</strong></td><td>" + h.quantity + "</td><td>" + UI.formatINR(h.currentValue, { decimals: 0 }) + '</td><td class="' + (h.pnl >= 0 ? "text-success" : "text-danger") + '">' + UI.formatINR(h.pnl, { decimals: 0 }) + "</td></tr>";
          }).join("") +
          "</tbody></table></div>" +
          (holdings.length ? "" : '<p class="text-muted">No holdings yet.</p>') +
          "</div>" +

          '<div class="card">' +
          '<div class="row-between"><h3>Recent Transactions</h3><a href="transactions.html" class="text-muted" style="font-size:var(--font-size-sm)">View all &rarr;</a></div>' +
          (transactions.length ? transactions.slice(0, 5).map(function (t) {
            return '<div class="notif-item"><span>' + t.type + " " + t.qty + " " + t.symbol + '</span><span class="text-muted">' + UI.formatDate(t.date) + "</span></div>";
          }).join("") : '<p class="text-muted">No transactions yet.</p>') +
          "</div>" +
        "</div>" +

        '<div>' +
          '<div class="card" style="margin-bottom:var(--space-5)">' +
          '<div class="row-between"><h3>Portfolio Health</h3><span class="badge badge-neutral">' + analytics.overall + "/100</span></div>" +
          SvgCharts.renderBarRows([
            { label: "Diversification", pct: analytics.breakdown.diversification },
            { label: "Risk", pct: analytics.breakdown.risk },
            { label: "Sector Balance", pct: analytics.breakdown.sectorBalance },
            { label: "Financial Quality", pct: analytics.breakdown.financialQuality },
            { label: "Volatility", pct: analytics.breakdown.volatility }
          ]) +
          "</div>" +

          '<div class="card" style="margin-bottom:var(--space-5)">' +
          "<h3>Sector Allocation</h3>" +
          SvgCharts.renderBarRows(analytics.sectorExposure.map(function (r, i) { return { label: r.sector, pct: r.pct, colorIndex: i, warn: r.sector !== "Cash" && r.pct > CONFIG.SECTOR_WARNING_THRESHOLD * 100 }; })) +
          "</div>" +

          '<div class="card">' +
          '<div class="row-between"><h3>Active Alerts</h3><a href="alerts.html" class="text-muted" style="font-size:var(--font-size-sm)">Manage &rarr;</a></div>' +
          (alerts.filter(function (a) { return a.status === "active"; }).length
            ? alerts.filter(function (a) { return a.status === "active"; }).slice(0, 4).map(function (a) {
              return '<div class="notif-item"><span>' + a.symbol + " · " + RuleEngineLabel(a) + '</span><span class="badge badge-info">Active</span></div>';
            }).join("")
            : '<p class="text-muted">No active alerts. Set stop-loss or target rules from a holding.</p>') +
          "</div>" +
        "</div>" +
      "</div>";
  }

  function statCard(label, value, cls) {
    return '<div class="card"><div class="card-title">' + label + '</div><div class="card-value ' + (cls || "") + '">' + value + "</div></div>";
  }

  // Lightweight local label helper (mirrors RuleEngine.ruleLabel, kept
  // dependency-free here since ruleEngine.js isn't loaded on this page).
  function RuleEngineLabel(a) {
    const map = { stop_loss: "Stop Loss", target: "Target", pct_stop: "Falls " + a.threshold + "%", pct_target: "Rises " + a.threshold + "%", trailing_stop: "Trailing Stop " + a.threshold + "%" };
    return map[a.ruleType] || a.ruleType;
  }
})();
