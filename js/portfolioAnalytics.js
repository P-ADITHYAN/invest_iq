/**
 * portfolioAnalytics.js — Deterministic portfolio-level analytics:
 * return %, volatility, max drawdown, Sharpe ratio, beta vs NIFTY50, a
 * composite Portfolio Health score, and sector exposure.
 *
 * All calculations are formula-driven from real inputs (current
 * holdings, demo historical price series, demo NIFTY50 benchmark
 * series) — nothing here is a random or hard-coded placeholder number.
 * The Sharpe ratio explicitly labels its risk-free-rate assumption
 * (CONFIG.RISK_FREE_RATE_ANNUAL) wherever it's displayed.
 */
(function (global) {
  "use strict";

  function returnPct(investedValue, currentValue) {
    if (!investedValue) return 0;
    return ((currentValue - investedValue) / investedValue) * 100;
  }

  function dailyReturns(series) {
    const returns = [];
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      returns.push(prev === 0 ? 0 : (series[i] - prev) / prev);
    }
    return returns;
  }

  function stdev(values) {
    if (!values.length) return 0;
    const mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    const variance = values.reduce(function (sum, v) { return sum + Math.pow(v - mean, 2); }, 0) / values.length;
    return Math.sqrt(variance);
  }

  // Builds a synthetic day-by-day portfolio value series by weighting each
  // held stock's demo historical series by the CURRENT quantity held. This
  // approximates how the portfolio would have moved, for volatility/beta/
  // drawdown purposes, using the same demo data shown on stock pages.
  function buildValueSeries(holdings) {
    if (!holdings.length) return [];
    const seriesPerStock = holdings.map(function (h) {
      return DemoHistorical.getSeriesFor(h.symbol, h.currentPrice, h.volatility || 22);
    });
    const len = Math.min.apply(null, seriesPerStock.map(function (s) { return s.length; }));
    const combined = [];
    for (let i = 0; i < len; i++) {
      let total = 0;
      holdings.forEach(function (h, idx) {
        total += seriesPerStock[idx][i].close * h.quantity;
      });
      combined.push(total);
    }
    return combined;
  }

  function maxDrawdown(valueSeries) {
    let peak = -Infinity;
    let maxDd = 0;
    valueSeries.forEach(function (v) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? (peak - v) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    });
    return maxDd * 100;
  }

  function annualizedVolatility(valueSeries) {
    const returns = dailyReturns(valueSeries);
    return stdev(returns) * Math.sqrt(252) * 100;
  }

  function sharpeRatio(valueSeries, riskFreeAnnual) {
    const returns = dailyReturns(valueSeries);
    if (!returns.length) return 0;
    const meanDaily = returns.reduce(function (a, b) { return a + b; }, 0) / returns.length;
    const annualizedReturn = meanDaily * 252;
    const vol = stdev(returns) * Math.sqrt(252);
    if (vol === 0) return 0;
    return (annualizedReturn - riskFreeAnnual) / vol;
  }

  function beta(portfolioSeries, benchmarkSeries) {
    const len = Math.min(portfolioSeries.length, benchmarkSeries.length);
    const pReturns = dailyReturns(portfolioSeries.slice(-len));
    const bReturns = dailyReturns(benchmarkSeries.slice(-len));
    const n = Math.min(pReturns.length, bReturns.length);
    if (n < 2) return 1;
    const pMean = pReturns.slice(-n).reduce(function (a, b) { return a + b; }, 0) / n;
    const bMean = bReturns.slice(-n).reduce(function (a, b) { return a + b; }, 0) / n;
    let cov = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      cov += (pReturns[i] - pMean) * (bReturns[i] - bMean);
      varB += Math.pow(bReturns[i] - bMean, 2);
    }
    return varB === 0 ? 1 : cov / varB;
  }

  function sectorExposure(holdings, cashAmount, totalValue) {
    const bySector = {};
    holdings.forEach(function (h) {
      bySector[h.sector] = (bySector[h.sector] || 0) + h.currentValue;
    });
    const rows = Object.keys(bySector).map(function (sector) {
      return { sector: sector, value: bySector[sector], pct: totalValue > 0 ? (bySector[sector] / totalValue) * 100 : 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    if (cashAmount > 0) {
      rows.push({ sector: "Cash", value: cashAmount, pct: totalValue > 0 ? (cashAmount / totalValue) * 100 : 0 });
    }
    return rows;
  }

  function diversificationScore(holdings, totalInvested) {
    if (!holdings.length || totalInvested <= 0) return 0;
    const hhi = holdings.reduce(function (sum, h) {
      const w = h.currentValue / totalInvested;
      return sum + w * w;
    }, 0);
    // HHI ranges from 1/n (ideal) to 1 (all in one stock). Convert to 0-100.
    const idealHHI = 1 / holdings.length;
    const score = 100 * (1 - (hhi - idealHHI) / (1 - idealHHI || 1));
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function sectorBalanceScore(sectorRows) {
    const maxPct = sectorRows.filter(function (r) { return r.sector !== "Cash"; })
      .reduce(function (max, r) { return Math.max(max, r.pct); }, 0);
    return Math.max(0, Math.min(100, Math.round(120 - maxPct)));
  }

  function financialQualityScore(holdingsWithScores, totalInvested) {
    if (!holdingsWithScores.length || totalInvested <= 0) return 0;
    const weighted = holdingsWithScores.reduce(function (sum, h) {
      const w = h.currentValue / totalInvested;
      const quality = ((h.subScores && h.subScores.financialStrength) || 50) * 0.5 +
        ((h.subScores && h.subScores.profitability) || 50) * 0.5;
      return sum + quality * w;
    }, 0);
    return Math.round(Math.max(0, Math.min(100, weighted)));
  }

  function volatilityScore(annualVolPct) {
    return Math.max(0, Math.min(100, Math.round(100 - annualVolPct * 2)));
  }

  function riskScore(betaValue, annualVolPct) {
    return Math.max(0, Math.min(100, Math.round(100 - Math.abs(betaValue - 1) * 60 - annualVolPct * 1.0)));
  }

  /**
   * computeHealth(holdings, cashAmount, holdingsWithScores)
   * holdings: [{symbol, sector, currentValue, quantity, currentPrice, volatility}]
   * holdingsWithScores: optional matching array carrying .subScores (from
   *   ScoringEngine) for the financial-quality sub-score; falls back to 50
   *   (neutral) per holding if not supplied.
   */
  function computeHealth(holdings, cashAmount) {
    const totalInvested = holdings.reduce(function (sum, h) { return sum + h.currentValue; }, 0);
    const totalValue = totalInvested + cashAmount;
    const sectors = sectorExposure(holdings, cashAmount, totalValue);

    const valueSeries = buildValueSeries(holdings);
    const vol = valueSeries.length > 1 ? annualizedVolatility(valueSeries) : 0;
    const dd = valueSeries.length > 1 ? maxDrawdown(valueSeries) : 0;
    const sharpe = valueSeries.length > 1 ? sharpeRatio(valueSeries, CONFIG.RISK_FREE_RATE_ANNUAL) : 0;
    const benchmarkSeries = DemoHistorical.getBenchmarkSeries().map(function (p) { return p.close; });
    const betaValue = valueSeries.length > 1 ? beta(valueSeries, benchmarkSeries) : 1;

    const diversification = diversificationScore(holdings, totalInvested);
    const sectorBalance = sectorBalanceScore(sectors);
    const financialQuality = financialQualityScore(holdings, totalInvested);
    const volScore = volatilityScore(vol);
    const riskSub = riskScore(betaValue, vol);

    const overall = Math.round((diversification + sectorBalance + financialQuality + volScore + riskSub) / 5);

    return {
      overall: overall,
      breakdown: {
        diversification: diversification,
        risk: riskSub,
        sectorBalance: sectorBalance,
        financialQuality: financialQuality,
        volatility: volScore
      },
      raw: { annualizedVolatilityPct: vol, maxDrawdownPct: dd, sharpeRatio: sharpe, beta: betaValue, riskFreeRateAssumed: CONFIG.RISK_FREE_RATE_ANNUAL },
      sectorExposure: sectors,
      sectorWarning: sectors.some(function (r) { return r.sector !== "Cash" && r.pct > CONFIG.SECTOR_WARNING_THRESHOLD * 100; })
    };
  }

  global.PortfolioAnalytics = {
    returnPct, maxDrawdown, annualizedVolatility, sharpeRatio, beta,
    sectorExposure, diversificationScore, computeHealth, buildValueSeries
  };
})(window);
