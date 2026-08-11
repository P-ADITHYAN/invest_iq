/**
 * data/learnContent.js — Beginner education content (spec §42).
 * Each topic: explanation, example, why it matters, common beginner mistake.
 */
(function (global) {
  "use strict";

  const LEARN_CATEGORIES = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: "book",
      topics: [
        {
          slug: "what-is-a-stock",
          title: "What is a stock?",
          explanation: "A stock (or share) represents a small ownership stake in a company. When you buy a share of a company listed on the NSE, you own a tiny fraction of that business.",
          example: "If a company has 1,000 shares and you own 10, you own 1% of the company.",
          whyItMatters: "Understanding this is the foundation for everything else — stock prices move because the market's view of a company's future value changes.",
          commonMistake: "Thinking of a stock symbol as just 'a number that goes up or down' rather than a real business you partly own."
        },
        {
          slug: "how-the-nse-works",
          title: "How the NSE works",
          explanation: "The National Stock Exchange (NSE) is where buyers and sellers of Indian stocks are matched electronically. Prices move continuously based on supply and demand during market hours.",
          example: "The NIFTY 50 index tracks the 50 largest NSE-listed companies and is a common benchmark for 'how the market is doing'.",
          whyItMatters: "Knowing how trades execute helps you understand why prices update in real time and what 'market open/close' means.",
          commonMistake: "Assuming a stock's price is set by a company directly, rather than by real buyers and sellers trading on the exchange."
        },
        {
          slug: "why-invest-early",
          title: "Why start investing early",
          explanation: "Investing earlier gives your money more time to compound — to earn returns on top of previous returns.",
          example: "₹10,000 growing at 10% a year becomes roughly ₹17,000 in 5 years, but roughly ₹26,000 in 10 years — the extra 5 years matter more than the extra amount invested.",
          whyItMatters: "Time in the market, not timing the market, is one of the most reliable ways to build wealth for beginners.",
          commonMistake: "Waiting for the 'perfect' entry point and delaying starting altogether."
        }
      ]
    },
    {
      id: "fundamental-analysis",
      title: "Fundamental Analysis",
      icon: "target",
      topics: [
        {
          slug: "reading-pe-ratio",
          title: "Reading the P/E ratio",
          explanation: "The Price-to-Earnings (P/E) ratio compares a company's share price to its earnings per share. It's a rough gauge of how expensive a stock is relative to its profits.",
          example: "A stock trading at ₹100 with ₹5 earnings per share has a P/E of 20 — investors are paying ₹20 for every ₹1 of annual profit.",
          whyItMatters: "P/E helps compare valuation across similar companies, though it should never be used alone.",
          commonMistake: "Assuming a lower P/E always means a 'better deal' without checking why it's cheap."
        },
        {
          slug: "roe-and-roce",
          title: "ROE and ROCE explained",
          explanation: "Return on Equity (ROE) measures how efficiently a company turns shareholder money into profit. Return on Capital Employed (ROCE) does the same but includes debt too.",
          example: "A company with ₹100 crore in equity and ₹18 crore in profit has an 18% ROE.",
          whyItMatters: "High and consistent ROE/ROCE often signals a well-run, financially strong business.",
          commonMistake: "Comparing ROE across very different industries without adjusting for typical capital intensity."
        },
        {
          slug: "debt-to-equity",
          title: "Understanding debt-to-equity",
          explanation: "Debt-to-equity compares how much a company owes to how much shareholders have invested. Lower generally means less financial risk.",
          example: "A debt-to-equity of 0.5 means the company has ₹0.50 of debt for every ₹1 of shareholder equity.",
          whyItMatters: "Highly indebted companies are more vulnerable during downturns or rising interest rates.",
          commonMistake: "Treating all debt as bad — some capital-intensive industries (like utilities) normally carry more debt."
        }
      ]
    },
    {
      id: "technical-analysis",
      title: "Technical Analysis",
      icon: "trend",
      topics: [
        {
          slug: "moving-averages",
          title: "What are moving averages?",
          explanation: "A moving average smooths out daily price noise by averaging the last N days of closing prices, making the overall trend easier to see.",
          example: "A 50-day moving average is the average closing price over the last 50 trading days, recalculated daily.",
          whyItMatters: "Moving averages help visualize trend direction without reacting to every single day's noise.",
          commonMistake: "Treating a moving-average crossover as a guaranteed buy/sell signal rather than one input among many."
        },
        {
          slug: "volatility-basics",
          title: "Volatility, in plain English",
          explanation: "Volatility measures how much a stock's price swings up and down over time. Higher volatility means bigger, faster price moves in both directions.",
          example: "A stock with 35% annualized volatility moves around much more sharply than one with 15%.",
          whyItMatters: "Understanding volatility helps you size positions appropriately for your comfort level.",
          commonMistake: "Confusing volatility with 'bad' — volatile stocks can also offer more upside, not just more downside."
        }
      ]
    },
    {
      id: "portfolio-management",
      title: "Portfolio Management",
      icon: "pie",
      topics: [
        {
          slug: "why-diversify",
          title: "Why diversification matters",
          explanation: "Diversification means spreading your money across different stocks and sectors so that one company's bad news doesn't sink your whole portfolio.",
          example: "Holding 8 stocks across 5 sectors is generally less risky than holding 8 stocks all in IT.",
          whyItMatters: "It reduces the impact of any single company or sector underperforming.",
          commonMistake: "Thinking you're diversified just because you own many stocks — if they're all in the same sector, you're not."
        },
        {
          slug: "rebalancing-basics",
          title: "What is rebalancing?",
          explanation: "Rebalancing means adjusting your holdings periodically to bring them back to your target allocation as prices drift over time.",
          example: "If a stock grows to 40% of your portfolio when your target was 20%, rebalancing means trimming it back.",
          whyItMatters: "Without rebalancing, winners can grow into an outsized, riskier share of your portfolio.",
          commonMistake: "Rebalancing too frequently, which can rack up unnecessary trading and taxes in a real account."
        }
      ]
    },
    {
      id: "risk-management",
      title: "Risk Management",
      icon: "bell",
      topics: [
        {
          slug: "stop-loss-basics",
          title: "What is a stop-loss?",
          explanation: "A stop-loss is a rule to automatically sell a stock if it falls to a certain price, limiting how much you can lose on that position.",
          example: "Buying at ₹100 with a stop-loss at ₹90 caps your loss on that trade to roughly 10%.",
          whyItMatters: "Stop-losses remove emotion from the decision to cut a losing position.",
          commonMistake: "Setting a stop-loss so tight that normal day-to-day volatility triggers it unnecessarily."
        },
        {
          slug: "sharpe-ratio",
          title: "The Sharpe ratio, simplified",
          explanation: "The Sharpe ratio measures how much return you earned for the amount of risk (volatility) you took on, relative to a risk-free investment.",
          example: "Two portfolios with the same return, but one with lower volatility, will have a higher Sharpe ratio.",
          whyItMatters: "It helps compare whether higher returns actually came with proportionally higher risk.",
          commonMistake: "Comparing Sharpe ratios calculated over different time periods or risk-free rate assumptions."
        }
      ]
    }
  ];

  global.LEARN_CATEGORIES = LEARN_CATEGORIES;
})(window);
