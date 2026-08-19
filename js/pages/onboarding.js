/**
 * pages/onboarding.js — Controller for the 6-step investor onboarding
 * flow. Renders each step's choice cards, validates one step at a time,
 * and on completion calls api.saveOnboardingAnswers() which runs
 * RiskEngine.computeRiskProfile() and persists the result.
 */
(function () {
  "use strict";

  if (!Store.getSession()) { window.location.href = "login.html"; return; }
  document.getElementById("brandName").textContent = CONFIG.APP_NAME;
  document.title = "Investor Onboarding — " + CONFIG.APP_NAME;

  const BUDGET_MIDPOINT = {
    "1000-5000": 3000, "5000-10000": 7500, "10000-25000": 17500, "25000-50000": 37500, "50000+": 60000
  };

  // Small hand-drawn icon set for choice cards — one per option value,
  // reused where the underlying concept repeats (e.g. "trending up" for
  // both long-term growth and a longer horizon).
  const ICONS = {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16v-6"/><path d="M3 7V5a2 2 0 0 1 2-2h12"/><path d="M17 12h3v3h-3z"/></svg>',
    banknote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/></svg>',
    banknoteStack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="10" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M2 15v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/></svg>',
    infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 8.5a4 4 0 1 0 0 7 6 6 0 0 0 4-1.8 6 6 0 0 0 4 1.8 4 4 0 1 0 0-7 6 6 0 0 0-4 1.8 6 6 0 0 0-4-1.8z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>',
    bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg>',
    arrowDownCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v6M9 11l3 3 3-3"/></svg>',
    pauseCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>',
    arrowUpCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16V8M9 11l3-3 3 3"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 7l-3 6a4 4 0 0 0 6 0l-3-6zM19 7l-3 6a4 4 0 0 0 6 0l-3-6zM5 7h14"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-1-3 2 1 3 4 3 6a6 6 0 0 1-12 0c0-4 2-6 4-10z"/></svg>'
  };

  const STEPS = [
    {
      key: "budgetBand",
      shortTitle: "Budget",
      title: "How much would you like to invest?",
      desc: "This helps size your recommended portfolio. You can start small.",
      type: "budget",
      grid: true,
      options: [
        { value: "1000-5000", label: "₹1,000 – ₹5,000", icon: "wallet" },
        { value: "5000-10000", label: "₹5,000 – ₹10,000", icon: "wallet" },
        { value: "10000-25000", label: "₹10,000 – ₹25,000", icon: "banknote" },
        { value: "25000-50000", label: "₹25,000 – ₹50,000", icon: "banknote" },
        { value: "50000+", label: "₹50,000+", icon: "banknoteStack" },
        { value: "custom", label: "Custom amount", icon: "edit" }
      ]
    },
    {
      key: "horizon",
      shortTitle: "Horizon",
      title: "How long do you plan to invest?",
      desc: "Longer horizons can typically absorb more short-term ups and downs.",
      options: [
        { value: "<1y", label: "Less than 1 year", icon: "zap" },
        { value: "1-3y", label: "1–3 years", icon: "clock" },
        { value: "3-5y", label: "3–5 years", icon: "calendar" },
        { value: "5-10y", label: "5–10 years", icon: "trendUp" },
        { value: "10y+", label: "10+ years", icon: "infinity" }
      ]
    },
    {
      key: "goal",
      shortTitle: "Goal",
      title: "What's your main investment goal?",
      desc: "We'll tilt your portfolio to match what matters most to you.",
      grid: true,
      options: [
        { value: "wealth_creation", label: "Wealth creation", desc: "Grow your money steadily over time.", icon: "target" },
        { value: "long_term_growth", label: "Long-term growth", desc: "Maximize growth over many years.", icon: "trendUp" },
        { value: "capital_preservation", label: "Capital preservation", desc: "Protect what you invest, first.", icon: "shield" },
        { value: "dividend_income", label: "Dividend income", desc: "Prefer steady income-paying stocks.", icon: "coins" },
        { value: "learning", label: "Learning", desc: "Mainly here to understand investing.", icon: "book" },
        { value: "short_term_opportunities", label: "Short-term opportunities", desc: "Comfortable with faster-moving bets.", icon: "zap" }
      ]
    },
    {
      key: "experience",
      shortTitle: "Experience",
      title: "How would you describe your investing experience?",
      desc: "Be honest — this only shapes how much risk we start you with.",
      grid: true,
      options: [
        { value: "complete_beginner", label: "Complete beginner", desc: "I've never invested before.", icon: "dot" },
        { value: "beginner", label: "Beginner", desc: "I've made a few investments.", icon: "circle" },
        { value: "intermediate", label: "Intermediate", desc: "I understand the basics well.", icon: "bars" },
        { value: "advanced", label: "Advanced", desc: "I actively manage my own investments.", icon: "award" }
      ]
    },
    {
      key: "lossTolerance",
      shortTitle: "Loss Reaction",
      title: "Your ₹10,000 portfolio temporarily falls to ₹8,000. What would you most likely do?",
      desc: "There's no wrong answer — this just measures comfort with paper losses.",
      grid: true,
      options: [
        { value: "sell", label: "Sell immediately", desc: "I'd want to stop further losses.", icon: "arrowDownCircle" },
        { value: "wait", label: "Wait", desc: "I'd leave it and see what happens.", icon: "pauseCircle" },
        { value: "analyze", label: "Analyze before deciding", desc: "I'd look into why it fell first.", icon: "search" },
        { value: "invest_more", label: "Invest more", desc: "I'd see it as a buying opportunity.", icon: "arrowUpCircle" }
      ]
    },
    {
      key: "questionnaire",
      shortTitle: "Risk Preference",
      title: "Which best describes your risk preference?",
      desc: "This is the single biggest input into your risk score.",
      options: [
        { value: "conservative", label: "Conservative", desc: "I prefer stability even if potential returns are lower.", icon: "shield" },
        { value: "moderate", label: "Moderate", desc: "I accept normal market fluctuations for long-term growth.", icon: "scale" },
        { value: "aggressive", label: "Aggressive", desc: "I'm comfortable with significant fluctuations for higher potential growth.", icon: "flame" }
      ]
    }
  ];

  let current = 0;
  const answers = {};

  function renderProgress() {
    const el = document.getElementById("progressSteps");
    el.innerHTML = STEPS.map(function (_, i) {
      const cls = i < current ? "done" : (i === current ? "active" : "");
      return (
        '<div class="progress-step-wrap">' +
        '<div class="progress-step ' + cls + '"></div>' +
        '<div class="progress-step-tooltip">' + STEPS[i].shortTitle + "</div>" +
        "</div>"
      );
    }).join("");
    document.getElementById("stepCounter").textContent = "Step " + (current + 1) + " of " + STEPS.length;
  }

  function formatINRPreview(amount) {
    if (!amount) return "";
    return "₹" + Number(amount).toLocaleString("en-IN");
  }

  function renderStep() {
    const step = STEPS[current];
    const container = document.getElementById("stepsContainer");
    document.getElementById("stepError").hidden = true;

    let optionsHTML = step.options.map(function (opt) {
      const selected = answers[step.key] === opt.value ? " selected" : "";
      return (
        '<button type="button" class="choice-card' + selected + '" data-value="' + opt.value + '">' +
        '<span class="choice-card-icon">' + (ICONS[opt.icon] || "") + "</span>" +
        '<span class="choice-card-body">' +
        '<span class="choice-card-title">' + opt.label + '</span>' +
        (opt.desc ? '<span class="choice-card-desc">' + opt.desc + '</span>' : "") +
        "</span>" +
        "</button>"
      );
    }).join("");

    let customBox = "";
    if (step.type === "budget") {
      const showCustom = answers.budgetBand === "custom";
      const previewText = formatINRPreview(answers.budgetAmount);
      customBox =
        '<div class="custom-amount-box" id="customAmountBox"' + (showCustom ? "" : " hidden") + '>' +
        '<label class="form-label" for="customAmount">Enter amount (₹)</label>' +
        '<input class="input" type="number" min="500" step="500" id="customAmount" value="' + (answers.budgetAmount || "") + '" placeholder="e.g. 15000">' +
        '<div class="custom-amount-preview" id="customAmountPreview">' + (previewText ? "You'll invest <strong>" + previewText + "</strong>" : "") + "</div>" +
        "</div>";
    }

    container.className = "step-content-enter";
    container.innerHTML =
      '<h3 class="onboarding-step-title">' + step.title + "</h3>" +
      '<p class="onboarding-step-desc text-muted">' + step.desc + "</p>" +
      '<div class="choice-list' + (step.grid ? " choice-grid-2" : "") + '">' + optionsHTML + "</div>" + customBox;

    UI.qsa(".choice-card", container).forEach(function (btn) {
      btn.addEventListener("click", function () {
        answers[step.key] = btn.getAttribute("data-value");
        renderStep();
      });
    });

    const customInput = document.getElementById("customAmount");
    if (customInput) {
      customInput.addEventListener("input", function () {
        answers.budgetAmount = Number(this.value);
        const preview = document.getElementById("customAmountPreview");
        const text = formatINRPreview(answers.budgetAmount);
        preview.innerHTML = text ? "You'll invest <strong>" + text + "</strong>" : "";
      });
    }

    document.getElementById("backBtn").disabled = current === 0;
    document.getElementById("nextBtn").textContent = current === STEPS.length - 1 ? "See My Profile" : "Continue";
    renderProgress();
  }

  function validateStep() {
    const step = STEPS[current];
    if (!answers[step.key]) return "Please select an option to continue.";
    if (step.type === "budget" && answers.budgetBand === "custom") {
      if (!answers.budgetAmount || answers.budgetAmount < 500) return "Enter a custom amount of at least ₹500.";
    }
    return null;
  }

  document.getElementById("nextBtn").addEventListener("click", function () {
    const error = validateStep();
    const errorEl = document.getElementById("stepError");
    if (error) { errorEl.textContent = error; errorEl.hidden = false; return; }

    if (current < STEPS.length - 1) {
      current++;
      renderStep();
      return;
    }

    // Final step: resolve numeric budget and submit.
    const finalAnswers = Object.assign({}, answers);
    finalAnswers.budget = finalAnswers.budgetBand === "custom"
      ? finalAnswers.budgetAmount
      : BUDGET_MIDPOINT[finalAnswers.budgetBand];

    this.disabled = true;
    this.textContent = "Calculating your risk profile...";
    api.saveOnboardingAnswers(finalAnswers).then(function () {
      window.location.href = "profile-result.html";
    }).catch(function (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    });
  });

  document.getElementById("backBtn").addEventListener("click", function () {
    if (current > 0) { current--; renderStep(); }
  });

  renderStep();
})();
