/**
 * Social Security Analysis Utilities
 * Calculates optimal claiming strategies and breakeven analysis
 */

import { getAdjustedSS, getImpliedPIA, calculateWeightedReturn, applySSEarningsTest, calculateAnnualTax, applyDeemedFiling } from './calculations';

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
  // Build list of strategies to analyze — all ages 62 through 70
  let strategies = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  strategies = [...new Set(strategies)].sort((a, b) => a - b);

  const weightedReturn = calculateWeightedReturn(assumptions);

  // Determine employment income for earnings test
  const clientAnnualIncome = clientInfo.annualIncome || 0;
  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
  const filingStatus = inputs.filingStatus || 'married';
  const stateRate = inputs.stateRate || 0;
  const stateCode = inputs.stateCode || '';

  // Compute simulation start: earliest of client retirement or partner turning 62 (if retired)
  let simStart = clientInfo.retirementAge;
  if (clientInfo.isMarried) {
    const partnerIsAlreadyRetired = clientInfo.partnerIsRetired || partnerRetAge <= clientInfo.partnerAge;
    if (partnerIsAlreadyRetired) {
      const partnerTurns62InClientAge = 62 + (clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge));
      simStart = Math.min(simStart, Math.max(clientInfo.currentAge, partnerTurns62InClientAge));
    }
  }

  // Calculate outcome for each claiming strategy — with earnings test and taxes
  const strategyProjections = {};

  const outcomes = strategies.map(startAge => {
    let balance = inputs.totalPortfolio;
    let cumulativeSSAfterTax = 0;
    const annualData = [];

    for (let age = simStart; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - simStart;
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
      let clientEmploymentIncome = 0;
      if (clientAlive && clientAnnualIncome > 0 && age < clientInfo.retirementAge) {
        clientEmploymentIncome = clientAnnualIncome * incomeInflationFactor;
      }
      let employmentIncome = 0;
      if (clientInfo.isMarried && partnerAlive && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
        employmentIncome = partnerAnnualIncome * incomeInflationFactor;
      }

      // Client SS with deemed filing and earnings test
      let ssIncome = 0;
      const clientHasFiled = clientAlive && age >= startAge;
      const partnerHasFiled = partnerAlive && currentPartnerAge >= inputs.partnerSSStartAge;

      // Own benefits (adjusted for claiming age; if currently receiving, input is the actual benefit)
      const clientOwnMonthly = inputs.ssCurrentlyReceiving ? inputs.ssPIA : getAdjustedSS(inputs.ssPIA, startAge);
      const partnerOwnMonthly = clientInfo.isMarried
        ? (inputs.partnerSSCurrentlyReceiving ? inputs.partnerSSPIA : getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge))
        : 0;

      // Back-calculate implied PIA when currently receiving (for spousal excess computation)
      const clientPIA = inputs.ssCurrentlyReceiving ? getImpliedPIA(inputs.ssPIA, inputs.ssStartAge) : inputs.ssPIA;
      const partnerPIA = inputs.partnerSSCurrentlyReceiving ? getImpliedPIA(inputs.partnerSSPIA, inputs.partnerSSStartAge) : inputs.partnerSSPIA;

      // Deemed filing: spousal excess reduction uses entitlement age (when both have filed).
      // For the CLIENT optimizer: freeze ALL partner spousal parameters to client's retirement age
      // so varying the client test age doesn't change the partner's income at all.
      const cAgeDiff = clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge);
      const cClaimAge = inputs.ssCurrentlyReceiving ? inputs.ssStartAge : startAge;
      const clientSpousalAge = clientInfo.isMarried
        ? Math.min(67, Math.max(cClaimAge, inputs.partnerSSStartAge + cAgeDiff))
        : cClaimAge;
      const fixedPartnerSpousalAge = clientInfo.isMarried
        ? Math.min(67, Math.max(inputs.partnerSSStartAge, clientInfo.retirementAge - cAgeDiff))
        : inputs.partnerSSStartAge;

      const clientMonthly = clientInfo.isMarried
        ? applyDeemedFiling(clientOwnMonthly, partnerPIA, partnerHasFiled, cClaimAge, clientPIA, clientSpousalAge)
        : clientOwnMonthly;
      // Partner benefit: timing uses real test age (clientHasFiled), reduction uses frozen retirement age
      const partnerMonthly = clientInfo.isMarried
        ? applyDeemedFiling(partnerOwnMonthly, clientPIA, clientHasFiled, inputs.partnerSSStartAge, partnerPIA, fixedPartnerSpousalAge)
        : 0;

      const clientSSFull = clientMonthly * 12 * incomeInflationFactor;
      const partnerSSFull = partnerMonthly * 12 * incomeInflationFactor;

      // Apply earnings test (client not working in retirement; partner may still be working)
      const clientSSAfterET = applySSEarningsTest(clientSSFull, clientEmploymentIncome, age, incomeInflationFactor);
      const partnerSSAfterET = applySSEarningsTest(partnerSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);

      if (clientHasFiled) {
        ssIncome += clientSSAfterET;
      }
      if (partnerHasFiled) {
        ssIncome += partnerSSAfterET;
      }
      // Survivor SS: surviving spouse gets the higher of their own or deceased spouse's benefit
      if (clientInfo.isMarried) {
        if (!clientAlive && partnerAlive && partnerHasFiled && clientSSFull > partnerSSFull) {
          const survivorBenefit = applySSEarningsTest(clientSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
          ssIncome += (survivorBenefit - partnerSSAfterET);
        }
        if (clientAlive && !partnerAlive && clientHasFiled && partnerSSFull > clientSSFull) {
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
      const surplus = Math.max(0, totalIncome - expense);

      // Always compute taxes — tax is owed on SS, pension, and withdrawals regardless of gap
      let tax = 0;
      if (inputs.taxEnabled) {
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        const effectiveFilingStatus = (filingStatus === 'married' && !bothAlive) ? 'single' : filingStatus;
        const taxResult = calculateAnnualTax({
          ssIncome, pensionIncome, traditionalWithdrawal: gap * tradPct,
          rothWithdrawal: 0, nqTaxableGain: 0, nqQualifiedDividends: 0, nqOrdinaryDividends: 0,
          otherIncome, employmentIncome
        }, { filingStatus: effectiveFilingStatus, stateRate, stateCode }, age >= 65);
        tax = taxResult.totalTax;
      }

      // Surplus (income > expenses) flows into portfolio; gap withdrawn from portfolio
      balance += surplus;
      balance -= (gap + tax);

      // Track cumulative after-tax SS (net of the tax triggered by having SS)
      // Compare: what would tax be with zero SS? The difference is the "SS tax cost"
      let ssTaxCost = 0;
      if (inputs.taxEnabled && ssIncome > 0) {
        const effectiveFilingStatus = (filingStatus === 'married' && !bothAlive) ? 'single' : filingStatus;
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        // Tax without SS (counterfactual: all spending from portfolio)
        const taxWithoutSS = calculateAnnualTax({
          ssIncome: 0, pensionIncome, traditionalWithdrawal: expense * tradPct,
          rothWithdrawal: 0, nqTaxableGain: 0, nqQualifiedDividends: 0, nqOrdinaryDividends: 0,
          otherIncome, employmentIncome
        }, { filingStatus: effectiveFilingStatus, stateRate, stateCode }, age >= 65).totalTax;
        ssTaxCost = Math.max(0, tax - taxWithoutSS);
      }
      const ssNetValue = ssIncome - ssTaxCost; // What SS actually saved the portfolio

      cumulativeSSAfterTax *= (1 + weightedReturn);
      cumulativeSSAfterTax += ssNetValue;

      annualData.push({ age, ssIncome: Math.round(ssIncome), cumulativeSSAfterTax: Math.round(cumulativeSSAfterTax) });
    }

    strategyProjections[startAge] = annualData;
    return { age: startAge, balance: Math.max(0, balance) };
  });

  const winner = outcomes.reduce((prev, current) =>
    (current.balance > prev.balance) ? current : prev
  );

  return { winner, outcomes };
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

  // Build list of strategies to analyze — all ages 62 through 70
  let strategies = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  strategies = [...new Set(strategies)].sort((a, b) => a - b);

  const weightedReturn = calculateWeightedReturn(assumptions);

  const clientAnnualIncome = clientInfo.annualIncome || 0;
  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
  const filingStatus = inputs.filingStatus || 'married';
  const stateRate = inputs.stateRate || 0;
  const stateCode = inputs.stateCode || '';

  // Compute simulation start: earliest of client retirement or partner turning 62 (if retired)
  let simStart = clientInfo.retirementAge;
  const partnerIsAlreadyRetired = clientInfo.partnerIsRetired || partnerRetAge <= clientInfo.partnerAge;
  if (partnerIsAlreadyRetired) {
    const partnerTurns62InClientAge = 62 + (clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge));
    simStart = Math.min(simStart, Math.max(clientInfo.currentAge, partnerTurns62InClientAge));
  }

  // Calculate outcome for each partner claiming strategy — with earnings test and taxes
  const outcomes = strategies.map(pStartAge => {
    let balance = inputs.totalPortfolio;

    for (let age = simStart; age <= targetMaxPortfolioAge; age++) {
      balance *= (1 + weightedReturn);
      const yearIndex = age - simStart;
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
      let clientEmploymentIncome = 0;
      if (clientAlive && clientAnnualIncome > 0 && age < clientInfo.retirementAge) {
        clientEmploymentIncome = clientAnnualIncome * incomeInflationFactor;
      }
      let employmentIncome = 0;
      if (partnerAlive && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
        employmentIncome = partnerAnnualIncome * incomeInflationFactor;
      }

      let ssIncome = 0;
      const clientHasFiled = clientAlive && age >= clientSSWinner.age;
      const partnerHasFiled = partnerAlive && currentPartnerAge >= pStartAge;

      // Own benefits (adjusted for claiming age; if currently receiving, input is the actual benefit)
      const clientOwnMonthly = inputs.ssCurrentlyReceiving ? inputs.ssPIA : getAdjustedSS(inputs.ssPIA, clientSSWinner.age);
      const partnerOwnMonthly = inputs.partnerSSCurrentlyReceiving ? inputs.partnerSSPIA : getAdjustedSS(inputs.partnerSSPIA, pStartAge);

      // Back-calculate implied PIA when currently receiving
      const clientPIA = inputs.ssCurrentlyReceiving ? getImpliedPIA(inputs.ssPIA, inputs.ssStartAge) : inputs.ssPIA;
      const partnerPIA = inputs.partnerSSCurrentlyReceiving ? getImpliedPIA(inputs.partnerSSPIA, inputs.partnerSSStartAge) : inputs.partnerSSPIA;

      // Deemed filing: spousal excess reduction uses entitlement age (when both have filed).
      // For the PARTNER optimizer: freeze client's spousal age (client has no spousal excess with high PIA,
      // but keeps the model consistent). Partner spousal age uses client's retirement age as the anchor.
      const pAgeDiff = clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge);
      const pClientClaimAge = inputs.ssCurrentlyReceiving ? inputs.ssStartAge : clientSSWinner.age;
      const pPartnerClaimAge = inputs.partnerSSCurrentlyReceiving ? inputs.partnerSSStartAge : pStartAge;
      const clientSpousalAge = Math.min(67, Math.max(pClientClaimAge, pPartnerClaimAge + pAgeDiff));
      // Partner spousal age: use client's actual claiming age (fixed, not varying with partner test)
      const partnerSpousalAge = Math.min(67, Math.max(pPartnerClaimAge, pClientClaimAge - pAgeDiff));

      const clientMonthly = applyDeemedFiling(clientOwnMonthly, partnerPIA, partnerHasFiled, pClientClaimAge, clientPIA, clientSpousalAge);
      const partnerMonthly = applyDeemedFiling(partnerOwnMonthly, clientPIA, clientHasFiled, pPartnerClaimAge, partnerPIA, partnerSpousalAge);

      const clientSSFull = clientMonthly * 12 * incomeInflationFactor;
      const partnerSSFull = partnerMonthly * 12 * incomeInflationFactor;

      const clientSSAfterET = applySSEarningsTest(clientSSFull, clientEmploymentIncome, age, incomeInflationFactor);
      const partnerSSAfterET = applySSEarningsTest(partnerSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);

      if (clientHasFiled) {
        ssIncome += clientSSAfterET;
      }
      if (partnerHasFiled) {
        ssIncome += partnerSSAfterET;
      }
      // Survivor SS
      if (!clientAlive && partnerAlive && partnerHasFiled && clientSSFull > partnerSSFull) {
        const survivorBenefit = applySSEarningsTest(clientSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
        ssIncome += (survivorBenefit - partnerSSAfterET);
      }
      if (clientAlive && !partnerAlive && clientHasFiled && partnerSSFull > clientSSFull) {
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
      const surplus = Math.max(0, totalIncome - expense);

      // Always compute taxes
      let tax = 0;
      if (inputs.taxEnabled) {
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        const effectiveFilingStatus = (filingStatus === 'married' && !bothAlive) ? 'single' : filingStatus;
        const taxResult = calculateAnnualTax({
          ssIncome, pensionIncome, traditionalWithdrawal: gap * tradPct,
          rothWithdrawal: 0, nqTaxableGain: 0, nqQualifiedDividends: 0, nqOrdinaryDividends: 0,
          otherIncome, employmentIncome
        }, { filingStatus: effectiveFilingStatus, stateRate, stateCode }, age >= 65);
        tax = taxResult.totalTax;
      }

      balance += surplus;
      balance -= (gap + tax);
    }

    return { age: pStartAge, balance: Math.max(0, balance) };
  });

  const winner = outcomes.reduce((prev, current) =>
    (current.balance > prev.balance) ? current : prev
  );

  return { winner, outcomes };
};

/**
 * Calculate wealth-based breakeven between early and delayed SS claiming strategies.
 *
 * Uses monthly time steps to model the portfolio opportunity cost and IRA tax drag
 * during the bridge years (earlyAge to delayedAge). The key asymmetry:
 *
 * - Bridge years: The delayer must fund living expenses entirely from the portfolio.
 *   The cost of replacing the early claimer's SS income is grossed up for IRA tax drag:
 *     Gross cost = (NQ_mix × SS) + (IRA_mix × SS / (1 - marginalTaxRate))
 *
 * - Catch-up phase: After the delayed age, the delayer's higher SS reduces portfolio
 *   withdrawals. The catch-up rate is the face-value SS difference, with a small
 *   tax-savings adjustment (10% of the gross-up factor) reflecting reduced IRA draws.
 *
 * This asymmetry means higher IRA% and higher tax brackets push the breakeven age
 * further out, while 100% NQ funding yields a tax-bracket-independent breakeven.
 *
 * @param {object} params
 * @param {number} params.pia - Monthly PIA (Primary Insurance Amount)
 * @param {number} params.earlyAge - Early claiming age (default 62)
 * @param {number} params.delayedAge - Delayed claiming age (default 67)
 * @param {number} params.growthRate - Annual portfolio growth rate in % (default 4.5)
 * @param {number} params.colaRate - Annual COLA rate in % (default 2.5)
 * @param {number} params.nqPercent - % of bridge funding from NQ accounts (default 100)
 * @param {number} params.marginalTaxRate - Marginal tax bracket in % (default 22)
 * @param {number} params.annualExpense - Annual living expense for chart display
 * @param {number} params.startingPortfolio - Starting portfolio for chart display
 * @returns {object} { breakevenAge, chartData, earlyBenefit, delayedBenefit }
 */
export const calculateWealthBreakeven = ({
  pia = 2500,
  earlyAge = 62,
  delayedAge = 67,
  growthRate = 4.5,
  colaRate = 2.5,
  nqPercent = 100,
  marginalTaxRate = 22,
  annualExpense = 60000,
  startingPortfolio = 1000000,
  spousePIA = 0,        // Spouse's PIA for deemed filing (0 = single/ignore)
  spouseClaimAge = 67   // Age when spouse files (triggers spousal top-up)
} = {}) => {
  const monthlyR = growthRate / 100 / 12;
  const annualCOLA = colaRate / 100;
  const nqMix = nqPercent / 100;
  const iraMix = 1 - nqMix;
  const taxRate = marginalTaxRate / 100;

  // Own benefits adjusted for claiming age
  const earlyOwnMonthly = getAdjustedSS(pia, earlyAge);
  const delayedOwnMonthly = getAdjustedSS(pia, delayedAge);

  // With deemed filing: own reduced + reduced spousal excess, once spouse has filed
  // Spousal excess reduction uses entitlement age (when both have filed), not filing age
  const earlyBenefitMonthly = (age) => {
    if (spousePIA > 0 && age >= spouseClaimAge) {
      const spousalAge = Math.min(67, Math.max(earlyAge, spouseClaimAge));
      return applyDeemedFiling(earlyOwnMonthly, spousePIA, true, earlyAge, pia, spousalAge);
    }
    return earlyOwnMonthly;
  };
  const delayedBenefitMonthly = (age) => {
    if (spousePIA > 0 && age >= spouseClaimAge) {
      const spousalAge = Math.min(67, Math.max(delayedAge, spouseClaimAge));
      return applyDeemedFiling(delayedOwnMonthly, spousePIA, true, delayedAge, pia, spousalAge);
    }
    return delayedOwnMonthly;
  };

  // Gross-up factor: NQ at face, IRA portion requires tax gross-up
  const grossUpFactor = nqMix + iraMix / Math.max(0.01, 1 - taxRate);
  // Catch-up: 10% of the tax benefit applies when higher SS reduces IRA draws
  const catchUpFactor = 1 + (grossUpFactor - 1) * 0.1;

  // --- Breakeven via portfolio-difference model (monthly steps) ---
  let diff = 0; // positive = early claimer ahead
  let breakevenAge = null;

  const totalMonths = (100 - earlyAge) * 12;
  for (let month = 0; month <= totalMonths; month++) {
    const prevDiff = diff;
    diff *= (1 + monthlyR);

    const yearFrac = month / 12;
    const age = earlyAge + yearFrac;
    const colaFactor = Math.pow(1 + annualCOLA, yearFrac);

    if (age < delayedAge) {
      // Bridge: early claimer saves SS, delayer pays gross-up to replace it from portfolio
      diff += earlyBenefitMonthly(age) * colaFactor * grossUpFactor;
    } else {
      // Catch-up: delayer's higher SS benefit narrows the gap
      diff -= (delayedBenefitMonthly(age) - earlyBenefitMonthly(age)) * colaFactor * catchUpFactor;
    }

    if (month > 0 && prevDiff > 0 && diff <= 0) {
      const pd = prevDiff;
      const cd = Math.abs(diff);
      const exactMonth = (month - 1) + pd / (pd + cd);
      breakevenAge = Math.round((earlyAge + exactMonth / 12) * 10) / 10;
    }
  }

  // --- Chart data via full portfolio simulation (annual steps for display) ---
  const chartData = [];
  let earlyPortfolio = startingPortfolio;
  let delayedPortfolio = startingPortfolio;
  const annualGrowth = growthRate / 100;

  for (let age = earlyAge; age <= 95; age++) {
    earlyPortfolio *= (1 + annualGrowth);
    delayedPortfolio *= (1 + annualGrowth);

    const colaFactor = Math.pow(1 + annualCOLA, age - earlyAge);
    const expenseThisYear = annualExpense * colaFactor;
    const earlySSAnnual = earlyBenefitMonthly(age) * 12 * colaFactor;
    const delayedSSAnnual = (age >= delayedAge) ? delayedBenefitMonthly(age) * 12 * colaFactor : 0;

    // Early claimer: withdraw deficit at face value
    earlyPortfolio -= Math.max(0, expenseThisYear - earlySSAnnual);
    // Delayer: bridge years grossed up, catch-up at face value
    if (age < delayedAge) {
      const fullNeed = expenseThisYear;
      delayedPortfolio -= (nqMix * fullNeed + iraMix * fullNeed / Math.max(0.01, 1 - taxRate));
    } else {
      delayedPortfolio -= Math.max(0, expenseThisYear - delayedSSAnnual);
    }

    chartData.push({
      age,
      earlyWealth: Math.round(earlyPortfolio),
      delayedWealth: Math.round(delayedPortfolio)
    });
  }

  return {
    breakevenAge,
    chartData,
    earlyBenefit: Math.round(earlyOwnMonthly),
    delayedBenefit: Math.round(delayedOwnMonthly)
  };
};

/**
 * Generate a breakeven matrix across NQ/IRA mixes and tax brackets.
 * @param {object} params
 * @param {number} params.earlyAge - Early claiming age (default 62)
 * @param {number} params.delayedAge - Delayed claiming age (default 67)
 * @param {number} params.growthRate - Annual portfolio growth rate in % (default 4.5)
 * @param {number} params.colaRate - Annual COLA rate in % (default 2.5)
 * @returns {Array} Array of { nqPercent, iraPercent, breakevens: { 12, 22, 24 } }
 */
export const calculateBreakevenMatrix = ({
  earlyAge = 62,
  delayedAge = 67,
  growthRate = 4.5,
  colaRate = 2.5
} = {}) => {
  const nqMixes = [100, 80, 60, 40, 20, 0];
  const taxRates = [10, 12, 22, 24, 32, 35, 37];

  return nqMixes.map(nq => ({
    nqPercent: nq,
    iraPercent: 100 - nq,
    breakevens: Object.fromEntries(
      taxRates.map(tax => [
        tax,
        calculateWealthBreakeven({
          pia: 2500, earlyAge, delayedAge, growthRate, colaRate,
          nqPercent: nq, marginalTaxRate: tax
        }).breakevenAge
      ])
    )
  }));
};
