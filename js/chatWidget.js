/**
 * chatWidget.js — "Ask InvestIQ" floating chat assistant, mounted on
 * every authenticated page (alongside nav.js). Self-contained: injects
 * its own markup, gathers the user's real data client-side, and talks
 * to api/chat.js (Gemini, server-side key only — see that file).
 *
 * Design principle carried over from js/ai.js and js/recommendationEngine.js:
 * the assistant only ever sees data this app already computed for real
 * (risk profile, holdings, transactions, portfolio health where
 * available) — it never invents numbers, and per its system instruction
 * in api/chat.js, it explains the app's own outputs rather than issuing
 * buy/sell trading signals.
 *
 * Gracefully degrades: if api.js/PortfolioAnalytics aren't loaded on a
 * given page, or the account has no portfolio yet, the corresponding
 * piece of context is simply omitted rather than the widget breaking.
 */
(function () {
  "use strict";

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  const SUGGESTIONS = [
    "Explain my portfolio health score",
    "What does beta mean?",
    "Why did I get this risk profile?",
    "What's a good next step for me?"
  ];

  let history = []; // [{role: "user"|"assistant", text}]
  let contextPromise = null;
  let sending = false;

  function mount() {
    if (!Store.getSession()) return; // unauthenticated pages never get the widget
    if (document.getElementById("chatFab")) return; // already mounted

    document.body.insertAdjacentHTML("beforeend", buildFab() + buildPanel());

    document.getElementById("chatFab").addEventListener("click", openPanel);
    document.getElementById("chatPanelClose").addEventListener("click", closePanel);

    const textarea = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSendBtn");
    sendBtn.addEventListener("click", function () { send(textarea.value); });
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send(textarea.value);
      }
    });
  }

  function buildFab() {
    return (
      '<button type="button" class="chat-fab" id="chatFab" aria-label="Ask InvestIQ assistant">' +
      ICON_CHAT + "</button>"
    );
  }

  function buildPanel() {
    return (
      '<div class="chat-panel" id="chatPanel" hidden role="dialog" aria-label="Ask InvestIQ assistant">' +
      '<div class="chat-panel-header"><div><h4>Ask InvestIQ</h4><p>Explains your data — never gives buy/sell signals</p></div>' +
      '<button type="button" class="chat-panel-close" id="chatPanelClose" aria-label="Close chat">' + ICON_CLOSE + "</button></div>" +
      '<div class="chat-messages" id="chatMessages"></div>' +
      '<div class="chat-suggestions" id="chatSuggestions"></div>' +
      '<div class="chat-input-area">' +
      '<div class="chat-input-row">' +
      '<textarea id="chatInput" rows="1" placeholder="Ask about your portfolio, a metric, or a concept..." maxlength="2000"></textarea>' +
      '<button type="button" class="chat-send-btn" id="chatSendBtn" aria-label="Send">' + ICON_SEND + "</button>" +
      "</div>" +
      '<p class="chat-disclaimer">Educational only — not financial advice. All trading in InvestIQ is simulated.</p>' +
      "</div></div>"
    );
  }

  function openPanel() {
    const panel = document.getElementById("chatPanel");
    panel.hidden = false;
    if (!history.length) showWelcome();
    document.getElementById("chatInput").focus();
  }

  function closePanel() {
    document.getElementById("chatPanel").hidden = true;
  }

  function showWelcome() {
    appendBubble("assistant", "Hi! I can explain your portfolio, risk profile, or any investing concept in plain language — using your real InvestIQ data. What would you like to know?");
    renderSuggestions();
  }

  function renderSuggestions() {
    const el = document.getElementById("chatSuggestions");
    el.innerHTML = SUGGESTIONS.map(function (s) {
      return '<button type="button" class="chat-suggestion-chip">' + UI.escapeHTML(s) + "</button>";
    }).join("");
    UI.qsa(".chat-suggestion-chip", el).forEach(function (chip) {
      chip.addEventListener("click", function () { send(chip.textContent); });
    });
  }

  function appendBubble(role, text) {
    const messages = document.getElementById("chatMessages");
    const el = document.createElement("div");
    el.className = "chat-message " + role;
    const bubble = document.createElement("div");
    bubble.className = "chat-message-bubble";
    bubble.textContent = text;
    el.appendChild(bubble);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function appendTyping() {
    const messages = document.getElementById("chatMessages");
    const el = document.createElement("div");
    el.className = "chat-message assistant";
    el.id = "chatTypingIndicator";
    el.innerHTML = '<div class="chat-message-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("chatTypingIndicator");
    if (el) el.remove();
  }

  // Gathers real, already-computed data for this page/session — cached
  // for the lifetime of the panel so re-asking doesn't re-fetch. Any
  // piece that isn't available here (wrong page, no api.js, no
  // portfolio yet) is simply omitted, not fabricated.
  function gatherContext() {
    if (contextPromise) return contextPromise;

    if (typeof api === "undefined") {
      contextPromise = Promise.resolve({ note: "No account data available on this page." });
      return contextPromise;
    }

    contextPromise = Promise.all([
      api.getRiskProfile().catch(function () { return null; }),
      api.getPortfolio().catch(function () { return null; }),
      api.getTransactions().catch(function () { return []; })
    ]).then(function (results) {
      const riskProfile = results[0];
      const portfolio = results[1];
      const transactions = results[2] || [];

      const context = {
        riskProfile: riskProfile ? { category: riskProfile.category, score: riskProfile.score, explanation: riskProfile.explanation } : null,
        cash: portfolio ? portfolio.cash : null,
        holdings: portfolio ? portfolio.holdings.map(function (h) {
          return { symbol: h.symbol, sector: h.sector, quantity: h.quantity, avgPrice: h.avgPrice, currentPrice: h.currentPrice, pnl: h.pnl, returnPct: h.returnPct };
        }) : [],
        recentTransactions: transactions.slice(0, 5).map(function (t) {
          return { type: t.type, symbol: t.symbol, qty: t.qty, price: t.price, date: t.date };
        })
      };

      if (portfolio && portfolio.holdings.length && typeof PortfolioAnalytics !== "undefined") {
        try {
          const health = PortfolioAnalytics.computeHealth(portfolio.holdings, portfolio.cash);
          context.portfolioHealth = { overall: health.overall, breakdown: health.breakdown, sectorExposure: health.sectorExposure };
        } catch (e) { /* health computation needs data this page doesn't have loaded — omit, don't fabricate */ }
      }

      return context;
    });

    return contextPromise;
  }

  function send(rawText) {
    const text = (rawText || "").trim();
    if (!text || sending) return;

    document.getElementById("chatInput").value = "";
    document.getElementById("chatSuggestions").innerHTML = "";
    appendBubble("user", text);
    history.push({ role: "user", text: text });

    performRequest(text, 0);
  }

  // Separated from send() so a "Retry" click can re-run the request
  // without re-appending the user's message or duplicating history.
  // api/chat.js already retries once internally on a transient Gemini
  // overload; this is a second layer for when even that didn't land
  // (or the failure was reaching our own server at all). Capped at a
  // single client-side retry — see appendErrorBubble — to keep quota
  // usage per message bounded on a free-tier key.
  function performRequest(text, retryCount) {
    sending = true;
    document.getElementById("chatSendBtn").disabled = true;
    appendTyping();

    gatherContext().then(function (context) {
      return fetch(CONFIG.CHAT_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(0, -1), context: context })
      });
    }).then(function (resp) {
      return resp.json().then(function (data) { return { ok: resp.ok, data: data }; });
    }).then(function (result) {
      removeTyping();
      if (!result.ok || !result.data.reply) {
        const detail = result.data && (result.data.detail || result.data.error);
        appendErrorBubble(detail, text, retryCount, result.data && result.data.quotaExceeded);
        return;
      }
      appendBubble("assistant", result.data.reply);
      history.push({ role: "assistant", text: result.data.reply });
    }).catch(function (err) {
      removeTyping();
      appendErrorBubble(err.message, text, retryCount);
    }).finally(function () {
      sending = false;
      document.getElementById("chatSendBtn").disabled = false;
    });
  }

  function appendErrorBubble(detail, originalText, retryCount, quotaExceeded) {
    const looksLikeMissingKey = detail && String(detail).indexOf("GEMINI_API_KEY") !== -1;
    const looksOverloaded = detail && /overload|high demand|try again later|timed out/i.test(String(detail));
    const message = quotaExceeded
      ? "The assistant has hit its free-tier daily usage limit — this isn't a glitch, and trying again right now won't help. It resets on its own; check back later, or ask whoever set up this deployment to enable billing on the Gemini API key for a higher limit."
      : looksLikeMissingKey
        ? "The assistant isn't set up yet on this deployment (missing GEMINI_API_KEY). Everything else in the app still works fine."
        : looksOverloaded
          ? "The assistant is busy right now (high demand on the free model tier). Give it a moment and try again."
          : "Sorry, I couldn't reach the assistant just now. Please try again in a moment.";

    const el = appendBubble("assistant", message);
    el.className = "chat-message error";

    // Offer one client-side retry for transient failures — but not for
    // a missing-key deployment issue or an exhausted quota, neither of
    // which an immediate retry can fix (and retrying a quota error only
    // burns more of a limit that's already at zero). Capped at a single
    // retry (not two) since api/chat.js already makes up to 2 Gemini
    // calls per attempt — on a free-tier key every extra click here is
    // real quota spent, so keep the worst case small.
    if (!looksLikeMissingKey && !quotaExceeded && retryCount < 1) {
      const bubble = el.querySelector(".chat-message-bubble");
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "btn btn-outline btn-sm";
      retryBtn.style.marginTop = "8px";
      retryBtn.textContent = "Try again";
      retryBtn.addEventListener("click", function () {
        el.remove();
        performRequest(originalText, retryCount + 1);
      });
      bubble.appendChild(document.createElement("br"));
      bubble.appendChild(retryBtn);
    }
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
