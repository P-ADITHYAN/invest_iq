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

  const STEPS = [
    {
      key: "budgetBand",
      title: "How much would you like to invest?",
      desc: "This helps size your recommended portfolio. You can start small.",
      type: "budget",
      options: [
        { value: "1000-5000", label: "₹1,000 – ₹5,000" },
        { value: "5000-10000", label: "₹5,000 – ₹10,000" },
        { value: "10000-25000", label: "₹10,000 – ₹25,000" },
        { value: "25000-50000", label: "₹25,000 – ₹50,000" },
        { value: "50000+", label: "₹50,000+" },
        { value: "custom", label: "Custom amount" }
      ]
    },
    {
      key: "horizon",
      title: "How long do you plan to invest?",
      desc: "Longer horizons can typically absorb more short-term ups and downs.",
      options: [
        { value: "<1y", label: "Less than 1 year" },
        { value: "1-3y", label: "1–3 years" },
        { value: "3-5y", label: "3–5 years" },
        { value: "5-10y", label: "5–10 years" },
        { value: "10y+", label: "10+ years" }
      ]
    },
    {
      key: "goal",
      title: "What's your main investment goal?",
      desc: "We'll tilt your portfolio to match what matters most to you.",
      options: [
        { value: "wealth_creation", label: "Wealth creation", desc: "Grow your money steadily over time." },
        { value: "long_term_growth", label: "Long-term growth", desc: "Maximize growth over many years." },
        { value: "capital_preservation", label: "Capital preservation", desc: "Protect what you invest, first." },
        { value: "dividend_income", label: "Dividend income", desc: "Prefer steady income-paying stocks." },
        { value: "learning", label: "Learning", desc: "Mainly here to understand investing." },
        { value: "short_term_opportunities", label: "Short-term opportunities", desc: "Comfortable with faster-moving bets." }
      ]
    },
    {
      key: "experience",
      title: "How would you describe your investing experience?",
      desc: "Be honest — this only shapes how much risk we start you with.",
      options: [
        { value: "complete_beginner", label: "Complete beginner", desc: "I've never invested before." },
        { value: "beginner", label: "Beginner", desc: "I've made a few investments." },
        { value: "intermediate", label: "Intermediate", desc: "I understand the basics well." },
        { value: "advanced", label: "Advanced", desc: "I actively manage my own investments." }
      ]
    },
    {
      key: "lossTolerance",
      title: "Your ₹10,000 portfolio temporarily falls to ₹8,000. What would you most likely do?",
      desc: "There's no wrong answer — this just measures comfort with paper losses.",
      options: [
        { value: "sell", label: "Sell immediately", desc: "I'd want to stop further losses." },
        { value: "wait", label: "Wait", desc: "I'd leave it and see what happens." },
        { value: "analyze", label: "Analyze before deciding", desc: "I'd look into why it fell first." },
        { value: "invest_more", label: "Invest more", desc: "I'd see it as a buying opportunity." }
      ]
    },
    {
      key: "questionnaire",
      title: "Which best describes your risk preference?",
      desc: "This is the single biggest input into your risk score.",
      options: [
        { value: "conservative", label: "Conservative", desc: "I prefer stability even if potential returns are lower." },
        { value: "moderate", label: "Moderate", desc: "I accept normal market fluctuations for long-term growth." },
        { value: "aggressive", label: "Aggressive", desc: "I'm comfortable with significant fluctuations for higher potential growth." }
      ]
    }
  ];

  let current = 0;
  const answers = {};

  function renderProgress() {
    const el = document.getElementById("progressSteps");
    el.innerHTML = STEPS.map(function (_, i) {
      const cls = i < current ? "done" : (i === current ? "active" : "");
      return '<div class="progress-step ' + cls + '"></div>';
    }).join("");
    document.getElementById("stepCounter").textContent = "Step " + (current + 1) + " of " + STEPS.length;
  }

  function renderStep() {
    const step = STEPS[current];
    const container = document.getElementById("stepsContainer");
    document.getElementById("stepError").hidden = true;

    let optionsHTML = step.options.map(function (opt) {
      const selected = answers[step.key] === opt.value ? " selected" : "";
      return (
        '<button type="button" class="choice-card' + selected + '" data-value="' + opt.value + '">' +
        '<span class="choice-card-title">' + opt.label + '</span>' +
        (opt.desc ? '<span class="choice-card-desc">' + opt.desc + '</span>' : "") +
        "</button>"
      );
    }).join("");

    let customBox = "";
    if (step.type === "budget") {
      const showCustom = answers.budgetBand === "custom";
      customBox =
        '<div class="custom-amount-box" id="customAmountBox"' + (showCustom ? "" : " hidden") + '>' +
        '<label class="form-label" for="customAmount">Enter amount (₹)</label>' +
        '<input class="input" type="number" min="500" step="500" id="customAmount" value="' + (answers.budgetAmount || "") + '" placeholder="e.g. 15000">' +
        "</div>";
    }

    container.innerHTML =
      '<h3 class="onboarding-step-title">' + step.title + "</h3>" +
      '<p class="onboarding-step-desc text-muted">' + step.desc + "</p>" +
      '<div class="choice-list">' + optionsHTML + "</div>" + customBox;

    UI.qsa(".choice-card", container).forEach(function (btn) {
      btn.addEventListener("click", function () {
        answers[step.key] = btn.getAttribute("data-value");
        renderStep();
      });
    });

    const customInput = document.getElementById("customAmount");
    if (customInput) {
      customInput.addEventListener("input", function () { answers.budgetAmount = Number(this.value); });
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
