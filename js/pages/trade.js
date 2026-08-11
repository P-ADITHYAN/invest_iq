/**
 * pages/trade.js — Virtual Buy/Sell flow (spec §30-31), including all
 * ten validation/execution steps for each direction.
 */
(function () {
  "use strict";

  document.title = "Trade — " + CONFIG.APP_NAME;
  const params = new URLSearchParams(window.location.search);

  let side = params.get("side") === "sell" ? "sell" : "buy";
  let stocks = [];
  let holdings = {};
  let cash = 0;

  const stockSelect = document.getElementById("stockSelect");
  const qtyInput = document.getElementById("qtyInput");
  const submitBtn = document.getElementById("submitTradeBtn");

  function setTab(next) {
    side = next;
    document.getElementById("buyTab").classList.toggle("active", side === "buy");
    document.getElementById("sellTab").classList.toggle("active", side === "sell");
    submitBtn.textContent = side === "buy" ? "Buy" : "Sell";
    submitBtn.className = "btn btn-block btn-lg " + (side === "buy" ? "btn-primary" : "btn-danger");
    updateSummary();
  }
  document.getElementById("buyTab").addEventListener("click", function () { setTab("buy"); });
  document.getElementById("sellTab").addEventListener("click", function () { setTab("sell"); });

  function loadData() {
    return Promise.all([api.getStocks(), api.getPortfolio()]).then(function (results) {
      stocks = results[0];
      cash = results[1].cash;
      holdings = {};
      results[1].holdings.forEach(function (h) { holdings[h.symbol] = h; });

      stockSelect.innerHTML = stocks.map(function (s) {
        return '<option value="' + s.symbol + '">' + s.symbol + " — " + UI.escapeHTML(s.companyName) + "</option>";
      }).join("");
      const preselect = params.get("symbol");
      if (preselect && stocks.some(function (s) { return s.symbol === preselect; })) stockSelect.value = preselect;
      updateSummary();
    });
  }

  function currentStock() {
    return stocks.find(function (s) { return s.symbol === stockSelect.value; });
  }

  function updateSummary() {
    const stock = currentStock();
    if (!stock) return;
    const qty = Math.max(0, Math.floor(Number(qtyInput.value) || 0));
    document.getElementById("summaryPrice").textContent = UI.formatINR(stock.price);
    document.getElementById("summaryTotal").textContent = UI.formatINR(qty * stock.price);
    document.getElementById("summaryCash").textContent = UI.formatINR(cash);
    const owned = holdings[stock.symbol];
    const ownedRow = document.getElementById("ownedRow");
    if (side === "sell") {
      ownedRow.hidden = false;
      document.getElementById("summaryOwned").textContent = owned ? owned.quantity + " shares" : "0 shares";
    } else {
      ownedRow.hidden = true;
    }
    document.getElementById("stockPreview").textContent = stock.sector + " · P/E " + stock.pe.toFixed(1) + " · 52W " + UI.formatINR(stock.low52, { decimals: 0 }) + "-" + UI.formatINR(stock.high52, { decimals: 0 });
  }

  stockSelect.addEventListener("change", updateSummary);
  qtyInput.addEventListener("input", updateSummary);

  submitBtn.addEventListener("click", function () {
    const errorEl = document.getElementById("formError");
    const qtyErrorEl = document.getElementById("qtyError");
    errorEl.hidden = true; qtyErrorEl.hidden = true;

    const stock = currentStock();
    const qty = Math.floor(Number(qtyInput.value));

    if (!qty || qty <= 0) { qtyErrorEl.textContent = "Enter a quantity greater than zero."; qtyErrorEl.hidden = false; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = side === "buy" ? "Placing order..." : "Placing order...";

    const action = side === "buy" ? api.buyStock(stock.symbol, qty, stock.price) : api.sellStock(stock.symbol, qty, stock.price);
    action.then(function (result) {
      UI.toast((side === "buy" ? "Bought " : "Sold ") + qty + " " + stock.symbol + " @ " + UI.formatINR(stock.price), "success");
      cash = result.account.cash;
      holdings = {};
      Object.keys(result.account.holdings).forEach(function (sym) {
        const h = result.account.holdings[sym];
        holdings[sym] = { symbol: sym, quantity: h.quantity, avgPrice: h.avgPrice };
      });
      qtyInput.value = 1;
      updateSummary();
      submitBtn.disabled = false;
      setTab(side);
    }).catch(function (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      setTab(side);
    });
  });

  loadData().then(function () { setTab(side); }).catch(function (err) {
    document.getElementById("formError").textContent = err.message;
    document.getElementById("formError").hidden = false;
  });
})();
