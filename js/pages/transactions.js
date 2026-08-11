/**
 * pages/transactions.js — Full virtual transaction history.
 */
(function () {
  "use strict";

  document.title = "Transactions — " + CONFIG.APP_NAME;
  const body = document.getElementById("txnBody");
  body.innerHTML = '<tr><td colspan="7">' + UI.loadingState("Loading transactions...") + "</td></tr>";

  api.getTransactions().then(function (txns) {
    if (!txns.length) {
      body.innerHTML = '<tr><td colspan="7">' + UI.emptyState("No transactions yet. Buy or sell a stock to see it here.", '<a href="trade.html" class="btn btn-primary btn-sm">Go to Trade</a>') + "</td></tr>";
      return;
    }
    body.innerHTML = txns.map(function (t) {
      const typeClass = t.type === "BUY" ? "badge-success" : "badge-danger";
      const sourceLabel = { manual: "Manual", recommendation: "Recommendation", rule: "Automated Rule" }[t.source] || t.source;
      return (
        "<tr>" +
        "<td>" + UI.formatDateTime(t.date) + "</td>" +
        '<td><span class="badge ' + typeClass + '">' + t.type + "</span></td>" +
        "<td><strong>" + t.symbol + "</strong></td>" +
        "<td>" + t.qty + "</td>" +
        "<td>" + UI.formatINR(t.price) + "</td>" +
        "<td>" + UI.formatINR(t.total, { decimals: 0 }) + "</td>" +
        "<td>" + sourceLabel + "</td>" +
        "</tr>"
      );
    }).join("");
  }).catch(function (err) {
    body.innerHTML = '<tr><td colspan="7">' + UI.errorState(err.message) + "</td></tr>";
  });
})();
