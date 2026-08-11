# InvestIQ — Indian Stock Portfolio Advisor & Virtual Trading Platform

A beginner-focused, India-only equity portfolio advisor and virtual (paper) trading web app. Built as a static HTML/CSS/vanilla-JS product-portfolio project — **no React, no frontend framework, no build step**.

> ⚠️ **Educational prototype.** All market data is demo/sample data, all trading is simulated with virtual currency, and nothing here is financial advice. See [Financial Disclaimer](#financial-disclaimer).

## 1. Project Overview

InvestIQ walks a beginner Indian investor through:

```
Sign up → Risk questionnaire → Investor profile → Personalized stock
recommendations (explained) → Build a virtual portfolio → Buy/sell with
virtual money → Track performance & risk analytics → Set automated
stop-loss/target rules → Get alerts → Learn the concepts along the way
```

The product name "InvestIQ" is a single configurable constant (`CONFIG.APP_NAME` in [`js/config.js`](js/config.js)) — rebrand by editing one file.

## 2. Features

- Landing page, signup/login (demo auth), 6-step onboarding with a deterministic risk-scoring engine
- Indian (NSE) stock universe with sector/risk/market-cap/score filters and search
- Deterministic 0-100 stock scoring engine with per-risk-profile weighting
- Personalized portfolio construction engine (budget + risk → allocations → share counts) with configurable constraints (max single-stock %, max sector %, min stock count, cash reserve range)
- "Why this stock?" explanations generated from real computed sub-scores — never a bare "BUY"
- Editable portfolio builder (add/remove/reweight before confirming)
- Virtual trading: ₹1,00,000 starting cash, full buy/sell validation, transaction history
- Dashboard: value/P&L/return/cash, hand-rolled SVG performance chart, holdings, sector exposure, portfolio health score
- Portfolio analytics: return %, annualized volatility, max drawdown, Sharpe ratio (labeled risk-free assumption), beta vs a NIFTY50 demo benchmark
- Automated virtual rules: stop-loss, target, percentage stop/target, trailing stop, with a demo "simulate price update" control since there is no live market feed
- In-app notifications, contextual ⓘ tooltips on every technical metric
- Learning section: 5 categories, each topic with explanation / example / why it matters / common mistake
- Documented (stub) interfaces for AI explanations, What-If simulation, and backtesting — intentionally left unimplemented per the phased build plan

## 3. Architecture

```
USER
  ↓
STATIC HTML/CSS/JS  (this repo — deployable as-is to any static host)
  ↓
js/api.js            (single API abstraction every page calls)
  ↓
DEMO MODE (default)                    LIVE MODE (CONFIG.DEMO_MODE = false)
  localStorage/sessionStorage    OR      HTTPS calls to CONFIG.API_BASE_URL
  js/data/* demo datasets                → Auth service
  js/marketData.js demo branch           → Market data provider
                                          → Database
                                          → Recommendation/analytics backend
                                          → Alert/rule processing
                                          → Optional AI explanation service
```

Pages **never** call `fetch()`, `localStorage`, or an engine module directly — they call `api.*`, which is the only place that needs to change to point at a real backend. `js/marketData.js` is the equivalent abstraction for market data specifically (`getStocks`, `getStock`, `getHistoricalPrices`, `getFundamentals`).

**No secret keys are ever placed in frontend code.** A production deployment must proxy any real market-data-provider key through a server-side API and have the frontend call that API only.

## 4. Folder Structure

```
/
├── index.html, login.html, signup.html, onboarding.html, profile-result.html
├── dashboard.html, recommendations.html, stocks.html, stock-detail.html
├── portfolio.html, trade.html, transactions.html, alerts.html
├── learn.html, learn-topic.html, account.html
├── css/
│   ├── tokens.css          (design system variables — rebrand here)
│   ├── base.css            (resets, layout primitives)
│   ├── components.css      (cards, buttons, tables, modals, toasts...)
│   └── pages/*.css         (page-specific layout only)
├── js/
│   ├── config.js            (CONFIG — every tunable constant)
│   ├── state.js              (localStorage/sessionStorage wrapper)
│   ├── api.js                 (the API abstraction — see §3)
│   ├── marketData.js           (MarketDataService)
│   ├── data/                   (demo stock universe, demo history, learn content)
│   ├── riskEngine.js            (onboarding answers → risk score/category)
│   ├── scoringEngine.js          (0-100 stock scoring)
│   ├── recommendationEngine.js    (budget+risk+scores → portfolio draft)
│   ├── portfolioAnalytics.js       (return/volatility/drawdown/Sharpe/beta/health)
│   ├── ruleEngine.js                (stop-loss/target/trailing evaluation)
│   ├── ai.js                         (AI explanation interface + Phase 10 stub docs)
│   ├── charts/svgCharts.js            (hand-rolled SVG chart renderers, zero deps)
│   ├── ui.js, nav.js                   (shared DOM utils, app shell/nav)
│   └── pages/*.js                       (one controller per HTML page)
└── assets/
```

## 5. Local Setup

No build step, no `npm install` required. Any static file server works:

```bash
npx serve .
```

or use the VS Code "Live Server" extension, or Python's built-in server:

```bash
python -m http.server 8080
```

Then open `index.html` (or `http://localhost:PORT`). Use the **"Use demo account"** button on the login page to skip signup.

## 6. Demo Mode

`CONFIG.DEMO_MODE = true` (default, in `js/config.js`) makes the entire app work with zero external services:

- Auth is simulated locally (non-cryptographic demo hash — **not secure**, not for production)
- Stock universe, fundamentals, and historical prices come from `js/data/demoStocks.js` / `js/data/demoHistorical.js`
- All account state (cash, holdings, transactions, alerts) persists per-user in `localStorage`

Every place demo data is shown carries a visible **"Demo Mode"** flag (top bar) or **"Demo Data"** label so it's never confused with live market data.

## 7. API Configuration (moving to live data)

To point the app at a real backend:

1. Set `CONFIG.DEMO_MODE = false` and `CONFIG.API_BASE_URL` in `js/config.js`.
2. Implement the real-mode branches already stubbed in `js/marketData.js` (`fetch(CONFIG.API_BASE_URL + "/stocks")`, etc.) and `js/api.js` (auth, trading, alerts).
3. Keep the same function signatures — no page code needs to change.
4. Ensure the backend, not the browser, is authoritative for account balances, holdings, and trade validation.

## 8. Deployment

This is a static site — deploy the repository root as-is.

**Hostinger:** Upload all files to `public_html` via File Manager or FTP.

**Vercel:** Connect the Git repository and deploy with no framework preset / no build command (root = static output).

**Netlify:** Connect the repository (no build command) or drag-and-drop the project folder in the Netlify dashboard.

**GitHub Pages:** Enable Pages on the repository, serving from the root of the default branch.

In every case, `index.html` must be served directly — no server-side rendering or build step is required.

## 9. Security Notes

- No API keys, database credentials, or secrets exist anywhere in this codebase.
- Demo-mode "password hashing" is a simple non-cryptographic string hash for prototyping convenience only — never reuse this pattern for a real user's real password.
- Demo-mode account data (cash/holdings) is client-stored and **not tamper-proof** — this is acceptable only because it is virtual/simulated money. A live deployment must validate and store balances server-side.
- The app never places real trades, never connects to a real brokerage, and never requests real financial credentials.

## 10. Market Data Notes

All prices, fundamentals, and historical series shown in demo mode are **illustrative sample data**, deterministically generated so charts are stable across reloads — they are not live market feeds and must never be relied on for real investment decisions.

## 11. Financial Disclaimer

This platform provides educational and algorithmic analysis for informational purposes only. It does not guarantee investment returns and is not a substitute for professional financial advice. All trading on InvestIQ is simulated with virtual currency. For a real-world deployment, this language should be reviewed by qualified legal/compliance counsel.

## 12. Future Features (documented, intentionally not built in this MVP)

- **AI explanations** — `js/ai.js` already defines the interface (`explainStock`, `explainPortfolio`, `explainMetric`, `summarizePerformance`, `answerLearningQuestion`); demo mode composes text from real computed data. Wiring a live LLM only requires replacing each function body with an API call passing the same structured payload.
- **What-If Simulator** — recalculates a hypothetical portfolio (different budget/risk/holdings) without touching the real portfolio. Interface documented in `js/ai.js`.
- **Backtesting** — historical strategy testing against a benchmark. Interface documented in `js/ai.js`.
- **Portfolio rebalancing suggestions, broker integrations, real-time WebSocket price feeds** — explicitly out of scope for this MVP per the phased build plan.

## 13. Testing Notes

Manually verified flows (see the project plan for the full checklist): signup → onboarding → risk profile → recommendations → build portfolio → dashboard → buy/sell → transactions → create + simulate-trigger an alert. Two personalization checks are core to this project and worth re-verifying after any engine change:

1. Same budget, different risk category → different stock weighting (`js/scoringEngine.js` + `js/recommendationEngine.js`).
2. Same risk category, different budget → different share counts/composition, not a naive linear scale.
