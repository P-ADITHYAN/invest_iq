/**
 * state.js — Lightweight vanilla-JS storage helpers.
 *
 * There is no framework store here on purpose: each page reads what it
 * needs through api.js, keeps it in a local JS variable, and re-renders
 * the DOM directly. This module only wraps the browser storage APIs so
 * the rest of the app never touches `localStorage`/`sessionStorage` keys
 * directly (avoids typo bugs and keeps storage keys documented in one
 * place). Session-bound, per-user account data (cash, holdings,
 * transactions, alerts, user profile) is namespaced by user id and
 * persisted in localStorage so a demo session survives a refresh. In a
 * production build with a real backend, `Store.local` would be reduced to
 * UI preferences only and account data would come from the API instead.
 */
(function (global) {
  "use strict";

  const KEYS = {
    SESSION: "investiq:session",           // { userId, email, name, token }
    USERS: "investiq:users",                 // demo-mode user directory
    ACCOUNT_PREFIX: "investiq:account:",      // + userId -> { cash, holdings, transactions, alerts, riskProfile, portfolio, notifications }
    UI_PREFS: "investiq:ui-prefs"
  };

  function readJSON(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("State: failed to parse", key, e);
      return fallback;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("State: failed to persist", key, e);
    }
  }

  const Store = {
    KEYS,

    // ---- Session (who is logged in right now) ----
    getSession() {
      return readJSON(sessionStorage, KEYS.SESSION, null);
    },
    setSession(session) {
      writeJSON(sessionStorage, KEYS.SESSION, session);
    },
    clearSession() {
      sessionStorage.removeItem(KEYS.SESSION);
    },

    // ---- Demo user directory (email -> {userId, name, passwordHash}) ----
    getUsers() {
      return readJSON(localStorage, KEYS.USERS, {});
    },
    setUsers(users) {
      writeJSON(localStorage, KEYS.USERS, users);
    },

    // ---- Per-user account data ----
    getAccount(userId) {
      return readJSON(localStorage, KEYS.ACCOUNT_PREFIX + userId, null);
    },
    setAccount(userId, account) {
      writeJSON(localStorage, KEYS.ACCOUNT_PREFIX + userId, account);
    },

    // ---- UI preferences (non-sensitive) ----
    getUIPrefs() {
      return readJSON(localStorage, KEYS.UI_PREFS, {});
    },
    setUIPrefs(prefs) {
      writeJSON(localStorage, KEYS.UI_PREFS, prefs);
    }
  };

  global.Store = Store;
})(window);
