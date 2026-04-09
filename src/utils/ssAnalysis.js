/**
 * Social Security Analysis Utilities
 * Calculates optimal claiming strategies and breakeven analysis
 */

import { getAdjustedSS, calculateWeightedReturn, applySSEarningsTest, calculateAnnualTax } from './calculations';

/**
 * Calculate expense inflation factor for a given year (uses personal inflation rate)
 * @param {number} personalInflationRate - Personal inflation rate
 * @param {number} yearIndex - Year index from retirement
 * @returns {number} Expense inflation factor
 */
const getExpenseInflationFactor = (personalInflationRate, yearIndex) => {
  return Math.pow(1 + (personalInflationRate / 100), yearIndex);
};

/**
 * Calculate income inflation factor for a given year (uses full inflation rate)
 * @param {number} inflationRate - Full inflation rate
 * @param {number} yearIndex - Year index from retirement
 * @returns {number} Income inflation factor
 */
const getIncomeInflationFactor = (inflationRate, yearIndex) => {
  return Math.pow(1 + (inflationRate / 100), yearIndex);
};

/**
 * Calculate income from additional income streams for a given age
 * @param {Array} additionalIncomes - Array of additional income streams
 * @param {number} clientAge - Current client age
 * @param {number} partnerAge - Current partner age
 * @param {number} inflationFactor - Inflation adjustment factor
 * @returns {object} Object with recurring income and one-time contributions
 */
const calculateAdditionalIncome = (additionalIncomes, clientAge, partnerAge, inflationFactor) => {
  let income = 0;
  let oneTimeContributions = 0;

  additionalIncomes.forEach(stream => {
    // Use partner's age if owner is 'partner', otherwise use client's age
    const ownerAge = stream.owner === 'partner' ? partnerAge : clientAge;

    if (stream.isOneTime) {
      // One-time events: only apply at the specific age, add to portfolio
      if (ownerAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= inflationFactor;
        oneTimeContributions += streamAmount;
      }
    } else {
      // Recurring income: multiply by 12 for annual, apply over age range
      if (ownerAge >= stream.startAge && ownerAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= inflationFactor;
        income += streamAmount;
      }
    }
  });

  return { income, oneTimeContributions };
};

/**
 * Calculate SS claiming strategy outcomes for the primary client
 * @param {object} params - Analysis parameters
 * @param {object} params.inputs - Portfolio inputs
 * @param {object} params.clientInfo - Client information
 * @param {object} params.assumptions - Return assumptions
 * @param {number} params.targetMaxPortfolioAge - Target age for portfolio analysis
 * @returns {object} Analysis results with winner, outcomes, and breakeven data
 */
export const calculateSSAnalysis = ({ inputs, clientInfo, assumptions, targetMaxPortfolioAge }) => {
  // Build list of strategies to analyze
  let strategies = [62, 67, 70];
  if (clientInfo.retirementAge > 62 && clientInfo.retirementAge < 67) {
    strategies.push(clientInfo.retirementAge);
  }
  strategies = [...new Set(strategies)].sort((a, b) => a - b);

  const weightedReturn = calculateWeightedReturn(assumptions);

  // Determine employment income for earnings test
  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
  const filingStatus = inputs.filingStatus || 'married';
  const stateRate = inputs.stateRate || 0;
  const stateCode = inputs.stateCode || '';

  // Calculate outcome for each claiming strategy — with earnings test and taxes
  const strategyProjections = {};

  const outcomes = strategies.map(startAge => {
    let balance = inputs.totalPortfolio;
    let cumulativeSSAfterTax = 0;
    const annualData = [];

    for (let age = clientInfo.retirementAge; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - clientInfo.retirementAge;
      const currentPartnerAge = clientInfo.partnerAge + (age - clientInfo.currentAge);
      const expenseInflationFactor = getExpenseInflationFactor(inputs.personalInflationRate, yearIndex);
      const incomeInflationFactor = getIncomeInflationFactor(inputs.inflationRate, yearIndex);
      const clientExpectedDeathAge = inputs.expectedDeathAge || 95;
      const partnerExpectedDeathAge = inputs.partnerExpectedDeathAge || 95;
      const clientAlive = age < clientExpectedDeathAge;
      const partnerAlive = clientInfo.isMarried && currentPartnerAge < partnerExpectedDeathAge;

      const bothAlive = clientAlive && partnerAlive;
      const reductionPct = (clientInfo.isMarried && !bothAlive && (clientAlive || partnerAlive))
        ? (inputs.spendingReductionAtFirstDeath || 0) / 100
        : 0;
      const expense = inputs.monthlySpending * 12 * expenseInflationFactor * (1 - reductionPct);

      // Employment income (for earnings test)
      let employmentIncome = 0;
      if (clientInfo.isMarried && partnerAlive && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
        employmentIncome = partnerAnnualIncome * incomeInflationFactor;
      }

      // Client SS with earnings test
      let ssIncome = 0;
      const effectiveSSStartAge = startAge >= 67 ? startAge : Math.max(startAge, clientInfo.retirementAge);
      const clientSSFull = getAdjustedSS(inputs.ssPIA, startAge) * 12 * incomeInflationFactor;
      const partnerSSFull = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) * 12 * incomeInflationFactor : 0;

      // Apply earnings test
      const clientSSAfterET = applySSEarningsTest(clientSSFull, 0, age, incomeInflationFactor);
      const partnerSSAfterET = applySSEarningsTest(partnerSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);

      if (clientAlive && age >= effectiveSSStartAge) {
        ssIncome += clientSSAfterET;
      }
      if (partnerAlive && currentPartnerAge >= inputs.partnerSSStartAge) {
        ssIncome += partnerSSAfterET;
      }
      // Survivor SS
      if (clientInfo.isMarried) {
        if (!clientAlive && partnerAlive && currentPartnerAge >= inputs.partnerSSStartAge && clientSSFull > partnerSSFull) {
          const survivorBenefit = applySSEarningsTest(clientSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
          ssIncome += (survivorBenefit - partnerSSAfterET);
        }
        if (clientAlive && !partnerAlive && age >= effectiveSSStartAge && partnerSSFull > clientSSFull) {
          const survivorBenefit = applySSEarningsTest(partnerSSFull, 0, age, incomeInflationFactor);
          ssIncome += (survivorBenefit - clientSSAfterET);
        }
      }

      let pensionIncome = 0;
      if (clientAlive && age >= inputs.pensionStartAge) {
        pensionIncome += inputs.monthlyPension * 12 * (inputs.pensionCOLA ? incomeInflationFactor : 1);
      } else if (!clientAlive && partnerAlive && (inputs.pensionSurvivorBenefitPct || 0) > 0 && age >= inputs.pensionStartAge) {
        pensionIncome += inputs.monthlyPension * (inputs.pensionSurvivorBenefitPct / 100) * 12 * (inputs.pensionCOLA ? incomeInflationFactor : 1);
      }
      if (partnerAlive && inputs.partnerMonthlyPension > 0 && currentPartnerAge >= (inputs.partnerPensionStartAge || 65)) {
        pensionIncome += inputs.partnerMonthlyPension * 12 * (inputs.partnerPensionCOLA ? incomeInflationFactor : 1);
      } else if (!partnerAlive && clientAlive && (inputs.partnerPensionSurvivorBenefitPct || 0) > 0 && inputs.partnerMonthlyPension > 0 && currentPartnerAge >= (inputs.partnerPensionStartAge || 65)) {
        pensionIncome += inputs.partnerMonthlyPension * (inputs.partnerPensionSurvivorBenefitPct / 100) * 12 * (inputs.partnerPensionCOLA ? incomeInflationFactor : 1);
      }

      const additionalIncomeResult = calculateAdditionalIncome(inputs.additionalIncomes || [], age, currentPartnerAge, incomeInflationFactor);
      const otherIncome = additionalIncomeResult.income;
      balance += additionalIncomeResult.oneTimeContributions;

      const totalIncome = ssIncome + pensionIncome + otherIncome + employmentIncome;
      const gap = Math.max(0, expense - totalIncome);

      // Estimate tax on the withdrawal (simplified — use traditional % for ordinary income estimate)
      let tax = 0;
      if (inputs.taxEnabled && gap > 0) {
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        const effectiveFilingStatus = (filingStatus === 'married' && !bothAlive) ? 'single' : filingStatus;
        const taxResult = calculateAnnualTax({
          ssIncome, pensionIncome, traditionalWithdrawal: gap * tradPct,
          rothWithdrawal: 0, nqTaxableGain: 0, nqQualifiedDividends: 0, nqOrdinaryDividends: 0,
          otherIncome, employmentIncome
        }, { filingStatus: effectiveFilingStatus, stateRate, stateCode }, age >= 65);
        tax = taxResult.totalTax;
      }

      balance -= (gap + tax);

      // Track cumulative after-tax SS received (for breakeven chart)
      // The "value" of SS in a given year = the net portfolio impact of having SS
      // (SS income received minus additional taxes triggered by that SS income)
      cumulativeSSAfterTax *= (1 + weightedReturn); // Grow accumulated value
      cumulativeSSAfterTax += ssIncome; // Add this year's SS received

      annualData.push({ age, ssIncome: Math.round(ssIncome), cumulativeSSAfterTax: Math.round(cumulativeSSAfterTax) });
    }

    strategyProjections[startAge] = annualData;
    return { age: startAge, balance: Math.max(0, balance) };
  });

  // Find the winning strategy (highest remaining balance)
  const winner = outcomes.reduce((prev, current) =>
    (prev.balance > current.balance) ? prev : current
  );

  // Build breakeven data from actual simulation projections
  const breakevenData = [];
  const maxAge = targetMaxPortfolioAge;
  for (let age = 60; age <= maxAge; age++) {
    const point = { age };
    strategies.forEach(startAge => {
      const proj = strategyProjections[startAge];
      const entry = proj?.find(d => d.age === age);
      point[`claim${startAge}`] = entry ? entry.cumulativeSSAfterTax : 0;
    });
    breakevenData.push(point);
  }

  return { winner, outcomes, breakevenData };
};

/**
 * Calculate SS claiming strategy outcomes for the partner
 * @param {object} params - Analysis parameters
 * @param {object} params.inputs - Portfolio inputs
 * @param {object} params.clientInfo - Client information
 * @param {object} params.assumptions - Return assumptions
 * @param {number} params.targetMaxPortfolioAge - Target age for portfolio analysis
 * @param {object} params.clientSSWinner - Optimal client SS strategy result
 * @returns {object|null} Analysis results with winner and outcomes, or null if not married
 */
export const calculateSSPartnerAnalysis = ({ inputs, clientInfo, assumptions, targetMaxPortfolioAge, clientSSWinner }) => {
  if (!clientInfo.isMarried) return null;

  // Build list of strategies to analyze
  let strategies = [62, 67, 70];
  if (clientInfo.partnerRetirementAge > 62 && clientInfo.partnerRetirementAge < 67) {
    strategies.push(clientInfo.partnerRetirementAge);
  }
  strategies = [...new Set(strategies)].sort((a, b) => a - b);

  const weightedReturn = calculateWeightedReturn(assumptions);

  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
  const filingStatus = inputs.filingStatus || 'married';
  const stateRate = inputs.stateRate || 0;
  const stateCode = inputs.stateCode || '';

  // Calculate outcome for each partner claiming strategy — with earnings test and taxes
  const outcomes = strategies.map(pStartAge => {
    let balance = inputs.totalPortfolio;

    for (let age = clientInfo.retirementAge; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - clientInfo.retirementAge;
      const currentPartnerAge = clientInfo.partnerAge + (age - clientInfo.currentAge);
      const expenseInflationFactor = getExpenseInflationFactor(inputs.personalInflationRate, yearIndex);
      const incomeInflationFactor = getIncomeInflationFactor(inputs.inflationRate, yearIndex);
      const clientExpectedDeathAge = inputs.expectedDeathAge || 95;
      const partnerExpectedDeathAge = inputs.partnerExpectedDeathAge || 95;
      const clientAlive = age < clientExpectedDeathAge;
      const partnerAlive = currentPartnerAge < partnerExpectedDeathAge;

      const bothAlive = clientAlive && partnerAlive;
      const reductionPct = (!bothAlive && (clientAlive || partnerAlive))
        ? (inputs.spendingReductionAtFirstDeath || 0) / 100
        : 0;
      const expense = inputs.monthlySpending * 12 * expenseInflationFactor * (1 - reductionPct);

      // Employment income for earnings test
      let employmentIncome = 0;
      if (partnerAlive && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
        employmentIncome = partnerAnnualIncome * incomeInflationFactor;
      }

      let ssIncome = 0;
      // Client SS (fixed at optimal age) with earnings test
      const effectiveClientSSStartAge = clientSSWinner.age >= 67 ? clientSSWinner.age : Math.max(clientSSWinner.age, clientInfo.retirementAge);
      const clientSSFull = getAdjustedSS(inputs.ssPIA, clientSSWinner.age) * 12 * incomeInflationFactor;
      const clientSSAfterET = applySSEarningsTest(clientSSFull, 0, age, incomeInflationFactor);
      if (clientAlive && age >= effectiveClientSSStartAge) {
        ssIncome += clientSSAfterET;
      }

      // Partner SS (variable) with earnings test
      const effectivePartnerSSStartAge = pStartAge >= 67 ? pStartAge : Math.max(pStartAge, clientInfo.partnerRetirementAge);
      const partnerSSFull = getAdjustedSS(inputs.partnerSSPIA, pStartAge) * 12 * incomeInflationFactor;
      const partnerSSAfterET = applySSEarningsTest(partnerSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
      if (partnerAlive && currentPartnerAge >= effectivePartnerSSStartAge) {
        ssIncome += partnerSSAfterET;
      }
      // Survivor SS
      if (!clientAlive && partnerAlive && currentPartnerAge >= effectivePartnerSSStartAge && clientSSFull > partnerSSFull) {
        const survivorBenefit = applySSEarningsTest(clientSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
        ssIncome += (survivorBenefit - partnerSSAfterET);
      }
      if (clientAlive && !partnerAlive && age >= effectiveClientSSStartAge && partnerSSFull > clientSSFull) {
        const survivorBenefit = applySSEarningsTest(partnerSSFull, 0, age, incomeInflationFactor);
        ssIncome += (survivorBenefit - clientSSAfterET);
      }

      let pensionIncome = 0;
      if (clientAlive && age >= inputs.pensionStartAge) {
        pensionIncome += inputs.monthlyPension * 12 * (inputs.pensionCOLA ? incomeInflationFactor : 1);
      } else if (!clientAlive && partnerAlive && (inputs.pensionSurvivorBenefitPct || 0) > 0 && age >= inputs.pensionStartAge) {
        pensionIncome += inputs.monthlyPension * (inputs.pensionSurvivorBenefitPct / 100) * 12 * (inputs.pensionCOLA ? incomeInflationFactor : 1);
      }
      if (partnerAlive && inputs.partnerMonthlyPension > 0 && currentPartnerAge >= (inputs.partnerPensionStartAge || 65)) {
        pensionIncome += inputs.partnerMonthlyPension * 12 * (inputs.partnerPensionCOLA ? incomeInflationFactor : 1);
      } else if (!partnerAlive && clientAlive && (inputs.partnerPensionSurvivorBenefitPct || 0) > 0 && inputs.partnerMonthlyPension > 0 && currentPartnerAge >= (inputs.partnerPensionStartAge || 65)) {
        pensionIncome += inputs.partnerMonthlyPension * (inputs.partnerPensionSurvivorBenefitPct / 100) * 12 * (inputs.partnerPensionCOLA ? incomeInflationFactor : 1);
      }

      const additionalIncomeResult = calculateAdditionalIncome(inputs.additionalIncomes || [], age, currentPartnerAge, incomeInflationFactor);
      const otherIncome = additionalIncomeResult.income;
      balance += additionalIncomeResult.oneTimeContributions;

      const totalIncome = ssIncome + pensionIncome + otherIncome + employmentIncome;
      const gap = Math.max(0, expense - totalIncome);

      // Tax estimate
      let tax = 0;
      if (inputs.taxEnabled && gap > 0) {
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        const effectiveFilingStatus = (filingStatus === 'married' && !bothAlive) ? 'single' : filingStatus;
        const taxResult = calculateAnnualTax({
          ssIncome, pensionIncome, traditionalWithdrawal: gap * tradPct,
          rothWithdrawal: 0, nqTaxableGain: 0, nqQualifiedDividends: 0, nqOrdinaryDividends: 0,
          otherIncome, employmentIncome
        }, { filingStatus: effectiveFilingStatus, stateRate, stateCode }, age >= 65);
        tax = taxResult.totalTax;
      }

      balance -= (gap + tax);
    }

    return { age: pStartAge, balance: Math.max(0, balance) };
  });

  const winner = outcomes.reduce((prev, current) =>
    (prev.balance > current.balance) ? prev : current
  );

  return { winner, outcomes };
};

/**
 * Calculate breakeven data comparing different SS claiming ages
 * Shows accumulated wealth at each age assuming benefits are reinvested
 * @param {number} pia - Primary Insurance Amount
 * @param {number} reinvestRate - Rate of return on reinvested benefits (default 4.5%)
 * @returns {Array} Breakeven data points from age 60 to 95
 */
export const calculateBreakevenData = (pia, reinvestRate = 4.5) => {
  const breakevenData = [];
  let accumulated = { claim62: 0, claim67: 0, claim70: 0 };

  const benefit62 = getAdjustedSS(pia, 62) * 12;
  const benefit67 = getAdjustedSS(pia, 67) * 12;
  const benefit70 = getAdjustedSS(pia, 70) * 12;

  for (let age = 60; age <= 95; age++) {
    // Apply growth to accumulated balances
    accumulated.claim62 *= (1 + reinvestRate / 100);
    accumulated.claim67 *= (1 + reinvestRate / 100);
    accumulated.claim70 *= (1 + reinvestRate / 100);

    // Add benefits if claiming age has been reached
    if (age >= 62) accumulated.claim62 += benefit62;
    if (age >= 67) accumulated.claim67 += benefit67;
    if (age >= 70) accumulated.claim70 += benefit70;

    breakevenData.push({
      age,
      claim62: Math.round(accumulated.claim62),
      claim67: Math.round(accumulated.claim67),
      claim70: Math.round(accumulated.claim70)
    });
  }

  return breakevenData;
};
