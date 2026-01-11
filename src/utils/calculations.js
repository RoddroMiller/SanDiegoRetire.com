/**
 * Financial calculation utilities for portfolio planning
 */

// Full Retirement Age for Social Security
const FULL_RETIREMENT_AGE = 67;
const EARLY_REDUCTION_RATE_FIRST_3_YEARS = 0.0667;
const EARLY_REDUCTION_RATE_AFTER_3_YEARS = 0.05;
const DELAYED_CREDIT_RATE = 0.08;

/**
 * Generate random number using Box-Muller transform for Monte Carlo simulations
 * @returns {number} Random number from standard normal distribution
 */
export const randn_bm = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

/**
 * Calculate adjusted Social Security benefit based on claiming age
 * @param {number} pia - Primary Insurance Amount (benefit at full retirement age)
 * @param {number} startAge - Age when benefits are claimed
 * @returns {number} Adjusted monthly benefit amount
 */
export const getAdjustedSS = (pia, startAge) => {
  if (startAge < FULL_RETIREMENT_AGE) {
    const yearsEarly = FULL_RETIREMENT_AGE - startAge;
    const reduction = yearsEarly <= 3
      ? yearsEarly * EARLY_REDUCTION_RATE_FIRST_3_YEARS
      : (3 * EARLY_REDUCTION_RATE_FIRST_3_YEARS) + ((yearsEarly - 3) * EARLY_REDUCTION_RATE_AFTER_3_YEARS);
    return pia * (1 - reduction);
  } else if (startAge > FULL_RETIREMENT_AGE) {
    return pia * (1 + ((startAge - FULL_RETIREMENT_AGE) * DELAYED_CREDIT_RATE));
  }
  return pia;
};

/**
 * Calculate accumulation phase data (portfolio growth before retirement)
 * @param {object} clientInfo - Client information object
 * @returns {Array} Array of yearly balance data points
 */
export const calculateAccumulation = (clientInfo) => {
  const { currentAge, retirementAge, currentPortfolio, annualSavings, expectedReturn } = clientInfo;
  const years = Math.max(0, retirementAge - currentAge);
  const data = [];
  let balance = currentPortfolio;

  for (let i = 0; i <= years; i++) {
    data.push({ age: currentAge + i, balance: Math.round(balance) });
    if (i < years) {
      balance += annualSavings;
      balance *= (1 + (expectedReturn / 100));
    }
  }
  return data;
};

/**
 * Calculate weighted portfolio return based on bucket allocations
 * @param {object} assumptions - Return assumptions for each bucket
 * @returns {number} Weighted return as decimal
 */
export const calculateWeightedReturn = (assumptions) => {
  return ((assumptions.b1.return * 0.1) +
    (assumptions.b2.return * 0.2) +
    (assumptions.b3.return * 0.3) +
    (assumptions.b4.return * 0.1) +
    (assumptions.b5.return * 0.3)) / 100;
};

/**
 * Calculate base distribution plan with bucket allocations
 * @param {object} inputs - Portfolio inputs
 * @param {object} assumptions - Return assumptions
 * @param {object} clientInfo - Client information
 * @returns {object} Base plan with bucket values and helper functions
 */
export const calculateBasePlan = (inputs, assumptions, clientInfo) => {
  const {
    totalPortfolio, monthlySpending, ssPIA, partnerSSPIA,
    ssStartAge, partnerSSStartAge, monthlyPension, pensionStartAge,
    inflationRate, withdrawalInflationFactor, additionalIncomes
  } = inputs;

  const clientSS = getAdjustedSS(ssPIA, ssStartAge);
  const partnerSS = getAdjustedSS(partnerSSPIA, partnerSSStartAge);
  const totalSS = clientSS + partnerSS;
  const effectiveInflationRate = inflationRate * (withdrawalInflationFactor / 100);

  // Get detailed cash flow numbers for a specific year
  const getAnnualDetails = (yearIndex) => {
    const simAge = clientInfo.retirementAge + yearIndex;
    const currentPartnerAge = clientInfo.partnerAge + (simAge - clientInfo.currentAge);
    const inflationFactor = Math.pow(1 + (effectiveInflationRate / 100), yearIndex);
    const expenses = monthlySpending * 12 * inflationFactor;

    let income = 0;
    if (simAge >= ssStartAge) income += clientSS * 12 * inflationFactor;
    if (clientInfo.isMarried && currentPartnerAge >= partnerSSStartAge) {
      income += partnerSS * 12 * inflationFactor;
    }

    if (simAge >= pensionStartAge) income += monthlyPension * 12 * inflationFactor;

    additionalIncomes.forEach(stream => {
      if (simAge >= stream.startAge && simAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= inflationFactor;
        income += streamAmount;
      }
    });

    const gap = Math.max(0, expenses - income);
    return { expenses, income, gap, simAge, currentPartnerAge };
  };

  const getAnnualGap = (yearIndex) => getAnnualDetails(yearIndex).gap;

  const calculateBucketNeed = (startYear, endYear, rate) => {
    let totalPV = 0;
    for (let year = startYear; year <= endYear; year++) {
      const futureGap = getAnnualGap(year - 1);
      const pvFactor = Math.pow(1 + (rate / 100), year - 1);
      totalPV += futureGap / pvFactor;
    }
    return totalPV;
  };

  const b1Val = Math.round(calculateBucketNeed(1, 3, assumptions.b1.return) / 1000) * 1000;
  const b2Val = Math.round(calculateBucketNeed(4, 6, assumptions.b2.return) / 1000) * 1000;
  const b3Val = Math.round(calculateBucketNeed(7, 14, assumptions.b3.return) / 1000) * 1000;
  const b4Val = Math.round((totalPortfolio * 0.10) / 1000) * 1000;
  const allocatedSoFar = b1Val + b2Val + b3Val + b4Val;
  const b5Val = totalPortfolio - allocatedSoFar;

  return {
    b1Val,
    b2Val,
    b3Val,
    b4Val,
    b5Val,
    isDeficit: b5Val < 0,
    getAnnualGap,
    getAnnualDetails,
    totalSS,
    getAdjustedSS
  };
};

/**
 * Run portfolio simulation (deterministic or Monte Carlo)
 * @param {object} basePlan - Base plan object
 * @param {object} assumptions - Return assumptions
 * @param {object} inputs - Portfolio inputs
 * @param {number} rebalanceFreq - Rebalancing frequency (0 = never)
 * @param {boolean} isMonteCarlo - Whether to run Monte Carlo simulation
 * @returns {Array|object} Simulation results
 */
export const runSimulation = (basePlan, assumptions, inputs, rebalanceFreq, isMonteCarlo = false) => {
  const { b1Val, b2Val, b3Val, b4Val, b5Val, getAnnualGap, getAnnualDetails } = basePlan;
  const years = 30;
  let results = [];
  let failureCount = 0;
  const iterations = isMonteCarlo ? 500 : 1;
  const benchmarkReturn = assumptions.b3.return / 100;

  for (let iter = 0; iter < iterations; iter++) {
    let balances = { b1: b1Val, b2: b2Val, b3: b3Val, b4: b4Val, b5: b5Val };
    let benchmarkBalance = inputs.totalPortfolio;
    let history = [];
    let failed = false;

    for (let i = 1; i <= years; i++) {
      const startTotal = Object.values(balances).reduce((a, b) => a + b, 0);
      let rates = {};

      if (isMonteCarlo) {
        rates.b1 = (assumptions.b1.return + assumptions.b1.stdDev * randn_bm()) / 100;
        rates.b2 = (assumptions.b2.return + assumptions.b2.stdDev * randn_bm()) / 100;
        rates.b3 = (assumptions.b3.return + assumptions.b3.stdDev * randn_bm()) / 100;
        rates.b4 = (assumptions.b4.return + assumptions.b4.stdDev * randn_bm()) / 100;
        rates.b5 = (assumptions.b5.return + assumptions.b5.stdDev * randn_bm()) / 100;
      } else {
        rates.b1 = assumptions.b1.return / 100;
        rates.b2 = assumptions.b2.return / 100;
        rates.b3 = assumptions.b3.return / 100;
        rates.b4 = assumptions.b4.return / 100;
        rates.b5 = assumptions.b5.return / 100;
      }

      const { expenses, income, gap, simAge, currentPartnerAge } = getAnnualDetails(i - 1);

      balances.b1 *= (1 + rates.b1);
      balances.b2 *= (1 + rates.b2);
      balances.b3 *= (1 + rates.b3);
      balances.b4 *= (1 + rates.b4);
      balances.b5 *= (1 + rates.b5);

      const postGrowthTotal = Object.values(balances).reduce((a, b) => a + b, 0);
      const annualGrowth = postGrowthTotal - startTotal;

      const appliedBench = isMonteCarlo
        ? (benchmarkReturn + (assumptions.b3.stdDev / 100) * randn_bm())
        : benchmarkReturn;
      benchmarkBalance *= (1 + appliedBench);

      let withdrawalAmount = gap;
      const totalWithdrawal = gap;

      if (benchmarkBalance >= gap) {
        benchmarkBalance -= gap;
      } else {
        benchmarkBalance = 0;
      }

      const withdrawOrder = rebalanceFreq === 0
        ? ['b1', 'b2', 'b3', 'b5', 'b4']
        : ['b1', 'b2', 'b5', 'b4', 'b3'];

      for (let b of withdrawOrder) {
        if (withdrawalAmount <= 0) break;
        if (balances[b] >= withdrawalAmount) {
          balances[b] -= withdrawalAmount;
          withdrawalAmount = 0;
        } else {
          withdrawalAmount -= balances[b];
          balances[b] = 0;
        }
      }

      if (rebalanceFreq > 0 && i % rebalanceFreq === 0) {
        const next3YearsGap = getAnnualGap(i) + getAnnualGap(i + 1) + getAnnualGap(i + 2);
        const refillNeeded = Math.max(0, next3YearsGap - balances.b1);
        let amountToRefill = refillNeeded;

        for (let b of ['b5', 'b4', 'b3']) {
          if (amountToRefill <= 0) break;
          if (balances[b] > amountToRefill) {
            balances[b] -= amountToRefill;
            balances.b1 += amountToRefill;
            amountToRefill = 0;
          } else if (balances[b] > 0) {
            amountToRefill -= balances[b];
            balances.b1 += balances[b];
            balances[b] = 0;
          }
        }
      }

      const total = Object.values(balances).reduce((a, b) => a + b, 0);
      if (total <= 0) failed = true;

      const distRate = startTotal > 0 ? (totalWithdrawal / startTotal) * 100 : 0;

      history.push({
        year: i,
        age: simAge,
        partnerAge: currentPartnerAge,
        startBalance: Math.round(startTotal),
        growth: Math.round(annualGrowth),
        ssIncome: Math.round(income),
        expenses: Math.round(expenses),
        distribution: Math.round(totalWithdrawal),
        total: Math.max(0, total),
        benchmark: Math.max(0, benchmarkBalance),
        distRate
      });
    }

    if (failed) failureCount++;
    results.push(history);
  }

  if (isMonteCarlo) {
    const processed = [];
    for (let y = 0; y < years; y++) {
      const vals = results.map(r => r[y]?.total || 0).sort((a, b) => a - b);
      processed.push({
        year: y + 1,
        p10: vals[Math.floor(iterations * 0.1)],
        median: vals[Math.floor(iterations * 0.5)],
        p90: vals[Math.floor(iterations * 0.9)]
      });
    }
    return { data: processed, successRate: ((iterations - failureCount) / iterations) * 100 };
  }

  return results[0];
};
