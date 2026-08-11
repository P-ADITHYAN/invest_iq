/**
 * ui.js — Shared DOM utilities: toasts, modals, tooltips, and the
 * loading/empty/error state helpers used by every async-feeling page
 * component. Kept dependency-free and framework-free.
 */
(function (global) {
  "use strict";

  // ---- Formatting helpers ----------------------------------------------
  function formatINR(amount, opts) {
    opts = opts || {};
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString("en-IN", {
      maximumFractionDigits: opts.decimals != null ? opts.decimals : 2,
      minimumFractionDigits: opts.decimals != null ? opts.decimals : 2
    });
    return (opts.symbol === false ? "" : CONFIG.CURRENCY_SYMBOL) + formatted;
  }

  function formatPercent(value, decimals) {
    const n = Number(value) || 0;
    const d = decimals == null ? 2 : decimals;
    return (n >= 0 ? "+" : "") + n.toFixed(d) + "%";
  }

  function formatNumber(value, decimals) {
    const n = Number(value) || 0;
    return n.toLocaleString("en-IN", { maximumFractionDigits: decimals == null ? 0 : decimals });
  }

  function formatDate(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ---- Toasts -------------------------------------------------------------
  function ensureToastRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(message, type) {
    const region = ensureToastRegion();
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    region.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, CONFIG.TOAST_DURATION_MS);
  }

  // ---- Modal ----------------------------------------------------------
  function openModal(contentHTML, opts) {
    opts = opts || {};
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "activeModalBackdrop";
    backdrop.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + contentHTML + "</div>";
    document.body.appendChild(backdrop);
    if (opts.closeOnBackdrop !== false) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) closeModal();
      });
    }
    document.addEventListener("keydown", escToClose);
    return backdrop;
  }

  function escToClose(e) {
    if (e.key === "Escape") closeModal();
  }

  function closeModal() {
    const el = document.getElementById("activeModalBackdrop");
    if (el) el.remove();
    document.removeEventListener("keydown", escToClose);
  }

  // ---- Loading / Empty / Error state boxes ---------------------------
  function loadingState(message) {
    return (
      '<div class="state-box"><div class="spinner" role="status" aria-label="Loading"></div><p>' +
      (message || "Loading...") +
      "</p></div>"
    );
  }

  function emptyState(message, actionHTML) {
    return (
      '<div class="state-box"><p>' + message + "</p>" + (actionHTML || "") + "</div>"
    );
  }

  function errorState(message, retryCallbackName) {
    const btn = retryCallbackName
      ? '<button class="btn btn-outline btn-sm" onclick="' + retryCallbackName + '()">Retry</button>'
      : "";
    return (
      '<div class="state-box"><p class="text-danger">' + (message || "Something went wrong.") + "</p>" + btn + "</div>"
    );
  }

  // ---- Info tooltip markup helper -------------------------------------
  function infoTip(text) {
    return (
      '<span class="info-tip"><button type="button" class="info-tip-btn" aria-label="More info">i</button>' +
      '<span class="info-tip-bubble">' + text + "</span></span>"
    );
  }

  // ---- Small DOM helpers ------------------------------------------------
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }
  // Deterministic pseudo-value in [min, max] derived from a string seed.
  // Used for demo-only values (e.g. simulated day change %) that need to
  // look realistic but stay stable across reloads instead of being
  // re-randomized on every render.
  function deterministicPseudo(seedStr, min, max) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) { hash = (hash << 5) - hash + seedStr.charCodeAt(i); hash |= 0; }
    const normalized = (Math.sin(hash) + 1) / 2; // 0..1
    return min + normalized * (max - min);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  global.UI = {
    formatINR, formatPercent, formatNumber, formatDate, formatDateTime,
    toast, openModal, closeModal,
    loadingState, emptyState, errorState, infoTip,
    qs, qsa, el, escapeHTML, deterministicPseudo
  };
})(window);
