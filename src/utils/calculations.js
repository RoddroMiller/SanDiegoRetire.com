/**
 * Financial calculation utilities for portfolio planning
 */

// Full Retirement Age for Social Security
const FULL_RETIREMENT_AGE = 67;
const EARLY_REDUCTION_RATE_FIRST_3_YEARS = 0.0667;
const EARLY_REDUCTION_RATE_AFTER_3_YEARS = 0.05;
const DELAYED_CREDIT_RATE = 0.08;

// Spousal benefit early-claiming reduction rates (different from own-benefit rates)
// First 36 months before FRA: 25/36 of 1% per month = ~8.333% per year
// Beyond 36 months: 5/12 of 1% per month = 5% per year
const SPOUSAL_REDUCTION_RATE_FIRST_3_YEARS = 25 / 36 / 100 * 12; // 0.08333 per year
const SPOUSAL_REDUCTION_RATE_AFTER_3_YEARS = 0.05;

// Social Security Earnings Test (2026 base thresholds, indexed for inflation)
const SS_EARNINGS_EXEMPT_UNDER_FRA = 24480;    // Annual exempt earnings before FRA year (2026)
const SS_EARNINGS_EXEMPT_FRA_YEAR = 65160;     // Annual exempt earnings in year reaching FRA (2026)
const SS_EARNINGS_REDUCTION_UNDER_FRA = 0.5;   // $1 withheld per $2 over limit
const SS_EARNINGS_REDUCTION_FRA_YEAR = 1 / 3;  // $1 withheld per $3 over limit

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
 * Reverse-engineer PIA from a current benefit amount and claiming age.
 * Inverts getAdjustedSS: if benefit = PIA × factor, then PIA = benefit / factor.
 * @param {number} currentBenefit - Current monthly benefit being received
 * @param {number} startAge - Age when benefits were first claimed
 * @returns {number} Implied PIA (benefit at Full Retirement Age)
 */
export const getImpliedPIA = (currentBenefit, startAge) => {
  if (!currentBenefit || currentBenefit <= 0) return 0;
  const factor = getAdjustedSS(1, startAge); // factor that would be applied to PIA of $1
  return factor > 0 ? currentBenefit / factor : currentBenefit;
};

/**
 * Apply Social Security Earnings Test — reduces benefits when claiming before FRA while still working
 * Before FRA: $1 withheld for every $2 earned above $24,480 (2026 base, indexed for inflation)
 * In the year reaching FRA: $1 withheld for every $3 earned above $65,160 (2026 base, indexed)
 * At or after FRA: no reduction
 * @param {number} annualBenefit - Annual SS benefit before earnings test
 * @param {number} earnedIncome - Annual earned income (wages/self-employment)
 * @param {number} currentAge - Beneficiary's age (integer, start of year)
 * @param {number} inflationFactor - Cumulative inflation factor from simulation start (default 1)
 * @returns {number} Adjusted annual benefit after earnings test reduction
 */
export const applySSEarningsTest = (annualBenefit, earnedIncome, currentAge, inflationFactor = 1) => {
  if (annualBenefit <= 0 || earnedIncome <= 0 || currentAge >= FULL_RETIREMENT_AGE) return annualBenefit;

  let exempt, reductionRate;
  if (currentAge === FULL_RETIREMENT_AGE - 1) {
    // Year of reaching FRA — higher threshold, lower reduction
    exempt = SS_EARNINGS_EXEMPT_FRA_YEAR * inflationFactor;
    reductionRate = SS_EARNINGS_REDUCTION_FRA_YEAR;
  } else {
    // Under FRA
    exempt = SS_EARNINGS_EXEMPT_UNDER_FRA * inflationFactor;
    reductionRate = SS_EARNINGS_REDUCTION_UNDER_FRA;
  }

  const excessEarnings = Math.max(0, earnedIncome - exempt);
  const reduction = excessEarnings * reductionRate;
  return Math.max(0, annualBenefit - reduction);
};

/**
 * Calculate deemed-filing SS benefit with spousal top-up (post-2015 Bipartisan Budget Act).
 *
 * SSA calculation method:
 *   1. Own reduced benefit = own PIA × (1 - own_reduction_for_claiming_age)
 *   2. Spousal excess = max(0, 50% × spouse_PIA - claimant_own_PIA)
 *   3. Reduced excess = excess × (1 - spousal_reduction_for_claiming_age)
 *   4. Total = own reduced benefit + reduced spousal excess
 *
 * The spousal excess uses steeper early-claiming reduction rates than own benefits:
 *   First 36 months: 25/36 of 1%/month (~8.33%/yr) vs 5/9 of 1%/month (~6.67%/yr)
 *   Beyond 36 months: 5/12 of 1%/month (5%/yr) — same for both
 *
 * @param {number} ownMonthlyBenefit - Claimant's own SS benefit (already adjusted for claiming age)
 * @param {number} spousePIA - Spouse's PIA (monthly, at FRA — NOT adjusted for their claiming age)
 * @param {boolean} spouseHasFiled - Whether the spouse has started receiving SS benefits
 * @param {number} claimantStartAge - Age the claimant files (used to reduce spousal excess for early claiming)
 * @param {number} claimantPIA - Claimant's own PIA at FRA (unreduced, for computing spousal excess)
 * @returns {number} Monthly benefit after deemed filing (own reduced + reduced spousal excess)
 */
export const applyDeemedFiling = (ownMonthlyBenefit, spousePIA, spouseHasFiled, claimantStartAge = FULL_RETIREMENT_AGE, claimantPIA = 0, spousalEntitlementAge = null) => {
  if (!spouseHasFiled || !spousePIA) return ownMonthlyBenefit;

  // Spousal excess: difference between 50% of spouse's PIA and claimant's own PIA (unreduced)
  // If claimantPIA not provided, fall back to ownMonthlyBenefit (less accurate but safe)
  const ownPIA = claimantPIA > 0 ? claimantPIA : ownMonthlyBenefit;
  const spousalExcess = Math.max(0, spousePIA * 0.5 - ownPIA);
  if (spousalExcess <= 0) return ownMonthlyBenefit;

  // Spousal excess reduction is based on the claimant's age when they become entitled to spousal benefits.
  // Under deemed filing (post-2015), if the claimant filed before their spouse, they only get their own
  // benefit initially. The spousal excess starts when the spouse files. The reduction is based on the
  // claimant's age at THAT point — not when they originally filed for their own benefit.
  // spousalEntitlementAge = max(claimantStartAge, claimant's age when spouse filed)
  const reductionAge = spousalEntitlementAge !== null ? spousalEntitlementAge : claimantStartAge;
  let reducedExcess = spousalExcess;
  if (reductionAge < FULL_RETIREMENT_AGE) {
    const yearsEarly = FULL_RETIREMENT_AGE - reductionAge;
    const spousalReduction = yearsEarly <= 3
      ? yearsEarly * SPOUSAL_REDUCTION_RATE_FIRST_3_YEARS
      : (3 * SPOUSAL_REDUCTION_RATE_FIRST_3_YEARS) + ((yearsEarly - 3) * SPOUSAL_REDUCTION_RATE_AFTER_3_YEARS);
    reducedExcess *= (1 - spousalReduction);
  }

  // Total = own reduced benefit + reduced spousal excess
  return ownMonthlyBenefit + reducedExcess;
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

// Tax bracket base year — all brackets are 2026 values
const TAX_BRACKET_BASE_YEAR = 2026;

// 2026 Federal Tax Brackets (IRS Rev. Proc. 2025-32, TCJA made permanent by OBBBA July 2025)
const FEDERAL_BRACKETS = {
  single: [
    { min: 0, max: 12400, rate: 0.10 },
    { min: 12400, max: 50400, rate: 0.12 },
    { min: 50400, max: 105700, rate: 0.22 },
    { min: 105700, max: 201775, rate: 0.24 },
    { min: 201775, max: 256225, rate: 0.32 },
    { min: 256225, max: 640600, rate: 0.35 },
    { min: 640600, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 24800, rate: 0.10 },
    { min: 24800, max: 100800, rate: 0.12 },
    { min: 100800, max: 211400, rate: 0.22 },
    { min: 211400, max: 403550, rate: 0.24 },
    { min: 403550, max: 512450, rate: 0.32 },
    { min: 512450, max: 768700, rate: 0.35 },
    { min: 768700, max: Infinity, rate: 0.37 }
  ]
};

// 2026 Qualified Dividend / LTCG Brackets (IRS Rev. Proc. 2025-32)
const QDIV_BRACKETS = {
  single: [
    { min: 0, max: 49450, rate: 0 },
    { min: 49450, max: 545500, rate: 0.15 },
    { min: 545500, max: Infinity, rate: 0.20 }
  ],
  married: [
    { min: 0, max: 98900, rate: 0 },
    { min: 98900, max: 613700, rate: 0.15 },
    { min: 613700, max: Infinity, rate: 0.20 }
  ]
};

// Standard deduction (2026, IRS Rev. Proc. 2025-32)
const STANDARD_DEDUCTION = {
  single: 16100,
  married: 32200,
  // Additional deduction for 65+
  seniorBonus: { single: 2050, married: 1650 }
};

// ============================================
// IRMAA (Income-Related Monthly Adjustment Amount) — Medicare Part B & Part D
// ============================================
// 2026 IRMAA brackets based on MAGI from 2 years prior (2024 for 2026)
// Source: CMS 2026 Medicare Parts A & B Premiums
const IRMAA_BASE_YEAR = 2026;
const IRMAA_BASE_PART_B = 202.90; // monthly base premium

// MAGI thresholds and monthly surcharges (Part B premium includes base)
const IRMAA_BRACKETS = {
  single: [
    { magiMax: 109000, partBMonthly: 202.90, partDSurchargeMonthly: 0 },
    { magiMax: 137000, partBMonthly: 284.10, partDSurchargeMonthly: 14.50 },
    { magiMax: 171000, partBMonthly: 405.80, partDSurchargeMonthly: 37.50 },
    { magiMax: 205000, partBMonthly: 527.50, partDSurchargeMonthly: 60.40 },
    { magiMax: 500000, partBMonthly: 649.20, partDSurchargeMonthly: 83.30 },
    { magiMax: Infinity, partBMonthly: 689.90, partDSurchargeMonthly: 91.00 }
  ],
  married: [
    { magiMax: 218000, partBMonthly: 202.90, partDSurchargeMonthly: 0 },
    { magiMax: 274000, partBMonthly: 284.10, partDSurchargeMonthly: 14.50 },
    { magiMax: 342000, partBMonthly: 405.80, partDSurchargeMonthly: 37.50 },
    { magiMax: 410000, partBMonthly: 527.50, partDSurchargeMonthly: 60.40 },
    { magiMax: 750000, partBMonthly: 649.20, partDSurchargeMonthly: 83.30 },
    { magiMax: Infinity, partBMonthly: 689.90, partDSurchargeMonthly: 91.00 }
  ]
};

/**
 * Calculate IRMAA surcharge for a given year
 * @param {number} magi - Modified Adjusted Gross Income (from 2 years prior)
 * @param {string} filingStatus - 'single' or 'married'
 * @param {number} yearsFromBase - Years from IRMAA_BASE_YEAR for inflation adjustment
 * @param {number} inflationRate - Annual inflation rate as percentage
 * @param {number} numPeople - Number of Medicare enrollees (1 or 2 for married couples)
 * @returns {{ partBSurcharge: number, partDSurcharge: number, totalAnnualCost: number, bracket: number }}
 */
export const calculateIRMAA = (magi, filingStatus, yearsFromBase, inflationRate, numPeople = 1) => {
  const brackets = IRMAA_BRACKETS[filingStatus] || IRMAA_BRACKETS.married;
  const factor = yearsFromBase > 0 ? Math.pow(1 + inflationRate / 100, yearsFromBase) : 1;

  // Find applicable bracket based on inflation-adjusted MAGI thresholds
  let bracket = 0;
  for (let i = 0; i < brackets.length; i++) {
    const adjustedMax = brackets[i].magiMax === Infinity ? Infinity : Math.round(brackets[i].magiMax * factor);
    if (magi <= adjustedMax) {
      bracket = i;
      break;
    }
    bracket = i;
  }

  const b = brackets[bracket];
  // Surcharge = total premium minus base premium, per person, annualized
  const partBSurchargeMonthly = Math.max(0, b.partBMonthly - IRMAA_BASE_PART_B);
  const partBSurcharge = partBSurchargeMonthly * 12 * numPeople;
  const partDSurcharge = b.partDSurchargeMonthly * 12 * numPeople;
  const totalAnnualCost = partBSurcharge + partDSurcharge;

  return { partBSurcharge, partDSurcharge, totalAnnualCost, bracket };
};

// ============================================
// STATE TAX DATA
// ============================================

// State tax rules: effective income tax rate and Social Security taxability
// Rates are effective/flat approximations for retirement income in the moderate bracket.
// States with progressive brackets use a representative rate for $50k-$150k income range.
// ssTaxable: false = state fully exempts SS, true = state taxes SS (may have partial exemptions)
// State tax data: flat rate OR marginal brackets for each state
// brackets: if present, used for marginal calculation (array for single/married or single array for all filers)
// rate: flat rate (used when no brackets defined, or as display summary)
// ssTaxable: whether state taxes Social Security benefits
export const STATE_TAX_DATA = {
  'AL': { name: 'Alabama', rate: 5.0, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 500, rate: 2 }, { min: 500, max: 3000, rate: 4 }, { min: 3000, max: Infinity, rate: 5 }],
    married: [{ min: 0, max: 1000, rate: 2 }, { min: 1000, max: 6000, rate: 4 }, { min: 6000, max: Infinity, rate: 5 }]
  }},
  'AK': { name: 'Alaska', rate: 0, ssTaxable: false },
  'AZ': { name: 'Arizona', rate: 2.5, ssTaxable: false },
  'AR': { name: 'Arkansas', rate: 3.9, ssTaxable: false, brackets: {
    single: [{ min: 0, max: 5500, rate: 0 }, { min: 5500, max: 10900, rate: 2 }, { min: 10900, max: 15600, rate: 3 }, { min: 15600, max: 25700, rate: 3.4 }, { min: 25700, max: Infinity, rate: 3.9 }]
  }},
  'CA': { name: 'California', rate: 9.3, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 11079, rate: 1 }, { min: 11079, max: 26264, rate: 2 }, { min: 26264, max: 41452, rate: 4 }, { min: 41452, max: 57542, rate: 6 }, { min: 57542, max: 72724, rate: 8 }, { min: 72724, max: 371479, rate: 9.3 }, { min: 371479, max: 445771, rate: 10.3 }, { min: 445771, max: 742953, rate: 11.3 }, { min: 742953, max: Infinity, rate: 12.3 }],
    married: [{ min: 0, max: 22158, rate: 1 }, { min: 22158, max: 52528, rate: 2 }, { min: 52528, max: 82904, rate: 4 }, { min: 82904, max: 115084, rate: 6 }, { min: 115084, max: 145448, rate: 8 }, { min: 145448, max: 742958, rate: 9.3 }, { min: 742958, max: 891542, rate: 10.3 }, { min: 891542, max: 1485906, rate: 11.3 }, { min: 1485906, max: Infinity, rate: 12.3 }]
  }},
  'CO': { name: 'Colorado', rate: 4.4, ssTaxable: true },
  'CT': { name: 'Connecticut', rate: 6.99, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 10000, rate: 2 }, { min: 10000, max: 50000, rate: 4.5 }, { min: 50000, max: 100000, rate: 5.5 }, { min: 100000, max: 200000, rate: 6 }, { min: 200000, max: 250000, rate: 6.5 }, { min: 250000, max: 500000, rate: 6.9 }, { min: 500000, max: Infinity, rate: 6.99 }],
    married: [{ min: 0, max: 20000, rate: 2 }, { min: 20000, max: 100000, rate: 4.5 }, { min: 100000, max: 200000, rate: 5.5 }, { min: 200000, max: 400000, rate: 6 }, { min: 400000, max: 500000, rate: 6.5 }, { min: 500000, max: 1000000, rate: 6.9 }, { min: 1000000, max: Infinity, rate: 6.99 }]
  }},
  'DE': { name: 'Delaware', rate: 6.6, ssTaxable: false, brackets: {
    single: [{ min: 0, max: 2000, rate: 0 }, { min: 2000, max: 5000, rate: 2.2 }, { min: 5000, max: 10000, rate: 3.9 }, { min: 10000, max: 20000, rate: 4.8 }, { min: 20000, max: 25000, rate: 5.2 }, { min: 25000, max: 60000, rate: 5.55 }, { min: 60000, max: Infinity, rate: 6.6 }]
  }},
  'DC': { name: 'District of Columbia', rate: 10.75, ssTaxable: false, brackets: {
    single: [{ min: 0, max: 10000, rate: 4 }, { min: 10000, max: 40000, rate: 6 }, { min: 40000, max: 60000, rate: 6.5 }, { min: 60000, max: 250000, rate: 8.5 }, { min: 250000, max: 500000, rate: 9.25 }, { min: 500000, max: 1000000, rate: 9.75 }, { min: 1000000, max: Infinity, rate: 10.75 }]
  }},
  'FL': { name: 'Florida', rate: 0, ssTaxable: false },
  'GA': { name: 'Georgia', rate: 5.19, ssTaxable: false },
  'HI': { name: 'Hawaii', rate: 11.0, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 9600, rate: 1.4 }, { min: 9600, max: 14400, rate: 3.2 }, { min: 14400, max: 19200, rate: 5.5 }, { min: 19200, max: 24000, rate: 6.4 }, { min: 24000, max: 36000, rate: 6.8 }, { min: 36000, max: 48000, rate: 7.2 }, { min: 48000, max: 125000, rate: 7.6 }, { min: 125000, max: 175000, rate: 7.9 }, { min: 175000, max: 225000, rate: 8.25 }, { min: 225000, max: 275000, rate: 9 }, { min: 275000, max: 325000, rate: 10 }, { min: 325000, max: Infinity, rate: 11 }],
    married: [{ min: 0, max: 19200, rate: 1.4 }, { min: 19200, max: 28800, rate: 3.2 }, { min: 28800, max: 38400, rate: 5.5 }, { min: 38400, max: 48000, rate: 6.4 }, { min: 48000, max: 72000, rate: 6.8 }, { min: 72000, max: 96000, rate: 7.2 }, { min: 96000, max: 250000, rate: 7.6 }, { min: 250000, max: 350000, rate: 7.9 }, { min: 350000, max: 450000, rate: 8.25 }, { min: 450000, max: 550000, rate: 9 }, { min: 550000, max: 650000, rate: 10 }, { min: 650000, max: Infinity, rate: 11 }]
  }},
  'ID': { name: 'Idaho', rate: 5.695, ssTaxable: false },
  'IL': { name: 'Illinois', rate: 4.95, ssTaxable: false },
  'IN': { name: 'Indiana', rate: 3.0, ssTaxable: false },
  'IA': { name: 'Iowa', rate: 3.8, ssTaxable: false },
  'KS': { name: 'Kansas', rate: 5.7, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 15000, rate: 3.1 }, { min: 15000, max: 30000, rate: 5.25 }, { min: 30000, max: Infinity, rate: 5.7 }],
    married: [{ min: 0, max: 30000, rate: 3.1 }, { min: 30000, max: 60000, rate: 5.25 }, { min: 60000, max: Infinity, rate: 5.7 }]
  }},
  'KY': { name: 'Kentucky', rate: 4.0, ssTaxable: false },
  'LA': { name: 'Louisiana', rate: 3.0, ssTaxable: false },
  'ME': { name: 'Maine', rate: 7.15, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 26800, rate: 5.8 }, { min: 26800, max: 63450, rate: 6.75 }, { min: 63450, max: Infinity, rate: 7.15 }],
    married: [{ min: 0, max: 53600, rate: 5.8 }, { min: 53600, max: 126900, rate: 6.75 }, { min: 126900, max: Infinity, rate: 7.15 }]
  }},
  'MD': { name: 'Maryland', rate: 5.75, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 1000, rate: 2 }, { min: 1000, max: 2000, rate: 3 }, { min: 2000, max: 3000, rate: 4 }, { min: 3000, max: 100000, rate: 4.75 }, { min: 100000, max: 125000, rate: 5 }, { min: 125000, max: 150000, rate: 5.25 }, { min: 150000, max: 250000, rate: 5.5 }, { min: 250000, max: 500000, rate: 5.75 }, { min: 500000, max: 1000000, rate: 6.25 }, { min: 1000000, max: Infinity, rate: 6.5 }],
    married: [{ min: 0, max: 1000, rate: 2 }, { min: 1000, max: 2000, rate: 3 }, { min: 2000, max: 3000, rate: 4 }, { min: 3000, max: 150000, rate: 4.75 }, { min: 150000, max: 175000, rate: 5 }, { min: 175000, max: 225000, rate: 5.25 }, { min: 225000, max: 300000, rate: 5.5 }, { min: 300000, max: 600000, rate: 5.75 }, { min: 600000, max: 1200000, rate: 6.25 }, { min: 1200000, max: Infinity, rate: 6.5 }]
  }},
  'MA': { name: 'Massachusetts', rate: 5.0, ssTaxable: false },
  'MI': { name: 'Michigan', rate: 4.25, ssTaxable: false },
  'MN': { name: 'Minnesota', rate: 9.85, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 32570, rate: 5.35 }, { min: 32570, max: 106990, rate: 6.8 }, { min: 106990, max: 198630, rate: 7.85 }, { min: 198630, max: Infinity, rate: 9.85 }],
    married: [{ min: 0, max: 47620, rate: 5.35 }, { min: 47620, max: 189180, rate: 6.8 }, { min: 189180, max: 330410, rate: 7.85 }, { min: 330410, max: Infinity, rate: 9.85 }]
  }},
  'MS': { name: 'Mississippi', rate: 4.4, ssTaxable: false },
  'MO': { name: 'Missouri', rate: 4.7, ssTaxable: true, brackets: {
    single: [{ min: 0, max: 1313, rate: 0 }, { min: 1313, max: 2626, rate: 2 }, { min: 2626, max: 3939, rate: 2.5 }, { min: 3939, max: 5252, rate: 3 }, { min: 5252, max: 6565, rate: 3.5 }, { min: 6565, max: 7878, rate: 4 }, { min: 7878, max: 9191, rate: 4.5 }, { min: 9191, max: Infinity, rate: 4.7 }]
  }},
  'MT': { name: 'Montana', rate: 5.9, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 21100, rate: 4.7 }, { min: 21100, max: Infinity, rate: 5.9 }],
    married: [{ min: 0, max: 42200, rate: 4.7 }, { min: 42200, max: Infinity, rate: 5.9 }]
  }},
  'NE': { name: 'Nebraska', rate: 5.2, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 4030, rate: 2.46 }, { min: 4030, max: 24120, rate: 3.51 }, { min: 24120, max: 38870, rate: 5.01 }, { min: 38870, max: Infinity, rate: 5.2 }],
    married: [{ min: 0, max: 8040, rate: 2.46 }, { min: 8040, max: 48250, rate: 3.51 }, { min: 48250, max: 77730, rate: 5.01 }, { min: 77730, max: Infinity, rate: 5.2 }]
  }},
  'NV': { name: 'Nevada', rate: 0, ssTaxable: false },
  'NH': { name: 'New Hampshire', rate: 0, ssTaxable: false },
  'NJ': { name: 'New Jersey', rate: 6.37, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 20000, rate: 1.4 }, { min: 20000, max: 35000, rate: 1.75 }, { min: 35000, max: 40000, rate: 3.5 }, { min: 40000, max: 75000, rate: 5.525 }, { min: 75000, max: 500000, rate: 6.37 }, { min: 500000, max: 1000000, rate: 8.97 }, { min: 1000000, max: Infinity, rate: 10.75 }],
    married: [{ min: 0, max: 20000, rate: 1.4 }, { min: 20000, max: 50000, rate: 1.75 }, { min: 50000, max: 70000, rate: 2.45 }, { min: 70000, max: 80000, rate: 3.5 }, { min: 80000, max: 150000, rate: 5.525 }, { min: 150000, max: 500000, rate: 6.37 }, { min: 500000, max: 1000000, rate: 8.97 }, { min: 1000000, max: Infinity, rate: 10.75 }]
  }},
  'NM': { name: 'New Mexico', rate: 5.9, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 5500, rate: 1.5 }, { min: 5500, max: 16500, rate: 3.2 }, { min: 16500, max: 33500, rate: 4.3 }, { min: 33500, max: 66500, rate: 4.7 }, { min: 66500, max: 210000, rate: 4.9 }, { min: 210000, max: Infinity, rate: 5.9 }],
    married: [{ min: 0, max: 8000, rate: 1.5 }, { min: 8000, max: 25000, rate: 3.2 }, { min: 25000, max: 50000, rate: 4.3 }, { min: 50000, max: 100000, rate: 4.7 }, { min: 100000, max: 315000, rate: 4.9 }, { min: 315000, max: Infinity, rate: 5.9 }]
  }},
  'NY': { name: 'New York', rate: 6.85, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 8500, rate: 4 }, { min: 8500, max: 11700, rate: 4.5 }, { min: 11700, max: 13900, rate: 5.25 }, { min: 13900, max: 80650, rate: 5.5 }, { min: 80650, max: 215400, rate: 6 }, { min: 215400, max: 1077550, rate: 6.85 }, { min: 1077550, max: 5000000, rate: 9.65 }, { min: 5000000, max: 25000000, rate: 10.3 }, { min: 25000000, max: Infinity, rate: 10.9 }],
    married: [{ min: 0, max: 17150, rate: 4 }, { min: 17150, max: 23600, rate: 4.5 }, { min: 23600, max: 27900, rate: 5.25 }, { min: 27900, max: 161550, rate: 5.5 }, { min: 161550, max: 323200, rate: 6 }, { min: 323200, max: 2155350, rate: 6.85 }, { min: 2155350, max: 5000000, rate: 9.65 }, { min: 5000000, max: 25000000, rate: 10.3 }, { min: 25000000, max: Infinity, rate: 10.9 }]
  }},
  'NC': { name: 'North Carolina', rate: 4.25, ssTaxable: false },
  'ND': { name: 'North Dakota', rate: 1.95, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 48475, rate: 0 }, { min: 48475, max: 244825, rate: 1.95 }, { min: 244825, max: Infinity, rate: 2.5 }],
    married: [{ min: 0, max: 80975, rate: 0 }, { min: 80975, max: 298075, rate: 1.95 }, { min: 298075, max: Infinity, rate: 2.5 }]
  }},
  'OH': { name: 'Ohio', rate: 2.75, ssTaxable: false },
  'OK': { name: 'Oklahoma', rate: 4.75, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 1000, rate: 0.25 }, { min: 1000, max: 2500, rate: 0.75 }, { min: 2500, max: 3750, rate: 1.75 }, { min: 3750, max: 4900, rate: 2.75 }, { min: 4900, max: 7200, rate: 3.75 }, { min: 7200, max: Infinity, rate: 4.75 }],
    married: [{ min: 0, max: 2000, rate: 0.25 }, { min: 2000, max: 5000, rate: 0.75 }, { min: 5000, max: 7500, rate: 1.75 }, { min: 7500, max: 9800, rate: 2.75 }, { min: 9800, max: 14400, rate: 3.75 }, { min: 14400, max: Infinity, rate: 4.75 }]
  }},
  'OR': { name: 'Oregon', rate: 9.9, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 4400, rate: 4.75 }, { min: 4400, max: 11050, rate: 6.75 }, { min: 11050, max: 125000, rate: 8.75 }, { min: 125000, max: Infinity, rate: 9.9 }],
    married: [{ min: 0, max: 8800, rate: 4.75 }, { min: 8800, max: 22100, rate: 6.75 }, { min: 22100, max: 250000, rate: 8.75 }, { min: 250000, max: Infinity, rate: 9.9 }]
  }},
  'PA': { name: 'Pennsylvania', rate: 3.07, ssTaxable: false },
  'RI': { name: 'Rhode Island', rate: 5.99, ssTaxable: true, brackets: {
    single: [{ min: 0, max: 79900, rate: 3.75 }, { min: 79900, max: 181650, rate: 4.75 }, { min: 181650, max: Infinity, rate: 5.99 }]
  }},
  'SC': { name: 'South Carolina', rate: 6.0, ssTaxable: false, brackets: {
    single: [{ min: 0, max: 3560, rate: 0 }, { min: 3560, max: 17830, rate: 3 }, { min: 17830, max: Infinity, rate: 6.0 }]
  }},
  'SD': { name: 'South Dakota', rate: 0, ssTaxable: false },
  'TN': { name: 'Tennessee', rate: 0, ssTaxable: false },
  'TX': { name: 'Texas', rate: 0, ssTaxable: false },
  'UT': { name: 'Utah', rate: 4.5, ssTaxable: true },
  'VT': { name: 'Vermont', rate: 8.75, ssTaxable: true, brackets: {
    single:  [{ min: 0, max: 3825, rate: 0 }, { min: 3825, max: 53225, rate: 3.35 }, { min: 53225, max: 123525, rate: 6.6 }, { min: 123525, max: 253525, rate: 7.6 }, { min: 253525, max: Infinity, rate: 8.75 }],
    married: [{ min: 0, max: 11475, rate: 0 }, { min: 11475, max: 93975, rate: 3.35 }, { min: 93975, max: 210925, rate: 6.6 }, { min: 210925, max: 315475, rate: 7.6 }, { min: 315475, max: Infinity, rate: 8.75 }]
  }},
  'VA': { name: 'Virginia', rate: 5.75, ssTaxable: false, brackets: {
    single: [{ min: 0, max: 3000, rate: 2 }, { min: 3000, max: 5000, rate: 3 }, { min: 5000, max: 17000, rate: 5 }, { min: 17000, max: Infinity, rate: 5.75 }]
  }},
  'WA': { name: 'Washington', rate: 0, ssTaxable: false },
  'WV': { name: 'West Virginia', rate: 4.82, ssTaxable: true, brackets: {
    single: [{ min: 0, max: 10000, rate: 2.22 }, { min: 10000, max: 25000, rate: 2.96 }, { min: 25000, max: 40000, rate: 3.33 }, { min: 40000, max: 60000, rate: 4.44 }, { min: 60000, max: Infinity, rate: 4.82 }]
  }},
  'WI': { name: 'Wisconsin', rate: 5.3, ssTaxable: false, brackets: {
    single:  [{ min: 0, max: 14680, rate: 3.5 }, { min: 14680, max: 29370, rate: 4.4 }, { min: 29370, max: 323290, rate: 5.3 }, { min: 323290, max: Infinity, rate: 7.65 }],
    married: [{ min: 0, max: 19580, rate: 3.5 }, { min: 19580, max: 39150, rate: 4.4 }, { min: 39150, max: 431060, rate: 5.3 }, { min: 431060, max: Infinity, rate: 7.65 }]
  }},
  'WY': { name: 'Wyoming', rate: 0, ssTaxable: false }
};

/**
 * Calculate state income tax using marginal brackets (when available) or flat rate
 * @param {number} taxableIncome - State taxable income
 * @param {string} stateCode - State abbreviation
 * @param {string} filingStatus - 'single' or 'married'
 * @returns {number} State tax amount
 */
const calculateStateTax = (taxableIncome, stateCode, filingStatus) => {
  if (taxableIncome <= 0 || !stateCode) return 0;
  const stateData = STATE_TAX_DATA[stateCode];
  if (!stateData) return 0;

  // Use marginal brackets if available
  if (stateData.brackets) {
    // Some states use the same brackets for all filers (only 'single' key)
    const brackets = stateData.brackets[filingStatus] || stateData.brackets.single || [];
    if (brackets.length === 0) return taxableIncome * (stateData.rate / 100);

    let tax = 0;
    let remaining = taxableIncome;
    for (const bracket of brackets) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, (bracket.max === Infinity ? remaining : bracket.max - bracket.min));
      tax += taxableInBracket * (bracket.rate / 100);
      remaining -= taxableInBracket;
    }
    return tax;
  }

  // Flat rate fallback
  return taxableIncome * (stateData.rate / 100);
};

/**
 * Get inflation-adjusted federal tax brackets for a future year
 * @param {string} filingStatus - 'single' or 'married'
 * @param {number} yearsFromBase - Years from TAX_BRACKET_BASE_YEAR (can be 0 for base year)
 * @param {number} inflationRate - Annual inflation rate as percentage (e.g. 2.5)
 * @returns {Array} Brackets with inflation-adjusted min/max thresholds
 */
export const getInflationAdjustedBrackets = (filingStatus, yearsFromBase, inflationRate) => {
  const brackets = FEDERAL_BRACKETS[filingStatus] || FEDERAL_BRACKETS.married;
  if (yearsFromBase <= 0) return brackets;
  const factor = Math.pow(1 + inflationRate / 100, yearsFromBase);
  return brackets.map(b => ({
    ...b,
    min: b.min === 0 ? 0 : Math.round(b.min * factor),
    max: b.max === Infinity ? Infinity : Math.round(b.max * factor)
  }));
};

export const getInflationAdjustedQDivBrackets = (filingStatus, yearsFromBase, inflationRate) => {
  const brackets = QDIV_BRACKETS[filingStatus] || QDIV_BRACKETS.married;
  if (yearsFromBase <= 0) return brackets;
  const factor = Math.pow(1 + inflationRate / 100, yearsFromBase);
  return brackets.map(b => ({
    ...b,
    min: b.min === 0 ? 0 : Math.round(b.min * factor),
    max: b.max === Infinity ? Infinity : Math.round(b.max * factor)
  }));
};

/**
 * Get inflation-adjusted standard deduction for a future year
 * @param {string} filingStatus - 'single' or 'married'
 * @param {number} yearsFromBase - Years from TAX_BRACKET_BASE_YEAR
 * @param {number} inflationRate - Annual inflation rate as percentage
 * @param {boolean} isSenior - Whether taxpayer is 65+
 * @returns {number} Inflation-adjusted standard deduction
 */
export const getInflationAdjustedDeduction = (filingStatus, yearsFromBase, inflationRate, isSenior = true) => {
  const factor = yearsFromBase > 0 ? Math.pow(1 + inflationRate / 100, yearsFromBase) : 1;
  let deduction = (STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.married) * factor;
  if (isSenior) {
    const seniorBonus = (STANDARD_DEDUCTION.seniorBonus[filingStatus] || STANDARD_DEDUCTION.seniorBonus.married) * factor;
    deduction += filingStatus === 'married' ? seniorBonus * 2 : seniorBonus;
  }
  return Math.round(deduction);
};

// ============================================
// RMD (REQUIRED MINIMUM DISTRIBUTION) UTILITIES
// ============================================

// IRS Uniform Lifetime Table (age -> distribution period)
// Source: IRS Publication 590-B, Table III
const UNIFORM_LIFETIME_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
  101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6,
  106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9,
  116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0
};

/**
 * Get RMD starting age based on birth year (SECURE Act 2.0)
 * @param {number} birthYear - Owner's birth year
 * @returns {number} Age at which RMDs must begin
 */
export const getRMDStartAge = (birthYear) => {
  if (birthYear <= 1950) return 72;
  if (birthYear <= 1959) return 73;
  return 75; // born 1960+
};

/**
 * Calculate Required Minimum Distribution for a given year
 * @param {number} priorYearEndBalance - Traditional account balance at end of prior year
 * @param {number} ownerAge - Owner's age in the current distribution year
 * @param {number} birthYear - Owner's birth year (determines RMD start age)
 * @returns {number} RMD amount (0 if below RMD age)
 */
export const calculateRMD = (priorYearEndBalance, ownerAge, birthYear) => {
  if (priorYearEndBalance <= 0) return 0;
  const rmdStartAge = getRMDStartAge(birthYear);
  if (ownerAge < rmdStartAge) return 0;
  const distributionPeriod = UNIFORM_LIFETIME_TABLE[Math.min(ownerAge, 120)] || 2.0;
  return priorYearEndBalance / distributionPeriod;
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
    otherIncome = 0,
    employmentIncome = 0         // Spouse employment income during gap years
  } = incomeBreakdown;

  const { filingStatus = 'married', stateRate = 0, stateCode = '' } = taxSettings;

  // Resolve state tax rules
  const stateData = stateCode ? STATE_TAX_DATA[stateCode] : null;
  const effectiveStateRate = stateData ? stateData.rate : stateRate;
  const stateTaxesSS = stateData ? stateData.ssTaxable : true; // Default: tax SS at state level

  // Calculate taxable SS (NQ ordinary dividends count as ordinary income)
  const ordinaryIncomeBeforeSS = pensionIncome + traditionalWithdrawal + nqOrdinaryDividends + otherIncome + employmentIncome;
  const taxableSS = calculateTaxableSS(ssIncome, ordinaryIncomeBeforeSS, filingStatus);

  // Total ordinary taxable income (includes NQ ordinary dividends and employment income)
  const grossOrdinaryIncome = taxableSS + pensionIncome + traditionalWithdrawal + nqOrdinaryDividends + otherIncome + employmentIncome;

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

  // State tax — exclude SS from state taxable income if state exempts it
  const stateSSIncome = stateTaxesSS ? taxableSS : 0;
  const stateOrdinaryIncome = stateSSIncome + pensionIncome + traditionalWithdrawal + nqOrdinaryDividends + otherIncome + employmentIncome;
  const stateTaxableIncome = Math.max(0, stateOrdinaryIncome - deduction) + totalPreferentialIncome;
  // Use marginal brackets when state has them, flat rate otherwise
  const stateTax = stateCode
    ? calculateStateTax(stateTaxableIncome, stateCode, filingStatus)
    : stateTaxableIncome * (effectiveStateRate / 100);

  // Total tax
  const totalTax = federalTax + stateTax;

  // Effective rate (based on gross income excluding Roth)
  const grossTaxableIncome = ssIncome + pensionIncome + traditionalWithdrawal + nqTaxableGain + nqQualifiedDividends + nqOrdinaryDividends + otherIncome + employmentIncome;
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

// 2026 Social Security wage base
const SS_WAGE_BASE = 176100;
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

  // Standard deduction (annual savings treated as pre-tax, e.g. 401k)
  const standardDeduction = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.married;
  const taxableIncome = Math.max(0, totalIncome - annualSavings - standardDeduction);

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
export const calculateAccumulation = (clientInfo, inflationRate = 0, additionalIncomes = [], accounts = []) => {
  const { currentAge, retirementAge, currentPortfolio, annualSavings, expectedReturn } = clientInfo;
  const years = Math.max(0, retirementAge - currentAge);
  const data = [];
  const growthRate = (expectedReturn || 0) / 100;
  const inflRate = (inflationRate || 0) / 100;

  // Calculate additional contributions (401k match, company contributions, etc.)
  const additionalContribs = (clientInfo.additionalContributions || []).reduce((sum, c) => {
    if (c.mode === 'percent' && clientInfo.annualIncome > 0) {
      return sum + (c.amount / 100) * clientInfo.annualIncome;
    }
    return sum + (c.amount || 0);
  }, 0);

  // Staggered retirement: calculate partner's income share for savings reduction
  const annualIncome = clientInfo.annualIncome || 0;
  const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
  const totalIncome = annualIncome + partnerAnnualIncome;
  const partnerRetirementAge = clientInfo.partnerRetirementAge || retirementAge;

  // --- Advanced mode: per-account accumulation ---
  if (accounts && accounts.length > 0) {
    // Initialize per-account balances
    const acctBalances = accounts.map(a => ({ ...a, projected: a.balance || 0 }));

    for (let i = 0; i <= years; i++) {
      const currentSimAge = currentAge + i;
      const currentPartnerAge = (clientInfo.partnerAge || currentAge) + i;

      // Add one-time events proportionally across accounts
      additionalIncomes.forEach(income => {
        if (income.isOneTime && income.startAge === currentSimAge && currentSimAge < retirementAge) {
          let amount = income.amount;
          if (income.inflationAdjusted) amount *= Math.pow(1 + inflRate, i);
          const totalBal = acctBalances.reduce((s, a) => s + a.projected, 0);
          if (totalBal > 0) {
            acctBalances.forEach(a => { a.projected += amount * (a.projected / totalBal); });
          } else if (acctBalances.length > 0) {
            acctBalances[acctBalances.length - 1].projected += amount;
          }
        }
      });

      const totalBalance = acctBalances.reduce((s, a) => s + a.projected, 0);

      // Build per-account projected balances snapshot for the final year
      const accountProjections = i === years ? acctBalances.map(a => ({
        id: a.id, type: a.type, owner: a.owner, projected: Math.round(a.projected)
      })) : undefined;

      data.push({ age: currentSimAge, balance: Math.round(totalBalance), accountProjections });

      if (i < years) {
        // Determine staggered retirement savings reduction
        const partnerRetired = totalIncome > 0 && partnerAnnualIncome > 0 &&
          currentPartnerAge >= partnerRetirementAge && currentSimAge < retirementAge;
        const partnerIncomeShare = partnerRetired ? partnerAnnualIncome / totalIncome : 0;

        // Distribute additional contributions proportionally across accounts
        const totalBal = acctBalances.reduce((s, a) => s + a.projected, 0);

        acctBalances.forEach(a => {
          let contribution = a.annualContribution || 0;
          // Stop partner account contributions when partner retires
          if (a.owner === 'partner' && partnerRetired) {
            contribution = 0;
          } else if (partnerRetired && a.owner === 'client') {
            // Client accounts keep full contribution
          }
          // Add proportional share of additional contributions
          if (additionalContribs > 0 && totalBal > 0) {
            const share = a.projected / totalBal;
            contribution += additionalContribs * share * (partnerRetired && a.owner === 'partner' ? 0 : 1);
          }
          // Inflation-adjust contributions
          const adjContribution = contribution * Math.pow(1 + inflRate, i);
          a.projected += adjContribution;
          a.projected *= (1 + growthRate);
        });
      }
    }
    return data;
  }

  // --- Simple mode: single portfolio balance ---
  let balance = currentPortfolio;

  for (let i = 0; i <= years; i++) {
    const currentSimAge = currentAge + i;
    const currentPartnerAge = (clientInfo.partnerAge || currentAge) + i;

    // Add one-time events that occur at this age BEFORE retirement
    additionalIncomes.forEach(income => {
      if (income.isOneTime && income.startAge === currentSimAge && currentSimAge < retirementAge) {
        let amount = income.amount;
        if (income.inflationAdjusted) {
          amount *= Math.pow(1 + inflRate, i);
        }
        balance += amount;
      }
    });

    data.push({ age: currentSimAge, balance: Math.round(balance) });
    if (i < years) {
      let effectiveSavings = annualSavings + additionalContribs;

      // Staggered retirement: reduce savings when partner retires before client
      if (totalIncome > 0 && partnerAnnualIncome > 0 && currentPartnerAge >= partnerRetirementAge && currentSimAge < retirementAge) {
        const partnerIncomeShare = partnerAnnualIncome / totalIncome;
        effectiveSavings = (annualSavings + additionalContribs) * (1 - partnerIncomeShare);
      }

      const inflationAdjustedSavings = effectiveSavings * Math.pow(1 + inflRate, i);
      balance += inflationAdjustedSavings;
      balance *= (1 + growthRate);
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
export const calculateBasePlan = (inputs, assumptions, clientInfo, vaEnabled = false, vaInputs = null, spousalAgeOverrides = null) => {
  const {
    totalPortfolio, monthlySpending, ssPIA, partnerSSPIA,
    ssStartAge, partnerSSStartAge, monthlyPension, pensionStartAge, pensionCOLA,
    pensionSurvivorBenefitPct,
    partnerMonthlyPension, partnerPensionStartAge, partnerPensionCOLA,
    partnerPensionSurvivorBenefitPct,
    expectedDeathAge, partnerExpectedDeathAge: partnerExpectedDeathAge_val,
    spendingReductionAtFirstDeath,
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

  // Start simulation from the earliest relevant age:
  // - Client's current age or retirement age (whichever is later)
  // - OR when a retired partner turns 62 (to capture their early SS income)
  let simulationStartAge = Math.max(clientInfo.currentAge, clientInfo.retirementAge);
  if (clientInfo.isMarried) {
    const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
    const partnerIsAlreadyRetired = clientInfo.partnerIsRetired || partnerRetAge <= clientInfo.partnerAge;
    if (partnerIsAlreadyRetired) {
      // Partner is retired — start when the earliest person can claim SS (age 62)
      const partnerTurns62InClientAge = 62 + (clientInfo.currentAge - clientInfo.partnerAge);
      const earliestSSAge = Math.max(clientInfo.currentAge, Math.min(simulationStartAge, partnerTurns62InClientAge));
      simulationStartAge = Math.min(simulationStartAge, earliestSSAge);
    }
  }

  // If currently receiving, the input is today's monthly benefit (no adjustment needed).
  // Back-calculate implied PIA for spousal excess computation.
  const ssCurrentlyReceiving = inputs.ssCurrentlyReceiving || false;
  const partnerSSCurrentlyReceiving = inputs.partnerSSCurrentlyReceiving || false;
  const clientSS = ssCurrentlyReceiving ? ssPIA : (clientInfo.currentAge >= 67 ? ssPIA : getAdjustedSS(ssPIA, ssStartAge));
  const partnerSS = partnerSSCurrentlyReceiving ? partnerSSPIA : (clientInfo.partnerAge >= 67 ? partnerSSPIA : getAdjustedSS(partnerSSPIA, partnerSSStartAge));
  const clientImpliedPIA = ssCurrentlyReceiving ? getImpliedPIA(ssPIA, ssStartAge) : ssPIA;
  const partnerImpliedPIA = partnerSSCurrentlyReceiving ? getImpliedPIA(partnerSSPIA, partnerSSStartAge) : partnerSSPIA;
  const totalSS = clientSS + partnerSS;

  // Spousal entitlement ages: the spousal excess reduction is based on the claimant's age when
  // they become entitled to spousal benefits (the later of when they file and when their spouse files).
  // This corrects the deemed-filing behavior: filing early only penalizes the own benefit reduction,
  // not the spousal excess, if the spouse hasn't filed yet.
  // spousalAgeOverrides allows the SS optimizer to freeze one spouse's entitlement age while varying the other.
  const ageDiff = clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge);
  const clientSpousalAge = spousalAgeOverrides?.client ?? (clientInfo.isMarried
    ? Math.min(FULL_RETIREMENT_AGE, Math.max(ssStartAge, partnerSSStartAge + ageDiff))
    : ssStartAge);
  const partnerSpousalAge = spousalAgeOverrides?.partner ?? (clientInfo.isMarried
    ? Math.min(FULL_RETIREMENT_AGE, Math.max(partnerSSStartAge, ssStartAge - ageDiff))
    : partnerSSStartAge);

  // Get detailed cash flow numbers for a specific year
  const getAnnualDetails = (yearIndex) => {
    const simAge = simulationStartAge + yearIndex;
    const currentPartnerAge = clientInfo.partnerAge + (simAge - clientInfo.currentAge);
    // Expenses use personal inflation rate
    const expenseInflationFactor = Math.pow(1 + (personalInflationRate / 100), yearIndex);
    // Income (SS, pension) uses full inflation rate
    const incomeInflationFactor = Math.pow(1 + (inflationRate / 100), yearIndex);
    // Death age tracking
    const clientExpectedDeathAge = expectedDeathAge || 95;
    const partnerExpectedDeathAge = partnerExpectedDeathAge_val || 95;
    const clientAlive = simAge < clientExpectedDeathAge;
    const partnerAlive = clientInfo.isMarried && currentPartnerAge < partnerExpectedDeathAge;

    // Spending reduction after first death (only for married couples)
    const bothAlive = clientAlive && partnerAlive;
    const reductionPct = (clientInfo.isMarried && !bothAlive && (clientAlive || partnerAlive))
      ? (spendingReductionAtFirstDeath || 0) / 100
      : 0;
    const expenses = monthlySpending * 12 * expenseInflationFactor * (1 - reductionPct);

    // Track income by source for tax calculations
    let ssIncome = 0;
    let pensionIncome = 0;
    let otherIncome = 0;
    let nonTaxableAdditionalIncome = 0;
    let vaIncome = 0;

    // Employment income — compute BEFORE SS so earnings test can be applied
    let clientEmploymentIncome = 0;
    const clientAnnualIncome_ = clientInfo.annualIncome || 0;
    if (clientAlive && clientAnnualIncome_ > 0 && simAge < clientInfo.retirementAge) {
      clientEmploymentIncome = clientAnnualIncome_ * (inflationRate > 0 ? incomeInflationFactor : 1);
    }
    let partnerEmploymentIncome = 0;
    const partnerAnnualIncome = clientInfo.partnerAnnualIncome || 0;
    const partnerRetAge = clientInfo.partnerRetirementAge || clientInfo.retirementAge;
    if (clientInfo.isMarried && partnerAlive && partnerAnnualIncome > 0 && currentPartnerAge < partnerRetAge) {
      partnerEmploymentIncome = partnerAnnualIncome * (inflationRate > 0 ? incomeInflationFactor : 1);
    }
    const employmentIncome = clientEmploymentIncome + partnerEmploymentIncome;

    // Social Security income with Deemed Filing and Earnings Test
    const clientHasFiled = clientAlive && simAge >= ssStartAge;
    const partnerHasFiled = clientInfo.isMarried && partnerAlive && currentPartnerAge >= partnerSSStartAge;

    // Deemed filing: own reduced benefit + reduced spousal excess (SSA method)
    // Spousal excess reduction uses entitlement age (when both spouses have filed), not filing age
    const clientMonthly = clientInfo.isMarried
      ? applyDeemedFiling(clientSS, partnerImpliedPIA, partnerHasFiled, ssStartAge, clientImpliedPIA, clientSpousalAge)
      : clientSS;
    const partnerMonthly = clientInfo.isMarried
      ? applyDeemedFiling(partnerSS, clientImpliedPIA, clientHasFiled, partnerSSStartAge, partnerImpliedPIA, partnerSpousalAge)
      : 0;

    const clientSSFull = clientMonthly * 12 * incomeInflationFactor;
    const partnerSSFull = partnerMonthly * 12 * incomeInflationFactor;
    const clientSSAfterET = applySSEarningsTest(clientSSFull, clientEmploymentIncome, simAge, incomeInflationFactor);
    const partnerSSAfterET = applySSEarningsTest(partnerSSFull, partnerEmploymentIncome, currentPartnerAge, incomeInflationFactor);

    if (clientHasFiled) {
      ssIncome += clientSSAfterET;
    }
    if (partnerHasFiled) {
      ssIncome += partnerSSAfterET;
    }
    // Survivor SS benefit: surviving spouse gets the higher of the two benefits
    if (clientInfo.isMarried) {
      if (!clientAlive && partnerHasFiled && clientSSFull > partnerSSFull) {
        const survivorBenefit = applySSEarningsTest(clientSSFull, employmentIncome, currentPartnerAge, incomeInflationFactor);
        ssIncome += (survivorBenefit - partnerSSAfterET);
      }
      if (clientAlive && !partnerAlive && clientHasFiled && partnerSSFull > clientSSFull) {
        const survivorBenefit = applySSEarningsTest(partnerSSFull, 0, simAge, incomeInflationFactor);
        ssIncome += (survivorBenefit - clientSSAfterET);
      }
    }

    // Pension income with survivor benefits
    if (clientAlive && simAge >= pensionStartAge) {
      pensionIncome += monthlyPension * 12 * (pensionCOLA ? incomeInflationFactor : 1);
    } else if (!clientAlive && clientInfo.isMarried && partnerAlive && pensionSurvivorBenefitPct > 0 && simAge >= pensionStartAge) {
      // Client died but partner gets survivor benefit from client's pension
      pensionIncome += monthlyPension * (pensionSurvivorBenefitPct / 100) * 12 * (pensionCOLA ? incomeInflationFactor : 1);
    }

    // Partner pension (if married and has pension)
    if (partnerAlive && partnerMonthlyPension > 0 && currentPartnerAge >= (partnerPensionStartAge || 65)) {
      pensionIncome += partnerMonthlyPension * 12 * (partnerPensionCOLA ? incomeInflationFactor : 1);
    } else if (!partnerAlive && clientAlive && partnerPensionSurvivorBenefitPct > 0 && partnerMonthlyPension > 0 && currentPartnerAge >= (partnerPensionStartAge || 65)) {
      // Partner died but client gets survivor benefit from partner's pension
      pensionIncome += partnerMonthlyPension * (partnerPensionSurvivorBenefitPct / 100) * 12 * (partnerPensionCOLA ? incomeInflationFactor : 1);
    }

    // Recurring additional incomes (monthly * 12) - stop if owner has died
    // taxablePercent controls what portion is taxed as ordinary income
    additionalIncomes.forEach(stream => {
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      const ownerAlive = stream.owner === 'partner' ? partnerAlive : clientAlive;
      if (ownerAlive && !stream.isOneTime && ownerAge >= stream.startAge && ownerAge <= (stream.endAge || 100)) {
        let streamAmount = stream.amount * 12;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        const taxablePct = (stream.taxablePercent ?? 100) / 100;
        otherIncome += streamAmount * taxablePct;
        // Non-taxable portion still counts as income for gap calculation
        nonTaxableAdditionalIncome += streamAmount * (1 - taxablePct);
      }
    });

    // VA GIB guaranteed income (when enabled and age >= income start age)
    // Note: VA income is not inflation-adjusted in this model
    // VA income is taxed as ordinary income
    if (vaEnabled && vaInputs && simAge >= vaIncomeStartAge) {
      vaIncome = vaAnnualIncome;
    }

    // Total income (includes non-taxable portion for gap calculation; only otherIncome is taxed)
    const income = ssIncome + pensionIncome + otherIncome + nonTaxableAdditionalIncome + vaIncome + employmentIncome;

    // One-time contributions - only if owner is alive
    // Taxable portion is added to otherIncome; non-taxable portion goes directly to portfolio
    let oneTimeContributions = 0;
    additionalIncomes.forEach(stream => {
      const ownerAge = stream.owner === 'partner' ? currentPartnerAge : simAge;
      const ownerAlive = stream.owner === 'partner' ? partnerAlive : clientAlive;
      if (ownerAlive && stream.isOneTime && ownerAge === stream.startAge) {
        let streamAmount = stream.amount;
        if (stream.inflationAdjusted) streamAmount *= incomeInflationFactor;
        const taxablePct = (stream.taxablePercent ?? 100) / 100;
        const taxablePortion = streamAmount * taxablePct;
        const nonTaxablePortion = streamAmount - taxablePortion;
        // Taxable portion treated as ordinary income for the year
        otherIncome += taxablePortion;
        // Non-taxable portion added directly to portfolio
        oneTimeContributions += nonTaxablePortion;
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
    // Surplus: when income exceeds expenses, excess flows into the portfolio as savings
    const surplus = Math.max(0, income - adjustedExpenses);
    return {
      expenses: adjustedExpenses,
      income,
      gap,
      surplus,
      simAge,
      currentPartnerAge,
      oneTimeContributions,
      employmentIncome,
      // Income breakdown for tax calculations
      ssIncome,
      pensionIncome,
      otherIncome,
      nonTaxableAdditionalIncome,
      vaIncome
    };
  };

  const getAnnualGap = (yearIndex) => getAnnualDetails(yearIndex).gap;

  // Tax-aware gap: estimate the gross withdrawal needed to cover spending + taxes
  // Even when income covers spending (gap=0), taxes on SS/pension/other income may
  // require a portfolio withdrawal, so we always compute the tax liability.
  const getTaxAwareGap = (yearIndex) => {
    if (!inputs.taxEnabled) return getAnnualGap(yearIndex);

    const details = getAnnualDetails(yearIndex);
    const rawGap = details.gap;
    const surplus = details.surplus || 0;

    // Estimate tax on the withdrawal using account-type split
    const traditionalPct = (inputs.traditionalPercent ?? 60) / 100;
    const rothPct = (inputs.rothPercent ?? 25) / 100;
    const nqPct = (inputs.nqPercent ?? 15) / 100;
    const nqDividendYield = (inputs.nqDividendYield ?? 2.0) / 100;
    const nqQualifiedDividendPct = (inputs.nqQualifiedDividendPercent ?? 80) / 100;
    const nqAnnualCapGainRate = (inputs.nqCapitalGainRate ?? 4) / 100;

    // Estimate NQ balance as share of remaining portfolio (rough)
    const estNqBalance = bucketPortfolio * nqPct;
    const nqTotalDividends = estNqBalance * nqDividendYield;
    const nqQualifiedDividends = nqTotalDividends * nqQualifiedDividendPct;
    const nqOrdinaryDividends = nqTotalDividends - nqQualifiedDividends;
    const nqAnnualCapGains = estNqBalance * nqAnnualCapGainRate;

    const isSenior = details.simAge >= 65;
    const filingStatus = inputs.filingStatus || 'married';
    const stateRate = inputs.stateRate || 0;

    // Two-pass convergence: estimate tax, then re-estimate with tax-inclusive withdrawal
    let withdrawal = rawGap;
    for (let pass = 0; pass < 2; pass++) {
      const taxData = calculateAnnualTax({
        ssIncome: details.ssIncome,
        pensionIncome: details.pensionIncome + (details.vaIncome || 0),
        traditionalWithdrawal: withdrawal * traditionalPct,
        rothWithdrawal: withdrawal * rothPct,
        nqTaxableGain: nqAnnualCapGains,
        nqQualifiedDividends,
        nqOrdinaryDividends,
        otherIncome: details.otherIncome,
        employmentIncome: details.employmentIncome
      }, { filingStatus, stateRate, stateCode: inputs.stateCode || '' }, isSenior);
      // Net withdrawal: spending gap + taxes, offset by any income surplus
      withdrawal = Math.max(0, rawGap + taxData.totalTax - surplus);
    }

    return withdrawal;
  };

  const calculateBucketNeed = (startYear, endYear, rate) => {
    let totalPV = 0;
    for (let year = startYear; year <= endYear; year++) {
      const futureGap = getTaxAwareGap(year - 1);
      const pvFactor = Math.pow(1 + (rate / 100), year - 1);
      totalPV += futureGap / pvFactor;
    }
    return totalPV;
  };

  // Bucket allocation is based on the full illustrated period starting from simulationStartAge.
  // If the client is still working in early years, those years will have $0 or minimal withdrawal
  // needs (surplus covers expenses + taxes). The advisor handles transitions via rebalancing.
  const b1Start = 1;
  const b1Target = Math.round(calculateBucketNeed(b1Start, b1Start + 2, assumptions.b1.return) / 1000) * 1000;
  const b2Start = b1Start + 3;
  const b2Target = Math.round(calculateBucketNeed(b2Start, b2Start + 2, assumptions.b2.return) / 1000) * 1000;
  // B3 covers years 7-15 with minimum 20% and maximum 25% allocation
  const b3Start = b1Start + 6;
  const b3Calculated = Math.round(calculateBucketNeed(b3Start, b3Start + 8, assumptions.b3.return) / 1000) * 1000;
  // Only apply B3 min/max floors when portfolio can cover B1+B2 spending needs
  const spendingDriven = b1Target + b2Target;
  const hasSpendingSurplus = bucketPortfolio > spendingDriven;
  const b3Min = hasSpendingSurplus ? Math.round((bucketPortfolio * 0.20) / 1000) * 1000 : 0;
  const b3Max = hasSpendingSurplus ? Math.round((bucketPortfolio * 0.25) / 1000) * 1000 : Infinity;
  const b3Target = Math.min(Math.max(b3Calculated, b3Min), b3Max);
  // B4 target is 10% of portfolio, but only when portfolio can cover spending needs
  const b4FullTarget = hasSpendingSurplus ? Math.round((bucketPortfolio * 0.10) / 1000) * 1000 : 0;

  // Sequential fill: B1 first, then B2, B3 — these are spending-driven
  // B4 and B5 split whatever remains, with B5 >= 2x B4 constraint
  let remaining = bucketPortfolio;
  const b1Val = Math.min(b1Target, Math.max(0, remaining));
  remaining -= b1Val;
  const b2Val = Math.min(b2Target, Math.max(0, remaining));
  remaining -= b2Val;
  const b3Val = Math.min(b3Target, Math.max(0, remaining));
  remaining -= b3Val;
  // B4: capped at 10% target AND must leave B5 >= 2x B4 (so B4 <= remaining/3)
  const b4MaxForB5 = remaining > 0 ? Math.round((remaining / 3) / 1000) * 1000 : 0;
  const b4Val = Math.min(b4FullTarget, b4MaxForB5, Math.max(0, remaining));
  remaining -= b4Val;
  const b5Val = Math.max(0, remaining);

  return {
    b1Val,
    b2Val,
    b3Val,
    b4Val,
    b5Val,
    isDeficit: b5Val === 0 && bucketPortfolio < (b1Target + b2Target + b3Target + b4FullTarget),
    getAnnualGap,
    getTaxAwareGap,
    getAnnualDetails,
    simulationStartAge,
    clientInfo,
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
  const { b1Val, b2Val, b3Val, b4Val, b5Val, getAnnualGap, getTaxAwareGap, getAnnualDetails, simulationStartAge, clientInfo } = basePlan;

  // Run until the later-dying spouse's expected death age, capped at 40 years
  const startAge = simulationStartAge || 65;
  const clientDeathAge = inputs.expectedDeathAge || 95;
  const yearsToClientDeath = clientDeathAge - startAge;
  let yearsToLastDeath = yearsToClientDeath;
  if (clientInfo?.isMarried) {
    const partnerDeathAge = inputs.partnerExpectedDeathAge || 95;
    // Convert partner's death age to years from simulation start (client's timeline)
    const ageDiff = (clientInfo.currentAge || 0) - (clientInfo.partnerAge || 0);
    const partnerDeathInClientAge = partnerDeathAge + ageDiff;
    yearsToLastDeath = Math.max(yearsToClientDeath, partnerDeathInClientAge - startAge);
  }
  const years = Math.min(40, Math.max(1, yearsToLastDeath));
  let results = [];
  let failureCount = 0;
  const iterations = isMonteCarlo ? 1000 : 1;
  // Benchmark: Passive 60/40 Balanced Portfolio (60% US Equity / 40% US Aggregate Bond)
  // Forward-looking consensus from major capital market assumptions (2026):
  //   Vanguard VCMM: 6.0-6.5%, JP Morgan LTCMA: 5.7-6.4%, Schwab 10yr: 6.2%
  //   Historical 50yr avg ~8.7%, reduced by forward P/E compression & lower real growth
  //   StdDev: historical ~9.6%, increased stock-bond correlation pushes forward to 9-11%
  const BENCHMARK_RETURN = 6.0; // Forward-looking nominal return %
  const BENCHMARK_STDDEV = 10.0; // Forward-looking annualized std dev %
  const benchmarkReturn = BENCHMARK_RETURN / 100;
  const benchmarkStdDev = BENCHMARK_STDDEV / 100;
  // Advisory fee applied annually to both the managed bucket portfolio and the passive 60/40 benchmark
  // (client pays the advisor either way — comparison is purely active vs passive strategy)
  const advisoryFeeRate = (inputs.advisoryFee ?? 1.0) / 100;

  // Calculate VA allocation if enabled
  let vaAllocationAmount = 0;
  if (vaInputs) {
    if (vaInputs.allocationType === 'percentage') {
      vaAllocationAmount = inputs.totalPortfolio * (vaInputs.allocationPercent / 100);
    } else {
      vaAllocationAmount = Math.min(vaInputs.allocationFixed, inputs.totalPortfolio);
    }
  }

  // --- RMD setup: derive birth years and per-owner traditional balances ---
  const currentYear = new Date().getFullYear();
  const clientBirthYear = currentYear - (clientInfo?.currentAge || 65);
  const partnerBirthYear = clientInfo?.isMarried ? currentYear - (clientInfo?.partnerAge || 65) : null;

  // Compute per-owner traditional balance from accounts array (if provided)
  let clientTraditionalShare = 1; // default: client owns all traditional
  let partnerTraditionalShare = 0;
  if (inputs.accounts && inputs.accounts.length > 0) {
    const totalTrad = inputs.accounts.filter(a => a.type === 'traditional').reduce((s, a) => s + (a.balance || 0), 0);
    if (totalTrad > 0) {
      const clientTrad = inputs.accounts.filter(a => a.type === 'traditional' && a.owner === 'client').reduce((s, a) => s + (a.balance || 0), 0);
      clientTraditionalShare = clientTrad / totalTrad;
      partnerTraditionalShare = 1 - clientTraditionalShare;
    }
  } else if (clientInfo?.isMarried) {
    // Without accounts, split traditional 50/50 for married couples
    clientTraditionalShare = 0.5;
    partnerTraditionalShare = 0.5;
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

    // Track account-type balances for RMD calculations
    const initTradPct = (inputs.traditionalPercent ?? 60) / 100;
    const initRothPct = (inputs.rothPercent ?? 25) / 100;
    const initNqPct = (inputs.nqPercent ?? 15) / 100;
    let traditionalBalance = inputs.totalPortfolio * initTradPct;
    let rothBalance = inputs.totalPortfolio * initRothPct;
    let nqAccountBalance = inputs.totalPortfolio * initNqPct;

    let nqUnrealizedGains = 0; // Tracks deferred capital gains that roll forward

    let benchmarkBalance = inputs.totalPortfolio;
    let history = [];
    let failed = false;

    // Helper: split withdrawal across account types (proportionate or priority-based)
    const splitWithdrawal = (withdrawal, traditionalPct, rothPct, nqPct, totalRMD, tradBal, rothBal, nqBal, yearNum) => {
      let tradW, rothW, nqW;

      if (inputs.liquidationMode === 'priority') {
        const strategy = (inputs.liquidationStrategies || []).find(s => yearNum >= s.startYear && yearNum <= s.endYear);
        if (strategy && strategy.split) {
          // Percentage-based split: e.g. { traditional: 50, nq: 50, roth: 0 }
          const sp = strategy.split;
          const totalPct = (sp.traditional || 0) + (sp.roth || 0) + (sp.nq || 0);
          if (totalPct > 0) {
            tradW = withdrawal * ((sp.traditional || 0) / totalPct);
            rothW = withdrawal * ((sp.roth || 0) / totalPct);
            nqW = withdrawal * ((sp.nq || 0) / totalPct);
          } else {
            tradW = withdrawal * traditionalPct;
            rothW = withdrawal * rothPct;
            nqW = withdrawal * nqPct;
          }
        } else if (strategy && strategy.priority) {
          tradW = 0; rothW = 0; nqW = 0;
          let remaining = withdrawal;
          const balMap = { traditional: tradBal, roth: rothBal, nq: nqBal };
          for (const acct of strategy.priority) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, balMap[acct] || 0);
            if (acct === 'traditional') tradW = take;
            else if (acct === 'roth') rothW = take;
            else if (acct === 'nq') nqW = take;
            remaining -= take;
          }
        } else {
          // No strategy covers this year — fall back to proportionate
          tradW = withdrawal * traditionalPct;
          rothW = withdrawal * rothPct;
          nqW = withdrawal * nqPct;
        }
      } else {
        tradW = withdrawal * traditionalPct;
        rothW = withdrawal * rothPct;
        nqW = withdrawal * nqPct;
      }

      // Enforce RMD floor on Traditional
      if (totalRMD > tradW) {
        const rmdForce = totalRMD - tradW;
        tradW = totalRMD;
        const nonTrad = rothW + nqW;
        if (nonTrad > rmdForce) {
          const ratio = (nonTrad - rmdForce) / nonTrad;
          rothW *= ratio;
          nqW *= ratio;
        } else { rothW = 0; nqW = 0; }
      }

      // Cap each at available account balance, redistribute overflow
      let ovf = 0;
      if (tradW > tradBal) { ovf += tradW - tradBal; tradW = tradBal; }
      if (rothW > rothBal) { ovf += rothW - rothBal; rothW = rothBal; }
      if (nqW > nqBal) { ovf += nqW - nqBal; nqW = nqBal; }
      // Redistribute: Traditional → NQ → Roth (least tax-advantaged first)
      if (ovf > 0) { const add = Math.min(ovf, tradBal - tradW); tradW += add; ovf -= add; }
      if (ovf > 0) { const add = Math.min(ovf, nqBal - nqW); nqW += add; ovf -= add; }
      if (ovf > 0) { const add = Math.min(ovf, rothBal - rothW); rothW += add; ovf -= add; }

      return { tradW, rothW, nqW };
    };

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
        expenses, income, gap, surplus, simAge, currentPartnerAge, oneTimeContributions,
        ssIncome, pensionIncome, otherIncome, nonTaxableAdditionalIncome, vaIncome, employmentIncome
      } = getAnnualDetails(i - 1);

      balances.b1 *= (1 + rates.b1);
      balances.b2 *= (1 + rates.b2);
      balances.b3 *= (1 + rates.b3);
      balances.b4 *= (1 + rates.b4);
      balances.b5 *= (1 + rates.b5);

      // Deduct advisory fee proportionally from all buckets
      if (advisoryFeeRate > 0) {
        const feeMultiplier = 1 - advisoryFeeRate;
        balances.b1 *= feeMultiplier;
        balances.b2 *= feeMultiplier;
        balances.b3 *= feeMultiplier;
        balances.b4 *= feeMultiplier;
        balances.b5 *= feeMultiplier;
      }

      // Add one-time contributions to b5 (long-term bucket)
      if (oneTimeContributions > 0) {
        balances.b5 += oneTimeContributions;
      }

      // Income surplus handling is deferred until after tax calculation,
      // so we can net surplus against tax liability before adding to portfolio.

      const postGrowthTotal = Object.values(balances).reduce((a, b) => a + b, 0);
      const annualGrowth = postGrowthTotal - startTotal - oneTimeContributions;

      const appliedBench = isMonteCarlo
        ? (benchmarkReturn + benchmarkStdDev * randn_bm())
        : benchmarkReturn;
      benchmarkBalance *= (1 + appliedBench);

      // Apply same advisory fee to benchmark — client pays the advisor either way,
      // so the comparison is purely active bucket strategy vs passive 60/40 management
      if (advisoryFeeRate > 0) {
        benchmarkBalance *= (1 - advisoryFeeRate);
      }

      // Add one-time contributions to benchmark (surplus added after tax netting below)
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

      // --- Grow account-type balances at blended portfolio rate ---
      const blendedRate = startTotal > 0
        ? (postGrowthTotal - startTotal - oneTimeContributions) / startTotal
        : 0;
      traditionalBalance *= (1 + blendedRate);
      rothBalance *= (1 + blendedRate);
      nqAccountBalance *= (1 + blendedRate);
      if (oneTimeContributions > 0) nqAccountBalance += oneTimeContributions;

      // --- RMD calculation (per-owner) ---
      const clientAlive = simAge < (inputs.expectedDeathAge || 95);
      const partnerAlive = clientInfo?.isMarried && currentPartnerAge < (inputs.partnerExpectedDeathAge || 95);
      let clientRMD = 0;
      let partnerRMD = 0;
      if (inputs.taxEnabled && traditionalBalance > 0) {
        // On spouse death, surviving spouse inherits the deceased's traditional balance
        if (clientInfo?.isMarried && !clientAlive && partnerAlive && clientTraditionalShare > 0) {
          // Client died — partner inherits client's share (recalculate as 100% partner)
          // This is handled by using full traditionalBalance for partner RMD
          partnerRMD = calculateRMD(traditionalBalance, currentPartnerAge, partnerBirthYear);
        } else if (clientInfo?.isMarried && clientAlive && !partnerAlive && partnerTraditionalShare > 0) {
          // Partner died — client inherits partner's share
          clientRMD = calculateRMD(traditionalBalance, simAge, clientBirthYear);
        } else {
          // Both alive (or single) — calculate per-owner
          clientRMD = calculateRMD(traditionalBalance * clientTraditionalShare, simAge, clientBirthYear);
          if (partnerBirthYear && partnerAlive) {
            partnerRMD = calculateRMD(traditionalBalance * partnerTraditionalShare, currentPartnerAge, partnerBirthYear);
          }
        }
      }
      const totalRMD = clientRMD + partnerRMD;

      // --- Tax-inclusive withdrawal calculation ---
      // When surplus > 0 (income > expenses), taxes are paid from income first.
      // Only the net shortfall (if any) requires a portfolio withdrawal.
      let totalWithdrawal = adjustedGap;
      let taxData = { federalTax: 0, stateTax: 0, totalTax: 0, effectiveRate: '0.0', qdivTax: 0, taxableSS: 0, deduction: 0 };
      let nqTaxDetail = {};
      let rmdAmount = totalRMD;
      let rmdExcess = 0;
      let netSurplus = surplus; // Track surplus after tax netting
      let rothConversionAmount = 0;
      let rothConversionTax = 0;
      let currentMAGI = 0;
      let irmaaCost = 0;
      let irmaaBracket = 0;
      let nqAnnualCapGains = 0;
      let nqStrategicRealization = 0;
      let nqOrdinaryDividends = 0;
      let nqQualifiedDividends = 0;

      if (inputs.taxEnabled) {
        // Resolve per-age override or use defaults
        const override = inputs.withdrawalOverrides?.[simAge];
        const traditionalPct = (override?.traditionalPercent ?? inputs.traditionalPercent ?? 60) / 100;
        const rothPct = (override?.rothPercent ?? inputs.rothPercent ?? 25) / 100;
        const nqPct = (override?.nqPercent ?? inputs.nqPercent ?? 15) / 100;

        // NQ tax computation — per-bucket when taxProfiles are available, global fallback otherwise
        // Only generate NQ dividends/cap gains when there is actual NQ balance remaining
        const capGainOverride = (inputs.nqCapGainOverrides || []).find(r => i >= r.startYear && i <= r.endYear);
        const baseCapGainRate = ((inputs.nqCapitalGainRate) ?? 4) / 100;
        const nqAnnualCapGainRate = ((capGainOverride?.rate ?? inputs.nqCapitalGainRate) ?? 4) / 100;
        const nqBalanceForTax = nqAccountBalance;

        // Per-bucket tax profiles: compute NQ tax items from each bucket's NQ share
        const hasBucketTaxProfiles = assumptions.b1?.taxProfile && assumptions.b2?.taxProfile;

        if (nqBalanceForTax > 0) {
          if (hasBucketTaxProfiles) {
            // Each bucket's NQ portion generates tax items based on its taxProfile
            // Scale by actual NQ balance vs theoretical to handle partial depletion
            const bucketKeys = ['b1', 'b2', 'b3', 'b4', 'b5'];
            const bucketTotal = bucketKeys.reduce((s, k) => s + balances[k], 0);
            const theoreticalNq = bucketTotal * nqPct;
            const nqScale = theoreticalNq > 0 ? Math.min(1, nqBalanceForTax / theoreticalNq) : 0;

            for (const bk of bucketKeys) {
              const tp = assumptions[bk]?.taxProfile;
              if (!tp || bucketTotal <= 0) continue;
              const bucketNqBalance = balances[bk] * nqPct * nqScale;
              nqOrdinaryDividends += bucketNqBalance * ((tp.ordinaryIncomeRate || 0) / 100);
              nqQualifiedDividends += bucketNqBalance * ((tp.qualDivRate || 0) / 100);
            }
          } else {
            // Global fallback: use flat dividend yield
            const nqDividendYield = (inputs.nqDividendYield ?? 2.0) / 100;
            const nqQualifiedDividendPct = (inputs.nqQualifiedDividendPercent ?? 80) / 100;
            const nqTotalDividends = nqBalanceForTax * nqDividendYield;
            nqQualifiedDividends = nqTotalDividends * nqQualifiedDividendPct;
            nqOrdinaryDividends = nqTotalDividends - nqQualifiedDividends;
          }
        }

        const isSenior = simAge >= 65;
        // Switch to single filing after first spouse dies
        const clientAliveForTax = clientAlive;
        const partnerAliveForTax = partnerAlive;
        const bothAliveForTax = clientAliveForTax && partnerAliveForTax;
        const filingStatus = (inputs.filingStatus === 'married' && !bothAliveForTax) ? 'single' : (inputs.filingStatus || 'married');
        const stateRate = inputs.stateRate || 0;

        // Unrealized gains rollforward: when cap gain override sets rate to 0,
        // gains still accrue but are deferred (unrealized). They accumulate and
        // can be strategically realized in years with 0% LTCG bracket room.

        // Compute potential and realized cap gains (per-bucket or global)
        let potentialCapGains = 0;

        if (nqBalanceForTax > 0) {
          if (hasBucketTaxProfiles) {
            const bucketKeys = ['b1', 'b2', 'b3', 'b4', 'b5'];
            const bucketTotal = bucketKeys.reduce((s, k) => s + balances[k], 0);
            const theoreticalNq = bucketTotal * nqPct;
            const nqScale = theoreticalNq > 0 ? Math.min(1, nqBalanceForTax / theoreticalNq) : 0;
            for (const bk of bucketKeys) {
              const tp = assumptions[bk]?.taxProfile;
              if (!tp || bucketTotal <= 0) continue;
              const bucketNqBalance = balances[bk] * nqPct * nqScale;
              potentialCapGains += bucketNqBalance * ((tp.realizedCapGainRate || 0) / 100);
            }
          } else {
            potentialCapGains = nqBalanceForTax * baseCapGainRate;
          }
        }

        if (capGainOverride && capGainOverride.rate === 0) {
          // Defer: gains accrue as unrealized
          nqUnrealizedGains += potentialCapGains;
          nqAnnualCapGains = 0;
        } else if (capGainOverride) {
          // Explicit override rate (non-zero)
          nqAnnualCapGains = nqBalanceForTax * (capGainOverride.rate / 100);
        } else {
          // Use per-bucket computed cap gains as the realized amount
          nqAnnualCapGains = potentialCapGains;

          // Strategic realization: if there are accumulated unrealized gains,
          // check if we can realize them at the 0% LTCG rate.
          // The 0% LTCG bracket applies when taxable ordinary income is below the threshold.
          if (nqUnrealizedGains > 0) {
            // Estimate ordinary income to determine 0% LTCG room
            const estTradWithdrawal = adjustedGap > 0 ? adjustedGap * ((inputs.traditionalPercent ?? 60) / 100) : 0;
            const estOrdinaryIncome = (ssIncome * 0.85) + pensionIncome + (vaIncome || 0) + estTradWithdrawal +
              nqOrdinaryDividends + otherIncome + (employmentIncome || 0) +
              (inputs.rothConversions?.[simAge] || 0);
            const yearsFromTaxBase = Math.max(0, simAge - (clientInfo?.currentAge || 65));
            const inflPct = inputs.inflationRate ?? 2.5;
            const qdivBrackets = getInflationAdjustedQDivBrackets(filingStatus, yearsFromTaxBase, inflPct);
            const deduction = getInflationAdjustedDeduction(filingStatus, yearsFromTaxBase, inflPct, isSenior);
            const taxableOrdinary = Math.max(0, estOrdinaryIncome - deduction);

            // 0% LTCG bracket room = threshold - taxable ordinary income - already realized gains - qualified divs
            const zeroPctThreshold = qdivBrackets[0]?.max || 98900;
            const availableRoom = Math.max(0, zeroPctThreshold - taxableOrdinary - nqAnnualCapGains - nqQualifiedDividends);

            if (availableRoom > 0) {
              nqStrategicRealization = Math.min(nqUnrealizedGains, availableRoom);
              nqUnrealizedGains -= nqStrategicRealization;
              nqAnnualCapGains += nqStrategicRealization;
            }
          }
        }

        // When there's an income surplus, first compute tax on income alone (no withdrawal).
        // Surplus pays taxes before any portfolio withdrawal is needed.
        if (surplus > 0 && adjustedGap === 0) {
          // Compute tax on income only — no portfolio withdrawal
          taxData = calculateAnnualTax({
            ssIncome,
            pensionIncome: pensionIncome + (vaIncome || 0),
            traditionalWithdrawal: 0,
            rothWithdrawal: 0,
            nqTaxableGain: nqAnnualCapGains,
            nqQualifiedDividends,
            nqOrdinaryDividends,
            otherIncome,
            employmentIncome
          }, { filingStatus, stateRate, stateCode: inputs.stateCode || '' }, isSenior);

          if (surplus >= taxData.totalTax) {
            // Surplus covers all taxes — net surplus flows to portfolio as contribution
            netSurplus = surplus - taxData.totalTax;
            totalWithdrawal = 0;
            nqTaxDetail = {
              nqWithdrawal: 0,
              nqTaxableGain: Math.round(nqAnnualCapGains),
              nqQualifiedDividends: Math.round(nqQualifiedDividends),
              nqOrdinaryDividends: Math.round(nqOrdinaryDividends),
              nqBalanceForTax: Math.round(nqBalanceForTax),
              traditionalPctUsed: 0, rothPctUsed: 0, nqPctUsed: 0
            };
          } else {
            // Surplus partially covers taxes — need withdrawal for the rest
            // Re-iterate with the shortfall as the starting withdrawal
            netSurplus = 0;
            let withdrawal = taxData.totalTax - surplus;
            let finalTradW = 0, finalRothW = 0, finalNqW = 0;

            for (let taxIter = 0; taxIter < 6; taxIter++) {
              const split = splitWithdrawal(withdrawal, traditionalPct, rothPct, nqPct, totalRMD, traditionalBalance, rothBalance, nqAccountBalance, i);
              finalTradW = split.tradW; finalRothW = split.rothW; finalNqW = split.nqW;

              taxData = calculateAnnualTax({
                ssIncome, pensionIncome: pensionIncome + (vaIncome || 0),
                traditionalWithdrawal: split.tradW, rothWithdrawal: split.rothW,
                nqTaxableGain: nqAnnualCapGains, nqQualifiedDividends, nqOrdinaryDividends,
                otherIncome, employmentIncome
              }, { filingStatus, stateRate, stateCode: inputs.stateCode || '' }, isSenior);

              const newWithdrawal = Math.max(0, taxData.totalTax - surplus);
              if (Math.abs(newWithdrawal - withdrawal) < 1) break;
              withdrawal = newWithdrawal;
            }
            totalWithdrawal = withdrawal;

            traditionalBalance = Math.max(0, traditionalBalance - finalTradW);
            rothBalance = Math.max(0, rothBalance - finalRothW);
            nqAccountBalance = Math.max(0, nqAccountBalance - finalNqW);

            const totalFinal = finalTradW + finalRothW + finalNqW;
            nqTaxDetail = {
              nqWithdrawal: Math.round(finalNqW),
              nqTaxableGain: Math.round(nqAnnualCapGains),
              nqQualifiedDividends: Math.round(nqQualifiedDividends),
              nqOrdinaryDividends: Math.round(nqOrdinaryDividends),
              nqBalanceForTax: Math.round(nqBalanceForTax),
              traditionalPctUsed: totalFinal > 0 ? Math.round((finalTradW / totalFinal) * 100) : 0,
              rothPctUsed: totalFinal > 0 ? Math.round((finalRothW / totalFinal) * 100) : 0,
              nqPctUsed: totalFinal > 0 ? 100 - Math.round((finalTradW / totalFinal) * 100) - Math.round((finalRothW / totalFinal) * 100) : 0
            };
          }
        } else {
          // Standard case: spending gap requires portfolio withdrawal
          // Iterate to convergence with balance constraints + RMD enforcement
          let withdrawal = adjustedGap;
          let finalTradWithdrawal = 0, finalRothWithdrawal = 0, finalNqWithdrawal = 0;

          for (let taxIter = 0; taxIter < 6; taxIter++) {
            const split = splitWithdrawal(withdrawal, traditionalPct, rothPct, nqPct, totalRMD, traditionalBalance, rothBalance, nqAccountBalance, i);
            finalTradWithdrawal = split.tradW;
            finalRothWithdrawal = split.rothW;
            finalNqWithdrawal = split.nqW;

            // Compute tax on the actual constrained split
            taxData = calculateAnnualTax({
              ssIncome,
              pensionIncome: pensionIncome + (vaIncome || 0),
              traditionalWithdrawal: split.tradW,
              rothWithdrawal: split.rothW,
              nqTaxableGain: nqAnnualCapGains,
              nqQualifiedDividends,
              nqOrdinaryDividends,
              otherIncome,
              employmentIncome
            }, { filingStatus, stateRate, stateCode: inputs.stateCode || '' }, isSenior);

            const newWithdrawal = adjustedGap + taxData.totalTax;
            if (Math.abs(newWithdrawal - withdrawal) < 1) break;
            withdrawal = newWithdrawal;
          }
          totalWithdrawal = withdrawal;
          netSurplus = 0;

          // Compute effective percentages used
          const totalFinalWithdrawal = finalTradWithdrawal + finalRothWithdrawal + finalNqWithdrawal;
          const effTradPct = totalFinalWithdrawal > 0 ? Math.round((finalTradWithdrawal / totalFinalWithdrawal) * 100) : 0;
          const effRothPct = totalFinalWithdrawal > 0 ? Math.round((finalRothWithdrawal / totalFinalWithdrawal) * 100) : 0;
          const effNqPct = totalFinalWithdrawal > 0 ? 100 - effTradPct - effRothPct : 0;

          nqTaxDetail = {
            nqWithdrawal: Math.round(finalNqWithdrawal),
            nqTaxableGain: Math.round(nqAnnualCapGains),
            nqQualifiedDividends: Math.round(nqQualifiedDividends),
            nqOrdinaryDividends: Math.round(nqOrdinaryDividends),
            nqBalanceForTax: Math.round(nqBalanceForTax),
            traditionalPctUsed: effTradPct,
            rothPctUsed: effRothPct,
            nqPctUsed: effNqPct
          };

          // Update account-type balances based on actual withdrawals
          traditionalBalance = Math.max(0, traditionalBalance - finalTradWithdrawal);
          rothBalance = Math.max(0, rothBalance - finalRothWithdrawal);
          nqAccountBalance = Math.max(0, nqAccountBalance - finalNqWithdrawal);
        }

        // Handle RMD excess (when RMD > total spending need, excess reinvested to NQ)
        if (totalRMD > 0) {
          const totalNeeded = adjustedGap + taxData.totalTax;
          if (totalRMD > totalNeeded && totalNeeded > 0) {
            rmdExcess = totalRMD - totalNeeded;
            totalWithdrawal = Math.max(totalWithdrawal, totalRMD);
          }
        }
        if (rmdExcess > 0) {
          nqAccountBalance += rmdExcess;
        }

        // --- Roth Conversion ---
        // Converts traditional → Roth, taxed as ordinary income. Additional tax paid from NQ.
        if (inputs.rothConversions?.[simAge] > 0) {
          rothConversionAmount = Math.min(inputs.rothConversions[simAge], traditionalBalance);
          if (rothConversionAmount > 0) {
            traditionalBalance -= rothConversionAmount;
            rothBalance += rothConversionAmount;

            // Recompute tax with conversion added as ordinary income
            const prevTotalTax = taxData.totalTax;
            const tradWithdrawalForTax = totalWithdrawal * (nqTaxDetail.traditionalPctUsed || 0) / 100;
            const rothWithdrawalForTax = totalWithdrawal * (nqTaxDetail.rothPctUsed || 0) / 100;
            taxData = calculateAnnualTax({
              ssIncome,
              pensionIncome: pensionIncome + (vaIncome || 0),
              traditionalWithdrawal: tradWithdrawalForTax + rothConversionAmount,
              rothWithdrawal: rothWithdrawalForTax,
              nqTaxableGain: nqTaxDetail.nqTaxableGain || 0,
              nqQualifiedDividends: nqTaxDetail.nqQualifiedDividends || 0,
              nqOrdinaryDividends: nqTaxDetail.nqOrdinaryDividends || 0,
              otherIncome,
              employmentIncome
            }, { filingStatus, stateRate, stateCode: inputs.stateCode || '' }, isSenior);

            // Pay additional tax from NQ account AND reduce bucket balances accordingly
            rothConversionTax = Math.max(0, taxData.totalTax - prevTotalTax);
            const conversionTax = rothConversionTax;
            if (conversionTax > 0) {
              nqAccountBalance = Math.max(0, nqAccountBalance - conversionTax);
              // Deduct from bucket balances (proportionally from largest to smallest)
              let taxRemaining = conversionTax;
              const bucketKeys = ['b5', 'b4', 'b3', 'b2', 'b1'];
              for (const bk of bucketKeys) {
                if (taxRemaining <= 0) break;
                const deduct = Math.min(taxRemaining, balances[bk]);
                balances[bk] -= deduct;
                taxRemaining -= deduct;
              }
            }
          }
        }
        // --- IRMAA calculation (Medicare surcharge based on MAGI from 2 years prior) ---
        // Compute current year's MAGI for IRMAA lookback
        // MAGI = all gross income (SS + pension + traditional + NQ gains/divs + other + Roth conversions)
        currentMAGI = ssIncome + pensionIncome + (vaIncome || 0) +
          (nqTaxDetail.nqWithdrawal || 0) + nqAnnualCapGains + nqQualifiedDividends + nqOrdinaryDividends +
          otherIncome + (employmentIncome || 0) + rothConversionAmount +
          (totalWithdrawal * ((nqTaxDetail.traditionalPctUsed || 0) / 100));

        if (inputs.irmaaEnabled && simAge >= 65) {
          // Use MAGI from 2 years prior (lookback rule)
          const lookbackIdx = history.length - 2;
          const lookbackMAGI = lookbackIdx >= 0 ? (history[lookbackIdx].magi || 0) : currentMAGI;

          const yearsFromIrmaaBase = Math.max(0, simAge - (clientInfo?.currentAge || 65));
          const inflPct = inputs.inflationRate ?? 2.5;
          const numMedicareEnrollees = (bothAliveForTax && simAge >= 65 && currentPartnerAge >= 65) ? 2 : 1;
          const irmaaResult = calculateIRMAA(lookbackMAGI, filingStatus, yearsFromIrmaaBase, inflPct, numMedicareEnrollees);
          irmaaCost = irmaaResult.totalAnnualCost;
          irmaaBracket = irmaaResult.bracket;

          // IRMAA is an additional expense — deduct from portfolio (NQ first, then buckets)
          if (irmaaCost > 0) {
            totalWithdrawal += irmaaCost;
            taxData.irmaaCost = irmaaCost;
            // Deduct IRMAA cost from NQ account and bucket balances
            nqAccountBalance = Math.max(0, nqAccountBalance - irmaaCost);
            let irmaaRemaining = irmaaCost;
            for (const bk of ['b1', 'b2', 'b3', 'b4', 'b5']) {
              if (irmaaRemaining <= 0) break;
              const deduct = Math.min(irmaaRemaining, balances[bk]);
              balances[bk] -= deduct;
              irmaaRemaining -= deduct;
            }
          }
        }
      } else {
        // Tax not enabled — still track balances proportionally
        const tradPct = (inputs.traditionalPercent ?? 60) / 100;
        const rothPctVal = (inputs.rothPercent ?? 25) / 100;
        const nqPctVal = (inputs.nqPercent ?? 15) / 100;
        traditionalBalance = Math.max(0, traditionalBalance - totalWithdrawal * tradPct);
        rothBalance = Math.max(0, rothBalance - totalWithdrawal * rothPctVal);
        nqAccountBalance = Math.max(0, nqAccountBalance - totalWithdrawal * nqPctVal);
        rmdAmount = 0;
      }

      // Net surplus (after taxes) flows into portfolio as contribution to NQ account
      // (surplus is after-tax income, so it enters the non-qualified/taxable account)
      if (netSurplus > 0) {
        balances.b5 += netSurplus;
        nqAccountBalance += netSurplus;
        benchmarkBalance += netSurplus;
      }

      let withdrawalAmount = totalWithdrawal;

      // Benchmark withdraws the same total as the bucket portfolio — same client,
      // same spending needs, same tax obligations. Only the investment returns differ.
      if (totalWithdrawal > 0 && benchmarkBalance >= totalWithdrawal) {
        benchmarkBalance -= totalWithdrawal;
      } else if (totalWithdrawal > 0) {
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
          // Uses tax-aware gap so rebalancing accounts for tax-inclusive distributions
          const calcPVGaps = (startYear, endYear, rate) => {
            let totalPV = 0;
            for (let yr = startYear; yr <= endYear; yr++) {
              if (yr > years) break; // Don't go beyond simulation
              const futureGap = getTaxAwareGap(yr - 1);
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
        surplus: Math.round(netSurplus),
        livingExpenses: Math.round(expenses),
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
        // RMD data
        rmdAmount: Math.round(rmdAmount),
        rmdExcess: Math.round(rmdExcess),
        traditionalBalanceDetail: Math.round(traditionalBalance),
        rothBalanceDetail: Math.round(rothBalance),
        nqBalanceDetail: Math.round(nqAccountBalance),
        // Income breakdown (for detailed views)
        ssIncomeDetail: Math.round(ssIncome),
        pensionIncomeDetail: Math.round(pensionIncome),
        otherIncomeDetail: Math.round(otherIncome + nonTaxableAdditionalIncome),
        vaIncomeDetail: Math.round(vaIncome || 0),
        employmentIncomeDetail: Math.round(employmentIncome || 0),
        taxableSS: Math.round(taxData.taxableSS || 0),
        rothConversion: Math.round(rothConversionAmount),
        rothConversionTax: Math.round(rothConversionTax),
        // Unrealized capital gains tracking
        nqUnrealizedGains: Math.round(nqUnrealizedGains),
        nqStrategicRealization: Math.round(nqStrategicRealization || 0),
        // IRMAA tracking
        magi: Math.round(currentMAGI || 0),
        irmaaCost: Math.round(irmaaCost || 0),
        irmaaBracket: irmaaBracket || 0,
        // Per-bucket return rates (as decimals, e.g. 0.05 = 5%)
        r1: rates.b1,
        r2: rates.b2,
        r3: rates.b3,
        r4: rates.b4,
        r5: rates.b5
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

    // Calculate median legacy (final year balance — includes all iterations for consistency with chart)
    const finalBalances = results
      .map(r => r[years - 1]?.total || 0)
      .sort((a, b) => a - b);
    const medianLegacy = finalBalances.length > 0
      ? finalBalances[Math.floor(finalBalances.length / 2)]
      : 0;

    // Find representative iterations for full cash flow table views
    const sortedByFinal = results
      .map((history, idx) => ({ idx, final: history[years - 1]?.total || 0 }))
      .sort((a, b) => a.final - b.final);
    const p10Target = sortedByFinal[Math.floor(iterations * 0.1)]?.idx || 0;
    const medianTarget = sortedByFinal[Math.floor(iterations * 0.5)]?.idx || 0;
    const p90Target = sortedByFinal[Math.floor(iterations * 0.9)]?.idx || 0;

    return {
      data: processed,
      successRate: ((iterations - failureCount) / iterations) * 100,
      medianLegacy: Math.round(medianLegacy),
      scenarios: {
        conservative: results[p10Target],
        median: results[medianTarget],
        optimistic: results[p90Target]
      }
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
 * Run Monte Carlo simulation for a specific allocation strategy.
 * Delegates to runSimulation (the same engine used for the Current Model)
 * so that all strategies share identical income, tax, RMD, and rebalancing logic.
 *
 * @param {object} allocation - Bucket allocation { b1Val, b2Val, b3Val, b4Val, b5Val }
 * @param {object} assumptions - Return assumptions
 * @param {object} inputs - Client inputs
 * @param {object} clientInfo - Client information
 * @param {number} rebalanceFreq - Rebalancing frequency (0 = sequential/never, 1 = annual, 3 = every 3 years)
 * @param {object} vaInputs - Optional VA GIB inputs
 * @returns {object} { successRate, medianLegacy, allocation }
 */
export const runOptimizedSimulation = (allocation, assumptions, inputs, clientInfo, rebalanceFreq = 0, vaInputs = null) => {
  // Build a real basePlan with the same income/expense/tax logic as the Current Model
  const basePlanForStrategy = calculateBasePlan(inputs, assumptions, clientInfo, !!vaInputs, vaInputs);

  // Override bucket values with this strategy's allocation
  const strategyBasePlan = {
    ...basePlanForStrategy,
    b1Val: allocation.b1Val,
    b2Val: allocation.b2Val,
    b3Val: allocation.b3Val,
    b4Val: allocation.b4Val,
    b5Val: allocation.b5Val
  };

  // Derive rebalance targets from the allocation's own percentages
  const allocTotal = allocation.b1Val + allocation.b2Val + allocation.b3Val + allocation.b4Val + allocation.b5Val;
  const strategyRebalanceTargets = allocTotal > 0 ? {
    b1: (allocation.b1Val / allocTotal) * 100,
    b2: (allocation.b2Val / allocTotal) * 100,
    b3: (allocation.b3Val / allocTotal) * 100,
    b4: (allocation.b4Val / allocTotal) * 100,
    b5: (allocation.b5Val / allocTotal) * 100
  } : null;

  // Run through the exact same Monte Carlo engine as the Current Model
  const result = runSimulation(strategyBasePlan, assumptions, inputs, rebalanceFreq, true, vaInputs, strategyRebalanceTargets);

  return {
    successRate: result.successRate,
    medianLegacy: result.medianLegacy,
    allocation
  };
};

// ============================================
// LIQUIDATION STRATEGY OPTIMIZER
// ============================================

/**
 * Optimize the liquidation strategy by finding the best static Trad/Roth/NQ distribution
 * split that maximizes after-tax legacy (what heirs actually receive).
 *
 * Sweeps a grid of static percentage splits, runs the full simulation for each,
 * scores by after-tax legacy accounting for SECURE Act heir taxes on Traditional.
 * The simulation engine handles tax convergence, RMD enforcement, and balance tracking.
 */
export const optimizeLiquidationStrategy = (basePlan, assumptions, inputs, clientInfo, rebalanceFreq = 0, rebalanceTargets = null) => {
  if (!inputs.taxEnabled) return null;

  // Heir tax assumptions (SECURE Act: heirs distribute inherited Traditional over 10 years)
  const heirFederalRate = 0.24;
  const stateData = inputs.stateCode ? STATE_TAX_DATA[inputs.stateCode] : null;
  const heirStateRate = stateData ? stateData.rate / 100 : (inputs.stateRate || 0) / 100;
  const heirTotalRate = heirFederalRate + heirStateRate;

  // Score a static split by running the full simulation
  const scoreSplit = (tradPct, rothPct, nqPct) => {
    const testInputs = { ...inputs, traditionalPercent: tradPct, rothPercent: rothPct, nqPercent: nqPct, withdrawalOverrides: {} };
    const projection = runSimulation(basePlan, assumptions, testInputs, rebalanceFreq, false, null, rebalanceTargets);
    const last = projection.length > 0 ? projection[projection.length - 1] : {};
    const grossLegacy = last.total || 0;
    const tradLegacy = last.traditionalBalanceDetail || 0;
    const rothLegacy = last.rothBalanceDetail || 0;
    const nqLegacy = last.nqBalanceDetail || 0;
    const heirTax = tradLegacy * heirTotalRate;
    const afterTaxLegacy = grossLegacy - heirTax;
    const lifetimeTax = projection.reduce((s, r) => s + (r.totalTax || 0), 0);
    const depleted = projection.some(r => r.total <= 0);
    const avgRate = projection.length > 0
      ? (projection.reduce((s, r) => s + parseFloat(r.effectiveRate || 0), 0) / projection.length).toFixed(1)
      : '0.0';
    return {
      tradPct, rothPct, nqPct,
      projection, grossLegacy, afterTaxLegacy, lifetimeTax, depleted, avgRate,
      heirTax, tradLegacy, rothLegacy, nqLegacy,
      score: depleted ? -1 : afterTaxLegacy
    };
  };

  // --- Generate candidate splits in 5% increments ---
  // Priority logic: Traditional + NQ exhaust first, Roth preserved
  const candidates = [];
  const step = 5;
  for (let trad = 0; trad <= 100; trad += step) {
    for (let nq = 0; nq <= 100 - trad; nq += step) {
      const roth = 100 - trad - nq;
      candidates.push({ trad, roth, nq });
    }
  }

  // Score all candidates
  let best = null;
  const allResults = [];

  for (const c of candidates) {
    const result = scoreSplit(c.trad, c.roth, c.nq);
    allResults.push(result);
    if (!best || result.score > best.score) {
      best = result;
    }
  }

  // Score current strategy for comparison
  const current = scoreSplit(inputs.traditionalPercent ?? 60, inputs.rothPercent ?? 25, inputs.nqPercent ?? 15);

  // If current is already optimal, note it
  const isCurrentOptimal = current.score >= best.score;
  if (isCurrentOptimal) best = current;

  // Top 10 strategies for the comparison table
  const topStrategies = allResults
    .filter(r => !r.depleted)
    .sort((a, b) => b.afterTaxLegacy - a.afterTaxLegacy)
    .slice(0, 10);

  // Build year-by-year detail from the winning projection
  const yearDetails = best.projection.map(row => ({
    age: row.age,
    tradPct: row.traditionalPctUsed || best.tradPct,
    rothPct: row.rothPctUsed || best.rothPct,
    nqPct: row.nqPctUsed || best.nqPct,
    distribution: row.distribution,
    totalTax: row.totalTax || 0,
    effectiveRate: row.effectiveRate || '0.0',
    rmd: row.rmdAmount || 0,
    tradBalance: row.traditionalBalanceDetail || 0,
    rothBalance: row.rothBalanceDetail || 0,
    nqBalance: row.nqBalanceDetail || 0,
    nqUnrealizedGains: row.nqUnrealizedGains || 0,
    nqStrategicRealization: row.nqStrategicRealization || 0
  }));

  return {
    optimizedSplit: { tradPct: best.tradPct, rothPct: best.rothPct, nqPct: best.nqPct },
    optimizedProjection: best.projection,
    currentProjection: current.projection,
    yearDetails,
    topStrategies,
    isCurrentOptimal,
    summary: {
      currentLifetimeTax: current.lifetimeTax,
      optimizedLifetimeTax: best.lifetimeTax,
      taxSavings: current.lifetimeTax - best.lifetimeTax,
      currentLegacy: current.grossLegacy,
      optimizedLegacy: best.grossLegacy,
      legacyImprovement: best.grossLegacy - current.grossLegacy,
      currentAvgRate: current.avgRate,
      optimizedAvgRate: best.avgRate,
      // After-tax legacy (optimization target)
      currentAfterTaxLegacy: Math.round(current.afterTaxLegacy),
      optimizedAfterTaxLegacy: Math.round(best.afterTaxLegacy),
      afterTaxLegacyImprovement: Math.round(best.afterTaxLegacy - current.afterTaxLegacy),
      heirTaxRate: Math.round(heirTotalRate * 100),
      // Legacy composition
      currentLegacyBreakdown: { traditional: Math.round(current.tradLegacy), roth: Math.round(current.rothLegacy), nq: Math.round(current.nqLegacy) },
      optimizedLegacyBreakdown: { traditional: Math.round(best.tradLegacy), roth: Math.round(best.rothLegacy), nq: Math.round(best.nqLegacy) },
      // Total family tax burden
      currentTotalTaxBurden: current.lifetimeTax + Math.round(current.heirTax),
      optimizedTotalTaxBurden: best.lifetimeTax + Math.round(best.heirTax),
      totalTaxSavings: (current.lifetimeTax + Math.round(current.heirTax)) - (best.lifetimeTax + Math.round(best.heirTax)),
      // Current vs optimized split
      currentSplit: { tradPct: inputs.traditionalPercent ?? 60, rothPct: inputs.rothPercent ?? 25, nqPct: inputs.nqPercent ?? 15 }
    }
  };
};

/**
 * Integrated Tax Strategy Optimizer
 * Jointly optimizes liquidation order, Roth conversions, and capital gains to maximize after-tax legacy.
 */
export const optimizeRetirementTaxStrategy = (basePlan, assumptions, inputs, clientInfo, rebalanceFreq = 0, rebalanceTargets = null, monteCarloData = null) => {
  if (!inputs.taxEnabled) return null;

  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - (clientInfo.currentAge || 65);
  const rmdStartAge = getRMDStartAge(birthYear);
  const retAge = basePlan?.simulationStartAge || clientInfo.retirementAge || 65;
  const inflationRate = inputs.inflationRate || 2.5;
  const filingStatus = inputs.filingStatus || 'married';

  // Heir tax assumptions (SECURE Act: heirs distribute inherited Traditional over 10 years)
  const heirFederalRate = 0.24;
  const stateData = inputs.stateCode ? STATE_TAX_DATA[inputs.stateCode] : null;
  const heirStateRate = stateData ? stateData.rate / 100 : (inputs.stateRate || 0) / 100;
  const heirTotalRate = heirFederalRate + heirStateRate;

  // Score and rank strategies using deterministic simulation
  // IRMAA is included in scoring — it reduces portfolio balances, affecting after-tax legacy
  const useMC = !!monteCarloData;
  const extractMetrics = (projection) => {
    const last = projection.length > 0 ? projection[projection.length - 1] : {};
    const grossLegacy = last.total || 0;
    const tradLegacy = last.traditionalBalanceDetail || 0;
    const rothLegacy = last.rothBalanceDetail || 0;
    const nqLegacy = last.nqBalanceDetail || 0;
    const heirTax = tradLegacy * heirTotalRate;
    const afterTaxLegacy = grossLegacy - heirTax;
    const lifetimeTax = projection.reduce((s, r) => s + (r.totalTax || 0), 0);
    const lifetimeRMD = projection.reduce((s, r) => s + (r.rmdAmount || 0), 0);
    const lifetimeIrmaa = projection.reduce((s, r) => s + (r.irmaaCost || 0), 0);
    const depleted = projection.some(r => r.total <= 0);
    return { projection, grossLegacy, afterTaxLegacy, lifetimeTax, lifetimeRMD, lifetimeIrmaa, depleted, tradLegacy, rothLegacy, nqLegacy, heirTax };
  };
  // Deterministic scorer for ranking and baseline
  const scoreStrategy = (testInputs) => {
    const projection = runSimulation(basePlan, assumptions, testInputs, rebalanceFreq, false, null, rebalanceTargets);
    return extractMetrics(projection);
  };
  // MC scorer for display scenarios (run after winner is chosen)
  const scoreMC = (testInputs) => {
    const result = runSimulation(basePlan, assumptions, testInputs, rebalanceFreq, true, null, rebalanceTargets);
    return result?.scenarios || null;
  };

  // --- Step 1: Score baseline using deterministic simulation ---
  const baseline = scoreStrategy(inputs);

  // --- Step 2: Compute bracket headroom for Roth conversion scheduling ---
  const baseProjection = baseline.projection;

  const generateConversionSchedule = (targetBracketIdx, projData, fillFraction = 1.0) => {
    // targetBracketIdx: 1=12%, 2=22%, 3=24%; fillFraction: 0-1 to scale headroom usage
    const conversions = {};
    let runningTradBalance = inputs.totalPortfolio * ((inputs.traditionalPercent ?? 60) / 100);

    for (let idx = 0; idx < projData.length; idx++) {
      const row = projData[idx];
      const age = row.age;
      if (age >= rmdStartAge) continue; // Only convert pre-RMD

      const yearsFromBase = age - (clientInfo.currentAge || 65);
      const yearsFromTaxBase = Math.max(0, yearsFromBase);
      const brackets = getInflationAdjustedBrackets(filingStatus, yearsFromTaxBase, inflationRate);
      const deduction = getInflationAdjustedDeduction(filingStatus, yearsFromTaxBase, inflationRate, age >= 65);

      // Current ordinary income (from baseline projection)
      const tradWithdrawal = row.distribution * (row.traditionalPctUsed || 0) / 100;
      const taxableSS = row.taxableSS || 0;
      const pension = row.pensionIncomeDetail || 0;
      const nqOrdinaryDivs = row.nqOrdinaryDividends || 0;
      const otherEmployment = (row.otherIncomeDetail || 0) + (row.employmentIncomeDetail || 0);
      const totalOrdinaryIncome = taxableSS + pension + tradWithdrawal + nqOrdinaryDivs + otherEmployment;
      const taxableAfterDeduction = Math.max(0, totalOrdinaryIncome - deduction);

      // Find headroom to target bracket
      const targetBracket = brackets[Math.min(targetBracketIdx, brackets.length - 1)];
      const headroom = Math.max(0, targetBracket.max - taxableAfterDeduction);

      // Grow traditional balance estimate (simplified — use blended return)
      if (idx > 0) {
        const blendedReturn = (assumptions.b3?.return || 7) / 100; // approximate
        runningTradBalance *= (1 + blendedReturn);
        // Subtract estimated traditional withdrawal
        runningTradBalance -= tradWithdrawal;
        // Subtract prior year's conversion
        const priorAge = projData[idx - 1]?.age;
        if (priorAge && conversions[priorAge]) {
          runningTradBalance -= conversions[priorAge];
        }
      }
      runningTradBalance = Math.max(0, runningTradBalance);

      const conversionAmount = Math.min(headroom * fillFraction, runningTradBalance);
      if (conversionAmount > 1000) { // Minimum threshold to bother
        conversions[age] = Math.round(conversionAmount);
      }
    }
    return conversions;
  };

  // --- Step 3: Define Roth conversion candidates ---
  // Uses the user's manually-set liquidation strategy; optimizer only solves for conversions
  const conversionCandidates = [
    { label: 'No Conversions', idx: null, fillFraction: 0 },
    { label: 'Fill to 12%', idx: 1, fillFraction: 1.0 },
    { label: 'Fill to 22%', idx: 2, fillFraction: 1.0 },
    { label: 'Fill to 24%', idx: 3, fillFraction: 1.0 },
    { label: 'Partial 24% (50%)', idx: 3, fillFraction: 0.5 },
  ];

  // --- Step 4: Test conversion candidates (preserving user's liquidation & cap gain settings) ---
  const results = [];
  const baseInputs = { ...inputs, rothConversions: {} };

  // Include user's current strategy as a candidate so it can't lose
  const hasCurrentConversions = Object.keys(inputs.rothConversions || {}).length > 0;
  if (hasCurrentConversions) {
    const currentResult = scoreStrategy(inputs);
    results.push({
      targetBracket: null,
      conversions: inputs.rothConversions,
      ...currentResult,
      label: 'Current Strategy'
    });
  }

  // Score the no-conversion baseline (deterministic)
  const noConvResult = scoreStrategy(baseInputs);

  for (const candidate of conversionCandidates) {
    let conversions = {};
    if (candidate.idx !== null) {
      conversions = generateConversionSchedule(candidate.idx, noConvResult.projection, candidate.fillFraction);
      if (Object.keys(conversions).length === 0) continue;
    }

    const testInputs = { ...baseInputs, rothConversions: conversions };
    const result = scoreStrategy(testInputs);

    results.push({
      targetBracket: candidate.idx !== null ? { label: candidate.label, idx: candidate.idx } : null,
      conversions,
      ...result,
      label: candidate.label
    });
  }

  // --- Step 5: Find best strategy (all scored deterministically) ---
  const validResults = results.filter(r => !r.depleted);
  validResults.sort((a, b) => b.afterTaxLegacy - a.afterTaxLegacy);
  let best = validResults[0] || results[0];

  // --- Step 6: Build output ---
  // Helper to build comparison + yearDetails from a projection pair (baseline vs best)
  const buildComparisonFromProjection = (baselineProj, bestProj) => {
    const bm = extractMetrics(baselineProj);
    const om = extractMetrics(bestProj);
    const totalConversions = Object.values(best.conversions).reduce((s, v) => s + v, 0);
    const totalConversionTax = bestProj
      .filter(r => r.rothConversion > 0)
      .reduce((s, r) => s + (r.totalTax || 0), 0) -
      baselineProj
      .filter((_, idx) => bestProj[idx]?.rothConversion > 0)
      .reduce((s, r) => s + (r.totalTax || 0), 0);

    return {
      currentAfterTaxLegacy: Math.round(bm.afterTaxLegacy),
      optimizedAfterTaxLegacy: Math.round(om.afterTaxLegacy),
      afterTaxLegacyImprovement: Math.round(om.afterTaxLegacy - bm.afterTaxLegacy),
      currentLifetimeTax: Math.round(bm.lifetimeTax),
      optimizedLifetimeTax: Math.round(om.lifetimeTax),
      totalTaxSavings: Math.round(bm.lifetimeTax - om.lifetimeTax),
      currentLifetimeIrmaa: Math.round(bm.lifetimeIrmaa || 0),
      optimizedLifetimeIrmaa: Math.round(om.lifetimeIrmaa || 0),
      irmaaSavings: Math.round((bm.lifetimeIrmaa || 0) - (om.lifetimeIrmaa || 0)),
      currentTotalBurden: Math.round(bm.lifetimeTax + bm.heirTax + (bm.lifetimeIrmaa || 0)),
      optimizedTotalBurden: Math.round(om.lifetimeTax + om.heirTax + (om.lifetimeIrmaa || 0)),
      totalBurdenSavings: Math.round((bm.lifetimeTax + bm.heirTax + (bm.lifetimeIrmaa || 0)) - (om.lifetimeTax + om.heirTax + (om.lifetimeIrmaa || 0))),
      currentRMDTotal: Math.round(bm.lifetimeRMD),
      optimizedRMDTotal: Math.round(om.lifetimeRMD),
      rmdReduction: Math.round(bm.lifetimeRMD - om.lifetimeRMD),
      totalConversions: Math.round(totalConversions),
      totalConversionTax: Math.round(totalConversionTax),
      heirTaxRate: Math.round(heirTotalRate * 100),
      currentLegacyBreakdown: { traditional: Math.round(bm.tradLegacy), roth: Math.round(bm.rothLegacy), nq: Math.round(bm.nqLegacy) },
      optimizedLegacyBreakdown: { traditional: Math.round(om.tradLegacy), roth: Math.round(om.rothLegacy), nq: Math.round(om.nqLegacy) }
    };
  };

  const buildYearDetails = (proj) => proj.map((row, idx) => ({
    age: row.age,
    yearNum: idx + 1,
    rothConversion: row.rothConversion || 0,
    rmd: row.rmdAmount || 0,
    tradBalance: row.traditionalBalanceDetail || 0,
    rothBalance: row.rothBalanceDetail || 0,
    nqBalance: row.nqBalanceDetail || 0,
    totalTax: row.totalTax || 0,
    effectiveRate: row.effectiveRate || '0.0',
    distribution: row.distribution || 0,
    nqUnrealizedGains: row.nqUnrealizedGains || 0,
    nqStrategicRealization: row.nqStrategicRealization || 0,
    irmaaCost: row.irmaaCost || 0,
    magi: row.magi || 0
  }));

  // Default comparison and yearDetails are deterministic (the scoring basis)
  const comparison = buildComparisonFromProjection(baseline.projection, best.projection);
  const yearDetails = buildYearDetails(best.projection);
  const alternativeStrategies = validResults.slice(0, 8).map(r => {
    const m = extractMetrics(r.projection);
    return {
      label: r.label,
      afterTaxLegacy: Math.round(m.afterTaxLegacy),
      lifetimeTax: Math.round(m.lifetimeTax),
      lifetimeIrmaa: Math.round(m.lifetimeIrmaa || 0),
      grossLegacy: Math.round(m.grossLegacy),
      conversions: r.conversions
    };
  });

  // Build MC scenario views for display toggle (run MC once per strategy)
  let scenarioResults = null;
  if (useMC) {
    const bestMC = scoreMC({ ...inputs, rothConversions: best.conversions });
    const baselineMC = scoreMC(inputs);
    // Run MC for each alternative once, cache results
    const altMCCache = validResults.slice(0, 8).map(r => ({
      ...r,
      mcScenarios: scoreMC({ ...inputs, rothConversions: r.conversions })
    }));
    if (bestMC && baselineMC) {
      scenarioResults = {};
      for (const key of ['optimistic', 'median', 'conservative']) {
        if (bestMC[key] && baselineMC[key]) {
          scenarioResults[key] = {
            comparison: buildComparisonFromProjection(baselineMC[key], bestMC[key]),
            yearDetails: buildYearDetails(bestMC[key]),
            alternativeStrategies: altMCCache.map(r => {
              const proj = r.mcScenarios?.[key] || r.projection;
              const m = extractMetrics(proj);
              return {
                label: r.label,
                afterTaxLegacy: Math.round(m.afterTaxLegacy),
                lifetimeTax: Math.round(m.lifetimeTax),
                lifetimeIrmaa: Math.round(m.lifetimeIrmaa || 0),
                grossLegacy: Math.round(m.grossLegacy),
                conversions: r.conversions
              };
            })
          };
        }
      }
    }
  }

  return {
    recommended: {
      rothConversions: best.conversions,
      nqCapGainOverrides: [],
      targetBracket: best.targetBracket?.label || null,
      label: best.label
    },
    comparison,
    yearDetails,
    alternativeStrategies,
    // MC scenario-specific results for UI toggle
    scenarios: Object.keys(scenarioResults).length > 0 ? scenarioResults : null
  };
};
