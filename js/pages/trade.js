/**
 * pages/trade.js — Virtual Buy/Sell flow (spec §30-31), including all
 * ten validation/execution steps for each direction, plus a searchable
 * stock combobox, quick allocation shortcuts, a price sparkline preview,
 * and an inline order-confirmation card.
 */
(function () {
  "use strict";

  document.title = "Trade — " + CONFIG.APP_NAME;
  const params = new URLSearchParams(window.location.search);

  let side = params.get("side") === "sell" ? "sell" : "buy";
  let stocks = [];
  let holdings = {};
  let cash = 0;
  let selectedSymbol = params.get("symbol") || null;

  const searchInput = document.getElementById("stockSearchInput");
  const comboList = document.getElementById("stockComboboxList");
  const qtyInput = document.getElementById("qtyInput");
  const submitBtn = document.getElementById("submitTradeBtn");
  const formArea = document.getElementById("tradeFormArea");
  const successArea = document.getElementById("tradeSuccessArea");

  function setTab(next) {
    side = next;
    document.getElementById("buyTab").classList.toggle("active", side === "buy");
    document.getElementById("sellTab").classList.toggle("active", side === "sell");
    submitBtn.textContent = side === "buy" ? "Buy" : "Sell";
    submitBtn.className = "btn btn-block btn-lg " + (side === "buy" ? "btn-primary" : "btn-danger");
    renderQuickAllocButtons();
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

      if (!selectedSymbol || !stocks.some(function (s) { return s.symbol === selectedSymbol; })) {
        selectedSymbol = stocks.length ? stocks[0].symbol : null;
      }
      syncSearchInputToSelection();
      updateSummary();
    });
  }

  function currentStock() {
    return stocks.find(function (s) { return s.symbol === selectedSymbol; });
  }

  // ---------------- Searchable combobox ----------------
  function syncSearchInputToSelection() {
    const stock = currentStock();
    searchInput.value = stock ? stock.symbol + " — " + stock.companyName : "";
  }

  function renderComboList(query) {
    const q = (query || "").trim().toLowerCase();
    const filtered = !q ? stocks : stocks.filter(function (s) {
      return s.symbol.toLowerCase().indexOf(q) !== -1 || s.companyName.toLowerCase().indexOf(q) !== -1;
    });

    if (!filtered.length) {
      comboList.innerHTML = '<div class="combobox-empty">No stocks match "' + UI.escapeHTML(query) + '"</div>';
    } else {
      comboList.innerHTML = filtered.slice(0, 30).map(function (s) {
        return (
          '<div class="combobox-item" data-symbol="' + s.symbol + '">' +
          "<strong>" + s.symbol + "</strong>" +
          '<span class="company">' + UI.escapeHTML(s.companyName) + "</span>" +
          "</div>"
        );
      }).join("");
    }
    comboList.hidden = false;

    UI.qsa(".combobox-item", comboList).forEach(function (item) {
      item.addEventListener("mousedown", function (e) {
        e.preventDefault(); // keep focus from leaving the input before click registers
        selectedSymbol = item.getAttribute("data-symbol");
        syncSearchInputToSelection();
        comboList.hidden = true;
        renderQuickAllocButtons();
        updateSummary();
      });
    });
  }

  searchInput.addEventListener("focus", function () { renderComboList(""); });
  searchInput.addEventListener("input", function () { renderComboList(searchInput.value); });
  searchInput.addEventListener("blur", function () {
    // Slight delay so a pending mousedown-select still fires first.
    setTimeout(function () { comboList.hidden = true; syncSearchInputToSelection(); }, 120);
  });

  // ---------------- Quick allocation shortcuts ----------------
  function renderQuickAllocButtons() {
    const row = document.getElementById("quickAllocRow");
    const stock = currentStock();
    if (!stock) { row.innerHTML = ""; return; }

    let presets;
    if (side === "buy") {
      presets = [
        { label: "25%", qty: function () { return Math.floor((cash * 0.25) / stock.price); } },
        { label: "50%", qty: function () { return Math.floor((cash * 0.5) / stock.price); } },
        { label: "75%", qty: function () { return Math.floor((cash * 0.75) / stock.price); } },
        { label: "Max", qty: function () { return Math.floor(cash / stock.price); } }
      ];
    } else {
      const owned = holdings[stock.symbol] ? holdings[stock.symbol].quantity : 0;
      presets = [
        { label: "25%", qty: function () { return Math.floor(owned * 0.25); } },
        { label: "50%", qty: function () { return Math.floor(owned * 0.5); } },
        { label: "75%", qty: function () { return Math.floor(owned * 0.75); } },
        { label: "All", qty: function () { return owned; } }
      ];
    }

    row.innerHTML = presets.map(function (p) {
      return '<button type="button" class="quick-alloc-btn" data-preset="' + p.label + '">' + p.label + "</button>";
    }).join("");

    UI.qsa(".quick-alloc-btn", row).forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        qtyInput.value = Math.max(0, presets[i].qty());
        updateSummary();
      });
    });
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

    const spark = DemoHistorical.getSeriesFor(stock.symbol, stock.price).slice(-30).map(function (p) { return p.close; });
    document.getElementById("tradePreviewSpark").innerHTML = SvgCharts.renderSparkline(spark, { color: spark[spark.length - 1] >= spark[0] ? "var(--color-success)" : "var(--color-danger)" });
  }

  qtyInput.addEventListener("input", updateSummary);

  submitBtn.addEventListener("click", function () {
    const errorEl = document.getElementById("formError");
    const qtyErrorEl = document.getElementById("qtyError");
    errorEl.hidden = true; qtyErrorEl.hidden = true;

    const stock = currentStock();
    const qty = Math.floor(Number(qtyInput.value));

    if (!stock) { errorEl.textContent = "Select a stock first."; errorEl.hidden = false; return; }
    if (!qty || qty <= 0) { qtyErrorEl.textContent = "Enter a quantity greater than zero."; qtyErrorEl.hidden = false; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Placing order...";

    const action = side === "buy" ? api.buyStock(stock.symbol, qty, stock.price) : api.sellStock(stock.symbol, qty, stock.price);
    action.then(function (result) {
      cash = result.account.cash;
      holdings = {};
      Object.keys(result.account.holdings).forEach(function (sym) {
        const h = result.account.holdings[sym];
        holdings[sym] = { symbol: sym, quantity: h.quantity, avgPrice: h.avgPrice };
      });
      showSuccess(side, stock, qty, result.transaction);
      submitBtn.disabled = false;
    }).catch(function (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      setTab(side);
    });
  });

  // ---------------- Success confirmation card ----------------
  function showSuccess(executedSide, stock, qty, txn) {
    UI.toast((executedSide === "buy" ? "Bought " : "Sold ") + qty + " " + stock.symbol + " @ " + UI.formatINR(stock.price), "success");

    const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';

    successArea.innerHTML =
      '<div class="trade-success-card">' +
      '<div class="trade-success-icon">' + checkIcon + "</div>" +
      "<h3>" + (executedSide === "buy" ? "Order Placed — Bought" : "Order Placed — Sold") + "</h3>" +
      '<p class="text-muted">' + qty + " shares of " + stock.symbol + " at " + UI.formatINR(stock.price) + " per share.</p>" +
      '<div class="trade-success-details">' +
      '<div class="trade-summary-row"><span>Total ' + (executedSide === "buy" ? "Paid" : "Received") + '</span><span>' + UI.formatINR(txn.total, { decimals: 0 }) + "</span></div>" +
      '<div class="trade-summary-row"><span>Available Cash Now</span><span>' + UI.formatINR(cash, { decimals: 0 }) + "</span></div>" +
      "</div>" +
      '<div class="row gap-3" style="justify-content:center">' +
      '<button type="button" class="btn btn-primary" id="placeAnotherBtn">Place Another Order</button>' +
      '<a href="portfolio.html" class="btn btn-outline">View Portfolio</a>' +
      "</div></div>";

    formArea.hidden = true;
    successArea.hidden = false;

    document.getElementById("placeAnotherBtn").addEventListener("click", function () {
      successArea.hidden = true;
      formArea.hidden = false;
      qtyInput.value = 1;
      renderQuickAllocButtons();
      updateSummary();
    });
  }

  loadData().then(function () { setTab(side); }).catch(function (err) {
    document.getElementById("formError").textContent = err.message;
    document.getElementById("formError").hidden = false;
  });
})();
