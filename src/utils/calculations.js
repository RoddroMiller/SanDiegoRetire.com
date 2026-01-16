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
 * @param {number} inflationRate - Annual inflation rate for savings adjustment
 * @param {Array} additionalIncomes - Additional income streams including one-time events
 * @returns {Array} Array of yearly balance data points
 */
export const calculateAccumulation = (clientInfo, inflationRate = 0, additionalIncomes = []) => {
  const { currentAge, retirementAge, currentPortfolio, annualSavings, expectedReturn } = clientInfo;
  const years = Math.max(0, retirementAge - currentAge);
  const data = [];
  let balance = currentPortfolio;

  for (let i = 0; i <= years; i++) {
    const currentSimAge = currentAge + i;

    // Add one-time events that occur at this age BEFORE retirement
    // Events AT retirement age are handled in the distribution phase
    additionalIncomes.forEach(income => {
      if (income.isOneTime && income.startAge === currentSimAge && currentSimAge < retirementAge) {
        let amount = income.amount;
        if (income.inflationAdjusted) {
          amount *= Math.pow(1 + (inflationRate / 100), i);
        }
        balance += amount;
      }
    });

    data.push({ age: currentSimAge, balance: Math.round(balance) });
    if (i < years) {
      const inflationAdjustedSavings = annualSavings * Math.pow(1 + (inflationRate / 100), i);
      balance += inflationAdjustedSavings;
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
    ssStartAge, partnerSSStartAge, monthlyPension, pensionStartAge, pensionCOLA,
    inflationRate, personalInflationRate, additionalIncomes
  } = inputs;

  // If already retired (currentAge > retirementAge), start simulation from currentAge
  const simulationStartAge = Math.max(clientInfo.currentAge, clientInfo.retirementAge);

  // For clients over FRA who entered current SS benefit, use the value directly (no adjustment)
  // For clients under FRA, apply the standard adjustment based on claiming age
  const clientSS = clientInfo.currentAge >= 67 ? ssPIA : getAdjustedSS(ssPIA, ssStartAge);
  const partnerSS = clientInfo.partnerAge >= 67 ? partnerSSPIA : getAdjustedSS(partnerSSPIA, partnerSSStartAge);
  const totalSS = clientSS + partnerSS;

  // Get detailed cash flow numbers for a specific year
  const getAnnualDetails = (yearIndex) => {
    const simAge = simulationStartAge + yearIndex;
    const currentPartnerAge = clientInfo.partnerAge + (simAge - clientInfo.currentAge);
    // Expenses use personal inflation rate
    const expenseInflationFactor = Math.pow(1 + (personalInflationRate / 100), yearIndex);
    // Income (SS, pension) uses full inflation rate
    const incomeInflationFactor = Math.pow(1 + (inflationRate / 100), yearIndex);
    const expenses = monthlySpending * 12 * expenseInflationFactor;

    let income = 0;
    // For clients 67+, assume already collecting SS; otherwise check start age
    if (clientInfo.currentAge >= 67 || simAge >= ssStartAge) {
      income += clientSS * 12 * incomeInflationFactor;
    }
    if (clientInfo.isMarried && (clientInfo.partnerAge >= 67 || currentPartnerAge >= partnerSSStartAge)) {
      income += partnerSS * 12 * incomeInflationFactor;
    }

    if (simAge >= pensionStartAge) {
      income += monthlyPension * 12 * (pensionCOLA ? incomeInflationFactor : 1);
    }

    // Recurring additional incomes (monthly * 12)
    additionalIncomes.forEach(stream => {
      if (!stream.isOneTime && simAge >= stream.startAge && simAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        income += streamAmount;
      }
    });

    // One-time contributions (added to portfolio, not income)
    let oneTimeContributions = 0;
    additionalIncomes.forEach(stream => {
      if (stream.isOneTime && simAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        oneTimeContributions += streamAmount;
      }
    });

    const gap = Math.max(0, expenses - income);
    return { expenses, income, gap, simAge, currentPartnerAge, oneTimeContributions };
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

      const { expenses, income, gap, simAge, currentPartnerAge, oneTimeContributions } = getAnnualDetails(i - 1);

      balances.b1 *= (1 + rates.b1);
      balances.b2 *= (1 + rates.b2);
      balances.b3 *= (1 + rates.b3);
      balances.b4 *= (1 + rates.b4);
      balances.b5 *= (1 + rates.b5);

      // Add one-time contributions to b5 (long-term bucket)
      if (oneTimeContributions > 0) {
        balances.b5 += oneTimeContributions;
      }

      const postGrowthTotal = Object.values(balances).reduce((a, b) => a + b, 0);
      const annualGrowth = postGrowthTotal - startTotal - oneTimeContributions;

      const appliedBench = isMonteCarlo
        ? (benchmarkReturn + (assumptions.b3.stdDev / 100) * randn_bm())
        : benchmarkReturn;
      benchmarkBalance *= (1 + appliedBench);

      // Add one-time contributions to benchmark as well
      if (oneTimeContributions > 0) {
        benchmarkBalance += oneTimeContributions;
      }

      let withdrawalAmount = gap;
      const totalWithdrawal = gap;

      if (benchmarkBalance >= gap) {
        benchmarkBalance -= gap;
      } else {
        benchmarkBalance = 0;
      }

      // Sequential withdrawal: B1 → B2 → B3 → B4 → B5 (B5 is last)
      // Track withdrawals from each bucket
      const withdrawOrder = ['b1', 'b2', 'b3', 'b4', 'b5'];
      const withdrawalsFromBucket = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 };

      for (let b of withdrawOrder) {
        if (withdrawalAmount <= 0) break;
        if (balances[b] >= withdrawalAmount) {
          withdrawalsFromBucket[b] = withdrawalAmount;
          balances[b] -= withdrawalAmount;
          withdrawalAmount = 0;
        } else {
          withdrawalsFromBucket[b] = balances[b];
          withdrawalAmount -= balances[b];
          balances[b] = 0;
        }
      }

      if (rebalanceFreq > 0 && i % rebalanceFreq === 0) {
        // Dynamic rebalancing with rolling window targets
        const currentTotal = Object.values(balances).reduce((a, b) => a + b, 0);

        // Helper to calculate present value of spending gaps for a range of years
        const calcPVGaps = (startYear, endYear, rate) => {
          let totalPV = 0;
          for (let yr = startYear; yr <= endYear; yr++) {
            if (yr > years) break; // Don't go beyond simulation
            const futureGap = getAnnualGap(yr - 1);
            const yearsOut = yr - i; // Years from current rebalance point
            const pvFactor = Math.pow(1 + (rate / 100), yearsOut);
            totalPV += futureGap / pvFactor;
          }
          return totalPV;
        };

        // Calculate dynamic targets based on current year (rolling window)
        // B1: Next 3 years (i+1 to i+3)
        const b1Target = calcPVGaps(i + 1, i + 3, assumptions.b1.return);
        // B2: Years 4-6 from now (i+4 to i+6)
        const b2Target = calcPVGaps(i + 4, i + 6, assumptions.b2.return);
        // B3: Years 7-14 from now (i+7 to i+14)
        const b3Target = calcPVGaps(i + 7, i + 14, assumptions.b3.return);
        // B4: Always 10% of current total
        const b4Target = currentTotal * 0.10;
        // B5: Everything else

        // Collect all funds
        let availableFunds = currentTotal;

        // Fill buckets in priority order: B1 → B2 → B3 → B4 → B5
        balances.b1 = Math.min(b1Target, availableFunds);
        availableFunds -= balances.b1;

        balances.b2 = Math.min(b2Target, Math.max(0, availableFunds));
        availableFunds -= balances.b2;

        balances.b3 = Math.min(b3Target, Math.max(0, availableFunds));
        availableFunds -= balances.b3;

        balances.b4 = Math.min(b4Target, Math.max(0, availableFunds));
        availableFunds -= balances.b4;

        // B5 gets whatever remains (no negatives)
        balances.b5 = Math.max(0, availableFunds);
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
        contribution: Math.round(oneTimeContributions),
        expenses: Math.round(expenses),
        distribution: Math.round(totalWithdrawal),
        total: Math.max(0, total),
        benchmark: Math.max(0, benchmarkBalance),
        distRate,
        // Individual bucket values for architecture chart
        b1: Math.round(balances.b1),
        b2: Math.round(balances.b2),
        b3: Math.round(balances.b3),
        b4: Math.round(balances.b4),
        b5: Math.round(balances.b5),
        // Withdrawals from each bucket
        w1: Math.round(withdrawalsFromBucket.b1),
        w2: Math.round(withdrawalsFromBucket.b2),
        w3: Math.round(withdrawalsFromBucket.b3),
        w4: Math.round(withdrawalsFromBucket.b4),
        w5: Math.round(withdrawalsFromBucket.b5)
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

/**
 * Calculate alternative allocation strategies for the optimizer
 * @param {object} inputs - Client inputs (portfolio, spending, etc.)
 * @param {object} basePlan - Current model allocation
 * @returns {object} Three allocation strategies
 */
export const calculateAlternativeAllocations = (inputs, basePlan) => {
  const { totalPortfolio, monthlySpending } = inputs;
  const annualDistribution = monthlySpending * 12;

  // Strategy 1: Conservative Equity Tilt (10% B1, 10% B2, 30% B3, 0% B4, 50% B5)
  const strategy1 = {
    name: 'Conservative Equity Tilt',
    description: 'B1+B2 limited to 20%, no B4, 50% in long-term growth',
    b1Val: Math.round(totalPortfolio * 0.10),
    b2Val: Math.round(totalPortfolio * 0.10),
    b3Val: Math.round(totalPortfolio * 0.30),
    b4Val: 0,
    b5Val: Math.round(totalPortfolio * 0.50)
  };

  // Strategy 2: Barbell (3 years cash in B1, rest in B5)
  const cashNeeded = annualDistribution * 3;
  const strategy2 = {
    name: 'Barbell Strategy',
    description: '3 years cash reserve, remainder in long-term growth',
    b1Val: Math.min(Math.round(cashNeeded), totalPortfolio),
    b2Val: 0,
    b3Val: 0,
    b4Val: 0,
    b5Val: Math.max(0, totalPortfolio - Math.round(cashNeeded))
  };

  // Strategy 3: Current Model (from basePlan)
  const strategy3 = {
    name: 'Current Model',
    description: 'Time-segmented bucket strategy with B4 income allocation',
    b1Val: basePlan.b1Val,
    b2Val: basePlan.b2Val,
    b3Val: basePlan.b3Val,
    b4Val: basePlan.b4Val,
    b5Val: basePlan.b5Val
  };

  return { strategy1, strategy2, strategy3 };
};

/**
 * Run Monte Carlo simulation with a custom allocation
 * @param {object} allocation - Custom bucket allocation (b1Val-b5Val)
 * @param {object} assumptions - Return assumptions for each bucket
 * @param {object} inputs - Client inputs
 * @param {object} clientInfo - Client information
 * @returns {object} Simulation results with successRate and finalBalance
 */
export const runOptimizedSimulation = (allocation, assumptions, inputs, clientInfo) => {
  const { monthlySpending, ssPIA, partnerSSPIA, ssStartAge, partnerSSStartAge,
    monthlyPension, pensionStartAge, pensionCOLA, inflationRate, personalInflationRate,
    additionalIncomes } = inputs;

  const simulationStartAge = Math.max(clientInfo.currentAge, clientInfo.retirementAge);
  const years = 30;
  const iterations = 500;

  // Calculate SS values
  const clientSS = clientInfo.currentAge >= 67 ? ssPIA : getAdjustedSS(ssPIA, ssStartAge);
  const partnerSS = clientInfo.partnerAge >= 67 ? partnerSSPIA : getAdjustedSS(partnerSSPIA, partnerSSStartAge);

  // Helper to get annual details
  const getAnnualDetails = (yearIndex) => {
    const simAge = simulationStartAge + yearIndex;
    const currentPartnerAge = clientInfo.partnerAge + (simAge - clientInfo.currentAge);
    const expenseInflationFactor = Math.pow(1 + (personalInflationRate / 100), yearIndex);
    const incomeInflationFactor = Math.pow(1 + (inflationRate / 100), yearIndex);
    const expenses = monthlySpending * 12 * expenseInflationFactor;

    let income = 0;
    if (clientInfo.currentAge >= 67 || simAge >= ssStartAge) {
      income += clientSS * 12 * incomeInflationFactor;
    }
    if (clientInfo.isMarried && (clientInfo.partnerAge >= 67 || currentPartnerAge >= partnerSSStartAge)) {
      income += partnerSS * 12 * incomeInflationFactor;
    }
    if (simAge >= pensionStartAge) {
      income += monthlyPension * 12 * (pensionCOLA ? incomeInflationFactor : 1);
    }

    // Recurring additional incomes
    (additionalIncomes || []).forEach(stream => {
      if (!stream.isOneTime && simAge >= stream.startAge && simAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        income += streamAmount;
      }
    });

    // One-time contributions
    let oneTimeContributions = 0;
    (additionalIncomes || []).forEach(stream => {
      if (stream.isOneTime && simAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        oneTimeContributions += streamAmount;
      }
    });

    const gap = Math.max(0, expenses - income);
    return { expenses, income, gap, simAge, oneTimeContributions };
  };

  let failureCount = 0;
  const finalBalances = [];

  for (let iter = 0; iter < iterations; iter++) {
    const balances = {
      b1: allocation.b1Val,
      b2: allocation.b2Val,
      b3: allocation.b3Val,
      b4: allocation.b4Val,
      b5: allocation.b5Val
    };

    for (let i = 0; i < years; i++) {
      // Generate random returns
      const rates = {
        b1: (assumptions.b1.return + assumptions.b1.stdDev * randn_bm()) / 100,
        b2: (assumptions.b2.return + assumptions.b2.stdDev * randn_bm()) / 100,
        b3: (assumptions.b3.return + assumptions.b3.stdDev * randn_bm()) / 100,
        b4: (assumptions.b4.return + assumptions.b4.stdDev * randn_bm()) / 100,
        b5: (assumptions.b5.return + assumptions.b5.stdDev * randn_bm()) / 100
      };

      // Apply returns
      balances.b1 *= (1 + rates.b1);
      balances.b2 *= (1 + rates.b2);
      balances.b3 *= (1 + rates.b3);
      balances.b4 *= (1 + rates.b4);
      balances.b5 *= (1 + rates.b5);

      // Add one-time contributions
      const details = getAnnualDetails(i);
      balances.b5 += details.oneTimeContributions;

      // Withdraw for spending gap
      let withdrawalAmount = details.gap;
      const withdrawOrder = ['b1', 'b2', 'b3', 'b4', 'b5'];
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

      const total = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
      if (total <= 0) {
        failureCount++;
        break;
      }
    }

    const finalTotal = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
    if (finalTotal > 0) {
      finalBalances.push(finalTotal);
    }
  }

  // Calculate median legacy from successful iterations
  finalBalances.sort((a, b) => a - b);
  const medianLegacy = finalBalances.length > 0
    ? finalBalances[Math.floor(finalBalances.length / 2)]
    : 0;

  return {
    successRate: ((iterations - failureCount) / iterations) * 100,
    medianLegacy: Math.round(medianLegacy),
    allocation
  };
};
