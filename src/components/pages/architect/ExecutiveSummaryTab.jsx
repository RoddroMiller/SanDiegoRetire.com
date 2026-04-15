import React, { useMemo, useState, useCallback } from 'react';
import { FileText, Layers, DollarSign, TrendingUp, Shield, ArrowRight } from 'lucide-react';
import { COLORS } from '../../../constants/colors';
import { Card } from '../../ui';
import { runSimulation } from '../../../utils';

const BUCKET_NAMES = ['B1 - Liquidity', 'B2 - Bridge', 'B3 - Tactical', 'B4 - Income', 'B5 - Equity'];
const BUCKET_SHORT = ['B1', 'B2', 'B3', 'B4', 'B5'];
const BUCKET_KEYS = ['b1', 'b2', 'b3', 'b4', 'b5'];
const BUCKET_COLORS = [COLORS.shortTerm, COLORS.midTerm, COLORS.hedged, COLORS.income, COLORS.longTerm];
const ACCOUNT_TYPES = ['traditional', 'roth', 'nq'];
const ACCOUNT_LABELS = { traditional: 'Traditional', roth: 'Roth', nq: 'Non-Qualified' };
const ACCOUNT_COLORS = {
  traditional: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  roth: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  nq: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
};

const fmt = (val) => val === 0 ? '-' : `$${Math.round(val).toLocaleString()}`;
const fmtShort = (val) => {
  if (val === 0) return '-';
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${Math.round(val).toLocaleString()}`;
};

/**
 * Optimize account-to-bucket allocation based on liquidation strategy.
 *
 * Priority logic:
 * 1. Read the liquidation strategies to determine which account type is spent first/last.
 * 2. Account types spent first fill B1 (years 1-3), then B2 (years 4-6).
 * 3. Account types spent last fill B5 (long-term), then B4.
 * 4. Middle-priority fills B3.
 * 5. If no liquidation strategy: NQ → B1/B2, Traditional → B3/B4, Roth → B5.
 */
const optimizeAllocation = (bucketTargets, accountBalances, liquidationStrategies) => {
  // Matrix: matrix[accountType][bucketKey] = dollar amount
  const matrix = {};
  for (const acct of ACCOUNT_TYPES) {
    matrix[acct] = {};
    for (const bk of BUCKET_KEYS) {
      matrix[acct][bk] = 0;
    }
  }

  // Remaining capacity in each bucket and remaining balance in each account
  const bucketRemaining = { ...bucketTargets };
  const acctRemaining = { ...accountBalances };

  // Determine fill order: which account type fills which buckets first
  // Based on liquidation priority — accounts spent FIRST go into near-term buckets
  let fillOrder;

  if (liquidationStrategies && liquidationStrategies.length > 0) {
    // Use the first (earliest) strategy to determine primary liquidation order
    const earlyStrategy = liquidationStrategies.reduce((a, b) => a.startYear < b.startYear ? a : b);
    const priority = earlyStrategy.priority || ['nq', 'traditional', 'roth'];

    // First priority account → B1, B2 (spent first)
    // Second priority → B3 (middle)
    // Third priority → B5, B4 (preserved longest)
    fillOrder = [
      { acct: priority[0], buckets: ['b1', 'b2', 'b3', 'b4', 'b5'] },
      { acct: priority[1], buckets: ['b3', 'b2', 'b4', 'b1', 'b5'] },
      { acct: priority[2], buckets: ['b5', 'b4', 'b3', 'b2', 'b1'] },
    ];
  } else {
    // Default tax-efficient mapping
    fillOrder = [
      { acct: 'nq', buckets: ['b1', 'b2', 'b3', 'b4', 'b5'] },           // NQ spent first (near-term)
      { acct: 'traditional', buckets: ['b3', 'b4', 'b2', 'b5', 'b1'] },   // Traditional in middle
      { acct: 'roth', buckets: ['b5', 'b4', 'b3', 'b2', 'b1'] },          // Roth preserved longest
    ];
  }

  // Fill the matrix greedily: for each account type in priority order, fill its preferred buckets
  for (const { acct, buckets } of fillOrder) {
    if ((acctRemaining[acct] || 0) <= 0) continue;
    for (const bk of buckets) {
      if (acctRemaining[acct] <= 0 || bucketRemaining[bk] <= 0) continue;
      const fill = Math.min(acctRemaining[acct], bucketRemaining[bk]);
      matrix[acct][bk] = fill;
      acctRemaining[acct] -= fill;
      bucketRemaining[bk] -= fill;
    }
  }

  return matrix;
};

export const ExecutiveSummaryTab = ({
  inputs, basePlan, projectionData, assumptions, clientInfo,
  ssAnalysis, ssPartnerAnalysis, rebalanceFreq, rebalanceTargets, monteCarloData
}) => {
  // SS comparison: user picks their "original plan" claiming age
  const [ssOriginalAge, setSSOriginalAge] = useState(62);
  const [ssPartnerOriginalAge, setSSPartnerOriginalAge] = useState(62);
  const [mcMode, setMcMode] = useState('deterministic');

  // Active projection data — deterministic or MC scenario
  const activeProjection = useMemo(() => {
    if (mcMode !== 'deterministic' && monteCarloData?.scenarios?.[mcMode]) {
      return monteCarloData.scenarios[mcMode];
    }
    return projectionData;
  }, [mcMode, monteCarloData, projectionData]);

  // Use manual overrides stored in state: matrix[acctType][bucketKey] = dollar amount
  const [manualOverrides, setManualOverrides] = useState(null);

  // Account type balances from the distribution starting portfolio
  const accountBalances = useMemo(() => {
    const total = inputs.totalPortfolio || 0;
    return {
      traditional: total * ((inputs.traditionalPercent ?? 60) / 100),
      roth: total * ((inputs.rothPercent ?? 25) / 100),
      nq: total * ((inputs.nqPercent ?? 15) / 100),
    };
  }, [inputs.totalPortfolio, inputs.traditionalPercent, inputs.rothPercent, inputs.nqPercent]);

  // Bucket targets from the base plan (distribution starting allocation)
  const bucketTargets = useMemo(() => ({
    b1: basePlan?.b1Val || 0,
    b2: basePlan?.b2Val || 0,
    b3: basePlan?.b3Val || 0,
    b4: basePlan?.b4Val || 0,
    b5: basePlan?.b5Val || 0,
  }), [basePlan]);

  const totalPortfolio = inputs.totalPortfolio || 0;

  // Auto-optimized matrix
  const autoMatrix = useMemo(() => {
    return optimizeAllocation(bucketTargets, accountBalances, inputs.liquidationStrategies);
  }, [bucketTargets, accountBalances, inputs.liquidationStrategies]);

  // Active matrix (manual overrides or auto)
  const matrix = manualOverrides || autoMatrix;

  // Handle cell edit
  const handleCellEdit = useCallback((acct, bk, value) => {
    const newMatrix = {};
    for (const a of ACCOUNT_TYPES) {
      newMatrix[a] = { ...(manualOverrides || autoMatrix)[a] };
    }
    newMatrix[acct][bk] = parseFloat(value) || 0;
    setManualOverrides(newMatrix);
  }, [manualOverrides, autoMatrix]);

  // Compute row/column totals
  const rowTotals = {};
  for (const acct of ACCOUNT_TYPES) {
    rowTotals[acct] = BUCKET_KEYS.reduce((s, bk) => s + (matrix[acct][bk] || 0), 0);
  }
  const colTotals = {};
  for (const bk of BUCKET_KEYS) {
    colTotals[bk] = ACCOUNT_TYPES.reduce((s, acct) => s + (matrix[acct][bk] || 0), 0);
  }
  const grandTotal = ACCOUNT_TYPES.reduce((s, acct) => s + rowTotals[acct], 0);

  // SS claiming strategy summary
  const ssSummary = useMemo(() => {
    const clientAge = inputs.ssStartAge || 67;
    const partnerAge = inputs.partnerSSStartAge || 67;
    const clientPIA = inputs.ssPIA || 0;
    const partnerPIA = inputs.partnerSSPIA || 0;
    const fraAge = 67;

    const adjustFactor = (claimAge) => {
      if (claimAge < fraAge) return 1 - (fraAge - claimAge) * (6.67 / 100);
      if (claimAge > fraAge) return 1 + (claimAge - fraAge) * 8 / 100;
      return 1;
    };

    return {
      clientAge, partnerAge,
      clientAnnual: clientPIA * 12 * adjustFactor(clientAge),
      partnerAnnual: partnerPIA * 12 * adjustFactor(partnerAge),
      clientPIA, partnerPIA
    };
  }, [inputs]);

  // Roth conversion protocol
  const rothProtocol = useMemo(() => {
    const conversions = inputs.rothConversions || {};
    const ages = Object.keys(conversions).map(Number).sort((a, b) => a - b);
    const total = Object.values(conversions).reduce((s, v) => s + v, 0);
    let targetBracket = 'N/A';
    if (ages.length > 0 && inputs.liquidationMode === 'priority') {
      targetBracket = '22%';
    }
    return { ages, total, targetBracket, conversions };
  }, [inputs.rothConversions, inputs.liquidationMode]);

  // SS comparison: portfolio outcome at original vs selected claiming ages
  const ssComparison = useMemo(() => {
    if (!ssAnalysis?.outcomes) return null;
    const selectedAge = inputs.ssStartAge || 67;
    const originalOutcome = ssAnalysis.outcomes.find(o => o.age === ssOriginalAge);
    const selectedOutcome = ssAnalysis.outcomes.find(o => o.age === selectedAge);
    if (!originalOutcome || !selectedOutcome) return null;

    let partnerResult = null;
    if (clientInfo?.isMarried && ssPartnerAnalysis?.outcomes) {
      const pSelectedAge = inputs.partnerSSStartAge || 67;
      const pOriginal = ssPartnerAnalysis.outcomes.find(o => o.age === ssPartnerOriginalAge);
      const pSelected = ssPartnerAnalysis.outcomes.find(o => o.age === pSelectedAge);
      if (pOriginal && pSelected) {
        partnerResult = {
          originalAge: ssPartnerOriginalAge,
          selectedAge: pSelectedAge,
          originalBalance: pOriginal.balance,
          selectedBalance: pSelected.balance,
          improvement: pSelected.balance - pOriginal.balance
        };
      }
    }

    return {
      originalAge: ssOriginalAge,
      selectedAge,
      originalBalance: originalOutcome.balance,
      selectedBalance: selectedOutcome.balance,
      improvement: selectedOutcome.balance - originalOutcome.balance,
      partner: partnerResult
    };
  }, [ssAnalysis, ssPartnerAnalysis, ssOriginalAge, ssPartnerOriginalAge, inputs.ssStartAge, inputs.partnerSSStartAge, clientInfo?.isMarried]);

  // Baseline strategy comparison: proportionate distribution, no tax optimization
  const strategyComparison = useMemo(() => {
    if (!activeProjection || activeProjection.length === 0 || !basePlan || !inputs.taxEnabled) return null;

    // Current plan metrics (from active projection — deterministic or MC scenario)
    const lastRow = activeProjection[activeProjection.length - 1];
    const currentLegacy = lastRow.total || 0;
    const currentTradLegacy = lastRow.traditionalBalanceDetail || 0;
    const currentLifetimeTax = activeProjection.reduce((s, r) => s + (r.totalTax || 0), 0);
    const currentLifetimeIrmaa = activeProjection.reduce((s, r) => s + (r.irmaaCost || 0), 0);
    const heirFederalRate = 0.24;
    const heirStateRate = (inputs.stateRate || 0) / 100;
    const currentHeirTax = currentTradLegacy * (heirFederalRate + heirStateRate);
    const currentAfterTax = currentLegacy - currentHeirTax;
    const currentTotalBurden = currentLifetimeTax + currentHeirTax + currentLifetimeIrmaa;

    // Baseline: proportionate distribution, no conversions, no cap gain overrides
    // Use MC when a MC mode is selected, deterministic otherwise
    const useMC = mcMode !== 'deterministic';
    const baselineInputs = {
      ...inputs,
      rothConversions: {},
      nqCapGainOverrides: [],
      liquidationMode: 'proportionate',
      liquidationStrategies: []
    };
    const baselineResult = runSimulation(basePlan, assumptions, baselineInputs, rebalanceFreq || 0, useMC, null, rebalanceTargets);
    let baselineProjection;
    if (useMC && baselineResult?.scenarios?.[mcMode]) {
      baselineProjection = baselineResult.scenarios[mcMode];
    } else if (Array.isArray(baselineResult)) {
      baselineProjection = baselineResult;
    } else {
      return null;
    }
    if (!baselineProjection || baselineProjection.length === 0) return null;

    const baselineLast = baselineProjection[baselineProjection.length - 1];
    const baselineLegacy = baselineLast.total || 0;
    const baselineTradLegacy = baselineLast.traditionalBalanceDetail || 0;
    const baselineLifetimeTax = baselineProjection.reduce((s, r) => s + (r.totalTax || 0), 0);
    const baselineLifetimeIrmaa = baselineProjection.reduce((s, r) => s + (r.irmaaCost || 0), 0);
    const baselineHeirTax = baselineTradLegacy * (heirFederalRate + heirStateRate);
    const baselineAfterTax = baselineLegacy - baselineHeirTax;
    const baselineTotalBurden = baselineLifetimeTax + baselineHeirTax + baselineLifetimeIrmaa;

    return {
      baseline: { legacy: baselineLegacy, afterTaxLegacy: baselineAfterTax, lifetimeTax: baselineLifetimeTax, heirTax: baselineHeirTax, totalBurden: baselineTotalBurden, irmaa: baselineLifetimeIrmaa },
      current: { legacy: currentLegacy, afterTaxLegacy: currentAfterTax, lifetimeTax: currentLifetimeTax, heirTax: currentHeirTax, totalBurden: currentTotalBurden, irmaa: currentLifetimeIrmaa },
      legacyImprovement: currentAfterTax - baselineAfterTax,
      burdenSavings: baselineTotalBurden - currentTotalBurden,
      taxSavings: baselineLifetimeTax - currentLifetimeTax
    };
  }, [activeProjection, basePlan, assumptions, inputs, rebalanceFreq, rebalanceTargets, mcMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-mwm-green" /> Executive Summary
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Optimized distribution strategy — bucket allocation, claiming strategy, and Roth conversion protocol
        </p>
      </Card>

      {/* Strategy Summary — Baseline vs Prepared Plan */}
      {strategyComparison && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Strategy Value Added
            </h3>
            {monteCarloData?.scenarios && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setMcMode('deterministic')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'deterministic' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >Deterministic</button>
                <button onClick={() => setMcMode('optimistic')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'optimistic' ? 'bg-mwm-green text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >Optimistic</button>
                <button onClick={() => setMcMode('median')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'median' ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >Median</button>
                <button onClick={() => setMcMode('conservative')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'conservative' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >Conservative</button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Baseline (proportionate distribution, no tax optimization) vs. your prepared plan{mcMode !== 'deterministic' ? ` — ${mcMode === 'optimistic' ? '90th' : mcMode === 'median' ? '50th' : '10th'} percentile` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Baseline */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Baseline — No Optimization</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">After-Tax Legacy</span><span className="font-semibold text-slate-600">{fmt(strategyComparison.baseline.afterTaxLegacy)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lifetime Taxes</span><span className="font-semibold text-red-500">{fmt(strategyComparison.baseline.lifetimeTax)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Heir Tax Burden</span><span className="font-semibold text-red-400">{fmt(strategyComparison.baseline.heirTax)}</span></div>
                {strategyComparison.baseline.irmaa > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Lifetime IRMAA</span><span className="font-semibold text-amber-500">{fmt(strategyComparison.baseline.irmaa)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold"><span className="text-slate-700">Total Family Burden</span><span className="text-red-600">{fmt(strategyComparison.baseline.totalBurden)}</span></div>
              </div>
            </div>
            {/* Prepared Plan */}
            <div className="border border-mwm-green/30 rounded-lg p-4 bg-mwm-green/5">
              <p className="text-[10px] text-mwm-green/80 uppercase font-semibold mb-2">Prepared Plan</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">After-Tax Legacy</span><span className="font-semibold text-mwm-green">{fmt(strategyComparison.current.afterTaxLegacy)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lifetime Taxes</span><span className="font-semibold text-mwm-green">{fmt(strategyComparison.current.lifetimeTax)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Heir Tax Burden</span><span className="font-semibold text-mwm-green">{fmt(strategyComparison.current.heirTax)}</span></div>
                {strategyComparison.current.irmaa > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Lifetime IRMAA</span><span className="font-semibold text-amber-500">{fmt(strategyComparison.current.irmaa)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold"><span className="text-slate-700">Total Family Burden</span><span className="text-mwm-green">{fmt(strategyComparison.current.totalBurden)}</span></div>
              </div>
            </div>
          </div>
          {/* Value Added Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-lg p-3 border ${strategyComparison.legacyImprovement > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Legacy Improvement</p>
              <p className={`text-xl font-bold ${strategyComparison.legacyImprovement > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {strategyComparison.legacyImprovement > 0 ? '+' : ''}{fmt(strategyComparison.legacyImprovement)}
              </p>
            </div>
            <div className={`rounded-lg p-3 border ${strategyComparison.burdenSavings > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Burden Savings</p>
              <p className={`text-xl font-bold ${strategyComparison.burdenSavings > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {fmt(strategyComparison.burdenSavings)}
              </p>
            </div>
            <div className={`rounded-lg p-3 border ${strategyComparison.taxSavings > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Tax Savings</p>
              <p className={`text-xl font-bold ${strategyComparison.taxSavings > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {fmt(strategyComparison.taxSavings)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Bucket Allocation Matrix */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <Layers className="w-4 h-4" /> Bucket Allocation by Account Type
          </h3>
          <div className="flex items-center gap-2">
            {manualOverrides && (
              <button
                onClick={() => setManualOverrides(null)}
                className="text-[10px] text-blue-600 hover:underline"
              >
                Reset to Auto
              </button>
            )}
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {manualOverrides ? 'Manual' : 'Auto-Optimized'}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Starting balance: <strong>{fmt(totalPortfolio)}</strong> allocated across account types and time-segmented buckets.
          {inputs.liquidationStrategies?.length > 0 && ' Optimized based on liquidation priority strategy.'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="p-2 text-left text-slate-600 font-bold w-[120px]">Account Type</th>
                {BUCKET_KEYS.map((bk, idx) => (
                  <th key={bk} className="p-2 text-center font-bold" style={{ color: BUCKET_COLORS[idx] }}>
                    <div className="text-[10px] uppercase">{BUCKET_SHORT[idx]}</div>
                    <div className="text-[9px] font-normal text-slate-400">{BUCKET_NAMES[idx].split(' - ')[1]}</div>
                  </th>
                ))}
                <th className="p-2 text-right text-slate-600 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNT_TYPES.map(acct => {
                const colors = ACCOUNT_COLORS[acct];
                return (
                  <tr key={acct} className={`border-b border-slate-100 ${colors.bg}`}>
                    <td className={`p-2 text-left font-semibold ${colors.text}`}>
                      {ACCOUNT_LABELS[acct]}
                      <div className="text-[9px] font-normal text-slate-400">
                        {fmt(accountBalances[acct])} ({Math.round((accountBalances[acct] / totalPortfolio) * 100)}%)
                      </div>
                    </td>
                    {BUCKET_KEYS.map((bk, idx) => {
                      const val = matrix[acct][bk] || 0;
                      const acctPct = rowTotals[acct] > 0 ? (val / rowTotals[acct]) * 100 : 0;
                      return (
                        <td key={bk} className="p-2 text-center">
                          {val > 0 ? (
                            <div>
                              <div className="font-semibold text-slate-700">{fmtShort(val)}</div>
                              <div className="text-[9px] text-slate-400">{Math.round(acctPct)}%</div>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right font-bold text-slate-700">
                      {fmtShort(rowTotals[acct])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="p-2 text-left font-bold text-slate-700">Bucket Total</td>
                {BUCKET_KEYS.map((bk, idx) => {
                  const target = bucketTargets[bk];
                  const actual = colTotals[bk];
                  const match = Math.abs(actual - target) < 1;
                  return (
                    <td key={bk} className="p-2 text-center">
                      <div className="font-bold" style={{ color: BUCKET_COLORS[idx] }}>{fmtShort(actual)}</div>
                      <div className="text-[9px] text-slate-400">
                        Target: {fmtShort(target)}
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 text-right font-bold text-slate-800 text-sm">
                  {fmtShort(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </Card>

      {/* SS Claiming Strategy — with Original Plan Comparison */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Social Security Claiming Strategy
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">{clientInfo?.name || 'Client'} — Selected Plan</p>
            <p className="text-lg font-bold text-mwm-green">Age {ssSummary.clientAge}</p>
            <p className="text-sm text-slate-500">PIA: {fmt(ssSummary.clientPIA)}/mo</p>
            <p className="text-sm font-semibold text-mwm-green">{fmt(ssSummary.clientAnnual)}/yr at claiming</p>
          </div>
          {clientInfo?.isMarried && ssSummary.partnerPIA > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">{clientInfo?.partnerName || 'Partner'} — Selected Plan</p>
              <p className="text-lg font-bold text-mwm-green">Age {ssSummary.partnerAge}</p>
              <p className="text-sm text-slate-500">PIA: {fmt(ssSummary.partnerPIA)}/mo</p>
              <p className="text-sm font-semibold text-mwm-green">{fmt(ssSummary.partnerAnnual)}/yr at claiming</p>
            </div>
          )}
        </div>

        {/* SS Value Comparison */}
        {ssAnalysis?.outcomes && (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500 mb-3">
              Compare portfolio outcome at plan horizon: original claiming plan vs. selected strategy
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              {/* Client SS Comparison */}
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">{clientInfo?.name || 'Client'} — Original Plan</p>
                  <select
                    value={ssOriginalAge}
                    onChange={(e) => setSSOriginalAge(parseInt(e.target.value))}
                    className="text-xs border border-slate-200 rounded px-2 py-1"
                  >
                    {[62, 63, 64, 65, 66, 67, 68, 69, 70].map(age => (
                      <option key={age} value={age}>Age {age}</option>
                    ))}
                  </select>
                </div>
                {ssComparison && (
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-slate-400 uppercase">Age {ssComparison.originalAge}</p>
                      <p className="text-sm font-bold text-slate-600">{fmtShort(ssComparison.originalBalance)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-mwm-green/80 uppercase">Age {ssComparison.selectedAge}</p>
                      <p className="text-sm font-bold text-mwm-green">{fmtShort(ssComparison.selectedBalance)}</p>
                    </div>
                    <div className={`text-center flex-1 rounded-lg p-1.5 ${ssComparison.improvement > 0 ? 'bg-emerald-50' : ssComparison.improvement < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <p className="text-[10px] text-slate-400 uppercase">Value Add</p>
                      <p className={`text-sm font-bold ${ssComparison.improvement > 0 ? 'text-emerald-600' : ssComparison.improvement < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {ssComparison.improvement > 0 ? '+' : ''}{fmtShort(ssComparison.improvement)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Partner SS Comparison */}
              {clientInfo?.isMarried && ssPartnerAnalysis?.outcomes && (
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">{clientInfo?.partnerName || 'Partner'} — Original Plan</p>
                    <select
                      value={ssPartnerOriginalAge}
                      onChange={(e) => setSSPartnerOriginalAge(parseInt(e.target.value))}
                      className="text-xs border border-slate-200 rounded px-2 py-1"
                    >
                      {[62, 63, 64, 65, 66, 67, 68, 69, 70].map(age => (
                        <option key={age} value={age}>Age {age}</option>
                      ))}
                    </select>
                  </div>
                  {ssComparison?.partner && (
                    <div className="flex items-center gap-3">
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-slate-400 uppercase">Age {ssComparison.partner.originalAge}</p>
                        <p className="text-sm font-bold text-slate-600">{fmtShort(ssComparison.partner.originalBalance)}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-mwm-green/80 uppercase">Age {ssComparison.partner.selectedAge}</p>
                        <p className="text-sm font-bold text-mwm-green">{fmtShort(ssComparison.partner.selectedBalance)}</p>
                      </div>
                      <div className={`text-center flex-1 rounded-lg p-1.5 ${ssComparison.partner.improvement > 0 ? 'bg-emerald-50' : ssComparison.partner.improvement < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                        <p className="text-[10px] text-slate-400 uppercase">Value Add</p>
                        <p className={`text-sm font-bold ${ssComparison.partner.improvement > 0 ? 'text-emerald-600' : ssComparison.partner.improvement < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {ssComparison.partner.improvement > 0 ? '+' : ''}{fmtShort(ssComparison.partner.improvement)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Roth Conversion Protocol */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Roth Conversion Protocol
        </h3>
        {rothProtocol.ages.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div className="bg-teal-50 rounded-lg p-2 border border-teal-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Conversions</p>
                <p className="text-base font-bold text-teal-600">{fmt(rothProtocol.total)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Target Bracket</p>
                <p className="text-base font-bold text-amber-600">{rothProtocol.targetBracket}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Conversion Years</p>
                <p className="text-base font-bold text-slate-700">
                  Ages {rothProtocol.ages[0]}-{rothProtocol.ages[rothProtocol.ages.length - 1]}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {rothProtocol.ages.map(age => (
                <div key={age} className="bg-teal-50 rounded px-2 py-1 text-[10px] border border-teal-100">
                  <span className="font-semibold text-teal-700">Age {age}:</span>{' '}
                  <span className="text-teal-600">{fmt(rothProtocol.conversions[age])}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">No Roth conversions scheduled. Run the Tax Optimizer to generate a conversion protocol.</p>
        )}
      </Card>
    </div>
  );
};
