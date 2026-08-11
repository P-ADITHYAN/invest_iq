/**
 * api.js — The single API abstraction every page talks to.
 *
 * Pages never call `fetch()`, `localStorage`, or the engines directly —
 * they call `api.*`. Every function returns a Promise, even in demo mode,
 * so page code is already shaped correctly for a real backend: swapping
 * CONFIG.DEMO_MODE to false and filling in these function bodies with
 * `fetch(CONFIG.API_BASE_URL + "/...")` calls is the only change required.
 *
 * Demo-mode implementation notes:
 * - Auth is a local, non-cryptographic demo (password is lightly hashed
 *   with a simple string hash — NOT secure, NOT for production use).
 * - All account data (cash, holdings, transactions, alerts,
 *   notifications, risk profile) is namespaced per user id in
 *   localStorage via state.js and is authoritative only for this demo;
 *   a real deployment must compute balances/holdings server-side and
 *   never trust client-submitted values.
 */
(function (global) {
  "use strict";

  function delay(value) {
    // Simulated network latency so loading states are visibly exercised
    // even in demo mode, without ever feeling sluggish.
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, 120); });
  }

  function fail(message) {
    return Promise.reject(new Error(message));
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  function newId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function defaultAccount() {
    return {
      cash: CONFIG.DEFAULT_VIRTUAL_CASH,
      holdings: {},           // symbol -> { quantity, avgPrice }
      transactions: [],       // { id, type, symbol, qty, price, total, date }
      alerts: [],             // { id, symbol, ruleType, params, status, createdAt, highestPrice }
      notifications: [],      // { id, type, title, message, date, read }
      riskProfile: null,
      onboardingAnswers: null,
      portfolioDraft: null,   // pending recommendation, not yet confirmed
      portfolioConfirmed: false,
      realizedPnL: 0
    };
  }

  function requireSession() {
    const session = Store.getSession();
    if (!session) return null;
    return session;
  }

  function getAccountOrInit(userId) {
    let account = Store.getAccount(userId);
    if (!account) {
      account = defaultAccount();
      Store.setAccount(userId, account);
    }
    return account;
  }

  function saveAccount(userId, account) {
    Store.setAccount(userId, account);
    return account;
  }

  // =====================================================================
  // AUTH
  // =====================================================================
  function signup(name, email, password) {
    if (!CONFIG.DEMO_MODE) return fail("Live signup API not configured.");
    email = String(email || "").trim().toLowerCase();
    if (!name || !name.trim()) return fail("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please enter a valid email address.");
    if (!password || password.length < 6) return fail("Password must be at least 6 characters.");

    const users = Store.getUsers();
    if (users[email]) return fail("An account with this email already exists.");

    const userId = newId("user");
    users[email] = { userId: userId, name: name.trim(), email: email, passwordHash: simpleHash(password) };
    Store.setUsers(users);
    Store.setAccount(userId, defaultAccount());

    const session = { userId: userId, email: email, name: name.trim(), token: newId("tok") };
    Store.setSession(session);
    return delay(session);
  }

  function login(email, password) {
    if (!CONFIG.DEMO_MODE) return fail("Live login API not configured.");
    email = String(email || "").trim().toLowerCase();
    const users = Store.getUsers();
    const user = users[email];
    if (!user || user.passwordHash !== simpleHash(password || "")) {
      return fail("Incorrect email or password.");
    }
    const session = { userId: user.userId, email: user.email, name: user.name, token: newId("tok") };
    Store.setSession(session);
    return delay(session);
  }

  function logout() {
    Store.clearSession();
    return delay(true);
  }

  function getCurrentUser() {
    return delay(requireSession());
  }

  // =====================================================================
  // MARKET DATA (delegated to MarketDataService, see js/marketData.js)
  // =====================================================================
  function getStocks(filters) { return MarketDataService.getStocks(filters); }
  function getStock(symbol) { return MarketDataService.getStock(symbol); }
  function getHistoricalPrices(symbol, range) { return MarketDataService.getHistoricalPrices(symbol, range); }
  function getFundamentals(symbol) { return MarketDataService.getFundamentals(symbol); }

  // =====================================================================
  // ONBOARDING / RISK PROFILE
  // =====================================================================
  function saveOnboardingAnswers(answers) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    const riskProfile = RiskEngine.computeRiskProfile(answers);
    account.onboardingAnswers = answers;
    account.riskProfile = riskProfile;
    account.portfolioDraft = null;
    account.portfolioConfirmed = false;
    saveAccount(session.userId, account);
    return delay(riskProfile);
  }

  function getRiskProfile() {
    const session = requireSession();
    if (!session) return delay(null);
    const account = getAccountOrInit(session.userId);
    return delay(account.riskProfile);
  }

  // =====================================================================
  // RECOMMENDATIONS / PORTFOLIO CONSTRUCTION
  // =====================================================================
  function getRecommendations() {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    if (!account.riskProfile || !account.onboardingAnswers) {
      return fail("Complete onboarding before viewing recommendations.");
    }
    return MarketDataService.getStocks().then(function (stocks) {
      const scored = ScoringEngine.scoreUniverse(stocks, account.riskProfile.category);
      const draft = RecommendationEngine.buildPortfolio({
        budget: account.onboardingAnswers.budget,
        riskCategory: account.riskProfile.category,
        scoredStocks: scored
      });
      account.portfolioDraft = draft;
      saveAccount(session.userId, account);
      return draft;
    });
  }

  function updatePortfolioDraft(draft) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    account.portfolioDraft = draft;
    saveAccount(session.userId, account);
    return delay(draft);
  }

  function confirmPortfolio(draft) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    if (account.portfolioConfirmed) return fail("Portfolio already built. Use Trade to make changes.");

    const totalAllocated = draft.positions.reduce(function (sum, p) { return sum + p.shares * p.price; }, 0);
    if (totalAllocated > account.cash + 0.01) {
      return fail("Draft exceeds available virtual cash.");
    }

    draft.positions.forEach(function (p) {
      if (p.shares <= 0) return;
      const existing = account.holdings[p.symbol];
      const cost = p.shares * p.price;
      if (existing) {
        const newQty = existing.quantity + p.shares;
        existing.avgPrice = (existing.avgPrice * existing.quantity + cost) / newQty;
        existing.quantity = newQty;
      } else {
        account.holdings[p.symbol] = { quantity: p.shares, avgPrice: p.price };
      }
      account.cash -= cost;
      account.transactions.unshift({
        id: newId("txn"), type: "BUY", symbol: p.symbol, qty: p.shares, price: p.price,
        total: cost, date: new Date().toISOString(), source: "recommendation"
      });
    });

    account.portfolioConfirmed = true;
    account.portfolioDraft = null;
    account.notifications.unshift(notif("recommendation", "Portfolio built", "Your personalized virtual portfolio has been created."));
    saveAccount(session.userId, account);
    return delay(account);
  }

  // =====================================================================
  // VIRTUAL TRADING
  // =====================================================================
  function notif(type, title, message) {
    return { id: newId("ntf"), type: type, title: title, message: message, date: new Date().toISOString(), read: false };
  }

  function buyStock(symbol, quantity, price) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    quantity = Math.floor(Number(quantity));
    if (!symbol) return fail("Select a stock to buy.");
    if (!quantity || quantity <= 0) return fail("Enter a valid quantity greater than zero.");
    if (!price || price <= 0) return fail("Invalid market price.");

    const account = getAccountOrInit(session.userId);
    const total = quantity * price;
    if (total > account.cash + 0.01) return fail("Insufficient virtual cash for this order.");

    const existing = account.holdings[symbol];
    if (existing) {
      const newQty = existing.quantity + quantity;
      existing.avgPrice = (existing.avgPrice * existing.quantity + total) / newQty;
      existing.quantity = newQty;
    } else {
      account.holdings[symbol] = { quantity: quantity, avgPrice: price };
    }
    account.cash -= total;
    const txn = { id: newId("txn"), type: "BUY", symbol: symbol, qty: quantity, price: price, total: total, date: new Date().toISOString(), source: "manual" };
    account.transactions.unshift(txn);
    saveAccount(session.userId, account);
    return delay({ account: account, transaction: txn });
  }

  function sellStock(symbol, quantity, price) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    quantity = Math.floor(Number(quantity));
    const account = getAccountOrInit(session.userId);
    const holding = account.holdings[symbol];

    if (!holding || holding.quantity <= 0) return fail("You do not own any shares of this stock.");
    if (!quantity || quantity <= 0) return fail("Enter a valid quantity greater than zero.");
    if (quantity > holding.quantity) return fail("You only own " + holding.quantity + " shares.");
    if (!price || price <= 0) return fail("Invalid market price.");

    const total = quantity * price;
    const realized = (price - holding.avgPrice) * quantity;
    holding.quantity -= quantity;
    if (holding.quantity === 0) delete account.holdings[symbol];
    account.cash += total;
    account.realizedPnL = (account.realizedPnL || 0) + realized;

    const txn = { id: newId("txn"), type: "SELL", symbol: symbol, qty: quantity, price: price, total: total, realizedPnL: realized, date: new Date().toISOString(), source: "manual" };
    account.transactions.unshift(txn);
    saveAccount(session.userId, account);
    return delay({ account: account, transaction: txn });
  }

  function getPortfolio() {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    return MarketDataService.getStocks().then(function (stocks) {
      const priceMap = {};
      stocks.forEach(function (s) { priceMap[s.symbol] = s; });
      const holdings = Object.keys(account.holdings).map(function (symbol) {
        const h = account.holdings[symbol];
        const stock = priceMap[symbol] || {};
        const currentPrice = stock.price || h.avgPrice;
        const investedValue = h.avgPrice * h.quantity;
        const currentValue = currentPrice * h.quantity;
        return {
          symbol: symbol,
          companyName: stock.companyName || symbol,
          sector: stock.sector || "Unknown",
          quantity: h.quantity,
          avgPrice: h.avgPrice,
          currentPrice: currentPrice,
          investedValue: investedValue,
          currentValue: currentValue,
          pnl: currentValue - investedValue,
          returnPct: investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0
        };
      });
      return { cash: account.cash, holdings: holdings, realizedPnL: account.realizedPnL || 0, confirmed: account.portfolioConfirmed };
    });
  }

  function getTransactions() {
    const session = requireSession();
    if (!session) return delay([]);
    const account = getAccountOrInit(session.userId);
    return delay(account.transactions);
  }

  // =====================================================================
  // ALERTS / RULES
  // =====================================================================
  function getAlerts() {
    const session = requireSession();
    if (!session) return delay([]);
    return delay(getAccountOrInit(session.userId).alerts);
  }

  function createAlert(alert) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    if (!alert.symbol || !alert.ruleType) return fail("Select a stock and rule type.");
    if (alert.ruleType !== "trailing_stop" && (!alert.threshold || alert.threshold <= 0)) {
      return fail("Enter a valid threshold.");
    }
    const account = getAccountOrInit(session.userId);
    if (!account.holdings[alert.symbol]) return fail("You must hold this stock to set an automated rule on it.");

    const record = {
      id: newId("rule"), symbol: alert.symbol, ruleType: alert.ruleType, threshold: alert.threshold,
      status: "active", createdAt: new Date().toISOString(),
      highestPrice: account.holdings[alert.symbol] ? MarketDataService.getLastKnownPrice(alert.symbol) : 0
    };
    account.alerts.unshift(record);
    saveAccount(session.userId, account);
    return delay(record);
  }

  function deleteAlert(alertId) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    account.alerts = account.alerts.filter(function (a) { return a.id !== alertId; });
    saveAccount(session.userId, account);
    return delay(true);
  }

  // Demo-only control: simulate a market price tick and evaluate all
  // active rules against it (there is no live feed to trigger rules
  // automatically in a static demo).
  function simulatePriceUpdate(symbol, newPrice) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    MarketDataService.setDemoPrice(symbol, newPrice);

    const result = RuleEngine.evaluateRules(account, symbol, newPrice, { sellStock: function (sym, qty, price) {
      const holding = account.holdings[sym];
      if (!holding) return null;
      const total = qty * price;
      const realized = (price - holding.avgPrice) * qty;
      holding.quantity -= qty;
      if (holding.quantity <= 0) delete account.holdings[sym];
      account.cash += total;
      account.realizedPnL = (account.realizedPnL || 0) + realized;
      const txn = { id: newId("txn"), type: "SELL", symbol: sym, qty: qty, price: price, total: total, realizedPnL: realized, date: new Date().toISOString(), source: "rule" };
      account.transactions.unshift(txn);
      return txn;
    }, notify: function (title, message) {
      account.notifications.unshift(notif("stop_loss", title, message));
    } });

    saveAccount(session.userId, account);
    return delay(result);
  }

  function getNotifications() {
    const session = requireSession();
    if (!session) return delay([]);
    return delay(getAccountOrInit(session.userId).notifications);
  }

  function markNotificationRead(id) {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const account = getAccountOrInit(session.userId);
    const n = account.notifications.find(function (x) { return x.id === id; });
    if (n) n.read = true;
    saveAccount(session.userId, account);
    return delay(true);
  }

  function resetAccount() {
    const session = requireSession();
    if (!session) return fail("Not logged in.");
    const existing = getAccountOrInit(session.userId);
    const fresh = defaultAccount();
    fresh.riskProfile = existing.riskProfile;
    fresh.onboardingAnswers = existing.onboardingAnswers;
    saveAccount(session.userId, fresh);
    return delay(fresh);
  }

  global.api = {
    signup, login, logout, getCurrentUser, resetAccount,
    getStocks, getStock, getHistoricalPrices, getFundamentals,
    saveOnboardingAnswers, getRiskProfile,
    getRecommendations, updatePortfolioDraft, confirmPortfolio,
    buyStock, sellStock, getPortfolio, getTransactions,
    getAlerts, createAlert, deleteAlert, simulatePriceUpdate,
    getNotifications, markNotificationRead
  };
})(window);
