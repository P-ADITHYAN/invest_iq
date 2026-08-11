/**
 * pages/alerts.js — Automated rule creation/list + demo price-simulation
 * control that exercises RuleEngine end-to-end (spec §38-41).
 */
(function () {
  "use strict";

  document.title = "Alerts — " + CONFIG.APP_NAME;
  let holdings = [];
  let alerts = [];
  let activeTab = "active";

  function loadAll() {
    return Promise.all([api.getPortfolio(), api.getAlerts()]).then(function (results) {
      holdings = results[0].holdings;
      alerts = results[1];
      populateSelects();
      renderList();
    });
  }

  function populateSelects() {
    const opts = holdings.map(function (h) { return '<option value="' + h.symbol + '">' + h.symbol + " (" + h.quantity + " shares)</option>"; }).join("");
    const ruleStock = document.getElementById("ruleStock");
    const simStock = document.getElementById("simStock");
    ruleStock.innerHTML = opts || '<option value="">No holdings yet</option>';
    simStock.innerHTML = opts || '<option value="">No holdings yet</option>';
    if (holdings.length) document.getElementById("simPrice").value = holdings[0].currentPrice;
  }

  document.getElementById("ruleType").addEventListener("change", function () {
    const label = document.getElementById("thresholdLabel");
    const isPct = this.value.indexOf("pct") === 0 || this.value === "trailing_stop";
    label.textContent = isPct ? "Threshold (%)" : "Trigger Price (₹)";
  });

  document.getElementById("simStock").addEventListener("change", function () {
    const selected = this.value;
    const h = holdings.find(function (x) { return x.symbol === selected; });
    if (h) document.getElementById("simPrice").value = h.currentPrice;
  });

  function renderList() {
    const list = document.getElementById("alertsList");
    let filtered;
    if (activeTab === "active") filtered = alerts.filter(function (a) { return a.status === "active"; });
    else filtered = alerts.filter(function (a) { return a.status === "triggered"; }); // Triggered and Completed share the same terminal state in this demo (see ruleEngine.js)

    if (!filtered.length) {
      list.innerHTML = UI.emptyState(activeTab === "active" ? "No active rules. Create one for a stock you hold." : "Nothing here yet.");
      return;
    }

    list.innerHTML = filtered.map(function (a) {
      return (
        '<div class="alert-row">' +
        '<div><strong>' + a.symbol + '</strong><div class="text-muted" style="font-size:var(--font-size-xs)">' + RuleEngine.ruleLabel(a) + "</div></div>" +
        '<div class="text-muted" style="font-size:var(--font-size-xs)">' + UI.formatDate(a.createdAt) + "</div>" +
        (a.status === "active" ? '<span class="badge badge-info">Active</span><button class="btn btn-ghost btn-sm delete-alert-btn" data-id="' + a.id + '">Delete</button>' :
          '<span class="badge badge-success">Triggered @ ' + UI.formatINR(a.triggerPrice) + "</span>") +
        "</div>"
      );
    }).join("");

    UI.qsa(".delete-alert-btn", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        api.deleteAlert(btn.getAttribute("data-id")).then(loadAll);
      });
    });
  }

  UI.qsa(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      UI.qsa(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-tab");
      renderList();
    });
  });

  document.getElementById("createRuleBtn").addEventListener("click", function () {
    const errorEl = document.getElementById("createError");
    errorEl.hidden = true;
    const symbol = document.getElementById("ruleStock").value;
    const ruleType = document.getElementById("ruleType").value;
    const threshold = Number(document.getElementById("thresholdInput").value);

    if (!symbol) { errorEl.textContent = "You need at least one holding to create a rule."; errorEl.hidden = false; return; }
    if (!threshold || threshold <= 0) { errorEl.textContent = "Enter a valid threshold."; errorEl.hidden = false; return; }

    api.createAlert({ symbol: symbol, ruleType: ruleType, threshold: threshold }).then(function () {
      UI.toast("Rule created for " + symbol, "success");
      document.getElementById("thresholdInput").value = "";
      loadAll();
    }).catch(function (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    });
  });

  document.getElementById("simulateBtn").addEventListener("click", function () {
    const symbol = document.getElementById("simStock").value;
    const price = Number(document.getElementById("simPrice").value);
    if (!symbol || !price) return;

    api.simulatePriceUpdate(symbol, price).then(function (result) {
      if (result.triggeredRules.length) {
        result.triggeredRules.forEach(function (t) {
          UI.toast(symbol + " " + RuleEngine.ruleLabel(t.rule) + " triggered — position sold.", "warning");
        });
      } else {
        UI.toast("Price updated. No rules triggered.", "success");
      }
      loadAll();
    });
  });

  loadAll();
})();
