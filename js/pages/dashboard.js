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
      const topHoldings = results[0].holdings.slice(0, 6);
      // Real historical closes per holding (live Yahoo data, with the
      // usual automatic demo fallback inside api.getHistoricalPrices)
      // for the holdings-table trend sparklines — fetched once up front
      // rather than faked with a synthetic series.
      return Promise.all(topHoldings.map(function (h) { return api.getHistoricalPrices(h.symbol).catch(function () { return []; }); }))
        .then(function (histories) { render(results[0], results[1], results[2], results[3], histories); });
    })
    .catch(function (err) {
      root.innerHTML = UI.errorState(err.message);
    });

  function render(portfolio, transactions, alerts, riskProfile, topHoldingsHistory) {
    const holdings = portfolio.holdings;
    const investedTotal = holdings.reduce(function (s, h) { return s + h.investedValue; }, 0);
    const currentHoldingsValue = holdings.reduce(function (s, h) { return s + h.currentValue; }, 0);
    const portfolioValue = currentHoldingsValue + portfolio.cash;
    const totalReturnPct = ((portfolioValue - CONFIG.DEFAULT_VIRTUAL_CASH) / CONFIG.DEFAULT_VIRTUAL_CASH) * 100;

    // Today's P&L = Σ (currentPrice - previousClose) × quantity, using
    // Yahoo's real previous-close for each holding (see api.js/getPortfolio
    // and api/yahoo.js). Holdings priced from demo/offline data carry
    // previousClose = null (there's no real "yesterday" for a demo price),
    // so they're excluded rather than faked — todaysPnlPartial flags that
    // at least one holding's contribution is missing.
    const holdingsWithDayChange = holdings.filter(function (h) { return h.dayChange != null; });
    const todaysPnl = holdingsWithDayChange.reduce(function (sum, h) { return sum + h.dayChange; }, 0);
    const todaysPnlPartial = holdings.length > 0 && holdingsWithDayChange.length < holdings.length;

    if (!holdings.length && !portfolio.confirmed) {
      root.innerHTML =
        '<div class="stat-grid" style="margin-bottom:var(--space-5)">' +
        statCard("Portfolio Value", UI.formatINR(portfolioValue, { decimals: 0 })) +
        statCard("Amount Invested", UI.formatINR(0)) +
        statCard("Today's Change", UI.formatINR(0), "text-muted") +
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
      '<div class="stat-grid stagger" style="margin-bottom:var(--space-5)">' +
      statCard("Portfolio Value", UI.formatINR(portfolioValue, { decimals: 0 }), "", true) +
      statCard("Amount Invested", UI.formatINR(investedTotal, { decimals: 0 })) +
      // Renamed from "Today's P&L" — that name reads as your overall gain/loss,
      // but this is only the price move since yesterday's close (see the
      // dayChange comment above). "Today's Change" makes the "since when"
      // explicit so it isn't mistaken for total return on your holdings.
      statCard("Today's Change" + (holdingsWithDayChange.length === 0 && holdings.length ? " (n/a)" : todaysPnlPartial ? "*" : ""),
        holdingsWithDayChange.length === 0 && holdings.length ? "—" : (todaysPnl >= 0 ? "+" : "") + UI.formatINR(todaysPnl, { decimals: 0 }),
        holdingsWithDayChange.length === 0 && holdings.length ? "text-muted" : (todaysPnl >= 0 ? "text-success" : "text-danger")) +
      statCard("Total Return", UI.formatPercent(totalReturnPct), totalReturnPct >= 0 ? "text-success" : "text-danger") +
      statCard("Available Cash", UI.formatINR(portfolio.cash, { decimals: 0 })) +
      "</div>" +

      '<div class="card anim-fade-in-up" style="margin-bottom:var(--space-5)">' +
      "<h3>Performance</h3>" +
      (cashSeries.length > 1 ? SvgCharts.renderLineChart(cashSeries, { showArea: true }) : '<p class="text-muted">Not enough history yet.</p>') +
      "</div>" +

      '<div class="dashboard-grid">' +
        '<div>' +
          '<div class="card card-hover" style="margin-bottom:var(--space-5)">' +
          '<div class="row-between"><h3>Holdings</h3><a href="portfolio.html" class="text-muted" style="font-size:var(--font-size-sm)">View all &rarr;</a></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Stock</th><th>Qty</th><th>Trend</th><th>Current Value</th><th>P&L</th></tr></thead><tbody>' +
          holdings.slice(0, 6).map(function (h, i) {
            const series = (topHoldingsHistory[i] || []).slice(-30).map(function (p) { return p.close; });
            const spark = series.length > 1 ? series : [h.currentPrice, h.currentPrice];
            return "<tr class=\"clickable\" onclick=\"window.location.href='stock-detail.html?symbol=" + h.symbol + "'\"><td><strong>" + h.symbol + "</strong></td><td>" + h.quantity + "</td>" +
              '<td><span class="sparkline-container">' + SvgCharts.renderSparkline(spark, { color: h.pnl >= 0 ? "var(--color-success)" : "var(--color-danger)" }) + "</span></td>" +
              "<td>" + UI.formatINR(h.currentValue, { decimals: 0 }) + '</td><td class="' + (h.pnl >= 0 ? "text-success" : "text-danger") + '">' + UI.formatINR(h.pnl, { decimals: 0 }) + "</td></tr>";
          }).join("") +
          "</tbody></table></div>" +
          (holdings.length ? "" : '<p class="text-muted">No holdings yet.</p>') +
          "</div>" +

          '<div class="card card-hover">' +
          '<div class="row-between"><h3>Recent Transactions</h3><a href="transactions.html" class="text-muted" style="font-size:var(--font-size-sm)">View all &rarr;</a></div>' +
          (transactions.length ? transactions.slice(0, 5).map(function (t) {
            const badgeCls = t.type === "BUY" ? "badge-success" : "badge-danger";
            return '<div class="notif-item"><span><span class="badge ' + badgeCls + '">' + t.type + '</span> ' + t.qty + " " + t.symbol + '</span><span class="text-muted">' + UI.formatDate(t.date) + "</span></div>";
          }).join("") : '<p class="text-muted">No transactions yet.</p>') +
          "</div>" +
        "</div>" +

        '<div>' +
          '<div class="card card-hover" style="margin-bottom:var(--space-5);text-align:center">' +
          '<div class="row-between" style="text-align:left"><h3>Portfolio Health</h3></div>' +
          '<span class="score-ring">' + SvgCharts.renderScoreRing(analytics.overall) + '<span class="score-ring-value">' + analytics.overall + "</span></span>" +
          '<div class="score-ring-label">out of 100</div>' +
          '<div style="text-align:left;margin-top:var(--space-4)">' +
          SvgCharts.renderBarRows([
            { label: "Diversification", pct: analytics.breakdown.diversification },
            { label: "Risk", pct: analytics.breakdown.risk },
            { label: "Sector Balance", pct: analytics.breakdown.sectorBalance },
            { label: "Financial Quality", pct: analytics.breakdown.financialQuality },
            { label: "Volatility", pct: analytics.breakdown.volatility }
          ]) +
          "</div></div>" +

          '<div class="card card-hover" style="margin-bottom:var(--space-5)">' +
          "<h3>Sector Allocation</h3>" +
          SvgCharts.renderBarRows(analytics.sectorExposure.map(function (r, i) { return { label: r.sector, pct: r.pct, colorIndex: i, warn: r.sector !== "Cash" && r.pct > CONFIG.SECTOR_WARNING_THRESHOLD * 100 }; })) +
          "</div>" +

          '<div class="card card-hover">' +
          '<div class="row-between"><h3>Active Alerts</h3><a href="alerts.html" class="text-muted" style="font-size:var(--font-size-sm)">Manage &rarr;</a></div>' +
          (alerts.filter(function (a) { return a.status === "active"; }).length
            ? alerts.filter(function (a) { return a.status === "active"; }).slice(0, 4).map(function (a) {
              return '<div class="notif-item"><span><span class="badge-dot warning" style="margin-right:6px"></span>' + a.symbol + " · " + RuleEngineLabel(a) + '</span><span class="badge badge-info">Active</span></div>';
            }).join("")
            : '<p class="text-muted">No active alerts. Set stop-loss or target rules from a holding.</p>') +
          "</div>" +
        "</div>" +
      "</div>";
  }

  function statCard(label, value, cls, accent) {
    return '<div class="card anim-fade-in-up' + (accent ? " card-accent" : " card-hover") + '"><div class="card-title">' + label + '</div><div class="card-value ' + (cls || "") + '">' + value + "</div></div>";
  }

  // Lightweight local label helper (mirrors RuleEngine.ruleLabel, kept
  // dependency-free here since ruleEngine.js isn't loaded on this page).
  function RuleEngineLabel(a) {
    const map = { stop_loss: "Stop Loss", target: "Target", pct_stop: "Falls " + a.threshold + "%", pct_target: "Rises " + a.threshold + "%", trailing_stop: "Trailing Stop " + a.threshold + "%" };
    return map[a.ruleType] || a.ruleType;
  }
})();
