/**
 * recommendationEngine.js — Turns (budget, risk profile, scored stock
 * universe) into a concrete personalized portfolio draft: which stocks,
 * what % allocation, how many shares, and how much stays as cash.
 *
 * This is the module responsible for the two "must prove personalization
 * works" behaviors required by the spec:
 *   1. Same budget, different risk category -> different stock weighting.
 *   2. Same risk category, different budget -> different share counts /
 *      composition (not a naive linear scale of the same %s).
 * Both fall out naturally here because stock *selection* depends on
 * profile-weighted scores (ScoringEngine already varies by risk category)
 * and *share quantities* depend on floor(amount/price) against the actual
 * budget, so different budgets round to different leftover cash and can
 * even change how many stocks fit above a meaningful allocation.
 */
(function (global) {
  "use strict";

  const CASH_RESERVE_BY_CATEGORY = {
    Conservative: 0.15,
    Moderate: 0.12,
    Growth: 0.09,
    Aggressive: 0.06
  };

  function reservePctFor(category) {
    const c = CONFIG.PORTFOLIO_CONSTRAINTS;
    const target = CASH_RESERVE_BY_CATEGORY[category] != null ? CASH_RESERVE_BY_CATEGORY[category] : 0.10;
    return Math.max(c.cashReserveMin, Math.min(c.cashReserveMax, target));
  }

  function targetStockCount(budget, universeSize) {
    const c = CONFIG.PORTFOLIO_CONSTRAINTS;
    const byBudget = Math.floor(budget / 5000); // roughly one more stock per extra 5k
    const count = Math.max(c.minStockCount, Math.min(8, byBudget || c.minStockCount));
    return Math.min(count, universeSize);
  }

  // Greedily pick the highest-scored stocks while capping how many can
  // come from a single sector, so the initial candidate set is already
  // reasonably diversified before weighting.
  function selectDiversified(sortedStocks, targetCount) {
    const maxPerSector = 2;
    const sectorCounts = {};
    const selected = [];
    for (let i = 0; i < sortedStocks.length && selected.length < targetCount; i++) {
      const s = sortedStocks[i];
      const count = sectorCounts[s.sector] || 0;
      if (count >= maxPerSector) continue;
      selected.push(s);
      sectorCounts[s.sector] = count + 1;
    }
    // Backfill if sector caps left us short of targetCount.
    if (selected.length < targetCount) {
      for (let i = 0; i < sortedStocks.length && selected.length < targetCount; i++) {
        if (selected.indexOf(sortedStocks[i]) === -1) selected.push(sortedStocks[i]);
      }
    }
    return selected;
  }

  function rawWeights(selected) {
    // Accentuate score differences (score^1.5) so higher-conviction picks
    // get meaningfully more allocation, not just marginally more.
    const powered = selected.map(function (s) { return Math.pow(Math.max(1, s.score), 1.5); });
    const sum = powered.reduce(function (a, b) { return a + b; }, 0);
    const weights = {};
    selected.forEach(function (s, i) { weights[s.symbol] = powered[i] / sum; });
    return weights;
  }

  // Iteratively enforce max-single-stock and max-sector caps, redistributing
  // any clipped weight proportionally across the remaining uncapped stocks.
  function applyConstraints(selected, weights) {
    const constraints = CONFIG.PORTFOLIO_CONSTRAINTS;
    let w = Object.assign({}, weights);

    for (let pass = 0; pass < 6; pass++) {
      let changed = false;

      // Single-stock cap
      let excess = 0;
      const uncappedSymbols = [];
      selected.forEach(function (s) {
        if (w[s.symbol] > constraints.maxSingleStockAllocation) {
          excess += w[s.symbol] - constraints.maxSingleStockAllocation;
          w[s.symbol] = constraints.maxSingleStockAllocation;
          changed = true;
        } else {
          uncappedSymbols.push(s.symbol);
        }
      });
      if (excess > 0 && uncappedSymbols.length) {
        const uncappedSum = uncappedSymbols.reduce(function (sum, sym) { return sum + w[sym]; }, 0);
        uncappedSymbols.forEach(function (sym) {
          w[sym] += uncappedSum > 0 ? (w[sym] / uncappedSum) * excess : excess / uncappedSymbols.length;
        });
      }

      // Sector cap
      const bySector = {};
      selected.forEach(function (s) {
        bySector[s.sector] = bySector[s.sector] || [];
        bySector[s.sector].push(s.symbol);
      });
      Object.keys(bySector).forEach(function (sector) {
        const symbols = bySector[sector];
        const sectorTotal = symbols.reduce(function (sum, sym) { return sum + w[sym]; }, 0);
        if (sectorTotal > constraints.maxSectorAllocation) {
          const scale = constraints.maxSectorAllocation / sectorTotal;
          const freed = sectorTotal - constraints.maxSectorAllocation;
          symbols.forEach(function (sym) { w[sym] *= scale; });
          const others = selected.map(function (s) { return s.symbol; }).filter(function (sym) { return symbols.indexOf(sym) === -1; });
          const othersSum = others.reduce(function (sum, sym) { return sum + w[sym]; }, 0);
          if (others.length) {
            others.forEach(function (sym) {
              w[sym] += othersSum > 0 ? (w[sym] / othersSum) * freed : freed / others.length;
            });
          }
          changed = true;
        }
      });

      if (!changed) break;
    }

    // Final renormalize to guard against floating-point drift.
    const total = selected.reduce(function (sum, s) { return sum + w[s.symbol]; }, 0);
    selected.forEach(function (s) { w[s.symbol] = w[s.symbol] / total; });
    return w;
  }

  function portfolioFitLabel(rank, total) {
    const pct = rank / total;
    if (pct <= 0.34) return "High";
    if (pct <= 0.67) return "Medium";
    return "Growing";
  }

  function explainStock(stock) {
    const strengths = Object.keys(stock.labels).filter(function (k) { return stock.labels[k] === "Strong"; });
    const good = Object.keys(stock.labels).filter(function (k) { return stock.labels[k] === "Good"; });
    const notable = strengths.length ? strengths : good;
    const friendly = {
      financialStrength: "financial strength", growth: "growth characteristics", valuation: "valuation",
      risk: "risk profile", momentum: "price momentum", profitability: "profitability", dividend: "dividend consistency"
    };
    const parts = notable.slice(0, 2).map(function (k) { return friendly[k]; });
    const reason = parts.length
      ? "This stock scored well due to its " + parts.join(" and ") + "."
      : "This stock offers a balanced overall profile relative to the rest of the universe considered.";
    return reason + " It was included to help diversify your portfolio across sectors and risk characteristics.";
  }

  /**
   * buildPortfolio({ budget, riskCategory, scoredStocks })
   * scoredStocks must already come from ScoringEngine.scoreUniverse().
   */
  function buildPortfolio(opts) {
    const budget = Math.max(0, Number(opts.budget) || 0);
    const riskCategory = opts.riskCategory || "Moderate";
    const scored = (opts.scoredStocks || []).slice(); // already sorted desc by score

    if (budget <= 0) {
      return { budget: budget, riskCategory: riskCategory, positions: [], cashAmount: budget, cashPct: 1, reservePct: 1, generatedAt: new Date().toISOString(), error: "Budget must be greater than zero." };
    }

    const reservePct = reservePctFor(riskCategory);
    const investable = budget * (1 - reservePct);
    const targetCount = targetStockCount(budget, scored.length);
    const selected = selectDiversified(scored, targetCount);

    const rawW = rawWeights(selected);
    const finalW = applyConstraints(selected, rawW);

    let totalInvested = 0;
    const positions = selected.map(function (s, idx) {
      const amount = finalW[s.symbol] * investable;
      const shares = Math.floor(amount / s.price);
      const actualAmount = shares * s.price;
      totalInvested += actualAmount;
      return {
        symbol: s.symbol,
        companyName: s.companyName,
        sector: s.sector,
        score: s.score,
        subScores: s.subScores,
        labels: s.labels,
        price: s.price,
        volatility: s.volatility,
        allocationPct: finalW[s.symbol],
        amount: actualAmount,
        targetAmount: amount,
        shares: shares,
        portfolioFit: portfolioFitLabel(idx, selected.length),
        whyThisStock: explainStock(s)
      };
    }).filter(function (p) { return p.shares > 0; });

    const cashAmount = budget - totalInvested;

    return {
      budget: budget,
      riskCategory: riskCategory,
      reservePct: reservePct,
      positions: positions,
      totalInvested: totalInvested,
      cashAmount: cashAmount,
      cashPct: budget > 0 ? cashAmount / budget : 0,
      generatedAt: new Date().toISOString()
    };
  }

  global.RecommendationEngine = { buildPortfolio: buildPortfolio, explainStock: explainStock };
})(window);
