/**
 * Investment Policy Statement (IPS) Generator
 * Generates a professional IPS document based on client data and optimized allocation
 */

/**
 * Format currency for display
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Get distribution strategy description
 */
const getDistributionStrategyDescription = (freq) => {
  switch (freq) {
    case 0:
      return {
        name: 'Sequential Distribution',
        description: 'Withdrawals are taken from buckets in sequential order (B1→B2→B3→B4→B5) without periodic rebalancing. This approach allows growth-oriented buckets maximum time to compound while providing liquidity from near-term buckets.'
      };
    case 1:
      return {
        name: 'Annual Rebalancing',
        description: 'Portfolio is rebalanced annually to maintain target allocation percentages across all buckets. This approach systematically harvests gains from outperforming buckets to replenish those being drawn down.'
      };
    case 3:
      return {
        name: 'Triennial Rebalancing',
        description: 'Portfolio is rebalanced every three years to target allocations. This balanced approach reduces transaction costs and tax events while still maintaining strategic asset allocation over time.'
      };
    default:
      return {
        name: 'Custom Distribution',
        description: 'Custom distribution strategy as specified by the client and advisor.'
      };
  }
};

/**
 * Get risk profile based on allocation
 */
const getRiskProfile = (allocation, totalPortfolio) => {
  if (!allocation || totalPortfolio === 0) return 'Moderate';

  const b5Pct = ((allocation.b5Val || 0) / totalPortfolio) * 100;
  const b4Pct = ((allocation.b4Val || 0) / totalPortfolio) * 100;
  const b1b2Pct = (((allocation.b1Val || 0) + (allocation.b2Val || 0)) / totalPortfolio) * 100;

  const growthPct = b5Pct + (b4Pct * 0.5);

  if (growthPct >= 60) return 'Aggressive';
  if (growthPct >= 45) return 'Moderately Aggressive';
  if (growthPct >= 30) return 'Moderate';
  if (growthPct >= 15) return 'Moderately Conservative';
  return 'Conservative';
};

/**
 * Calculate weighted expected return
 */
const calculateWeightedReturn = (allocation, assumptions, totalPortfolio) => {
  if (!allocation || totalPortfolio === 0) return 0;

  const weights = {
    b1: (allocation.b1Val || 0) / totalPortfolio,
    b2: (allocation.b2Val || 0) / totalPortfolio,
    b3: (allocation.b3Val || 0) / totalPortfolio,
    b4: (allocation.b4Val || 0) / totalPortfolio,
    b5: (allocation.b5Val || 0) / totalPortfolio
  };

  return (
    weights.b1 * assumptions.b1.return +
    weights.b2 * assumptions.b2.return +
    weights.b3 * assumptions.b3.return +
    weights.b4 * assumptions.b4.return +
    weights.b5 * assumptions.b5.return
  ).toFixed(2);
};

/**
 * Calculate weighted standard deviation (simplified)
 */
const calculateWeightedStdDev = (allocation, assumptions, totalPortfolio) => {
  if (!allocation || totalPortfolio === 0) return 0;

  const weights = {
    b1: (allocation.b1Val || 0) / totalPortfolio,
    b2: (allocation.b2Val || 0) / totalPortfolio,
    b3: (allocation.b3Val || 0) / totalPortfolio,
    b4: (allocation.b4Val || 0) / totalPortfolio,
    b5: (allocation.b5Val || 0) / totalPortfolio
  };

  // Simplified calculation (assumes some correlation)
  const variance =
    Math.pow(weights.b1 * assumptions.b1.stdDev, 2) +
    Math.pow(weights.b2 * assumptions.b2.stdDev, 2) +
    Math.pow(weights.b3 * assumptions.b3.stdDev, 2) +
    Math.pow(weights.b4 * assumptions.b4.stdDev, 2) +
    Math.pow(weights.b5 * assumptions.b5.stdDev, 2);

  return Math.sqrt(variance).toFixed(2);
};

/**
 * Generate IPS document content
 */
export const generateIPSContent = ({
  clientInfo,
  inputs,
  assumptions,
  selectedStrategy,
  distributionFreq,
  monteCarloData
}) => {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const allocation = selectedStrategy?.allocation || {};
  const totalPortfolio = inputs.totalPortfolio || 0;
  const distributionStrategy = getDistributionStrategyDescription(distributionFreq);
  const riskProfile = getRiskProfile(allocation, totalPortfolio);
  const expectedReturn = calculateWeightedReturn(allocation, assumptions, totalPortfolio);
  const expectedStdDev = calculateWeightedStdDev(allocation, assumptions, totalPortfolio);

  // Calculate allocation percentages
  const allocPcts = {
    b1: totalPortfolio > 0 ? (((allocation.b1Val || 0) / totalPortfolio) * 100).toFixed(1) : '0',
    b2: totalPortfolio > 0 ? (((allocation.b2Val || 0) / totalPortfolio) * 100).toFixed(1) : '0',
    b3: totalPortfolio > 0 ? (((allocation.b3Val || 0) / totalPortfolio) * 100).toFixed(1) : '0',
    b4: totalPortfolio > 0 ? (((allocation.b4Val || 0) / totalPortfolio) * 100).toFixed(1) : '0',
    b5: totalPortfolio > 0 ? (((allocation.b5Val || 0) / totalPortfolio) * 100).toFixed(1) : '0'
  };

  const yearsToRetirement = Math.max(0, clientInfo.retirementAge - clientInfo.currentAge);
  const planningHorizon = 30; // Standard distribution phase

  return `
INVESTMENT POLICY STATEMENT

================================================================================
                              CONFIDENTIAL
================================================================================

Prepared for: ${clientInfo.name || 'Client'}
Prepared by: Miller Wealth Management
Date: ${today}

================================================================================
SECTION 1: CLIENT PROFILE
================================================================================

Client Name:           ${clientInfo.name || 'Not Provided'}
Email:                 ${clientInfo.email || 'Not Provided'}
Phone:                 ${clientInfo.phone || 'Not Provided'}
Marital Status:        ${clientInfo.isMarried ? 'Married' : 'Single'}
Current Age:           ${clientInfo.currentAge}
${clientInfo.isMarried ? `Partner Age:           ${clientInfo.partnerAge}` : ''}
Retirement Age:        ${clientInfo.retirementAge}
${clientInfo.isMarried ? `Partner Ret. Age:      ${clientInfo.partnerRetirementAge}` : ''}
Current Retirement Status: ${clientInfo.isRetired ? 'Currently Retired' : 'Pre-Retirement'}

================================================================================
SECTION 2: INVESTMENT OBJECTIVES
================================================================================

Primary Objective:
-----------------
Generate sustainable retirement income while preserving capital for long-term
growth and legacy planning.

Specific Goals:
--------------
1. Provide monthly retirement income of ${formatCurrency(inputs.monthlySpending)}
   (adjusted for inflation at ${inputs.personalInflationRate}% annually)

2. Maintain portfolio sustainability through a ${planningHorizon}-year distribution phase

3. Optimize Social Security timing for maximum lifetime benefit
   - Primary: Claiming at age ${inputs.ssStartAge} (${formatCurrency(inputs.ssPIA)}/month at FRA)
   ${clientInfo.isMarried ? `- Partner: Claiming at age ${inputs.partnerSSStartAge} (${formatCurrency(inputs.partnerSSPIA)}/month at FRA)` : ''}

4. Preserve capital for potential legacy transfer

5. Target Success Rate: ${monteCarloData?.successRate?.toFixed(1) || 'N/A'}% probability of
   not depleting assets over ${planningHorizon} years

================================================================================
SECTION 3: TIME HORIZON
================================================================================

${yearsToRetirement > 0 ? `
Accumulation Phase:    ${yearsToRetirement} years (until age ${clientInfo.retirementAge})
                       Current Portfolio: ${formatCurrency(clientInfo.currentPortfolio)}
                       Annual Contributions: ${formatCurrency(clientInfo.annualSavings)}
                       Expected Growth Rate: ${clientInfo.expectedReturn}%
` : ''}
Distribution Phase:    ${planningHorizon} years (ages ${clientInfo.retirementAge} to ${clientInfo.retirementAge + planningHorizon})

Initial Distribution Portfolio: ${formatCurrency(totalPortfolio)}

================================================================================
SECTION 4: RISK TOLERANCE
================================================================================

Risk Profile:          ${riskProfile}

Assessment Based On:
- Time horizon and distribution needs
- Allocation to growth vs. conservative assets
- Monte Carlo simulation success probability
- Client's income replacement ratio

Portfolio Characteristics:
- Expected Return:     ${expectedReturn}%
- Expected Volatility: ${expectedStdDev}%
- Success Rate:        ${monteCarloData?.successRate?.toFixed(1) || 'N/A'}%

The client understands that:
1. All investments carry risk, including potential loss of principal
2. Past performance does not guarantee future results
3. Higher expected returns generally require accepting higher volatility
4. The bucket strategy is designed to manage sequence-of-returns risk

================================================================================
SECTION 5: ASSET ALLOCATION - TIME-SEGMENTED BUCKET STRATEGY
================================================================================

Strategy:              ${selectedStrategy?.name || 'Current Model'}

The portfolio employs a time-segmented bucket strategy, allocating assets based
on when they will be needed for distributions. This approach manages
sequence-of-returns risk by protecting near-term income needs while allowing
long-term assets to grow.

BUCKET ALLOCATION:
--------------------------------------------------------------------------------
Bucket    | Name             | Allocation | Amount          | Time Horizon
--------------------------------------------------------------------------------
B1        | Short-Term       | ${allocPcts.b1.padStart(6)}%   | ${formatCurrency(allocation.b1Val || 0).padStart(15)} | Years 1-3
B2        | Mid-Term         | ${allocPcts.b2.padStart(6)}%   | ${formatCurrency(allocation.b2Val || 0).padStart(15)} | Years 4-6
B3        | Balanced 60/40   | ${allocPcts.b3.padStart(6)}%   | ${formatCurrency(allocation.b3Val || 0).padStart(15)} | Years 7-15
B4        | Income & Growth  | ${allocPcts.b4.padStart(6)}%   | ${formatCurrency(allocation.b4Val || 0).padStart(15)} | Years 16-20
B5        | Long-Term Growth | ${allocPcts.b5.padStart(6)}%   | ${formatCurrency(allocation.b5Val || 0).padStart(15)} | Years 21+
--------------------------------------------------------------------------------
Total                        | 100.0%   | ${formatCurrency(totalPortfolio).padStart(15)}
--------------------------------------------------------------------------------

BUCKET DESCRIPTIONS:

B1 - Short-Term (${allocPcts.b1}%):
   Investment Types: Cash, Money Market, Short-Term Treasury Bills
   Expected Return: ${assumptions.b1.return}% | Volatility: ${assumptions.b1.stdDev}%
   Purpose: Immediate liquidity for years 1-3 distributions

B2 - Mid-Term (${allocPcts.b2}%):
   Investment Types: Short-Term Bonds, Investment Grade Corporate Bonds
   Expected Return: ${assumptions.b2.return}% | Volatility: ${assumptions.b2.stdDev}%
   Purpose: Near-term stability for years 4-6 distributions

B3 - Balanced 60/40 (${allocPcts.b3}%):
   Investment Types: Balanced Funds, 60% Equity / 40% Fixed Income
   Expected Return: ${assumptions.b3.return}% | Volatility: ${assumptions.b3.stdDev}%
   Purpose: Moderate growth with reduced volatility for mid-term needs

B4 - Income & Growth (${allocPcts.b4}%):
   Investment Types: Dividend Stocks, REITs, Preferred Securities
   Expected Return: ${assumptions.b4.return}% | Volatility: ${assumptions.b4.stdDev}%
   Purpose: Income generation with capital appreciation potential

B5 - Long-Term Growth (${allocPcts.b5}%):
   Investment Types: Domestic Equity, International Equity, Small Cap
   Expected Return: ${assumptions.b5.return}% | Volatility: ${assumptions.b5.stdDev}%
   Purpose: Maximum long-term growth for late-stage distributions and legacy

================================================================================
SECTION 6: DISTRIBUTION STRATEGY
================================================================================

Method:                ${distributionStrategy.name}

${distributionStrategy.description}

Annual Distribution Target: ${formatCurrency(inputs.monthlySpending * 12)}
Monthly Distribution:       ${formatCurrency(inputs.monthlySpending)}
Distribution Rate:          ${((inputs.monthlySpending * 12 / totalPortfolio) * 100).toFixed(2)}% of initial portfolio

Income Sources at Retirement:
-----------------------------
1. Portfolio Distributions:     Variable (as needed to meet spending)
2. Social Security (Primary):   ${formatCurrency(inputs.ssPIA)}/month starting age ${inputs.ssStartAge}
${clientInfo.isMarried ? `3. Social Security (Partner):   ${formatCurrency(inputs.partnerSSPIA)}/month starting age ${inputs.partnerSSStartAge}` : ''}
${inputs.monthlyPension > 0 ? `${clientInfo.isMarried ? '4' : '3'}. Pension Income:              ${formatCurrency(inputs.monthlyPension)}/month starting age ${inputs.pensionStartAge}${inputs.pensionCOLA ? ' (with COLA)' : ''}` : ''}

================================================================================
SECTION 7: REBALANCING POLICY
================================================================================

${distributionFreq === 0 ? `
Rebalancing Approach:  Sequential Draw-Down (No Periodic Rebalancing)

Under this strategy, buckets are not rebalanced to target allocations. Instead:
- Distributions are taken from B1 until depleted (approximately years 1-3)
- Then from B2 until depleted (approximately years 4-6)
- Then from B3 until depleted (approximately years 7-15)
- Then from B4 until depleted (approximately years 16-20)
- Finally from B5 for remaining years

This approach allows growth buckets (B4, B5) maximum time to compound before
being accessed.
` : `
Rebalancing Frequency: ${distributionFreq === 1 ? 'Annually' : `Every ${distributionFreq} Years`}

Rebalancing Triggers:
1. Time-based: Portfolio reviewed and rebalanced per schedule above
2. Threshold-based: Consider rebalancing if any bucket deviates more than
   5 percentage points from target allocation
3. Event-based: Material changes in client circumstances or market conditions

Rebalancing Methodology:
- Sell from overweighted buckets
- Purchase into underweighted buckets
- Consider tax implications and transaction costs
- Maintain adequate cash reserves for near-term distributions
`}

================================================================================
SECTION 8: INVESTMENT GUIDELINES
================================================================================

Permitted Investments:
- Money Market Funds and Treasury Bills (B1)
- Investment Grade Bonds and Bond Funds (B1, B2)
- Balanced Mutual Funds and ETFs (B3)
- Dividend-focused Equity Funds (B4)
- Diversified Equity Funds - Domestic and International (B4, B5)
- Real Estate Investment Trusts (B4)
- Index Funds and ETFs across all buckets

Prohibited Investments:
- Speculative or highly leveraged instruments
- Commodities (except through diversified funds)
- Private placements without specific client approval
- Individual securities comprising >10% of any bucket
- Concentrated positions in any single industry >25%

Diversification Requirements:
- No single equity position >5% of total portfolio
- No single fixed income issuer >10% (excluding U.S. Government)
- Geographic diversification across domestic and international markets
- Sector diversification within equity allocations

================================================================================
SECTION 9: MONITORING AND REVIEW
================================================================================

Performance Review:    Quarterly

Review Elements:
1. Portfolio performance vs. benchmarks and expected returns
2. Progress toward income and legacy goals
3. Asset allocation drift from targets
4. Changes in client circumstances or objectives
5. Economic and market outlook considerations

Benchmark Comparisons:
- B1: 3-Month Treasury Bill Rate
- B2: Bloomberg U.S. Aggregate Bond Index (1-3 Year)
- B3: Balanced Index (60% S&P 500 / 40% Bloomberg Aggregate)
- B4: MSCI USA High Dividend Yield Index
- B5: MSCI All Country World Index

Annual Review:
The Investment Policy Statement shall be reviewed at least annually or upon
material changes in:
- Client financial situation or goals
- Market conditions or economic outlook
- Tax laws or regulations
- Client's health or family circumstances

================================================================================
SECTION 10: SIGNATURES AND ACKNOWLEDGMENT
================================================================================

By signing below, the client acknowledges:

1. This Investment Policy Statement accurately reflects their investment
   objectives, risk tolerance, and financial circumstances as of the date signed.

2. They have been provided with and understand the risks associated with the
   proposed investment strategy.

3. They will promptly notify Miller Wealth Management of any material changes
   in their financial situation or investment objectives.

4. They understand that investment returns are not guaranteed and that past
   performance does not predict future results.

5. The projections contained in this document are hypothetical illustrations
   based on assumed rates of return and are not guarantees of future performance.


Client Signature: _______________________________  Date: ________________

${clientInfo.isMarried ? `\nPartner Signature: ______________________________  Date: ________________\n` : ''}

Advisor Signature: ______________________________  Date: ________________


================================================================================
                        MILLER WEALTH MANAGEMENT
                        www.millerwm.com | (480) 613-7400
================================================================================

Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice
offered through Miller Wealth Management, a Registered Investment Advisor.
Miller Wealth Management is a separate entity from LPL Financial.

This document is confidential and intended solely for the use of the named
client(s). Distribution or reproduction without written consent is prohibited.
`.trim();
};

/**
 * Download IPS as text file
 */
export const downloadIPS = (content, clientName) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  link.href = url;
  link.download = `Investment_Policy_Statement_${safeName}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Main function to generate and download IPS
 */
export const generateAndDownloadIPS = (params) => {
  const content = generateIPSContent(params);
  downloadIPS(content, params.clientInfo?.name);
};
