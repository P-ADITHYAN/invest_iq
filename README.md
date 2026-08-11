# InvestIQ — Indian Stock Portfolio Advisor & Virtual Trading Platform

A beginner-focused, India-only equity portfolio advisor and virtual (paper) trading web app. Built as a static HTML/CSS/vanilla-JS product-portfolio project — **no React, no frontend framework, no build step** (aside from one small serverless function for live prices — see §8).

> ⚠️ **Educational prototype.** Trading is always simulated with virtual currency, and nothing here is financial advice. Prices/charts are live from Yahoo Finance when the serverless proxy is reachable, otherwise the app falls back to demo/sample data automatically — fundamentals (P/E, ROE, etc.) are always estimated demo figures. See [Financial Disclaimer](#12-financial-disclaimer) and [§8 Live Market Data](#8-live-market-data-yahoo-finance).

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
- Portfolio analytics: return %, annualized volatility, max drawdown, Sharpe ratio (labeled risk-free assumption), beta vs a NIFTY50 benchmark
- Automated virtual rules: stop-loss, target, percentage stop/target, trailing stop, with a demo "simulate price update" control since there is no live streaming market feed
- In-app notifications, contextual ⓘ tooltips on every technical metric
- Learning section: 5 categories, each topic with explanation / example / why it matters / common mistake
- Documented (stub) interfaces for AI explanations, What-If simulation, and backtesting — intentionally left unimplemented per the phased build plan
- **Live prices from Yahoo Finance** (price, day/52-week range, historical charts) via a small serverless proxy, with automatic fallback to demo data if the proxy or Yahoo is unreachable — see §8

## 3. Architecture

```
USER
  ↓
STATIC HTML/CSS/JS  (this repo — deployable as-is to any static host)
  ↓
js/api.js            (auth, trading, alerts — always local/demo, no real backend)
js/marketData.js      (price data — live via api/yahoo.js when reachable, else demo)
  ↓                                          ↓
localStorage/sessionStorage        api/yahoo.js (Vercel serverless function)
(demo accounts, holdings,                    ↓
 transactions, alerts)              query1.finance.yahoo.com/v8/finance/chart
                                     (public, unauthenticated, no API key)
```

Pages **never** call `fetch()`, `localStorage`, or an engine module directly — they call `api.*`, which is the only place that needs to change to point auth/trading at a real backend. `js/marketData.js` is the equivalent abstraction for market data specifically (`getStocks`, `getStock`, `getHistoricalPrices`, `getFundamentals`), and already has a working live-data path (§8).

**No secret keys are ever placed in frontend code.** Yahoo's chart endpoint needs no API key, but it also doesn't allow direct browser requests (no CORS header), so `api/yahoo.js` fetches it server-side and re-serves the JSON to the frontend — the standard pattern for any future paid provider that *does* need a key.

## 4. Folder Structure

```
/
├── index.html, login.html, signup.html, onboarding.html, profile-result.html
├── dashboard.html, recommendations.html, stocks.html, stock-detail.html
├── portfolio.html, trade.html, transactions.html, alerts.html
├── learn.html, learn-topic.html, account.html
├── api/
│   └── yahoo.js              (Vercel serverless function — Yahoo Finance CORS proxy, see §8)
├── package.json                ("type": "module" so api/yahoo.js can use ES module syntax)
├── css/
│   ├── tokens.css          (design system variables — rebrand here)
│   ├── base.css            (resets, layout primitives)
│   ├── components.css      (cards, buttons, tables, modals, toasts...)
│   └── pages/*.css         (page-specific layout only)
├── js/
│   ├── config.js            (CONFIG — every tunable constant)
│   ├── state.js              (localStorage/sessionStorage wrapper)
│   ├── api.js                 (auth/trading/alerts abstraction — always local/demo)
│   ├── marketData.js           (MarketDataService — live price abstraction, see §8)
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

No build step, no `npm install` required for the frontend itself. Any static file server works for browsing the UI:

```bash
npx serve .
```

or Python's built-in server:

```bash
python -m http.server 8080
```

Then open `http://localhost:PORT`. Use the **"Use demo account"** button on the login page to skip signup.

**Note:** a plain static server like the ones above does **not** run `api/yahoo.js`, so locally you'll see live-price fetches fail and the app will automatically fall back to demo data (by design — nothing breaks). To test live Yahoo data locally, run it through the Vercel CLI instead, which emulates serverless functions:

```bash
npx vercel dev
```

## 6. Demo Mode vs Live Price Data

Two independent things are "demo" in this app, and they don't share one on/off switch:

**Auth, virtual cash, holdings, transactions, alerts** — these are **always** local/demo (see `js/api.js`), on every deployment, because there is no real backend for them in this project. This is intentional — the app never places real trades or touches real money.

**Price data** — controlled by `CONFIG.DEMO_MODE` in `js/config.js`:
- `false` (current default): `js/marketData.js` tries live Yahoo Finance data via `api/yahoo.js` first, and silently falls back to `js/data/demoStocks.js` / `js/data/demoHistorical.js` if the proxy is unreachable.
- `true`: skips the live attempt entirely and always uses demo data.

The top bar shows **"Live Data (Yahoo Finance)"** or **"Demo Data"** depending on which one actually served the current page's data — check `MarketDataService.getStatus()` if you need this programmatically.

## 7. API Configuration (auth/trading → a real backend)

To point **auth and trading** at a real backend (market data already has one, see §8):

1. Implement the real-mode branches in `js/api.js` (signup, login, buy/sell, alerts) as `fetch(CONFIG.API_BASE_URL + "/...")` calls, gated the same way `js/marketData.js` gates on `CONFIG.DEMO_MODE`.
2. Set `CONFIG.API_BASE_URL` in `js/config.js`.
3. Keep the same function signatures — no page code needs to change.
4. Ensure the backend, not the browser, is authoritative for account balances, holdings, and trade validation.

## 8. Live Market Data (Yahoo Finance)

`js/marketData.js` gets **price, day/52-week range, company name, and historical charts** from Yahoo Finance's public chart endpoint (`query1.finance.yahoo.com/v8/finance/chart/<SYMBOL>.NS`), which requires no API key.

**Why there's a proxy (`api/yahoo.js`):** that endpoint doesn't send an `Access-Control-Allow-Origin` header, so a browser calling it directly gets blocked by CORS. `api/yahoo.js` is a small Vercel serverless function that fetches it server-side (no CORS involved server-to-server) and re-serves the JSON to the frontend with permissive CORS headers. It requires no secrets/environment variables.

**What's NOT live:** fundamentals — P/E, P/B, EPS, ROE, ROCE, debt-to-equity, revenue/profit growth, dividend yield, beta, volatility. Yahoo's fundamentals endpoint (`quoteSummary`) now requires a session cookie + crumb token to access; this project deliberately does not replicate that handshake, so these fields always come from `js/data/demoStocks.js` and are treated as estimated/demo figures throughout the UI.

**Endpoints exposed by `api/yahoo.js`:**
```
GET /api/yahoo?mode=quotes&symbols=TCS.NS,INFY.NS   → lightweight current price + 52-week range per symbol (used by stocks.html, dashboard, etc.)
GET /api/yahoo?mode=history&symbol=TCS.NS&range=1y&interval=1d → full historical daily series for one symbol (used by stock-detail.html)
```

**Failure handling:** every call in `js/marketData.js` is wrapped in a `.catch()` that falls back to demo data and logs a `console.warn` — a slow/unreachable proxy, a Yahoo outage, or an unrecognized symbol never breaks the page. Requests time out after 8 seconds.

**Deployment implication:** the live-data path only works on hosts that run Node.js serverless functions (Vercel does this natively — see §9). On a purely static host (GitHub Pages, Netlify drag-and-drop, Hostinger shared hosting) `api/yahoo.js` simply won't execute, `fetch()` calls to it will fail, and the app will automatically and permanently run on demo data there — it still works correctly, just without live prices.

## 9. Deployment

**Vercel (recommended — only option with live Yahoo data):** Connect the Git repository, framework preset **"Other"**, no build command, output = repository root. Vercel auto-detects `api/yahoo.js` as a serverless function — no extra configuration needed.

```bash
npx vercel --prod
```

**Hostinger / Netlify drag-and-drop / GitHub Pages (static-only, demo data only):** Upload/connect the repository as a static site (no build command). `api/yahoo.js` will not run on these — the app still works fully, just always on demo price data (`MarketDataService` falls back automatically).

**Netlify (with functions):** Netlify can also run `api/yahoo.js`-style functions, but it expects them in `netlify/functions/` with its own request/response shape — porting `api/yahoo.js` there is a small manual step, not drop-in compatible with the Vercel version as-is.

In every case, `index.html` must be served directly — no server-side rendering or build step is required for the frontend itself.

## 10. Security Notes

- No API keys, database credentials, or secrets exist anywhere in this codebase — Yahoo's chart endpoint needs none.
- Demo-mode "password hashing" is a simple non-cryptographic string hash for prototyping convenience only — never reuse this pattern for a real user's real password.
- Demo-mode account data (cash/holdings) is client-stored and **not tamper-proof** — this is acceptable only because it is virtual/simulated money. A live deployment must validate and store balances server-side.
- The app never places real trades, never connects to a real brokerage, and never requests real financial credentials.

## 11. Market Data Notes

Prices, day/52-week ranges, and historical charts are live from Yahoo Finance whenever `api/yahoo.js` is reachable (labeled **"Live Data (Yahoo Finance)"** in the top bar) and fall back to deterministic illustrative sample data otherwise (labeled **"Demo Data"**). Fundamentals (P/E, ROE, ROCE, debt-to-equity, growth, dividend yield, beta, volatility) are always estimated demo figures — see §8 for why. None of this should be relied on for real investment decisions.

## 12. Financial Disclaimer

This platform provides educational and algorithmic analysis for informational purposes only. It does not guarantee investment returns and is not a substitute for professional financial advice. All trading on InvestIQ is simulated with virtual currency. For a real-world deployment, this language should be reviewed by qualified legal/compliance counsel.

## 13. Future Features (documented, intentionally not built in this MVP)

- **AI explanations** — `js/ai.js` already defines the interface (`explainStock`, `explainPortfolio`, `explainMetric`, `summarizePerformance`, `answerLearningQuestion`); demo mode composes text from real computed data. Wiring a live LLM only requires replacing each function body with an API call passing the same structured payload.
- **What-If Simulator** — recalculates a hypothetical portfolio (different budget/risk/holdings) without touching the real portfolio. Interface documented in `js/ai.js`.
- **Backtesting** — historical strategy testing against a benchmark. Interface documented in `js/ai.js`.
- **Live fundamentals** — would require either a paid market-data provider or replicating Yahoo's cookie/crumb auth flow (deliberately not done here); a paid provider is the more robust path and would slot into `api/yahoo.js` (or a new `api/fundamentals.js`) the same way.
- **Portfolio rebalancing suggestions, broker integrations, real-time WebSocket price feeds** — explicitly out of scope for this MVP per the phased build plan.

## 14. Testing Notes

Manually verified flows: signup → onboarding → risk profile → recommendations → build portfolio → dashboard → buy/sell → transactions → create + simulate-trigger an alert; live-data fetch success path and the demo-data fallback path (proxy unreachable) were both verified against `js/marketData.js`. Two personalization checks are core to this project and worth re-verifying after any engine change:

1. Same budget, different risk category → different stock weighting (`js/scoringEngine.js` + `js/recommendationEngine.js`).
2. Same risk category, different budget → different share counts/composition, not a naive linear scale.
