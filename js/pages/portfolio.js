/**
 * pages/portfolio.js — Holdings table + allocation + sector exposure +
 * portfolio health (spec §33, §36-37).
 */
(function () {
  "use strict";

  document.title = "Portfolio — " + CONFIG.APP_NAME;
  const root = document.getElementById("portfolioContent");
  let sortKey = "currentValue";
  let sortDir = -1;
  let holdings = [];

  root.innerHTML = UI.loadingState("Loading your portfolio...");

  api.getPortfolio().then(function (data) {
    holdings = data.holdings;
    if (!data.confirmed && !holdings.length) {
      root.innerHTML = '<div class="card text-center"><h3>No portfolio yet</h3><p class="text-muted">Build a personalized portfolio to get started, or head to Trade to buy your first stock.</p><a href="recommendations.html" class="btn btn-primary">Get Recommendations</a></div>';
      return;
    }
    render(data);
  }).catch(function (err) {
    root.innerHTML = UI.errorState(err.message);
  });

  function render(data) {
    const totalValue = holdings.reduce(function (s, h) { return s + h.currentValue; }, 0) + data.cash;
    const analytics = PortfolioAnalytics.computeHealth(holdings, data.cash);

    root.innerHTML =
      '<div class="portfolio-top-grid">' +
      '<div class="card">' +
      '<div class="row-between"><h3>Holdings</h3></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      th("Stock", "symbol") + th("Qty", "quantity") + th("Avg Price", "avgPrice") + th("Current Price", "currentPrice") +
      th("Invested", "investedValue") + th("Current Value", "currentValue") + th("P&L", "pnl") + th("Return %", "returnPct") +
      "</tr></thead><tbody id=\"holdingsBody\"></tbody></table></div>" +
      (holdings.length ? "" : '<p class="text-muted">No holdings yet. Visit <a href="trade.html">Trade</a> to buy your first stock.</p>') +
      "</div>" +

      '<div class="card">' +
      '<h3>Portfolio Health</h3>' +
      '<div class="card-value" style="margin-bottom:var(--space-2)">' + analytics.overall + "/100</div>" +
      SvgCharts.renderBarRows([
        { label: "Diversification", pct: analytics.breakdown.diversification },
        { label: "Risk", pct: analytics.breakdown.risk },
        { label: "Sector Balance", pct: analytics.breakdown.sectorBalance },
        { label: "Financial Quality", pct: analytics.breakdown.financialQuality },
        { label: "Volatility", pct: analytics.breakdown.volatility }
      ]) +
      "</div>" +
      "</div>" +

      '<div class="portfolio-top-grid" style="margin-top:var(--space-5)">' +
      '<div class="card"><h3>Sector Allocation</h3>' +
      (analytics.sectorWarning ? '<div class="badge badge-warning" style="margin-bottom:var(--space-3)">One or more sectors exceed the ' + (CONFIG.SECTOR_WARNING_THRESHOLD * 100) + '% concentration guideline</div>' : "") +
      SvgCharts.renderBarRows(analytics.sectorExposure.map(function (r, i) { return { label: r.sector, pct: r.pct, colorIndex: i, warn: r.sector !== "Cash" && r.pct > CONFIG.SECTOR_WARNING_THRESHOLD * 100 }; })) +
      "</div>" +
      '<div class="card"><h3>Allocation</h3><div class="donut-wrap">' +
      SvgCharts.renderDonutChart(holdings.map(function (h) { return { label: h.symbol, value: h.currentValue }; }).concat([{ label: "Cash", value: data.cash }]), { size: 160 }) +
      '<div class="donut-legend">' + holdings.map(function (h, i) {
        return '<div class="donut-legend-item"><span><span class="legend-dot" style="background:' + SvgCharts.colorFor(i) + '"></span>' + h.symbol + '</span><span>' + UI.formatPercent((h.currentValue / totalValue) * 100, 1).replace("+", "") + "</span></div>";
      }).join("") + '<div class="donut-legend-item"><span><span class="legend-dot" style="background:' + SvgCharts.colorFor(holdings.length) + '"></span>Cash</span><span>' + UI.formatPercent((data.cash / totalValue) * 100, 1).replace("+", "") + "</span></div></div>" +
      "</div></div>";

    renderHoldingsBody();
    UI.qsa("th[data-key]", root).forEach(function (h) {
      h.addEventListener("click", function () {
        const key = h.getAttribute("data-key");
        sortDir = sortKey === key ? -sortDir : -1;
        sortKey = key;
        renderHoldingsBody();
      });
    });
  }

  function th(label, key) {
    return '<th data-key="' + key + '" aria-sort="none">' + label + "</th>";
  }

  function renderHoldingsBody() {
    const body = document.getElementById("holdingsBody");
    if (!body) return;
    const sorted = holdings.slice().sort(function (a, b) {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
    body.innerHTML = sorted.map(function (h) {
      return (
        '<tr class="clickable" data-symbol="' + h.symbol + '">' +
        '<td><strong>' + h.symbol + '</strong></td>' +
        '<td>' + h.quantity + "</td>" +
        '<td>' + UI.formatINR(h.avgPrice) + "</td>" +
        '<td>' + UI.formatINR(h.currentPrice) + "</td>" +
        '<td>' + UI.formatINR(h.investedValue, { decimals: 0 }) + "</td>" +
        '<td>' + UI.formatINR(h.currentValue, { decimals: 0 }) + "</td>" +
        '<td class="' + (h.pnl >= 0 ? "text-success" : "text-danger") + '">' + UI.formatINR(h.pnl, { decimals: 0 }) + "</td>" +
        '<td class="' + (h.returnPct >= 0 ? "text-success" : "text-danger") + '">' + UI.formatPercent(h.returnPct) + "</td>" +
        "</tr>"
      );
    }).join("");
    UI.qsa("tr[data-symbol]", body).forEach(function (row) {
      row.addEventListener("click", function () { window.location.href = "stock-detail.html?symbol=" + row.getAttribute("data-symbol"); });
    });
  }
})();
