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
 * Estimate PIA (Primary Insurance Amount) from current annual income
 * Uses 2025 SSA bend-point formula. Assumes ~35 years of similar earnings.
 * @param {number} annualIncome - Current annual income
 * @returns {number} Estimated monthly PIA at Full Retirement Age
 */
export const estimatePIAFromIncome = (annualIncome) => {
  if (!annualIncome || annualIncome <= 0) return 0;
  // Cap at 2025 SS wage base
  const capped = Math.min(annualIncome, 176100);
  // Convert to AIME (Average Indexed Monthly Earnings)
  const aime = Math.floor(capped / 12);
  // 2025 bend points
  let pia = 0;
  if (aime <= 1226) {
    pia = aime * 0.90;
  } else if (aime <= 7391) {
    pia = 1226 * 0.90 + (aime - 1226) * 0.32;
  } else {
    pia = 1226 * 0.90 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15;
  }
  return Math.round(pia);
};

// ============================================
// TAX CALCULATION UTILITIES
// ============================================

// 2024 Federal Tax Brackets
const FEDERAL_BRACKETS = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ]
};

// 2024 Qualified Dividend / LTCG Brackets
const QDIV_BRACKETS = {
  single: [
    { min: 0, max: 47025, rate: 0 },
    { min: 47025, max: 518900, rate: 0.15 },
    { min: 518900, max: Infinity, rate: 0.20 }
  ],
  married: [
    { min: 0, max: 94050, rate: 0 },
    { min: 94050, max: 583750, rate: 0.15 },
    { min: 583750, max: Infinity, rate: 0.20 }
  ]
};

// Standard deduction (2024)
const STANDARD_DEDUCTION = {
  single: 14600,
  married: 29200,
  // Additional deduction for 65+
  seniorBonus: { single: 1950, married: 1550 }
};

/**
 * Calculate the taxable portion of Social Security benefits
 * Uses the "combined income" method (AGI + nontaxable interest + 50% of SS)
 * @param {number} ssIncome - Total Social Security income
 * @param {number} otherIncome - Other taxable income (excluding SS)
 * @param {string} filingStatus - 'single' or 'married'
 * @returns {number} Taxable portion of SS (0%, 50%, or up to 85%)
 */
export const calculateTaxableSS = (ssIncome, otherIncome, filingStatus) => {
  if (ssIncome <= 0) return 0;

  // Combined income = AGI + nontaxable interest + 50% of SS
  const combinedIncome = otherIncome + (ssIncome * 0.5);

  // Thresholds for SS taxation
  const thresholds = filingStatus === 'married'
    ? { low: 32000, high: 44000 }
    : { low: 25000, high: 34000 };

  if (combinedIncome <= thresholds.low) {
    // Below threshold: 0% taxable
    return 0;
  } else if (combinedIncome <= thresholds.high) {
    // Between thresholds: up to 50% taxable
    const taxableAmount = Math.min(ssIncome * 0.5, (combinedIncome - thresholds.low) * 0.5);
    return taxableAmount;
  } else {
    // Above high threshold: up to 85% taxable
    const baseAmount = (thresholds.high - thresholds.low) * 0.5;
    const additionalAmount = (combinedIncome - thresholds.high) * 0.85;
    const taxableAmount = Math.min(ssIncome * 0.85, baseAmount + additionalAmount);
    return taxableAmount;
  }
};

/**
 * Calculate federal income tax using marginal brackets
 * @param {number} taxableIncome - Taxable income after deductions
 * @param {string} filingStatus - 'single' or 'married'
 * @returns {number} Federal tax amount
 */
export const calculateFederalTax = (taxableIncome, filingStatus) => {
  if (taxableIncome <= 0) return 0;

  const brackets = FEDERAL_BRACKETS[filingStatus] || FEDERAL_BRACKETS.married;
  let tax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  return tax;
};

/**
 * Calculate tax on qualified dividends and long-term capital gains
 * @param {number} qualifiedIncome - Qualified dividend/LTCG income
 * @param {number} ordinaryIncome - Ordinary taxable income (determines starting bracket)
 * @param {string} filingStatus - 'single' or 'married'
 * @returns {number} Tax on qualified income
 */
export const calculateQualifiedDividendTax = (qualifiedIncome, ordinaryIncome, filingStatus) => {
  if (qualifiedIncome <= 0) return 0;

  const brackets = QDIV_BRACKETS[filingStatus] || QDIV_BRACKETS.married;
  let tax = 0;
  let incomePosition = ordinaryIncome; // Start where ordinary income ends
  let remainingQualified = qualifiedIncome;

  for (const bracket of brackets) {
    if (remainingQualified <= 0) break;

    // How much room is left in this bracket?
    const roomInBracket = Math.max(0, bracket.max - incomePosition);
    if (roomInBracket <= 0) {
      incomePosition = bracket.max;
      continue;
    }

    const taxableInBracket = Math.min(remainingQualified, roomInBracket);
    tax += taxableInBracket * bracket.rate;
    remainingQualified -= taxableInBracket;
    incomePosition += taxableInBracket;
  }

  return tax;
};

/**
 * Calculate total tax for a year given income breakdown
 * @param {object} incomeBreakdown - Object containing different income types
 * @param {object} taxSettings - Tax settings from inputs
 * @param {boolean} isSenior - Whether taxpayer is 65+
 * @returns {object} Tax breakdown { federal, state, qdivTax, total, effectiveRate }
 */
export const calculateAnnualTax = (incomeBreakdown, taxSettings, isSenior = true) => {
  const {
    ssIncome = 0,
    pensionIncome = 0,
    traditionalWithdrawal = 0,
    rothWithdrawal = 0,
    nqTaxableGain = 0,           // LTCG portion of NQ withdrawal
    nqQualifiedDividends = 0,    // Qualified divs from NQ holdings (LTCG rates)
    nqOrdinaryDividends = 0,     // Non-qualified divs (ordinary rates)
    otherIncome = 0
  } = incomeBreakdown;

  const { filingStatus = 'married', stateRate = 0 } = taxSettings;

  // Calculate taxable SS (NQ ordinary dividends count as ordinary income)
  const ordinaryIncomeBeforeSS = pensionIncome + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;
  const taxableSS = calculateTaxableSS(ssIncome, ordinaryIncomeBeforeSS, filingStatus);

  // Total ordinary taxable income (includes NQ ordinary dividends)
  const grossOrdinaryIncome = taxableSS + pensionIncome + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;

  // Standard deduction (with senior bonus)
  let deduction = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.married;
  if (isSenior) {
    // Assume both spouses are 65+ for married
    const seniorBonus = STANDARD_DEDUCTION.seniorBonus[filingStatus] || STANDARD_DEDUCTION.seniorBonus.married;
    deduction += filingStatus === 'married' ? seniorBonus * 2 : seniorBonus;
  }

  // Taxable ordinary income after deduction
  const taxableOrdinaryIncome = Math.max(0, grossOrdinaryIncome - deduction);

  // Federal tax on ordinary income
  const federalOrdinaryTax = calculateFederalTax(taxableOrdinaryIncome, filingStatus);

  // Preferential income: NQ capital gains + NQ qualified dividends (all taxed at LTCG rates)
  const totalPreferentialIncome = nqTaxableGain + nqQualifiedDividends;

  // Tax on preferential income (at LTCG/qualified dividend rates)
  const qdivTax = calculateQualifiedDividendTax(totalPreferentialIncome, taxableOrdinaryIncome, filingStatus);

  // Total federal tax
  const federalTax = federalOrdinaryTax + qdivTax;

  // State tax (simplified: flat rate on all taxable income including preferential)
  const stateTaxableIncome = taxableOrdinaryIncome + totalPreferentialIncome;
  const stateTax = stateTaxableIncome * (stateRate / 100);

  // Total tax
  const totalTax = federalTax + stateTax;

  // Effective rate (based on gross income excluding Roth)
  const grossTaxableIncome = ssIncome + pensionIncome + traditionalWithdrawal + nqTaxableGain + nqQualifiedDividends + nqOrdinaryDividends + otherIncome;
  const effectiveRate = grossTaxableIncome > 0 ? (totalTax / grossTaxableIncome) * 100 : 0;

  return {
    taxableSS,
    federalTax: Math.round(federalTax),
    stateTax: Math.round(stateTax),
    qdivTax: Math.round(qdivTax),
    totalTax: Math.round(totalTax),
    effectiveRate: effectiveRate.toFixed(1),
    deduction
  };
};

// ============================================
// TAX-IMPLIED SPENDING CALCULATOR
// ============================================

// 2024 Social Security wage base
const SS_WAGE_BASE = 168600;
const SS_TAX_RATE = 0.062;
const MEDICARE_TAX_RATE = 0.0145;
const MEDICARE_ADDITIONAL_RATE = 0.009;
const MEDICARE_THRESHOLD_MARRIED = 250000;
const MEDICARE_THRESHOLD_SINGLE = 200000;

/**
 * Calculate implied monthly spending from income, taxes, and savings
 * Used to validate client-reported spending against income/tax reality
 * @param {object} params - Calculation parameters
 * @returns {object} Breakdown of implied spending and tax components
 */
export const calculateImpliedSpending = ({
  annualIncome = 0,
  partnerAnnualIncome = 0,
  annualSavings = 0,
  filingStatus = 'married',
  stateRate = 0,
  isMarried = false
}) => {
  const totalIncome = annualIncome + partnerAnnualIncome;
  if (totalIncome <= 0) {
    return { impliedMonthly: 0, federalTax: 0, stateTax: 0, ssTax: 0, medicareTax: 0, totalTax: 0 };
  }

  // Social Security tax (employee portion) - each earner taxed separately up to wage base
  const clientSSTax = SS_TAX_RATE * Math.min(annualIncome, SS_WAGE_BASE);
  const partnerSSTax = SS_TAX_RATE * Math.min(partnerAnnualIncome, SS_WAGE_BASE);
  const ssTax = clientSSTax + partnerSSTax;

  // Medicare tax - 1.45% on all income + 0.9% additional on income above threshold
  const medicareThreshold = isMarried ? MEDICARE_THRESHOLD_MARRIED : MEDICARE_THRESHOLD_SINGLE;
  const baseMedicare = MEDICARE_TAX_RATE * totalIncome;
  const additionalMedicare = MEDICARE_ADDITIONAL_RATE * Math.max(0, totalIncome - medicareThreshold);
  const medicareTax = baseMedicare + additionalMedicare;

  // Standard deduction
  const standardDeduction = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.married;
  const taxableIncome = Math.max(0, totalIncome - standardDeduction);

  // Federal income tax (reuse existing bracket calculator)
  const federalTax = calculateFederalTax(taxableIncome, filingStatus);

  // State income tax (simplified flat rate)
  const stateTax = taxableIncome * (stateRate / 100);

  const totalTax = ssTax + medicareTax + federalTax + stateTax;
  const impliedMonthly = (totalIncome - totalTax - annualSavings) / 12;

  return {
    impliedMonthly: Math.round(impliedMonthly),
    federalTax: Math.round(federalTax),
    stateTax: Math.round(stateTax),
    ssTax: Math.round(ssTax),
    medicareTax: Math.round(medicareTax),
    totalTax: Math.round(totalTax)
  };
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

  // Staggered retirement: calculate partner's income share for savings reduction
  const annualIncome = clientInfo.annualIncome || 0;
  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const totalIncome = annualIncome + partnerAnnualIncome;
  const partnerRetirementAge = clientInfo.partnerRetirementAge || retirementAge;

  for (let i = 0; i <= years; i++) {
    const currentSimAge = currentAge + i;
    const currentPartnerAge = (clientInfo.partnerAge || currentAge) + i;

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
      let effectiveSavings = annualSavings;

      // Staggered retirement: reduce savings when partner retires before client
      if (totalIncome > 0 && partnerAnnualIncome > 0 && currentPartnerAge >= partnerRetirementAge && currentSimAge < retirementAge) {
        const partnerIncomeShare = partnerAnnualIncome / totalIncome;
        effectiveSavings = annualSavings * (1 - partnerIncomeShare);
      }

      const inflationAdjustedSavings = effectiveSavings * Math.pow(1 + (inflationRate / 100), i);
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
 * @param {boolean} vaEnabled - Whether VA GIB is enabled
 * @param {object} vaInputs - VA GIB inputs (allocation, withdrawal rate, etc.)
 * @returns {object} Base plan with bucket values and helper functions
 */
export const calculateBasePlan = (inputs, assumptions, clientInfo, vaEnabled = false, vaInputs = null) => {
  const {
    totalPortfolio, monthlySpending, ssPIA, partnerSSPIA,
    ssStartAge, partnerSSStartAge, monthlyPension, pensionStartAge, pensionCOLA,
    partnerMonthlyPension, partnerPensionStartAge, partnerPensionCOLA,
    inflationRate, personalInflationRate, additionalIncomes,
    cashFlowAdjustments
  } = inputs;

  // Calculate VA allocation and adjust portfolio for bucket calculations
  let vaAllocationAmount = 0;
  let vaAnnualIncome = 0;
  let vaIncomeStartAge = 65;

  if (vaEnabled && vaInputs) {
    if (vaInputs.allocationType === 'percentage') {
      vaAllocationAmount = totalPortfolio * (vaInputs.allocationPercent / 100);
    } else {
      vaAllocationAmount = Math.min(vaInputs.allocationFixed || 0, totalPortfolio);
    }
    vaAnnualIncome = vaAllocationAmount * ((vaInputs.withdrawalRate || 5) / 100);
    vaIncomeStartAge = vaInputs.incomeStartAge || 65;
  }

  // Portfolio available for bucket allocation (excluding VA allocation)
  const bucketPortfolio = totalPortfolio - vaAllocationAmount;

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

    // Track income by source for tax calculations
    let ssIncome = 0;
    let pensionIncome = 0;
    let otherIncome = 0;
    let vaIncome = 0;

    // Social Security income
    if (clientInfo.currentAge >= 67 || simAge >= ssStartAge) {
      ssIncome += clientSS * 12 * incomeInflationFactor;
    }
    if (clientInfo.isMarried && (clientInfo.partnerAge >= 67 || currentPartnerAge >= partnerSSStartAge)) {
      ssIncome += partnerSS * 12 * incomeInflationFactor;
    }

    // Pension income
    if (simAge >= pensionStartAge) {
      pensionIncome += monthlyPension * 12 * (pensionCOLA ? incomeInflationFactor : 1);
    }

    // Partner pension (if married and has pension)
    if (clientInfo.isMarried && partnerMonthlyPension > 0 && currentPartnerAge >= (partnerPensionStartAge || 65)) {
      pensionIncome += partnerMonthlyPension * 12 * (partnerPensionCOLA ? incomeInflationFactor : 1);
    }

    // Recurring additional incomes (monthly * 12)
    additionalIncomes.forEach(stream => {
      // Use partner's age if owner is 'partner', otherwise use client's age
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      if (!stream.isOneTime && ownerAge >= stream.startAge && ownerAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        otherIncome += streamAmount;
      }
    });

    // VA GIB guaranteed income (when enabled and age >= income start age)
    // Note: VA income is not inflation-adjusted in this model
    // VA income is taxed as ordinary income
    if (vaEnabled && vaInputs && simAge >= vaIncomeStartAge) {
      vaIncome = vaAnnualIncome;
    }

    // Staggered retirement: partner's employment income during gap years
    let employmentIncome = 0;
    const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
    const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
    if (clientInfo.isMarried && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
      // Partner still working after client retires
      let partnerEmployment = partnerAnnualIncome;
      if (inflationRate > 0) partnerEmployment *= incomeInflationFactor;
      employmentIncome += partnerEmployment;
    }

    // Total income
    const income = ssIncome + pensionIncome + otherIncome + vaIncome + employmentIncome;

    // One-time contributions (added to portfolio, not income)
    let oneTimeContributions = 0;
    additionalIncomes.forEach(stream => {
      // Use partner's age if owner is 'partner', otherwise use client's age
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      if (stream.isOneTime && ownerAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        oneTimeContributions += streamAmount;
      }
    });

    // Apply cash flow adjustments to expenses
    let adjustedExpenses = expenses;
    if (cashFlowAdjustments && cashFlowAdjustments.length > 0) {
      let netAdjustment = 0;
      cashFlowAdjustments.forEach(adj => {
        const ownerAge = adj.owner === 'partner' ? currentPartnerAge : simAge;
        if (adj.type === 'one-time') {
          if (Math.floor(ownerAge) === adj.startAge) {
            let amount = adj.amount;
            if (adj.inflationAdjusted) amount *= expenseInflationFactor;
            netAdjustment += amount;
          }
        } else if (ownerAge >= adj.startAge && ownerAge <= (adj.endAge || 100)) {
          let amount = adj.amount * 12; // monthly to annual
          if (adj.inflationAdjusted) amount *= expenseInflationFactor;
          if (adj.type === 'reduction') {
            netAdjustment -= amount;
          } else if (adj.type === 'increase') {
            netAdjustment += amount;
          }
        }
      });
      adjustedExpenses = Math.max(0, expenses + netAdjustment);
    }

    const gap = Math.max(0, adjustedExpenses - income);
    return {
      expenses: adjustedExpenses,
      income,
      gap,
      simAge,
      currentPartnerAge,
      oneTimeContributions,
      employmentIncome,
      // Income breakdown for tax calculations
      ssIncome,
      pensionIncome,
      otherIncome,
      vaIncome
    };
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
  // B3 covers years 7-15 with minimum 20% and maximum 35% allocation
  const b3Calculated = Math.round(calculateBucketNeed(7, 15, assumptions.b3.return) / 1000) * 1000;
  const b3Min = Math.round((bucketPortfolio * 0.20) / 1000) * 1000;
  const b3Max = Math.round((bucketPortfolio * 0.35) / 1000) * 1000;
  const b3Val = Math.min(Math.max(b3Calculated, b3Min), b3Max);

  // B4 is 10% but may be reduced to ensure B5 >= 2x B4
  // B5 = bucketPortfolio - b1 - b2 - b3 - b4
  // Constraint: B5 >= 2 * B4
  // So: bucketPortfolio - b1 - b2 - b3 - b4 >= 2 * b4
  // bucketPortfolio - b1 - b2 - b3 >= 3 * b4
  // b4 <= (bucketPortfolio - b1 - b2 - b3) / 3
  const remainingAfterB3 = bucketPortfolio - b1Val - b2Val - b3Val;
  const b4Target = Math.round((bucketPortfolio * 0.10) / 1000) * 1000;
  const b4MaxForB5Constraint = Math.round((remainingAfterB3 / 3) / 1000) * 1000;
  const b4Val = Math.min(b4Target, Math.max(0, b4MaxForB5Constraint));

  const allocatedSoFar = b1Val + b2Val + b3Val + b4Val;
  const b5Val = bucketPortfolio - allocatedSoFar;

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
    getAdjustedSS,
    vaAllocationAmount,
    vaAnnualIncome
  };
};

/**
 * Run portfolio simulation (deterministic or Monte Carlo)
 * @param {object} basePlan - Base plan object
 * @param {object} assumptions - Return assumptions
 * @param {object} inputs - Portfolio inputs
 * @param {number} rebalanceFreq - Rebalancing frequency (0 = never)
 * @param {boolean} isMonteCarlo - Whether to run Monte Carlo simulation
 * @param {object} vaInputs - VA GIB inputs (optional)
 * @param {object} rebalanceTargets - Manual rebalance target percentages (optional)
 * @returns {Array|object} Simulation results
 */
export const runSimulation = (basePlan, assumptions, inputs, rebalanceFreq, isMonteCarlo = false, vaInputs = null, rebalanceTargets = null) => {
  const { b1Val, b2Val, b3Val, b4Val, b5Val, getAnnualGap, getAnnualDetails } = basePlan;
  const years = 30;
  let results = [];
  let failureCount = 0;
  const iterations = isMonteCarlo ? 500 : 1;
  const benchmarkReturn = assumptions.b3.return / 100;

  // Calculate VA allocation if enabled
  let vaAllocationAmount = 0;
  if (vaInputs) {
    if (vaInputs.allocationType === 'percentage') {
      vaAllocationAmount = inputs.totalPortfolio * (vaInputs.allocationPercent / 100);
    } else {
      vaAllocationAmount = Math.min(vaInputs.allocationFixed, inputs.totalPortfolio);
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    // Start with base bucket allocations
    let balances = { b1: b1Val, b2: b2Val, b3: b3Val, b4: b4Val, b5: b5Val };

    // If VA is enabled, reduce bucket balances proportionally to fund the VA
    let vaAccountValue = 0;
    let vaBenefitBase = 0;
    let vaHighWaterMark = 0;

    if (vaInputs && vaAllocationAmount > 0) {
      const totalBuckets = b1Val + b2Val + b3Val + b4Val + b5Val;
      if (totalBuckets > 0) {
        const reductionRatio = vaAllocationAmount / totalBuckets;
        balances.b1 = b1Val * (1 - reductionRatio);
        balances.b2 = b2Val * (1 - reductionRatio);
        balances.b3 = b3Val * (1 - reductionRatio);
        balances.b4 = b4Val * (1 - reductionRatio);
        balances.b5 = b5Val * (1 - reductionRatio);
      }
      vaAccountValue = vaAllocationAmount;
      vaBenefitBase = vaAllocationAmount;
      vaHighWaterMark = vaAllocationAmount;
    }

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

      const {
        expenses, income, gap, simAge, currentPartnerAge, oneTimeContributions,
        ssIncome, pensionIncome, otherIncome, vaIncome, employmentIncome
      } = getAnnualDetails(i - 1);

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

      // VA GIB: Calculate guaranteed income and update VA account
      let vaGuaranteedIncome = 0;
      if (vaInputs && vaBenefitBase > 0) {
        // VA account grows with market (using B5 long-term returns)
        vaAccountValue *= (1 + rates.b5);

        // Apply VA fees (typically 1.5% annually)
        const vaFeeRate = 0.015;
        vaAccountValue *= (1 - vaFeeRate);

        // High water mark: step-up benefit base if account grows
        if (vaInputs.highWaterMark && vaAccountValue > vaHighWaterMark) {
          vaHighWaterMark = vaAccountValue;
          vaBenefitBase = vaAccountValue;
        }

        // Only start guaranteed income withdrawals when simAge >= incomeStartAge
        const incomeStartAge = vaInputs.incomeStartAge || 65;
        if (simAge >= incomeStartAge) {
          // Calculate guaranteed withdrawal from benefit base
          vaGuaranteedIncome = vaBenefitBase * (vaInputs.withdrawalRate / 100);

          // Withdraw guaranteed income from VA account (can go negative, but income continues)
          vaAccountValue = Math.max(0, vaAccountValue - vaGuaranteedIncome);
        }
      }

      // Adjust gap by VA guaranteed income - this is what the buckets need to cover
      const adjustedGap = vaInputs ? Math.max(0, gap - vaGuaranteedIncome) : gap;

      // --- Tax-inclusive withdrawal calculation ---
      let totalWithdrawal = adjustedGap;
      let taxData = { federalTax: 0, stateTax: 0, totalTax: 0, effectiveRate: '0.0', qdivTax: 0, taxableSS: 0, deduction: 0 };
      let nqTaxDetail = {};

      if (inputs.taxEnabled) {
        // Resolve per-age override or use defaults
        const override = inputs.withdrawalOverrides?.[simAge];
        const traditionalPct = (override?.traditionalPercent ?? inputs.traditionalPercent ?? 60) / 100;
        const rothPct = (override?.rothPercent ?? inputs.rothPercent ?? 25) / 100;
        const nqPct = (override?.nqPercent ?? inputs.nqPercent ?? 15) / 100;

        // NQ assumptions
        const nqDividendYield = (inputs.nqDividendYield ?? 2.0) / 100;
        const nqQualifiedDividendPct = (inputs.nqQualifiedDividendPercent ?? 80) / 100;
        const nqCapitalGainRate = (inputs.nqCapitalGainRate ?? 50) / 100;

        // Estimate NQ balance for dividend calculation
        const nqBalance = startTotal * nqPct;
        const nqTotalDividends = nqBalance * nqDividendYield;
        const nqQualifiedDividends = nqTotalDividends * nqQualifiedDividendPct;
        const nqOrdinaryDividends = nqTotalDividends - nqQualifiedDividends;

        const isSenior = simAge >= 65;
        const filingStatus = inputs.filingStatus || 'married';
        const stateRate = inputs.stateRate || 0;

        // Iterate to convergence (tax depends on withdrawal, withdrawal depends on tax)
        let withdrawal = adjustedGap;
        for (let iter = 0; iter < 5; iter++) {
          const nqWithdrawal = withdrawal * nqPct;
          const nqTaxableGain = nqWithdrawal * nqCapitalGainRate;

          taxData = calculateAnnualTax({
            ssIncome,
            pensionIncome: pensionIncome + (vaIncome || 0),
            traditionalWithdrawal: withdrawal * traditionalPct,
            rothWithdrawal: withdrawal * rothPct,
            nqTaxableGain,
            nqQualifiedDividends,
            nqOrdinaryDividends,
            otherIncome
          }, { filingStatus, stateRate }, isSenior);

          const newWithdrawal = adjustedGap + taxData.totalTax;
          if (Math.abs(newWithdrawal - withdrawal) < 1) break;
          withdrawal = newWithdrawal;
        }
        totalWithdrawal = withdrawal;

        // Store NQ detail for history
        const finalNqWithdrawal = withdrawal * nqPct;
        nqTaxDetail = {
          nqWithdrawal: Math.round(finalNqWithdrawal),
          nqCostBasis: Math.round(finalNqWithdrawal * (1 - nqCapitalGainRate)),
          nqTaxableGain: Math.round(finalNqWithdrawal * nqCapitalGainRate),
          nqQualifiedDividends: Math.round(nqQualifiedDividends),
          nqOrdinaryDividends: Math.round(nqOrdinaryDividends),
          traditionalPctUsed: Math.round(traditionalPct * 100),
          rothPctUsed: Math.round(rothPct * 100),
          nqPctUsed: Math.round(nqPct * 100)
        };
      }

      let withdrawalAmount = totalWithdrawal;

      const benchmarkWithdrawal = gap + taxData.totalTax;
      if (benchmarkBalance >= benchmarkWithdrawal) {
        benchmarkBalance -= benchmarkWithdrawal;
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
        const currentTotal = Object.values(balances).reduce((a, b) => a + b, 0);

        // Check if using manual rebalance targets (percentages)
        if (rebalanceTargets && rebalanceTargets.b1 !== undefined) {
          // Use manual percentage targets for rebalancing
          balances.b1 = currentTotal * (rebalanceTargets.b1 / 100);
          balances.b2 = currentTotal * (rebalanceTargets.b2 / 100);
          balances.b3 = currentTotal * (rebalanceTargets.b3 / 100);
          balances.b4 = currentTotal * (rebalanceTargets.b4 / 100);
          balances.b5 = currentTotal * (rebalanceTargets.b5 / 100);

          // Normalize to ensure total matches (handle rounding)
          const allocatedTotal = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
          if (Math.abs(allocatedTotal - currentTotal) > 1) {
            const adjustment = currentTotal - allocatedTotal;
            balances.b5 += adjustment; // Add any difference to B5
          }
        } else {
          // Dynamic rebalancing with rolling window targets (formula-based)

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
          // B3: Years 7-15 from now (i+7 to i+15) with minimum 20% allocation
          const b3Calculated = calcPVGaps(i + 7, i + 15, assumptions.b3.return);
          const b3Min = currentTotal * 0.20;
          const b3Target = Math.max(b3Calculated, b3Min);
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
      }

      // Total includes bucket balances plus VA account value
      const bucketTotal = Object.values(balances).reduce((a, b) => a + b, 0);
      const total = bucketTotal + (vaInputs ? vaAccountValue : 0);
      if (total <= 0) failed = true;

      const distRate = startTotal > 0 ? (totalWithdrawal / startTotal) * 100 : 0;

      history.push({
        year: i,
        age: simAge,
        partnerAge: currentPartnerAge,
        startBalance: Math.round(startTotal),
        growth: Math.round(annualGrowth),
        ssIncome: Math.round(income + vaGuaranteedIncome), // Include VA income in reported income
        contribution: Math.round(oneTimeContributions),
        expenses: Math.round(expenses + taxData.totalTax),
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
        w5: Math.round(withdrawalsFromBucket.b5),
        // VA GIB tracking
        vaAccountValue: vaInputs ? Math.round(vaAccountValue) : 0,
        vaBenefitBase: vaInputs ? Math.round(vaBenefitBase) : 0,
        vaGuaranteedIncome: Math.round(vaGuaranteedIncome),
        // Tax data
        federalTax: taxData.federalTax,
        stateTax: taxData.stateTax,
        totalTax: taxData.totalTax,
        effectiveRate: taxData.effectiveRate,
        // NQ tax detail
        ...nqTaxDetail,
        // Income breakdown (for detailed views)
        ssIncomeDetail: Math.round(ssIncome),
        pensionIncomeDetail: Math.round(pensionIncome),
        otherIncomeDetail: Math.round(otherIncome),
        vaIncomeDetail: Math.round(vaIncome || 0),
        employmentIncomeDetail: Math.round(employmentIncome || 0)
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

    // Calculate median legacy (final year balance from successful iterations)
    const finalBalances = results
      .map(r => r[years - 1]?.total || 0)
      .filter(val => val > 0)
      .sort((a, b) => a - b);
    const medianLegacy = finalBalances.length > 0
      ? finalBalances[Math.floor(finalBalances.length / 2)]
      : 0;

    return {
      data: processed,
      successRate: ((iterations - failureCount) / iterations) * 100,
      medianLegacy: Math.round(medianLegacy)
    };
  }

  return results[0];
};

/**
 * Calculate alternative allocation strategies for the optimizer
 * @param {object} inputs - Client inputs (portfolio, spending, etc.)
 * @param {object} basePlan - Current model allocation
 * @returns {object} Six allocation strategies
 */
export const calculateAlternativeAllocations = (inputs, basePlan) => {
  const { totalPortfolio, monthlySpending } = inputs;
  const annualDistribution = monthlySpending * 12;

  // Strategy 1: Aggressive Growth (0% B1, 0% B2, 20% B3, 10% B4, 70% B5)
  const strategy1 = {
    name: 'Aggressive Growth',
    description: 'Maximizes long-term growth with 70% in B5, minimal short-term reserves',
    b1Val: 0,
    b2Val: 0,
    b3Val: Math.round(totalPortfolio * 0.20),
    b4Val: Math.round(totalPortfolio * 0.10),
    b5Val: Math.round(totalPortfolio * 0.70)
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

  // Strategy 4: 4% Model (12.5% B1, 12.5% B2, 22.5% B3, 10% B4, 42.5% B5)
  const strategy4 = {
    name: '4% Model',
    description: 'Designed for 4% withdrawal rate with balanced risk',
    b1Val: Math.round(totalPortfolio * 0.125),
    b2Val: Math.round(totalPortfolio * 0.125),
    b3Val: Math.round(totalPortfolio * 0.225),
    b4Val: Math.round(totalPortfolio * 0.10),
    b5Val: Math.round(totalPortfolio * 0.425)
  };

  // Strategy 5: 5.5% Model (17.5% B1, 17.5% B2, 25% B3, 10% B4, 30% B5)
  const strategy5 = {
    name: '5.5% Model',
    description: 'Higher liquidity for higher withdrawal rates',
    b1Val: Math.round(totalPortfolio * 0.175),
    b2Val: Math.round(totalPortfolio * 0.175),
    b3Val: Math.round(totalPortfolio * 0.25),
    b4Val: Math.round(totalPortfolio * 0.10),
    b5Val: Math.round(totalPortfolio * 0.30)
  };

  // Strategy 6: Balanced 60/40 (100% B3)
  const strategy6 = {
    name: 'Balanced 60/40',
    description: 'Traditional 60/40 portfolio in single bucket',
    b1Val: 0,
    b2Val: 0,
    b3Val: totalPortfolio,
    b4Val: 0,
    b5Val: 0
  };

  return { strategy1, strategy2, strategy3, strategy4, strategy5, strategy6 };
};

/**
 * Run Monte Carlo simulation with a custom allocation
 * @param {object} allocation - Custom bucket allocation (b1Val-b5Val)
 * @param {object} assumptions - Return assumptions for each bucket
 * @param {object} inputs - Client inputs
 * @param {object} clientInfo - Client information
 * @param {number} rebalanceFreq - Rebalancing frequency (0 = sequential/never, 1 = annual, 3 = every 3 years)
 * @param {object} vaInputs - Optional VA GIB inputs
 * @returns {object} Simulation results with successRate and finalBalance
 */
export const runOptimizedSimulation = (allocation, assumptions, inputs, clientInfo, rebalanceFreq = 0, vaInputs = null) => {
  const { monthlySpending, ssPIA, partnerSSPIA, ssStartAge, partnerSSStartAge,
    monthlyPension, pensionStartAge, pensionCOLA,
    partnerMonthlyPension, partnerPensionStartAge, partnerPensionCOLA,
    inflationRate, personalInflationRate, additionalIncomes, cashFlowAdjustments } = inputs;

  const simulationStartAge = Math.max(clientInfo.currentAge, clientInfo.retirementAge);
  const years = 30;
  const iterations = 500;

  // Calculate VA allocation if enabled
  let vaAllocationAmount = 0;
  if (vaInputs) {
    if (vaInputs.allocationType === 'percentage') {
      vaAllocationAmount = inputs.totalPortfolio * (vaInputs.allocationPercent / 100);
    } else {
      vaAllocationAmount = Math.min(vaInputs.allocationFixed || 0, inputs.totalPortfolio);
    }
  }

  // Calculate initial allocation percentages for rebalancing (excluding VA)
  const initialTotal = allocation.b1Val + allocation.b2Val + allocation.b3Val + allocation.b4Val + allocation.b5Val;
  const targetPcts = {
    b1: initialTotal > 0 ? allocation.b1Val / initialTotal : 0,
    b2: initialTotal > 0 ? allocation.b2Val / initialTotal : 0,
    b3: initialTotal > 0 ? allocation.b3Val / initialTotal : 0,
    b4: initialTotal > 0 ? allocation.b4Val / initialTotal : 0,
    b5: initialTotal > 0 ? allocation.b5Val / initialTotal : 0
  };

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

    // Partner pension
    if (clientInfo.isMarried && partnerMonthlyPension > 0 && currentPartnerAge >= (partnerPensionStartAge || 65)) {
      income += partnerMonthlyPension * 12 * (partnerPensionCOLA ? incomeInflationFactor : 1);
    }

    // Recurring additional incomes
    (additionalIncomes || []).forEach(stream => {
      // Use partner's age if owner is 'partner', otherwise use client's age
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      if (!stream.isOneTime && ownerAge >= stream.startAge && ownerAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        income += streamAmount;
      }
    });

    // Staggered retirement: partner's employment income during gap years
    const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
    const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
    if (clientInfo.isMarried && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
      let partnerEmployment = partnerAnnualIncome;
      if (inflationRate > 0) partnerEmployment *= incomeInflationFactor;
      income += partnerEmployment;
    }

    // One-time contributions
    let oneTimeContributions = 0;
    (additionalIncomes || []).forEach(stream => {
      // Use partner's age if owner is 'partner', otherwise use client's age
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      if (stream.isOneTime && ownerAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        oneTimeContributions += streamAmount;
      }
    });

    // Apply cash flow adjustments to expenses
    let adjustedExpenses = expenses;
    if (cashFlowAdjustments && cashFlowAdjustments.length > 0) {
      let netAdjustment = 0;
      cashFlowAdjustments.forEach(adj => {
        const ownerAge = adj.owner === 'partner' ? currentPartnerAge : simAge;
        if (adj.type === 'one-time') {
          if (Math.floor(ownerAge) === adj.startAge) {
            let amount = adj.amount;
            if (adj.inflationAdjusted) amount *= expenseInflationFactor;
            netAdjustment += amount;
          }
        } else if (ownerAge >= adj.startAge && ownerAge <= (adj.endAge || 100)) {
          let amount = adj.amount * 12;
          if (adj.inflationAdjusted) amount *= expenseInflationFactor;
          if (adj.type === 'reduction') {
            netAdjustment -= amount;
          } else if (adj.type === 'increase') {
            netAdjustment += amount;
          }
        }
      });
      adjustedExpenses = Math.max(0, expenses + netAdjustment);
    }

    const gap = Math.max(0, adjustedExpenses - income);
    return { expenses: adjustedExpenses, income, gap, simAge, currentPartnerAge, oneTimeContributions };
  };

  let failureCount = 0;
  const finalBalances = [];

  for (let iter = 0; iter < iterations; iter++) {
    // Start with allocation, reduced proportionally for VA
    let balances = {
      b1: allocation.b1Val,
      b2: allocation.b2Val,
      b3: allocation.b3Val,
      b4: allocation.b4Val,
      b5: allocation.b5Val
    };

    // Initialize VA tracking
    let vaAccountValue = 0;
    let vaBenefitBase = 0;
    let vaHighWaterMark = 0;

    if (vaInputs && vaAllocationAmount > 0) {
      const totalBuckets = allocation.b1Val + allocation.b2Val + allocation.b3Val + allocation.b4Val + allocation.b5Val;
      if (totalBuckets > 0) {
        const reductionRatio = vaAllocationAmount / totalBuckets;
        balances.b1 = allocation.b1Val * (1 - reductionRatio);
        balances.b2 = allocation.b2Val * (1 - reductionRatio);
        balances.b3 = allocation.b3Val * (1 - reductionRatio);
        balances.b4 = allocation.b4Val * (1 - reductionRatio);
        balances.b5 = allocation.b5Val * (1 - reductionRatio);
      }
      vaAccountValue = vaAllocationAmount;
      vaBenefitBase = vaAllocationAmount;
      vaHighWaterMark = vaAllocationAmount;
    }

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

      // VA GIB: Calculate guaranteed income and update VA account
      let vaGuaranteedIncome = 0;
      if (vaInputs && vaBenefitBase > 0) {
        // VA account grows with B5 returns
        vaAccountValue *= (1 + rates.b5);

        // Apply VA fees (1.5% annually)
        const vaFeeRate = 0.015;
        vaAccountValue *= (1 - vaFeeRate);

        // High water mark: step-up benefit base if account grows
        if (vaInputs.highWaterMark && vaAccountValue > vaHighWaterMark) {
          vaHighWaterMark = vaAccountValue;
          vaBenefitBase = vaAccountValue;
        }

        // Only start guaranteed income at income start age
        const incomeStartAge = vaInputs.incomeStartAge || 65;
        if (details.simAge >= incomeStartAge) {
          vaGuaranteedIncome = vaBenefitBase * (vaInputs.withdrawalRate / 100);
          vaAccountValue = Math.max(0, vaAccountValue - vaGuaranteedIncome);
        }
      }

      // Adjust gap by VA guaranteed income
      const adjustedGap = vaInputs ? Math.max(0, details.gap - vaGuaranteedIncome) : details.gap;

      // Withdraw for spending gap
      let withdrawalAmount = adjustedGap;
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

      // Rebalance if frequency is set and it's a rebalance year
      // Use (i + 1) since i is 0-indexed but we want year 1, 2, 3...
      if (rebalanceFreq > 0 && (i + 1) % rebalanceFreq === 0) {
        const currentTotal = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
        if (currentTotal > 0) {
          balances.b1 = currentTotal * targetPcts.b1;
          balances.b2 = currentTotal * targetPcts.b2;
          balances.b3 = currentTotal * targetPcts.b3;
          balances.b4 = currentTotal * targetPcts.b4;
          balances.b5 = currentTotal * targetPcts.b5;
        }
      }

      // Total includes bucket balances plus VA account
      const bucketTotal = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
      const total = bucketTotal + (vaInputs ? vaAccountValue : 0);
      if (total <= 0) {
        failureCount++;
        break;
      }
    }

    const bucketFinal = balances.b1 + balances.b2 + balances.b3 + balances.b4 + balances.b5;
    const finalTotal = bucketFinal + (vaInputs ? vaAccountValue : 0);
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
