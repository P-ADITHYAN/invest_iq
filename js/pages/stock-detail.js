/**
 * pages/stock-detail.js — Stock detail page: price chart with moving
 * averages, volume, fundamentals, and risk metrics (spec §34).
 */
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const symbol = params.get("symbol");
  const content = document.getElementById("detailContent");

  if (!symbol) {
    content.innerHTML = UI.errorState("No stock selected.");
  } else {
    load();
  }

  function movingAverage(values, window) {
    const out = [];
    for (let i = window - 1; i < values.length; i++) {
      let sum = 0;
      for (let j = i - window + 1; j <= i; j++) sum += values[j];
      out.push(sum / window);
    }
    return out;
  }

  function riskLabel(volatility) {
    if (volatility < 18) return { text: "Low", cls: "badge-success" };
    if (volatility <= 26) return { text: "Moderate", cls: "badge-warning" };
    return { text: "High", cls: "badge-danger" };
  }

  // value may legitimately be null (that field wasn't available from the
  // live provider for this stock) — shown as "N/A" rather than crashing
  // on a null .toFixed() call or fabricating a number.
  function fundamentalRow(label, rawValue, formatter, tipKey) {
    const display = rawValue == null ? "N/A" : formatter(rawValue);
    return (
      '<div class="fundamental-item">' +
      '<div class="label">' + label + (tipKey ? UI.infoTip(AI_TIPS[tipKey] || "") : "") + "</div>" +
      '<div class="value' + (rawValue == null ? " text-subtle" : "") + '">' + display + "</div>" +
      "</div>"
    );
  }

  const AI_TIPS = {
    pe: "Compares share price with earnings per share. Lower can mean cheaper, but context matters.",
    pb: "Compares share price to book value per share.",
    roe: "Return on Equity — profit generated from shareholder capital.",
    debtToEquity: "How much debt the company uses relative to equity. Lower is generally safer.",
    dividendYield: "Annual dividend as a percentage of share price.",
    beta: "Sensitivity to overall market movements. 1.0 moves roughly with the market.",
    volatility: "Annualized size of price swings — higher means bigger ups and downs.",
    revenueGrowth: "Year-over-year growth in total sales.",
    profitGrowth: "Year-over-year growth in net profit."
  };

  function load() {
    content.innerHTML = UI.loadingState("Loading stock data...");
    Promise.all([api.getStock(symbol), api.getHistoricalPrices(symbol), api.getRiskProfile(), api.getStocks()])
      .then(function (results) {
        render(results[0], results[1], results[2], results[3]);
      })
      .catch(function () {
        content.innerHTML = UI.errorState("Couldn't load data for " + symbol + ".", null);
      });
  }

  function render(stock, history, riskProfile, liveStocks) {
    document.title = stock.symbol + " — " + CONFIG.APP_NAME;
    const closes = history.map(function (h) { return h.close; });
    const volumes = history.map(function (h) { return h.volume; });
    const ma20 = movingAverage(closes, 20);
    const ma50 = movingAverage(closes, 50);
    const dayChange = UI.deterministicPseudo(symbol + new Date().toDateString(), -3, 3);
    const risk = riskLabel(stock.volatility);

    // Score against the same live-merged universe the rest of the app
    // uses (recommendations.js, stocks.js) rather than the raw offline
    // DEMO_STOCKS list, so this matches live prices/fundamentals too.
    const scored = ScoringEngine.scoreUniverse(liveStocks, riskProfile ? riskProfile.category : "Moderate");
    const scoredStock = scored.find(function (s) { return s.symbol === symbol; });

    content.innerHTML =
      '<div class="stock-header">' +
      '<div><h1 style="margin-bottom:2px">' + stock.symbol + '</h1><p class="text-muted" style="margin:0">' + UI.escapeHTML(stock.companyName) + ' · ' + stock.sector + ' · ' + stock.exchange + "</p></div>" +
      '<div class="stock-price-block"><div class="card-value">' + UI.formatINR(stock.price) + '</div><div class="' + (dayChange >= 0 ? "text-success" : "text-danger") + '">' + UI.formatPercent(dayChange) + " today</div></div>" +
      "</div>" +

      '<div class="grid grid-4" style="margin-bottom:var(--space-5)">' +
      statCard("52-Week Range", UI.formatINR(stock.low52, { decimals: 0 }) + " – " + UI.formatINR(stock.high52, { decimals: 0 })) +
      statCard("Market Cap", "₹" + UI.formatNumber(stock.marketCap) + " Cr") +
      statCard("Risk Level", '<span class="badge ' + risk.cls + '">' + risk.text + "</span>") +
      statCard("InvestIQ Score", scoredStock ? scoredStock.score + "/100" : "—") +
      "</div>" +

      '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="row-between"><h3>Price History (1Y)</h3></div>' +
      '<div class="legend-row"><span><span class="legend-dot" style="background:var(--color-success)"></span>Close</span><span><span class="legend-dot" style="background:var(--chart-3)"></span>MA 20</span><span><span class="legend-dot" style="background:var(--chart-4)"></span>MA 50</span></div>' +
      SvgCharts.renderLineChart(closes, { overlays: [{ values: ma20, color: "var(--chart-3)" }, { values: ma50, color: "var(--chart-4)", dashed: true }] }) +
      '<h4 style="margin-top:var(--space-4)">Volume</h4>' +
      SvgCharts.renderVolumeChart(volumes) +
      "</div>" +

      '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="row-between"><h3>Fundamentals</h3>' + (stock._fundamentalsLive ? '<span class="badge badge-success">Live</span>' : '<span class="badge badge-neutral">Estimated</span>') + "</div>" +
      '<div class="fundamentals-grid">' +
      fundamentalRow("P/E", stock.pe, function (v) { return v.toFixed(1); }, "pe") +
      fundamentalRow("P/B", stock.pb, function (v) { return v.toFixed(1); }, "pb") +
      fundamentalRow("EPS", stock.eps, function (v) { return UI.formatINR(v); }) +
      fundamentalRow("ROE", stock.roe, function (v) { return v.toFixed(1) + "%"; }, "roe") +
      fundamentalRow("Debt/Equity", stock.debtToEquity, function (v) { return v.toFixed(2); }, "debtToEquity") +
      fundamentalRow("Revenue Growth", stock.revenueGrowth, function (v) { return UI.formatPercent(v); }, "revenueGrowth") +
      fundamentalRow("Profit Growth", stock.profitGrowth, function (v) { return UI.formatPercent(v); }, "profitGrowth") +
      fundamentalRow("Dividend Yield", stock.dividendYield, function (v) { return v.toFixed(1) + "%"; }, "dividendYield") +
      "</div></div>" +

      '<div class="card" style="margin-bottom:var(--space-5)">' +
      "<h3>Risk</h3>" +
      '<div class="fundamentals-grid">' +
      fundamentalRow("Beta", stock.beta, function (v) { return v.toFixed(2); }, "beta") +
      fundamentalRow("Volatility (Annualized)", stock.volatility, function (v) { return v.toFixed(1) + "%"; }, "volatility") +
      "</div></div>" +

      (scoredStock ? explainCard(scoredStock) : "") +

      '<div class="row gap-3">' +
      '<a href="trade.html?symbol=' + stock.symbol + '&side=buy" class="btn btn-primary btn-lg">Virtual Buy</a>' +
      '<a href="trade.html?symbol=' + stock.symbol + '&side=sell" class="btn btn-outline btn-lg">Virtual Sell</a>' +
      "</div>";
  }

  function statCard(label, value) {
    return '<div class="card"><div class="card-title">' + label + '</div><div style="font-weight:700">' + value + "</div></div>";
  }

  function explainCard(scoredStock) {
    const rows = Object.keys(scoredStock.labels).map(function (k) {
      const friendly = { financialStrength: "Financial Strength", growth: "Growth", valuation: "Valuation", risk: "Risk", momentum: "Momentum", profitability: "Profitability", dividend: "Dividend" }[k];
      const badgeClass = { Strong: "badge-success", Good: "badge-info", Fair: "badge-warning", Weak: "badge-danger", "N/A": "badge-neutral" }[scoredStock.labels[k]];
      return '<div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--color-border)"><span>' + friendly + '</span><span class="badge ' + badgeClass + '">' + scoredStock.labels[k] + "</span></div>";
    }).join("");
    return (
      '<div class="card" style="margin-bottom:var(--space-5)"><h3>Why this stock scores ' + scoredStock.score + '/100</h3>' + rows +
      '<p class="text-muted" style="margin-top:var(--space-3)">' + RecommendationEngine.explainStock(scoredStock) + "</p></div>"
    );
  }
})();
