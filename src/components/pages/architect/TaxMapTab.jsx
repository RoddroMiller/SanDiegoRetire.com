import React, { useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Bar, Line
} from 'recharts';
import {
  DollarSign, Table as TableIcon, Target, CheckCircle, Loader,
  Layers, ChevronDown, ChevronUp, RefreshCw, Trash2
} from 'lucide-react';

import { getInflationAdjustedBrackets, getInflationAdjustedDeduction, optimizeRetirementTaxStrategy } from '../../../utils';
import { Card } from '../../ui';

const TAX_BRACKET_BASE_YEAR = 2026;

const ACCOUNT_COLORS = { traditional: 'text-orange-600', roth: 'text-mwm-green', nq: 'text-purple-600' };

// Inline component for adding a new cap gain override range
const CapGainRangeAdder = ({ totalYears, defaultRate, onAdd }) => {
  const [startYear, setStartYear] = useState(1);
  const [endYear, setEndYear] = useState(Math.min(10, totalYears));
  const [rate, setRate] = useState(0);

  return (
    <div className="flex items-end gap-2 p-2 bg-slate-50 rounded border border-slate-200">
      <div>
        <label className="text-[10px] text-slate-500 uppercase font-semibold">From Year</label>
        <input type="number" value={startYear} min={1} max={40} onChange={(e) => setStartYear(parseInt(e.target.value) || 1)}
          className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase font-semibold">To Year</label>
        <input type="number" value={endYear} min={1} max={40} onChange={(e) => setEndYear(parseInt(e.target.value) || 1)}
          className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase font-semibold">Rate %</label>
        <input type="number" value={rate} min={0} max={20} step={0.5} onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
          className="block w-16 text-right px-2 py-1 border rounded text-xs mt-0.5" />
      </div>
      <button
        onClick={() => { if (startYear <= endYear) onAdd({ startYear, endYear, rate }); }}
        className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-colors"
      >
        + Add
      </button>
      <span className="text-[10px] text-slate-400 ml-1">Default: {defaultRate}%</span>
    </div>
  );
};

export const TaxMapTab = ({
  projectionData, monteCarloData, inputs, clientInfo, basePlan,
  assumptions, rebalanceFreq, rebalanceTargets,
  onApplyTaxStrategy, onRothConversionChange, onLiquidationStrategyChange, onCapGainOverrideChange,
  onInputChange
}) => {
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;

  const [optimizerResult, setOptimizerResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [targetOptimizeAge, setTargetOptimizeAge] = useState(null); // null = end of projection
  const [showConversionTable, setShowConversionTable] = useState(false);
  const [showLiquidation, setShowLiquidation] = useState(false);
  const [showCapGains, setShowCapGains] = useState(false);
  const [mcMode, setMcMode] = useState('deterministic');

  // Active projection data — deterministic or MC scenario
  const activeProjection = useMemo(() => {
    if (mcMode !== 'deterministic' && monteCarloData?.scenarios?.[mcMode]) {
      return monteCarloData.scenarios[mcMode];
    }
    return projectionData;
  }, [mcMode, monteCarloData, projectionData]);

  const chartData = useMemo(() => {
    if (!projectionData || projectionData.length === 0) return [];
    const startAge = basePlan?.simulationStartAge || projectionData[0]?.age || 65;
    const inflationRate = inputs.inflationRate || 2.5;
    const filingStatus = inputs.filingStatus || 'married';

    return projectionData.map((row, idx) => {
      const yearsFromBase = (startAge + idx) - (clientInfo.currentAge || 65);
      const yearsFromTaxBase = Math.max(0, yearsFromBase);
      const brackets = getInflationAdjustedBrackets(filingStatus, yearsFromTaxBase, inflationRate);
      const deduction = getInflationAdjustedDeduction(filingStatus, yearsFromTaxBase, inflationRate, row.age >= 65);

      const tradWithdrawal = row.distribution * (row.traditionalPctUsed || 0) / 100;
      const rothConversion = row.rothConversion || 0;
      const taxableSS = row.taxableSS || 0;
      const pension = row.pensionIncomeDetail || 0;
      const nqOrdinaryDivs = row.nqOrdinaryDividends || 0;
      const nqPreferential = (row.nqTaxableGain || 0) + (row.nqQualifiedDividends || 0);
      const otherEmployment = (row.otherIncomeDetail || 0) + (row.employmentIncomeDetail || 0);
      const rmd = row.rmdAmount || 0;

      const totalOrdinaryIncome = taxableSS + pension + tradWithdrawal + rothConversion + nqOrdinaryDivs + otherEmployment;

      const bracket12Top = brackets.length > 1 ? brackets[1].max + deduction : 0;
      const bracket22Top = brackets.length > 2 ? brackets[2].max + deduction : 0;
      const bracket24Top = brackets.length > 3 ? brackets[3].max + deduction : 0;

      const taxableAfterDeduction = Math.max(0, totalOrdinaryIncome - deduction);
      let currentBracket = '10%';
      let headroom = 0;
      for (let b = 0; b < brackets.length; b++) {
        if (taxableAfterDeduction <= brackets[b].max) {
          currentBracket = `${Math.round(brackets[b].rate * 100)}%`;
          headroom = brackets[b].max - taxableAfterDeduction;
          break;
        }
      }

      return {
        age: row.age, taxableSS, pension,
        tradWithdrawal: Math.round(tradWithdrawal),
        rothConversion: Math.round(rothConversion),
        nqOrdinaryDivs: Math.round(nqOrdinaryDivs),
        nqPreferential: Math.round(nqPreferential),
        otherEmployment: Math.round(otherEmployment),
        totalOrdinaryIncome: Math.round(totalOrdinaryIncome),
        rmd: Math.round(rmd),
        bracket12Top, bracket22Top, bracket24Top,
        deduction, currentBracket,
        headroom: Math.round(headroom),
        taxableAfterDeduction: Math.round(taxableAfterDeduction),
        totalTax: row.totalTax || 0,
        effectiveRate: row.effectiveRate || '0.0',
        tradBalance: row.traditionalBalanceDetail || 0,
        rothBalance: row.rothBalanceDetail || 0,
        nqBalance: row.nqBalanceDetail || 0,
        nqUnrealizedGains: row.nqUnrealizedGains || 0,
        nqStrategicRealization: row.nqStrategicRealization || 0,
        irmaaCost: row.irmaaCost || 0,
        irmaaBracket: row.irmaaBracket || 0
      };
    });
  }, [projectionData, inputs, clientInfo, basePlan]);

  // Identify pre-RMD window and Roth conversion opportunities
  const insights = useMemo(() => {
    if (chartData.length === 0) return { preRMDYears: [], rothOpportunity: 0 };
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - (clientInfo.currentAge || 65);
    const rmdStartAge = birthYear <= 1950 ? 72 : birthYear <= 1959 ? 73 : 75;
    const retAge = basePlan?.simulationStartAge || 65;

    const preRMDYears = chartData.filter(d => d.age >= retAge && d.age < rmdStartAge);
    let rothOpportunity12 = 0;
    let rothOpportunity22 = 0;
    preRMDYears.forEach(d => {
      if (d.currentBracket === '10%' || d.currentBracket === '12%') {
        rothOpportunity12 += d.headroom;
      } else if (d.currentBracket === '22%') {
        rothOpportunity22 += d.headroom;
      }
    });

    return { preRMDYears, rothOpportunity12, rothOpportunity22, rmdStartAge };
  }, [chartData, clientInfo, basePlan]);

  // Live current strategy metrics — uses active projection (deterministic or MC scenario)
  const liveCurrentStrategy = useMemo(() => {
    if (!activeProjection || activeProjection.length === 0) return null;
    const last = targetOptimizeAge
      ? (activeProjection.find(r => r.age >= targetOptimizeAge) || activeProjection[activeProjection.length - 1])
      : activeProjection[activeProjection.length - 1];
    const scopedProjection = targetOptimizeAge
      ? activeProjection.filter(r => r.age <= targetOptimizeAge)
      : activeProjection;
    const grossLegacy = last.total || 0;
    const tradLegacy = last.traditionalBalanceDetail || 0;
    const rothLegacy = last.rothBalanceDetail || 0;
    const nqLegacy = last.nqBalanceDetail || 0;
    const heirFederalRate = 0.24;
    const heirStateRate = (inputs.stateRate || 0) / 100;
    const heirTax = tradLegacy * (heirFederalRate + heirStateRate);
    const afterTaxLegacy = grossLegacy - heirTax;
    const lifetimeTax = scopedProjection.reduce((s, r) => s + (r.totalTax || 0), 0);
    const lifetimeRMD = scopedProjection.reduce((s, r) => s + (r.rmdAmount || 0), 0);
    const lifetimeIrmaa = scopedProjection.reduce((s, r) => s + (r.irmaaCost || 0), 0);
    const totalConversions = scopedProjection.reduce((s, r) => s + (r.rothConversion || 0), 0);
    return {
      grossLegacy, afterTaxLegacy, lifetimeTax, lifetimeRMD, heirTax,
      lifetimeIrmaa, totalConversions,
      legacyBreakdown: { traditional: tradLegacy, roth: rothLegacy, nq: nqLegacy },
      totalBurden: lifetimeTax + heirTax + lifetimeIrmaa
    };
  }, [activeProjection, inputs.stateRate, targetOptimizeAge]);

  // Active strategy indicators
  const hasActiveConversions = Object.keys(inputs.rothConversions || {}).length > 0;
  const hasActiveLiquidation = inputs.liquidationMode === 'priority' && (inputs.liquidationStrategies || []).length > 0;
  const hasActiveCapGains = (inputs.nqCapGainOverrides || []).length > 0;

  // Run optimizer
  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    setShowOptimizer(true);
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      const result = optimizeRetirementTaxStrategy(basePlan, assumptions, inputs, clientInfo, rebalanceFreq, rebalanceTargets, monteCarloData, targetOptimizeAge);
      setOptimizerResult(result);
      setIsOptimizing(false);
    }, 50);
  }, [basePlan, assumptions, inputs, clientInfo, rebalanceFreq, rebalanceTargets, monteCarloData, targetOptimizeAge]);

  // Active optimizer display data — switches based on MC mode toggle
  const activeOptimizer = useMemo(() => {
    if (!optimizerResult) return null;
    // Check for scenario-specific data (deterministic, optimistic, median, conservative)
    if (optimizerResult.scenarios?.[mcMode]) {
      const s = optimizerResult.scenarios[mcMode];
      return {
        comparison: s.comparison,
        yearDetails: s.yearDetails,
        alternativeStrategies: s.alternativeStrategies || optimizerResult.alternativeStrategies
      };
    }
    // Fallback: use default (deterministic when no MC, or deterministic comparison)
    return {
      comparison: optimizerResult.comparison,
      yearDetails: optimizerResult.yearDetails,
      alternativeStrategies: optimizerResult.alternativeStrategies
    };
  }, [optimizerResult, mcMode]);

  // Apply recommended strategy
  const handleApplyRecommended = useCallback(() => {
    if (!optimizerResult?.recommended) return;
    onApplyTaxStrategy(optimizerResult.recommended, activeOptimizer?.comparison || optimizerResult.comparison);
    setShowConversionTable(true);
  }, [optimizerResult, activeOptimizer, onApplyTaxStrategy]);

  if (!inputs.taxEnabled) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Enable Tax Impact Analysis in Inputs to use the Tax Map.</p>
        </div>
      </Card>
    );
  }

  const hasRothConversions = projectionData.some(r => r.rothConversion > 0);

  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-lg mb-1 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Tax Map — Taxable Income vs. Bracket Thresholds
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Bars show taxable income by source. Dashed lines show inflation-adjusted federal tax bracket thresholds (gross income, after standard deduction).
        </p>

        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} label={{ value: 'Age', position: 'insideBottom', offset: -3, fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(value, name) => [fmt(value), name]}
                labelFormatter={(label) => `Age ${label}`}
                contentStyle={{ fontSize: 12 }}
                itemSorter={(item) => {
                  // Show bracket lines on top, income components on bottom
                  const bracketNames = ['Top of 12%', 'Top of 22%', 'Top of 24%'];
                  return bracketNames.includes(item.name) ? -1 : 1;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="taxableSS" stackId="income" fill="#60a5fa" name="Taxable SS" />
              <Bar dataKey="pension" stackId="income" fill="#34d399" name="Pension" />
              <Bar dataKey="tradWithdrawal" stackId="income" fill="#f97316" name="Traditional" />
              {hasRothConversions && <Bar dataKey="rothConversion" stackId="income" fill="#14b8a6" name="Roth Conversion" />}
              <Bar dataKey="nqOrdinaryDivs" stackId="income" fill="#c084fc" name="NQ Ordinary Divs" />
              <Bar dataKey="otherEmployment" stackId="income" fill="#94a3b8" name="Other/Employment" />
              <Bar dataKey="nqPreferential" stackId="income" fill="#a78bfa" name="NQ Cap Gains (LTCG rate)" />
              <Line dataKey="bracket12Top" stroke="#10b981" strokeDasharray="5 5" name="Top of 12%" dot={false} strokeWidth={2} />
              <Line dataKey="bracket22Top" stroke="#f59e0b" strokeDasharray="5 5" name="Top of 22%" dot={false} strokeWidth={2} />
              <Line dataKey="bracket24Top" stroke="#ef4444" strokeDasharray="5 5" name="Top of 24%" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Insights Cards */}
      {insights.preRMDYears.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pre-RMD Window</p>
              <p className="text-2xl font-bold text-mwm-green/80">{insights.preRMDYears.length} years</p>
              <p className="text-xs text-slate-500 mt-1">
                Ages {insights.preRMDYears[0]?.age}–{insights.preRMDYears[insights.preRMDYears.length - 1]?.age} before RMDs begin at {insights.rmdStartAge}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Roth Conversion Room (12% bracket)</p>
              <p className="text-2xl font-bold text-blue-700">{fmt(insights.rothOpportunity12)}</p>
              <p className="text-xs text-slate-500 mt-1">Cumulative headroom at 12% rate during pre-RMD years</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Roth Conversion Room (22% bracket)</p>
              <p className="text-2xl font-bold text-mwm-gold/80">{fmt(insights.rothOpportunity22)}</p>
              <p className="text-xs text-slate-500 mt-1">Cumulative headroom at 22% rate during pre-RMD years</p>
            </div>
          </Card>
        </div>
      )}

      {/* Liquidation Strategy */}
      <Card>
          <button onClick={() => setShowLiquidation(!showLiquidation)} className="w-full flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
              <Layers className="w-4 h-4" /> Liquidation Strategy
              {hasActiveLiquidation && <span className="text-xs font-normal text-orange-600">({inputs.liquidationStrategies.length} range{inputs.liquidationStrategies.length !== 1 ? 's' : ''})</span>}
            </h3>
            {showLiquidation ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showLiquidation && (
            <div className="mt-3">
              <div className="flex justify-end mb-2">
                <button onClick={() => onLiquidationStrategyChange('proportionate', [])} className="text-xs text-red-500 hover:underline">Reset to Proportionate</button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-2 text-left">Years</th>
                    <th className="p-2 text-center">Mode</th>
                    <th className="p-2 text-center">Traditional</th>
                    <th className="p-2 text-center">Roth</th>
                    <th className="p-2 text-center">NQ</th>
                    <th className="p-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {inputs.liquidationStrategies.map((s, idx) => {
                    const isSplit = !!s.split;
                    const toggleMode = () => {
                      const newStrategies = [...inputs.liquidationStrategies];
                      if (isSplit) {
                        // Switch to priority mode
                        const { split, ...rest } = newStrategies[idx];
                        newStrategies[idx] = { ...rest, priority: s.priority || ['nq', 'traditional', 'roth'] };
                      } else {
                        // Switch to split mode
                        newStrategies[idx] = { ...newStrategies[idx], split: { traditional: 50, roth: 0, nq: 50 } };
                      }
                      onLiquidationStrategyChange('priority', newStrategies);
                    };
                    const updateSplit = (acct, val) => {
                      const newStrategies = [...inputs.liquidationStrategies];
                      const newSplit = { ...(s.split || { traditional: 0, roth: 0, nq: 0 }), [acct]: parseFloat(val) || 0 };
                      // Auto-adjust NQ so totals = 100%
                      if (acct !== 'nq') {
                        newSplit.nq = Math.max(0, 100 - (newSplit.traditional || 0) - (newSplit.roth || 0));
                      }
                      newStrategies[idx] = { ...newStrategies[idx], split: newSplit };
                      onLiquidationStrategyChange('priority', newStrategies);
                    };
                    const updatePriority = (pi, newAcct) => {
                      const newStrategies = [...inputs.liquidationStrategies];
                      const newPriority = [...(newStrategies[idx].priority || ['nq', 'traditional', 'roth'])];
                      const swapIdx = newPriority.indexOf(newAcct);
                      if (swapIdx >= 0) {
                        newPriority[swapIdx] = newPriority[pi];
                        newPriority[pi] = newAcct;
                      }
                      newStrategies[idx] = { ...newStrategies[idx], priority: newPriority };
                      onLiquidationStrategyChange('priority', newStrategies);
                    };

                    return (
                      <tr key={s.id || idx} className="border-b border-slate-50 bg-orange-50/30">
                        <td className="p-2 text-left font-bold text-slate-700">Yr {s.startYear}–{s.endYear}</td>
                        <td className="p-2 text-center">
                          <button onClick={toggleMode}
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${isSplit ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isSplit ? 'Split %' : 'Priority'}
                          </button>
                        </td>
                        {isSplit ? (
                          <>
                            <td className="p-2 text-center">
                              <input type="number" value={s.split.traditional ?? 0} min={0} max={100 - (s.split.roth ?? 0)}
                                onChange={(e) => updateSplit('traditional', e.target.value)}
                                className="w-14 text-center px-1 py-1 border rounded text-xs" />
                              <span className="text-[9px] text-slate-400">%</span>
                            </td>
                            <td className="p-2 text-center">
                              <input type="number" value={s.split.roth ?? 0} min={0} max={100 - (s.split.traditional ?? 0)}
                                onChange={(e) => updateSplit('roth', e.target.value)}
                                className="w-14 text-center px-1 py-1 border rounded text-xs" />
                              <span className="text-[9px] text-slate-400">%</span>
                            </td>
                            <td className="p-2 text-center">
                              <input type="number" value={Math.max(0, 100 - (s.split.traditional ?? 0) - (s.split.roth ?? 0))} readOnly
                                className="w-14 text-center px-1 py-1 border rounded text-xs bg-slate-50 text-slate-500" />
                              <span className="text-[9px] text-slate-400">%</span>
                            </td>
                          </>
                        ) : (
                          <>
                            {(s.priority || ['nq', 'traditional', 'roth']).map((acct, pi) => (
                              <td key={pi} className="p-2 text-center">
                                <select value={acct} onChange={(e) => updatePriority(pi, e.target.value)}
                                  className={`text-xs px-2 py-1 border rounded font-medium ${ACCOUNT_COLORS[acct] || ''}`}>
                                  <option value="traditional">Traditional</option>
                                  <option value="roth">Roth</option>
                                  <option value="nq">NQ</option>
                                </select>
                                <div className="text-[9px] text-slate-400 mt-0.5">{pi === 0 ? '1st' : pi === 1 ? '2nd' : '3rd'}</div>
                              </td>
                            ))}
                          </>
                        )}
                        <td className="p-2 text-center">
                          <button onClick={() => {
                            const newStrategies = inputs.liquidationStrategies.filter((_, i) => i !== idx);
                            onLiquidationStrategyChange(newStrategies.length > 0 ? 'priority' : 'proportionate', newStrategies);
                          }} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Add new year range */}
              <div className="flex items-end gap-2 mt-3 p-2 bg-slate-50 rounded border border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">From Year</label>
                  <input type="number" defaultValue={1} min={1} max={40} id="liq-start"
                    className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">To Year</label>
                  <input type="number" defaultValue={Math.min(10, projectionData.length)} min={1} max={40} id="liq-end"
                    className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Mode</label>
                  <select id="liq-mode" defaultValue="split" className="block text-xs px-2 py-1 border rounded mt-0.5">
                    <option value="priority">Priority</option>
                    <option value="split">Split %</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    const startYear = parseInt(document.getElementById('liq-start').value) || 1;
                    const endYear = parseInt(document.getElementById('liq-end').value) || 10;
                    const mode = document.getElementById('liq-mode').value;
                    const newStrategy = mode === 'split'
                      ? { id: Date.now(), startYear, endYear, priority: ['nq', 'traditional', 'roth'], split: { traditional: 50, roth: 0, nq: 50 } }
                      : { id: Date.now(), startYear, endYear, priority: ['nq', 'traditional', 'roth'] };
                    onLiquidationStrategyChange('priority', [...(inputs.liquidationStrategies || []), newStrategy]);
                  }}
                  className="px-3 py-1 bg-mwm-green text-white rounded text-xs font-semibold hover:bg-mwm-emerald"
                >
                  Add
                </button>
              </div>
            </div>
          )}
      </Card>

      {/* Roth Conversion Schedule */}
      <Card>
        <button onClick={() => setShowConversionTable(!showConversionTable)} className="w-full flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Roth Conversions
            {hasActiveConversions && <span className="text-xs font-normal text-teal-600">({Object.keys(inputs.rothConversions).length} years)</span>}
          </h3>
          {showConversionTable ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showConversionTable && (
          <div className="mt-3">
            <div className="flex justify-end mb-2">
              <button onClick={() => onRothConversionChange('__reset_all__')} className="text-xs text-red-500 hover:underline">Clear All Conversions</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-2 text-left">Age</th>
                    <th className="p-2 text-right">Conversion Amount</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(inputs.rothConversions).sort((a, b) => Number(a[0]) - Number(b[0])).map(([age, amount]) => (
                    <tr key={age} className="border-b border-slate-50 bg-teal-50/30">
                      <td className="p-2 text-left font-bold text-slate-700">{age}</td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => onRothConversionChange(Number(age), parseInt(e.target.value) || 0)}
                          className="w-28 text-right px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => onRothConversionChange(Number(age), null)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Add conversions by age range */}
            <div className="flex items-end gap-2 mt-3 p-2 bg-slate-50 rounded border border-slate-200">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">From Age</label>
                <input type="number" defaultValue={clientInfo?.retirementAge || 65} min={50} max={90} id="roth-start-age"
                  className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">To Age</label>
                <input type="number" defaultValue={(clientInfo?.retirementAge || 65) + 5} min={50} max={90} id="roth-end-age"
                  className="block w-16 text-center px-1 py-1 border rounded text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Amount / Year</label>
                <input type="number" defaultValue={50000} min={0} step={5000} id="roth-amount"
                  className="block w-24 text-right px-2 py-1 border rounded text-xs mt-0.5" />
              </div>
              <button
                onClick={() => {
                  const fromAge = parseInt(document.getElementById('roth-start-age').value) || 65;
                  const toAge = parseInt(document.getElementById('roth-end-age').value) || 70;
                  const amount = parseInt(document.getElementById('roth-amount').value) || 0;
                  if (amount > 0 && fromAge <= toAge) {
                    for (let age = fromAge; age <= toAge; age++) {
                      onRothConversionChange(age, amount);
                    }
                  }
                }}
                className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700"
              >
                Add Range
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ===== OPTIMIZER SECTION ===== */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <Target className="w-4 h-4" /> Tax Strategy Optimizer
          </h3>
          <div className="flex items-center gap-2">
            {(hasActiveConversions || hasActiveLiquidation || hasActiveCapGains) && (
              <button
                onClick={() => onApplyTaxStrategy({ rothConversions: {}, nqCapGainOverrides: [], liquidationMode: 'proportionate', liquidationStrategies: [] })}
                className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                Clear All Strategies
              </button>
            )}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold whitespace-nowrap">Optimize at</label>
              <select
                value={targetOptimizeAge || ''}
                onChange={(e) => setTargetOptimizeAge(e.target.value ? parseInt(e.target.value) : null)}
                className="text-xs font-bold p-1 rounded border border-slate-300 bg-white text-slate-800"
              >
                <option value={80}>Age 80</option>
                <option value={85}>Age 85</option>
                <option value={90}>Age 90</option>
                <option value={95}>Age 95</option>
                <option value="">End of Plan</option>
              </select>
            </div>
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-mwm-green text-white rounded-lg text-sm font-medium hover:bg-mwm-green/80 transition-colors disabled:opacity-50"
            >
              {isOptimizing ? <Loader className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {isOptimizing ? 'Optimizing...' : 'Optimize Tax Strategy'}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-500">
            Optimizes Roth conversion schedule to maximize after-tax {targetOptimizeAge ? `portfolio at age ${targetOptimizeAge}` : 'legacy'}{inputs.irmaaEnabled ? ', factoring in IRMAA surcharges' : ''}. Set your liquidation strategy and Roth conversions above, then optimize.
          </p>
          {monteCarloData?.scenarios && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg ml-4 shrink-0">
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

        {/* Active Strategy Badges */}
        {(hasActiveConversions || hasActiveLiquidation || hasActiveCapGains) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {hasActiveConversions && (
              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                Roth Conversions: {Object.keys(inputs.rothConversions).length} years
              </span>
            )}
            {hasActiveLiquidation && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                Priority Liquidation: {inputs.liquidationStrategies.length} range{inputs.liquidationStrategies.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasActiveCapGains && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                Cap Gains Overrides: {inputs.nqCapGainOverrides.length} range{inputs.nqCapGainOverrides.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Optimizer Results */}
        {isOptimizing && (
          <div className="text-center py-8 text-slate-500">
            <Loader className="w-8 h-8 mx-auto mb-3 text-slate-300 animate-spin" />
            <p className="font-medium">Testing Roth conversion schedules{inputs.irmaaEnabled ? ' with IRMAA impact' : ''}...</p>
          </div>
        )}

        {/* Live Strategy Summary — always reflects current manual inputs */}
        {liveCurrentStrategy && (
          <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4">
            <p className="text-xs text-blue-600 uppercase font-semibold mb-3">Active Strategy (Live){targetOptimizeAge ? ` — Values at Age ${targetOptimizeAge}` : ''}</p>
            <div className={`grid grid-cols-2 ${inputs.irmaaEnabled && liveCurrentStrategy.lifetimeIrmaa > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 text-center`}>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">{targetOptimizeAge ? `After-Tax at ${targetOptimizeAge}` : 'After-Tax Legacy'}</p>
                <p className="text-lg font-bold text-blue-700">{fmt(liveCurrentStrategy.afterTaxLegacy)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Lifetime Taxes</p>
                <p className="text-lg font-bold text-red-600">{fmt(liveCurrentStrategy.lifetimeTax)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Heir Tax Burden</p>
                <p className="text-lg font-bold text-red-500">{fmt(liveCurrentStrategy.heirTax)}</p>
              </div>
              {inputs.irmaaEnabled && liveCurrentStrategy.lifetimeIrmaa > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Lifetime IRMAA</p>
                  <p className="text-lg font-bold text-amber-600">{fmt(liveCurrentStrategy.lifetimeIrmaa)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Total Family Burden</p>
                <p className="text-lg font-bold text-red-700">{fmt(liveCurrentStrategy.totalBurden)}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <span className="text-orange-600">Trad: {fmt(liveCurrentStrategy.legacyBreakdown.traditional)}</span>
              <span className="text-mwm-green">Roth: {fmt(liveCurrentStrategy.legacyBreakdown.roth)}</span>
              <span className="text-purple-600">NQ: {fmt(liveCurrentStrategy.legacyBreakdown.nq)}</span>
              {liveCurrentStrategy.totalConversions > 0 && (
                <span className="text-teal-600">Conversions: {fmt(liveCurrentStrategy.totalConversions)}</span>
              )}
            </div>
          </div>
        )}

        {optimizerResult && !isOptimizing && (
          <div className="space-y-4">
            {/* Optimizer Recommendation */}
            <div className="border border-mwm-green/30 bg-mwm-green/5 rounded-lg p-4">
              <p className="text-xs text-mwm-green/80 uppercase font-semibold mb-3">Optimizer Recommendation: {optimizerResult.recommended.label}{targetOptimizeAge ? ` — Values at Age ${targetOptimizeAge}` : ''}</p>
              <div className={`grid grid-cols-2 ${inputs.irmaaEnabled && activeOptimizer.comparison.optimizedLifetimeIrmaa > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 text-center`}>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">{targetOptimizeAge ? `After-Tax at ${targetOptimizeAge}` : 'After-Tax Legacy'}</p>
                  <p className="text-lg font-bold text-mwm-green">{fmt(activeOptimizer.comparison.optimizedAfterTaxLegacy)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Lifetime Taxes</p>
                  <p className="text-lg font-bold text-mwm-green">{fmt(activeOptimizer.comparison.optimizedLifetimeTax)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Heir Tax Burden</p>
                  <p className="text-lg font-bold text-mwm-green">{fmt(activeOptimizer.comparison.optimizedTotalBurden - activeOptimizer.comparison.optimizedLifetimeTax - (activeOptimizer.comparison.optimizedLifetimeIrmaa || 0))}</p>
                </div>
                {inputs.irmaaEnabled && activeOptimizer.comparison.optimizedLifetimeIrmaa > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Lifetime IRMAA</p>
                    <p className="text-lg font-bold text-amber-600">{fmt(activeOptimizer.comparison.optimizedLifetimeIrmaa)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Total Family Burden</p>
                  <p className="text-lg font-bold text-mwm-green/80">{fmt(activeOptimizer.comparison.optimizedTotalBurden)}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <span className="text-orange-600">Trad: {fmt(activeOptimizer.comparison.optimizedLegacyBreakdown.traditional)}</span>
                <span className="text-mwm-green">Roth: {fmt(activeOptimizer.comparison.optimizedLegacyBreakdown.roth)}</span>
                <span className="text-purple-600">NQ: {fmt(activeOptimizer.comparison.optimizedLegacyBreakdown.nq)}</span>
              </div>
            </div>

            {/* Summary Cards */}
            <div className={`grid grid-cols-1 ${inputs.irmaaEnabled && activeOptimizer.comparison.optimizedLifetimeIrmaa > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
              <div className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Total Burden Savings</p>
                <p className={`text-xl font-bold ${activeOptimizer.comparison.totalBurdenSavings > 0 ? 'text-mwm-green/80' : 'text-slate-500'}`}>
                  {fmt(activeOptimizer.comparison.totalBurdenSavings)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Legacy Improvement</p>
                <p className={`text-xl font-bold ${activeOptimizer.comparison.afterTaxLegacyImprovement > 0 ? 'text-mwm-green/80' : 'text-slate-500'}`}>
                  +{fmt(activeOptimizer.comparison.afterTaxLegacyImprovement)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Total Roth Conversions</p>
                <p className="text-xl font-bold text-teal-600">{fmt(activeOptimizer.comparison.totalConversions)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">RMD Reduction</p>
                <p className={`text-xl font-bold ${activeOptimizer.comparison.rmdReduction > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                  {activeOptimizer.comparison.rmdReduction > 0 ? `-${fmt(activeOptimizer.comparison.rmdReduction)}` : '$0'}
                </p>
              </div>
              {inputs.irmaaEnabled && activeOptimizer.comparison.optimizedLifetimeIrmaa > 0 && (
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">IRMAA Impact</p>
                  <p className={`text-xl font-bold ${activeOptimizer.comparison.irmaaSavings > 0 ? 'text-mwm-green/80' : activeOptimizer.comparison.irmaaSavings < 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {activeOptimizer.comparison.irmaaSavings > 0 ? `-${fmt(activeOptimizer.comparison.irmaaSavings)}` : activeOptimizer.comparison.irmaaSavings < 0 ? `+${fmt(Math.abs(activeOptimizer.comparison.irmaaSavings))}` : '$0'}
                  </p>
                </div>
              )}
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyRecommended}
              className="flex items-center gap-1.5 px-4 py-2 bg-mwm-green text-white rounded-lg text-sm font-medium hover:bg-mwm-green/80 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Apply Recommended Strategy
            </button>

            {/* Conversion Strategies Compared */}
            {activeOptimizer.alternativeStrategies.length > 1 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Roth Conversion Strategies Compared</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-2 text-left">Conversion Strategy</th>
                        <th className="p-2 text-right">Lifetime Tax</th>
                        {inputs.irmaaEnabled && <th className="p-2 text-right">Lifetime IRMAA</th>}
                        <th className="p-2 text-right">After-Tax Legacy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOptimizer.alternativeStrategies.map((s, idx) => (
                        <tr key={idx} className={`border-b border-slate-100 ${idx === 0 ? 'bg-mwm-green/10 font-bold' : 'hover:bg-slate-50'}`}>
                          <td className="p-2 text-left text-slate-700">{idx === 0 && <span className="text-mwm-green mr-1">★</span>}{s.label}</td>
                          <td className="p-2 text-right text-red-600">{fmt(s.lifetimeTax)}</td>
                          {inputs.irmaaEnabled && <td className="p-2 text-right text-amber-600">{s.lifetimeIrmaa > 0 ? fmt(s.lifetimeIrmaa) : '-'}</td>}
                          <td className="p-2 text-right text-blue-700">{fmt(s.afterTaxLegacy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Year-by-Year Detail */}
            {activeOptimizer.yearDetails && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Optimized Year-by-Year Projection</h4>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-2 text-left">Age</th>
                        <th className="p-2 text-right">Roth Conv.</th>
                        <th className="p-2 text-right">RMD</th>
                        <th className="p-2 text-right">Tax</th>
                        <th className="p-2 text-right">Eff. Rate</th>
                        {inputs.irmaaEnabled && <th className="p-2 text-right">IRMAA</th>}
                        <th className="p-2 text-right">Trad Bal</th>
                        <th className="p-2 text-right">Roth Bal</th>
                        <th className="p-2 text-right">NQ Bal</th>
                        <th className="p-2 text-right">Unreal. CG</th>
                        <th className="p-2 text-right">CG Harvest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOptimizer.yearDetails.map((row) => (
                        <tr key={row.age} className={`border-b border-slate-50 hover:bg-slate-50 ${row.rothConversion > 0 ? 'bg-teal-50/50' : ''}`}>
                          <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                          <td className="p-2 text-right text-teal-600">{row.rothConversion > 0 ? fmt(row.rothConversion) : '-'}</td>
                          <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                          <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                          <td className="p-2 text-right text-mwm-gold/80">{row.effectiveRate}%</td>
                          {inputs.irmaaEnabled && <td className="p-2 text-right text-amber-600">{row.irmaaCost > 0 ? fmt(row.irmaaCost) : '-'}</td>}
                          <td className="p-2 text-right text-orange-500">{fmt(row.tradBalance)}</td>
                          <td className="p-2 text-right text-mwm-green">{fmt(row.rothBalance)}</td>
                          <td className="p-2 text-right text-purple-500">{fmt(row.nqBalance)}</td>
                          <td className="p-2 text-right text-amber-600">{row.nqUnrealizedGains > 0 ? fmt(row.nqUnrealizedGains) : '-'}</td>
                          <td className={`p-2 text-right ${row.nqStrategicRealization > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>{row.nqStrategicRealization > 0 ? fmt(row.nqStrategicRealization) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Capital Gains Rate Overrides — always visible */}
      <Card>
        <button onClick={() => setShowCapGains(!showCapGains)} className="w-full flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Realized Capital Gains Rate
            {hasActiveCapGains && <span className="text-xs font-normal text-purple-600">({inputs.nqCapGainOverrides.length} override{inputs.nqCapGainOverrides.length !== 1 ? 's' : ''})</span>}
          </h3>
          {showCapGains ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Default: <span className="font-semibold">{inputs.nqCapitalGainRate ?? 4}%</span> of NQ balance realized annually (fund distributions, rebalancing, turnover).
          Override specific year ranges to model tax-efficient fund selection or deferred rebalancing.
        </p>
        {showCapGains && (
          <div className="mt-3 space-y-3">
            {/* Existing overrides */}
            {hasActiveCapGains && (
              <>
                <div className="flex justify-end">
                  <button onClick={() => onCapGainOverrideChange([])} className="text-xs text-red-500 hover:underline">Clear All</button>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-2 text-left">From Year</th>
                      <th className="p-2 text-left">To Year</th>
                      <th className="p-2 text-right">Rate %</th>
                      <th className="p-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputs.nqCapGainOverrides.map((o, idx) => (
                      <tr key={idx} className="border-b border-slate-50 bg-purple-50/30">
                        <td className="p-2 text-left">
                          <input type="number" value={o.startYear} min={1} max={40}
                            onChange={(e) => {
                              const newOverrides = [...inputs.nqCapGainOverrides];
                              newOverrides[idx] = { ...newOverrides[idx], startYear: parseInt(e.target.value) || 1 };
                              onCapGainOverrideChange(newOverrides);
                            }}
                            className="w-14 text-center px-1 py-1 border rounded text-xs" />
                        </td>
                        <td className="p-2 text-left">
                          <input type="number" value={o.endYear} min={1} max={40}
                            onChange={(e) => {
                              const newOverrides = [...inputs.nqCapGainOverrides];
                              newOverrides[idx] = { ...newOverrides[idx], endYear: parseInt(e.target.value) || 1 };
                              onCapGainOverrideChange(newOverrides);
                            }}
                            className="w-14 text-center px-1 py-1 border rounded text-xs" />
                        </td>
                        <td className="p-2 text-right">
                          <input type="number" value={o.rate} min={0} max={20} step={0.5}
                            onChange={(e) => {
                              const newOverrides = [...inputs.nqCapGainOverrides];
                              newOverrides[idx] = { ...newOverrides[idx], rate: parseFloat(e.target.value) || 0 };
                              onCapGainOverrideChange(newOverrides);
                            }}
                            className="w-16 text-right px-2 py-1 border rounded text-xs" />
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => onCapGainOverrideChange(inputs.nqCapGainOverrides.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {/* Add new range */}
            <CapGainRangeAdder totalYears={projectionData.length} defaultRate={inputs.nqCapitalGainRate ?? 4} onAdd={(range) => {
              onCapGainOverrideChange([...(inputs.nqCapGainOverrides || []), range]);
            }} />
          </div>
        )}
      </Card>

      {/* IRMAA Medicare Surcharge Overlay */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Medicare IRMAA Surcharges
          </h3>
          <button
            onClick={() => onInputChange({ target: { name: 'irmaaEnabled', checked: !inputs.irmaaEnabled, type: 'checkbox' } })}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              inputs.irmaaEnabled
                ? 'bg-mwm-green text-white'
                : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
            }`}
          >
            {inputs.irmaaEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Income-Related Monthly Adjustment Amount — additional Medicare Part B & Part D premiums based on MAGI from 2 years prior.
          Roth conversions can push MAGI into higher IRMAA brackets.
        </p>
        {inputs.irmaaEnabled && projectionData.some(r => r.irmaaCost > 0) && (
          <div className="mt-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Lifetime IRMAA</p>
                <p className="text-base font-bold text-red-600">${projectionData.reduce((s, r) => s + (r.irmaaCost || 0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Peak Annual</p>
                <p className="text-base font-bold text-amber-600">${Math.max(...projectionData.map(r => r.irmaaCost || 0)).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Years with IRMAA</p>
                <p className="text-base font-bold text-slate-700">{projectionData.filter(r => r.irmaaCost > 0).length}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Bracket Headroom Table */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <TableIcon className="w-4 h-4" /> Bracket Analysis by Year
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                <th className="p-2 text-right">Taxable Income</th>
                <th className="p-2 text-right">Deduction</th>
                <th className="p-2 text-right">After Deduction</th>
                <th className="p-2 text-center">Bracket</th>
                <th className="p-2 text-right">Headroom</th>
                {hasRothConversions && <th className="p-2 text-right">Roth Conv.</th>}
                <th className="p-2 text-right">RMD</th>
                <th className="p-2 text-right">Total Tax</th>
                <th className="p-2 text-right">Eff. Rate</th>
                {inputs.irmaaEnabled && <th className="p-2 text-center">IRMAA</th>}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => {
                const bracketNum = parseFloat(row.currentBracket);
                const bracketColor = bracketNum <= 12 ? 'bg-mwm-green/20 text-mwm-emerald'
                  : bracketNum <= 22 ? 'bg-mwm-gold/20 text-mwm-gold/80'
                  : bracketNum <= 24 ? 'bg-orange-100 text-orange-800'
                  : 'bg-red-100 text-red-800';
                return (
                  <tr key={row.age} className={`border-b border-slate-50 hover:bg-slate-50 ${row.rothConversion > 0 ? 'bg-teal-50/30' : ''}`}>
                    <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                    <td className="p-2 text-right text-blue-600">{fmt(row.totalOrdinaryIncome)}</td>
                    <td className="p-2 text-right text-slate-500">{fmt(row.deduction)}</td>
                    <td className="p-2 text-right text-slate-700">{fmt(row.taxableAfterDeduction)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bracketColor}`}>{row.currentBracket}</span>
                    </td>
                    <td className="p-2 text-right text-mwm-green">{fmt(row.headroom)}</td>
                    {hasRothConversions && <td className="p-2 text-right text-teal-600">{row.rothConversion > 0 ? fmt(row.rothConversion) : '-'}</td>}
                    <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                    <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                    <td className="p-2 text-right text-mwm-gold/80">{row.effectiveRate}%</td>
                    {inputs.irmaaEnabled && (
                      <td className="p-2 text-center">
                        {row.irmaaBracket > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.irmaaBracket <= 1 ? 'bg-amber-100 text-amber-700'
                            : row.irmaaBracket <= 2 ? 'bg-orange-100 text-orange-700'
                            : row.irmaaBracket <= 3 ? 'bg-red-100 text-red-700'
                            : 'bg-red-200 text-red-800'
                          }`}>Tier {row.irmaaBracket}</span>
                        ) : <span className="text-slate-400 text-[10px]">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
