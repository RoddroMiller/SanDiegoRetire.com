import React, { useMemo, useState, useCallback } from 'react';
import { FileText, Layers, DollarSign, TrendingUp, Shield } from 'lucide-react';
import { COLORS } from '../../../constants/colors';
import { Card } from '../../ui';

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
  ssAnalysis, ssPartnerAnalysis
}) => {
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

  // Value added summary
  const valueAdded = useMemo(() => {
    if (!projectionData || projectionData.length === 0) return null;
    const lastRow = projectionData[projectionData.length - 1];
    const lifetimeTax = projectionData.reduce((s, r) => s + (r.totalTax || 0), 0);
    const totalConversions = projectionData.reduce((s, r) => s + (r.rothConversion || 0), 0);
    return {
      finalLegacy: lastRow.total || 0, lifetimeTax, totalConversions,
      hasOptimization: inputs.liquidationMode === 'priority' || totalConversions > 0
    };
  }, [projectionData, inputs.liquidationMode]);

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

      {/* Strategy Summary */}
      {valueAdded && (
        <Card>
          <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Strategy Summary
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            {valueAdded.hasOptimization
              ? 'Active tax optimization with priority liquidation and/or Roth conversions'
              : 'Run the Tax Optimizer to see value-added analysis vs baseline'}
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Projected Legacy</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(valueAdded.finalLegacy)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Lifetime Taxes</p>
              <p className="text-xl font-bold text-red-600">{fmt(valueAdded.lifetimeTax)}</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Roth Conversions</p>
              <p className="text-xl font-bold text-teal-600">{fmt(valueAdded.totalConversions)}</p>
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

      {/* SS Claiming Strategy */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Social Security Claiming Strategy
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Client</p>
            <p className="text-lg font-bold text-slate-700">Age {ssSummary.clientAge}</p>
            <p className="text-sm text-slate-500">PIA: {fmt(ssSummary.clientPIA)}/mo</p>
            <p className="text-sm font-semibold text-mwm-green">{fmt(ssSummary.clientAnnual)}/yr at claiming</p>
          </div>
          {clientInfo?.isMarried && ssSummary.partnerPIA > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Partner</p>
              <p className="text-lg font-bold text-slate-700">Age {ssSummary.partnerAge}</p>
              <p className="text-sm text-slate-500">PIA: {fmt(ssSummary.partnerPIA)}/mo</p>
              <p className="text-sm font-semibold text-mwm-green">{fmt(ssSummary.partnerAnnual)}/yr at claiming</p>
            </div>
          )}
        </div>
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
