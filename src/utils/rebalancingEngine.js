/**
 * MWM Advanced Rebalancing Engine
 *
 * Tactical rebalancing: harvest equity gains in good years to refill B1 & B2.
 * In downturns, stop selling equities — liquidate B1 & B2 sequentially instead.
 * This preserves long-term equity positions through market cycles.
 */

import { HISTORICAL_RETURNS, getBucketReturn } from '../constants/historicalReturns';

// Box-Muller transform for standard normal random variable
const randn = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

/**
 * Run a tactical rebalancing simulation
 * @param {Object} params
 * @param {Object} params.initialBuckets - { b1, b2, b3, b4, b5 } starting values
 * @param {number} params.annualWithdrawal - Flat annual spending need (fallback)
 * @param {Array}  params.withdrawalSchedule - Optional per-year withdrawal amounts [amount0, amount1, ...] overrides flat
 * @param {Array}  params.surplusSchedule - Optional per-year surplus amounts (income > expenses, added to portfolio)
 * @param {number} params.startYear - First year of simulation (for historical data)
 * @param {number} params.years - Number of years to simulate
 * @param {string} params.mode - 'tactical' | 'scheduled' | 'sequential'
 * @param {Object} params.assumptions - Bucket return assumptions (used for projected targets)
 * @param {number} params.scheduledFreq - Rebalance frequency for 'scheduled' mode (default 3)
 * @param {Array}  params.precomputedReturns - Optional array of per-year return objects [{ b1, b2, b3, b4, b5 }]
 * @returns {Array} Year-by-year snapshots
 */
export const runTacticalSimulation = ({
  initialBuckets,
  annualWithdrawal,
  withdrawalSchedule = null,
  surplusSchedule = null,
  startYear,
  years,
  mode = 'tactical',
  assumptions = null,
  scheduledFreq = 3,
  precomputedReturns = null
}) => {
  const buckets = { ...initialBuckets };
  const history = [];
  let downturnMode = false;
  let equityPeak = buckets.b3 + buckets.b4 + buckets.b5;

  // Year 0: initial snapshot — same year as the illustration start, before returns/withdrawals
  history.push({
    year: startYear,
    yearIndex: 0,
    startTotal: Math.round(Object.values(buckets).reduce((a, b) => a + b, 0)),
    endTotal: Math.round(Object.values(buckets).reduce((a, b) => a + b, 0)),
    b1: Math.round(buckets.b1), b2: Math.round(buckets.b2), b3: Math.round(buckets.b3),
    b4: Math.round(buckets.b4), b5: Math.round(buckets.b5),
    withdrawal: 0, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0,
    returns: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 },
    equityReturn: 0, bondReturn: 0,
    downturnMode: false, rebalanceAction: 'none', rebalanceDetail: 'Starting allocation',
    equityPeak: Math.round(equityPeak), equityDrawdown: 0,
    equityBalance: Math.round(buckets.b3 + buckets.b4 + buckets.b5)
  });

  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    const yearData = precomputedReturns ? null : HISTORICAL_RETURNS[year];
    const startTotal = Object.values(buckets).reduce((a, b) => a + b, 0);
    const startEquity = buckets.b3 + buckets.b4 + buckets.b5;

    // Apply returns
    const returns = {};
    for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
      if (precomputedReturns && precomputedReturns[i]) {
        returns[bk] = precomputedReturns[i][bk];
      } else if (yearData) {
        returns[bk] = getBucketReturn(bk, year);
      } else {
        returns[bk] = assumptions ? (assumptions[bk]?.return || 5) / 100 : 0.05;
      }
      buckets[bk] *= (1 + returns[bk]);
    }

    const postGrowthTotal = Object.values(buckets).reduce((a, b) => a + b, 0);
    const postGrowthEquity = buckets.b3 + buckets.b4 + buckets.b5;

    if (postGrowthEquity > equityPeak) {
      equityPeak = postGrowthEquity;
    }

    let rebalanceAction = 'none';
    let rebalanceDetail = '';
    const equityDrawdown = equityPeak > 0 ? (equityPeak - postGrowthEquity) / equityPeak : 0;

    // Compute blended equity return for display
    const equityReturnPct = startEquity > 0
      ? ((postGrowthEquity - startEquity) / startEquity) * 100
      : 0;

    if (mode === 'tactical') {
      // --- MWM Tactical Rebalancing ---
      // Normal markets: rebalance annually to target allocations (same as scheduled but yearly).
      //   This keeps B1/B2 funded as a spending buffer and maintains diversification.
      // Downturns (equity drawdown > 15% from peak): FREEZE rebalancing.
      //   Spend from B1/B2 reserves only. Do NOT sell equities at depressed prices.
      //   This is the tactical edge — avoiding forced liquidation at the bottom.
      // Recovery: resume normal rebalancing once equities recover to within 5% of peak.

      if (equityDrawdown > 0.15) {
        // DOWNTURN: freeze rebalancing, protect equity positions
        if (!downturnMode) {
          downturnMode = true;
          rebalanceAction = 'downturn_enter';
          rebalanceDetail = `Equity drawdown ${(equityDrawdown * 100).toFixed(1)}% from peak — freezing rebalancing, spending from B1/B2`;
        } else {
          rebalanceAction = 'downturn_hold';
          rebalanceDetail = `Downturn hold: preserving equities, spending B1/B2 (${(equityDrawdown * 100).toFixed(1)}% from peak)`;
        }
      } else if (downturnMode && postGrowthEquity >= equityPeak * 0.95) {
        // RECOVERY: resume rebalancing
        downturnMode = false;
        rebalanceAction = 'recovery';
        rebalanceDetail = `Equities recovered to ${((postGrowthEquity / equityPeak) * 100).toFixed(1)}% of peak — resuming rebalancing`;
        equityPeak = postGrowthEquity;

        // Rebalance on recovery
        const total = Object.values(buckets).reduce((a, b) => a + b, 0);
        const origTotal = Object.values(initialBuckets).reduce((a, b) => a + b, 0);
        if (total > 0 && origTotal > 0) {
          for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
            buckets[bk] = total * (initialBuckets[bk] / origTotal);
          }
        }
      } else if (!downturnMode) {
        // NORMAL: rebalance annually to target allocations
        const total = Object.values(buckets).reduce((a, b) => a + b, 0);
        const origTotal = Object.values(initialBuckets).reduce((a, b) => a + b, 0);
        if (total > 0 && origTotal > 0) {
          for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
            buckets[bk] = total * (initialBuckets[bk] / origTotal);
          }
          rebalanceAction = 'harvest';
          rebalanceDetail = `Rebalanced to targets — B1/B2 refilled from equity gains`;
        }
      }
      // else: in downturn, do NOT rebalance — let buckets drift

    } else if (mode === 'scheduled' && scheduledFreq > 0 && (i + 1) % scheduledFreq === 0) {
      const total = Object.values(buckets).reduce((a, b) => a + b, 0);
      const origTotal = Object.values(initialBuckets).reduce((a, b) => a + b, 0);
      if (total > 0 && origTotal > 0) {
        for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
          buckets[bk] = total * (initialBuckets[bk] / origTotal);
        }
        rebalanceAction = 'scheduled';
        rebalanceDetail = `Rebalanced to target allocation`;
      }
    }

    // Determine this year's withdrawal (from schedule or flat)
    const yearWithdrawal = withdrawalSchedule ? (withdrawalSchedule[i] ?? annualWithdrawal) : annualWithdrawal;
    const yearSurplus = surplusSchedule ? (surplusSchedule[i] ?? 0) : 0;

    // If there's a surplus (income > expenses), add it to the portfolio instead of withdrawing
    if (yearSurplus > 0) {
      buckets.b5 += yearSurplus; // Surplus flows to long-term bucket
    }

    let withdrawal = yearWithdrawal;
    const withdrawals = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 };

    if (mode === 'tactical') {
      if (downturnMode) {
        // Downturn: spend from B1 first, then B2 — preserve B3-B5
        for (const bk of ['b1', 'b2']) {
          if (withdrawal <= 0) break;
          const take = Math.min(withdrawal, buckets[bk]);
          withdrawals[bk] = take;
          buckets[bk] -= take;
          withdrawal -= take;
        }
        if (withdrawal > 0) {
          for (const bk of ['b3', 'b4', 'b5']) {
            if (withdrawal <= 0) break;
            const take = Math.min(withdrawal, buckets[bk]);
            withdrawals[bk] = take;
            buckets[bk] -= take;
            withdrawal -= take;
          }
          if (withdrawals.b3 > 0 || withdrawals.b4 > 0 || withdrawals.b5 > 0) {
            rebalanceDetail += ' (B1/B2 exhausted, forced equity liquidation)';
          }
        }
      } else {
        // Normal tactical: spend from B1 only (its purpose is near-term liquidity).
        // The harvest mechanism keeps B1 funded from equity gains.
        // If B1 is depleted, fall through to B2, then B3+.
        const b1Take = Math.min(withdrawal, buckets.b1);
        if (b1Take > 0) {
          withdrawals.b1 = b1Take;
          buckets.b1 -= b1Take;
          withdrawal -= b1Take;
        }
        if (withdrawal > 0) {
          // B1 wasn't enough — draw from B2
          const b2Take = Math.min(withdrawal, buckets.b2);
          if (b2Take > 0) {
            withdrawals.b2 = b2Take;
            buckets.b2 -= b2Take;
            withdrawal -= b2Take;
          }
        }
        if (withdrawal > 0) {
          // B1+B2 exhausted — draw from equity buckets as last resort
          for (const bk of ['b3', 'b4', 'b5']) {
            if (withdrawal <= 0) break;
            const take = Math.min(withdrawal, buckets[bk]);
            withdrawals[bk] = take;
            buckets[bk] -= take;
            withdrawal -= take;
          }
        }
      }
    } else {
      // Sequential / scheduled: standard B1 → B2 → B3 → B4 → B5
      for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
        if (withdrawal <= 0) break;
        const take = Math.min(withdrawal, buckets[bk]);
        withdrawals[bk] = take;
        buckets[bk] -= take;
        withdrawal -= take;
      }
    }

    const endTotal = Object.values(buckets).reduce((a, b) => a + b, 0);
    const endEquity = buckets.b3 + buckets.b4 + buckets.b5;

    history.push({
      year,
      yearIndex: i + 1,
      startTotal: Math.round(startTotal),
      endTotal: Math.round(endTotal),
      b1: Math.round(buckets.b1),
      b2: Math.round(buckets.b2),
      b3: Math.round(buckets.b3),
      b4: Math.round(buckets.b4),
      b5: Math.round(buckets.b5),
      withdrawal: Math.round(yearWithdrawal),
      surplus: Math.round(yearSurplus),
      w1: Math.round(withdrawals.b1),
      w2: Math.round(withdrawals.b2),
      w3: Math.round(withdrawals.b3),
      w4: Math.round(withdrawals.b4),
      w5: Math.round(withdrawals.b5),
      returns: { ...returns },
      equityReturn: yearData ? yearData.equity : equityReturnPct,
      bondReturn: yearData ? yearData.bonds : 0,
      downturnMode,
      rebalanceAction,
      rebalanceDetail,
      equityPeak: Math.round(equityPeak),
      equityDrawdown: Math.round(equityDrawdown * 100),
      equityBalance: Math.round(endEquity)
    });
  }

  return history;
};

/**
 * Run comparison of tactical vs scheduled rebalancing (historical)
 */
export const runRebalancingComparison = ({ initialBuckets, annualWithdrawal, withdrawalSchedule, surplusSchedule, startYear, years, assumptions, scheduledFreq = 3 }) => {
  const common = { initialBuckets, annualWithdrawal, withdrawalSchedule, surplusSchedule, startYear, years, assumptions };
  const tactical = runTacticalSimulation({ ...common, mode: 'tactical' });
  const scheduled = runTacticalSimulation({ ...common, mode: 'scheduled', scheduledFreq });
  const sequential = runTacticalSimulation({ ...common, mode: 'sequential' });

  return { tactical, scheduled, sequential };
};

/**
 * Generate random per-year returns for all buckets using assumptions (mean + stdDev)
 */
const generateRandomReturns = (assumptions, years) => {
  const returns = [];
  for (let i = 0; i < years; i++) {
    const yearReturns = {};
    for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
      const mean = (assumptions[bk]?.return || 5) / 100;
      const std = (assumptions[bk]?.stdDev || 5) / 100;
      yearReturns[bk] = mean + std * randn();
    }
    returns.push(yearReturns);
  }
  return returns;
};

/**
 * Run Monte Carlo rebalancing simulation and extract percentile paths.
 * Returns p10 (conservative), p50 (median), and p90 (optimistic) paths
 * for both tactical and scheduled strategies.
 *
 * @param {Object} params
 * @param {Object} params.initialBuckets
 * @param {number} params.annualWithdrawal
 * @param {number} params.years
 * @param {Object} params.assumptions - Bucket return/stdDev assumptions
 * @param {number} params.iterations - Number of MC iterations (default 500)
 * @param {number} params.scheduledFreq
 * @returns {{ optimistic, median, conservative }} Each contains { tactical, scheduled }
 */
export const runMonteCarloRebalancing = ({
  initialBuckets,
  annualWithdrawal,
  withdrawalSchedule = null,
  surplusSchedule = null,
  years,
  assumptions,
  iterations = 500,
  scheduledFreq = 3
}) => {
  const startYear = new Date().getFullYear();

  const tacticalResults = [];
  const scheduledResults = [];
  const tacticalHistories = [];
  const scheduledHistories = [];

  for (let iter = 0; iter < iterations; iter++) {
    const returnSequence = generateRandomReturns(assumptions, years);
    const common = { initialBuckets, annualWithdrawal, withdrawalSchedule, surplusSchedule, startYear, years, assumptions, precomputedReturns: returnSequence };

    const tacticalRun = runTacticalSimulation({ ...common, mode: 'tactical' });
    const scheduledRun = runTacticalSimulation({ ...common, mode: 'scheduled', scheduledFreq });

    tacticalResults.push(tacticalRun.map(r => r.endTotal));
    scheduledResults.push(scheduledRun.map(r => r.endTotal));
    tacticalHistories.push(tacticalRun);
    scheduledHistories.push(scheduledRun);
  }

  // For each year, sort end totals to find percentile iterations
  const findPercentileIteration = (results, percentile) => {
    // Use final year value to rank iterations
    const finalYear = results[0].length - 1;
    const indexed = results.map((r, idx) => ({ idx, val: r[finalYear] }));
    indexed.sort((a, b) => a.val - b.val);
    const pIdx = Math.floor(indexed.length * percentile);
    return indexed[Math.min(pIdx, indexed.length - 1)].idx;
  };

  // Find the iteration that represents each percentile based on final portfolio value
  const tacticalP10Idx = findPercentileIteration(tacticalResults, 0.10);
  const tacticalP50Idx = findPercentileIteration(tacticalResults, 0.50);
  const tacticalP90Idx = findPercentileIteration(tacticalResults, 0.90);

  const scheduledP10Idx = findPercentileIteration(scheduledResults, 0.10);
  const scheduledP50Idx = findPercentileIteration(scheduledResults, 0.50);
  const scheduledP90Idx = findPercentileIteration(scheduledResults, 0.90);

  return {
    conservative: {
      tactical: tacticalHistories[tacticalP10Idx],
      scheduled: scheduledHistories[scheduledP10Idx],
      label: 'Conservative (P10)'
    },
    median: {
      tactical: tacticalHistories[tacticalP50Idx],
      scheduled: scheduledHistories[scheduledP50Idx],
      label: 'Median (P50)'
    },
    optimistic: {
      tactical: tacticalHistories[tacticalP90Idx],
      scheduled: scheduledHistories[scheduledP90Idx],
      label: 'Optimistic (P90)'
    }
  };
};
