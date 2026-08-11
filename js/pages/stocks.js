/**
 * pages/stocks.js — Stock discovery page (search, filter, sort).
 */
(function () {
  "use strict";

  document.title = "Stocks — " + CONFIG.APP_NAME;
  const tbody = document.getElementById("stocksTableBody");
  let allScored = [];

  function riskLabel(stock) {
    if (stock.volatility < 18) return "Low";
    if (stock.volatility <= 26) return "Moderate";
    return "High";
  }

  function capBand(marketCap) {
    if (marketCap >= 200000) return "Large";
    if (marketCap >= 50000) return "Mid";
    return "Small";
  }

  function dayChange(symbol) {
    return UI.deterministicPseudo(symbol + new Date().toDateString(), -3, 3);
  }

  function populateSectorFilter() {
    const select = document.getElementById("sectorFilter");
    select.innerHTML = MarketDataService.getSectors().map(function (s) {
      return '<option value="' + s + '">' + (s === "All" ? "All Sectors" : s) + "</option>";
    }).join("");
  }

  function applyFiltersAndRender() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const sector = document.getElementById("sectorFilter").value;
    const risk = document.getElementById("riskFilter").value;
    const cap = document.getElementById("capFilter").value;
    const sort = document.getElementById("sortSelect").value;

    let rows = allScored.filter(function (s) {
      if (search && s.symbol.toLowerCase().indexOf(search) === -1 && s.companyName.toLowerCase().indexOf(search) === -1) return false;
      if (sector !== "All" && s.sector !== sector) return false;
      if (risk !== "All" && riskLabel(s) !== risk) return false;
      if (cap !== "All" && capBand(s.marketCap) !== cap) return false;
      return true;
    });

    rows.sort(function (a, b) {
      if (sort === "price") return b.price - a.price;
      if (sort === "growth") return b.subScores.growth - a.subScores.growth;
      if (sort === "valuation") return b.subScores.valuation - a.subScores.valuation;
      return b.score - a.score;
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7">' + UI.emptyState("No stocks match your filters. Try adjusting search or filters.") + "</td></tr>";
      return;
    }

    tbody.innerHTML = rows.map(function (s) {
      const chg = dayChange(s.symbol);
      const chgClass = chg >= 0 ? "text-success" : "text-danger";
      const rl = riskLabel(s);
      return (
        '<tr class="clickable" data-symbol="' + s.symbol + '">' +
        '<td><div class="stock-symbol-cell"><strong>' + s.symbol + '</strong><span class="company">' + UI.escapeHTML(s.companyName) + '</span></div></td>' +
        '<td>' + UI.formatINR(s.price) + "</td>" +
        '<td class="' + chgClass + '">' + UI.formatPercent(chg) + "</td>" +
        '<td><span class="badge badge-neutral">' + s.score + '/100</span></td>' +
        '<td>' + s.sector + "</td>" +
        '<td class="risk-pill-' + rl + '">' + rl + "</td>" +
        '<td>' + s.pe.toFixed(1) + "</td>" +
        "</tr>"
      );
    }).join("");

    UI.qsa("tr[data-symbol]", tbody).forEach(function (row) {
      row.addEventListener("click", function () {
        window.location.href = "stock-detail.html?symbol=" + row.getAttribute("data-symbol");
      });
    });
  }

  tbody.innerHTML = '<tr><td colspan="7">' + UI.loadingState("Loading stock universe...") + "</td></tr>";
  populateSectorFilter();

  Promise.all([api.getStocks(), api.getRiskProfile()]).then(function (results) {
    const stocks = results[0];
    const profile = results[1];
    allScored = ScoringEngine.scoreUniverse(stocks, profile ? profile.category : "Moderate");
    applyFiltersAndRender();
  }).catch(function (err) {
    tbody.innerHTML = '<tr><td colspan="7">' + UI.errorState(err.message) + "</td></tr>";
  });

  ["searchInput", "sectorFilter", "riskFilter", "capFilter", "sortSelect"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", applyFiltersAndRender);
    document.getElementById(id).addEventListener("change", applyFiltersAndRender);
  });
})();
