/**
 * Social Security Analysis Utilities
 * Calculates optimal claiming strategies and breakeven analysis
 */

import { getAdjustedSS, calculateWeightedReturn } from './calculations';

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
 * @param {number} age - Current age
 * @param {number} inflationFactor - Inflation adjustment factor
 * @returns {object} Object with recurring income and one-time contributions
 */
const calculateAdditionalIncome = (additionalIncomes, age, inflationFactor) => {
  let income = 0;
  let oneTimeContributions = 0;

  additionalIncomes.forEach(stream => {
    if (stream.isOneTime) {
      // One-time events: only apply at the specific age, add to portfolio
      if (age === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= inflationFactor;
        oneTimeContributions += streamAmount;
      }
    } else {
      // Recurring income: multiply by 12 for annual, apply over age range
      if (age >= stream.startAge && age <= (stream.endAge || 100)) {
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

  // Calculate outcome for each claiming strategy
  const outcomes = strategies.map(startAge => {
    let balance = inputs.totalPortfolio;

    for (let age = clientInfo.retirementAge; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - clientInfo.retirementAge;
      const currentPartnerAge = clientInfo.partnerAge + (age - clientInfo.currentAge);
      // Expenses use personal inflation rate
      const expenseInflationFactor = getExpenseInflationFactor(inputs.personalInflationRate, yearIndex);
      // Income uses full inflation rate
      const incomeInflationFactor = getIncomeInflationFactor(inputs.inflationRate, yearIndex);
      const expense = inputs.monthlySpending * 12 * expenseInflationFactor;

      let income = 0;

      // Client SS income (variable based on strategy)
      if (age >= startAge && age >= clientInfo.retirementAge) {
        income += getAdjustedSS(inputs.ssPIA, startAge) * 12 * incomeInflationFactor;
      }

      // Partner SS income (fixed at their chosen start age)
      if (clientInfo.isMarried && currentPartnerAge >= inputs.partnerSSStartAge) {
        income += getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) * 12 * incomeInflationFactor;
      }

      // Pension income
      if (age >= inputs.pensionStartAge) {
        income += inputs.monthlyPension * 12 * incomeInflationFactor;
      }

      // Additional income streams (recurring only - one-time adds to portfolio)
      const additionalIncomeResult = calculateAdditionalIncome(inputs.additionalIncomes || [], age, incomeInflationFactor);
      income += additionalIncomeResult.income;
      balance += additionalIncomeResult.oneTimeContributions;

      balance -= Math.max(0, expense - income);
    }

    return { age: startAge, balance: Math.max(0, balance) };
  });

  // Find the winning strategy (highest remaining balance)
  const winner = outcomes.reduce((prev, current) =>
    (prev.balance > current.balance) ? prev : current
  );

  // Calculate breakeven data for comparison chart
  const breakevenData = calculateBreakevenData(inputs.ssPIA, inputs.ssReinvestRate);

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

  // Calculate outcome for each partner claiming strategy
  const outcomes = strategies.map(pStartAge => {
    let balance = inputs.totalPortfolio;

    for (let age = clientInfo.retirementAge; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - clientInfo.retirementAge;
      const currentPartnerAge = clientInfo.partnerAge + (age - clientInfo.currentAge);
      // Expenses use personal inflation rate
      const expenseInflationFactor = getExpenseInflationFactor(inputs.personalInflationRate, yearIndex);
      // Income uses full inflation rate
      const incomeInflationFactor = getIncomeInflationFactor(inputs.inflationRate, yearIndex);
      const expense = inputs.monthlySpending * 12 * expenseInflationFactor;

      let income = 0;

      // Client SS income (fixed at optimal age from client analysis)
      if (age >= clientSSWinner.age && age >= clientInfo.retirementAge) {
        income += getAdjustedSS(inputs.ssPIA, clientSSWinner.age) * 12 * incomeInflationFactor;
      }

      // Partner SS income (variable based on strategy)
      // Assume partner works until their retirement age (earnings test applies if claiming early)
      if (currentPartnerAge >= pStartAge && currentPartnerAge >= clientInfo.partnerRetirementAge) {
        income += getAdjustedSS(inputs.partnerSSPIA, pStartAge) * 12 * incomeInflationFactor;
      }

      // Pension income
      if (age >= inputs.pensionStartAge) {
        income += inputs.monthlyPension * 12 * incomeInflationFactor;
      }

      // Additional income streams (recurring only - one-time adds to portfolio)
      const additionalIncomeResult = calculateAdditionalIncome(inputs.additionalIncomes || [], age, incomeInflationFactor);
      income += additionalIncomeResult.income;
      balance += additionalIncomeResult.oneTimeContributions;

      balance -= Math.max(0, expense - income);
    }

    return { age: pStartAge, balance: Math.max(0, balance) };
  });

  // Find the winning strategy
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
