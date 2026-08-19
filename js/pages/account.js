/**
 * pages/account.js — Profile summary, risk profile recap, virtual
 * account reset, and logout.
 */
(function () {
  "use strict";

  document.title = "Account — " + CONFIG.APP_NAME;
  const session = Store.getSession();
  document.getElementById("resetCashAmount").textContent = UI.formatINR(CONFIG.DEFAULT_VIRTUAL_CASH, { decimals: 0 });

  document.getElementById("profileCard").innerHTML =
    "<h3>Profile</h3>" +
    '<div class="stack-2">' +
    row("Name", session ? session.name : "—") +
    row("Email", session ? session.email : "—") +
    row("Market", CONFIG.MARKET + " (India)") +
    row("Price Data", CONFIG.DEMO_MODE ? "Demo Data" : "Live (Yahoo Finance, when reachable)") +
    row("Fundamentals", CONFIG.DEMO_MODE ? "Demo Data" : "Live (RapidAPI, when reachable)") +
    row("Virtual Account", "Local demo — never real money") +
    "</div>";

  api.getRiskProfile().then(function (profile) {
    const el = document.getElementById("riskCard");
    if (!profile) {
      el.innerHTML = "<h3>Risk Profile</h3><p class=\"text-muted\">Not completed yet.</p><a href=\"onboarding.html\" class=\"btn btn-outline btn-sm\">Start Onboarding</a>";
      return;
    }
    el.innerHTML =
      "<h3>Risk Profile</h3>" +
      '<div class="stack-2">' +
      row("Category", profile.category) +
      row("Risk Score", profile.score + "/100") +
      "</div>" +
      '<a href="onboarding.html" class="btn btn-ghost btn-sm" style="margin-top:var(--space-3)">Retake Questionnaire</a>';
  });

  function row(label, value) {
    return '<div class="row-between"><span class="text-muted">' + label + '</span><span style="font-weight:600">' + UI.escapeHTML(String(value)) + "</span></div>";
  }

  document.getElementById("resetBtn").addEventListener("click", function () {
    if (!window.confirm("This will clear all virtual holdings, cash, transactions and alerts, and cannot be undone. Continue?")) return;
    api.resetAccount().then(function () {
      UI.toast("Virtual account reset.", "success");
      window.location.href = "dashboard.html";
    });
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    api.logout().then(function () { window.location.href = "index.html"; });
  });
})();
