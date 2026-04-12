import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  Activity, BarChart2, RefreshCw, RefreshCcw, Table as TableIcon
} from 'lucide-react';

import { COLORS, LOGO_URL } from '../../../constants';
import { calculateAnnualTax, calculateTaxableSS, calculateFederalTax, STATE_TAX_DATA } from '../../../utils';
import { Card, AllocationRow } from '../../ui';

export const AllocationTab = ({
  inputs, basePlan, assumptions, projectionData, monteCarloData, clientInfo,
  showCashFlowTable, onSetShowCashFlowTable, rebalanceFreq, onSetRebalanceFreq,
  showMonteCarlo, onSetShowMonteCarlo,
  useManualAllocation, manualAllocationMode, manualAllocations, manualPercentages,
  useManualForRebalance, onToggleManualAllocation, onToggleManualForRebalance,
  onManualAllocationChange, onManualAllocationModeChange,
  onRecalculateFromFormula, formulaAllocations,
  onInputChange, onAccountSplitChange, onWithdrawalOverrideChange
}) => {
  const [selectedTaxRow, setSelectedTaxRow] = useState(null);
  const [mcScenario, setMcScenario] = useState('median');

  // Compute tax detail when a row is selected
  const taxDetail = useMemo(() => {
    if (!selectedTaxRow || !inputs.taxEnabled) return null;
    const row = selectedTaxRow;

    // Use actual percentages from simulation row (supports per-year overrides)
    const tradPctVal = row.traditionalPctUsed ?? inputs.traditionalPercent ?? 60;
    const rothPctVal = row.rothPctUsed ?? inputs.rothPercent ?? 25;
    const nqPctVal = row.nqPctUsed ?? inputs.nqPercent ?? 15;
    const tradPct = tradPctVal / 100;
    const rothPct = rothPctVal / 100;
    const nqPct = nqPctVal / 100;

    const traditionalWithdrawal = row.distribution * tradPct;
    const rothWithdrawal = row.distribution * rothPct;
    const nqWithdrawal = row.distribution * nqPct;

    // NQ breakdown from simulation row
    const nqTaxableGain = row.nqTaxableGain || 0;
    const nqCostBasis = row.nqCostBasis || 0;
    const nqQualifiedDividends = row.nqQualifiedDividends || 0;
    const nqOrdinaryDividends = row.nqOrdinaryDividends || 0;

    const ssIncome = row.ssIncomeDetail || 0;
    const pensionIncome = row.pensionIncomeDetail || 0;
    const vaIncome = row.vaIncomeDetail || 0;
    const otherIncome = row.otherIncomeDetail || 0;
    const employmentIncome = row.employmentIncomeDetail || 0;
    const filingStatus = inputs.filingStatus || 'married';
    const stateRate = inputs.stateRate || 0;

    // Pension + VA treated as ordinary income in tax calc
    const pensionForTax = pensionIncome + vaIncome;

    // Step 1: Taxable SS (NQ ordinary dividends count as ordinary income)
    const ordinaryIncomeBeforeSS = pensionForTax + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;
    const taxableSS = calculateTaxableSS(ssIncome, ordinaryIncomeBeforeSS, filingStatus);

    // Determine SS tier
    const combinedIncome = ordinaryIncomeBeforeSS + (ssIncome * 0.5);
    const thresholds = filingStatus === 'married'
      ? { low: 32000, high: 44000 }
      : { low: 25000, high: 34000 };
    const ssTier = ssIncome <= 0 ? 'N/A' : combinedIncome <= thresholds.low ? '0%' : combinedIncome <= thresholds.high ? '50%' : '85%';

    // Step 2: Gross ordinary income (includes NQ ordinary dividends)
    const grossOrdinaryIncome = taxableSS + pensionForTax + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;

    // Step 3: Standard deduction
    const isSenior = row.age >= 65;
    const baseDeduction = filingStatus === 'married' ? 29200 : 14600;
    const seniorBonusPer = filingStatus === 'married' ? 1550 : 1950;
    const seniorBonus = isSenior ? (filingStatus === 'married' ? seniorBonusPer * 2 : seniorBonusPer) : 0;
    const totalDeduction = baseDeduction + seniorBonus;

    // Step 4: Taxable ordinary income
    const taxableOrdinaryIncome = Math.max(0, grossOrdinaryIncome - totalDeduction);

    // Step 5: Federal tax on ordinary income
    const federalOrdinaryTax = calculateFederalTax(taxableOrdinaryIncome, filingStatus);

    // Marginal bracket
    const brackets = filingStatus === 'married'
      ? [{ max: 23200, rate: 10 }, { max: 94300, rate: 12 }, { max: 201050, rate: 22 }, { max: 383900, rate: 24 }, { max: 487450, rate: 32 }, { max: 731200, rate: 35 }, { max: Infinity, rate: 37 }]
      : [{ max: 11600, rate: 10 }, { max: 47150, rate: 12 }, { max: 100525, rate: 22 }, { max: 191950, rate: 24 }, { max: 243725, rate: 32 }, { max: 609350, rate: 35 }, { max: Infinity, rate: 37 }];
    const marginalBracket = taxableOrdinaryIncome > 0
      ? (brackets.find(b => taxableOrdinaryIncome <= b.max)?.rate || 37)
      : 0;

    // Preferential income: NQ capital gains + NQ qualified dividends
    const totalPreferentialIncome = nqTaxableGain + nqQualifiedDividends;

    // Use calculateAnnualTax for the final numbers (ensures consistency)
    const taxResult = calculateAnnualTax({
      ssIncome,
      pensionIncome: pensionForTax,
      traditionalWithdrawal,
      rothWithdrawal,
      nqTaxableGain,
      nqQualifiedDividends,
      nqOrdinaryDividends,
      otherIncome
    }, { filingStatus, stateRate }, isSenior);

    return {
      ssIncome, pensionIncome, vaIncome, employmentIncome, otherIncome,
      traditionalWithdrawal, rothWithdrawal,
      traditionalPercent: tradPctVal,
      rothPercent: rothPctVal,
      nqPercent: nqPctVal,
      nqWithdrawal, nqCostBasis, nqTaxableGain, nqQualifiedDividends, nqOrdinaryDividends,
      totalPreferentialIncome,
      taxableSS, ssTier,
      grossOrdinaryIncome, baseDeduction, seniorBonus, totalDeduction, isSenior,
      taxableOrdinaryIncome, federalOrdinaryTax: Math.round(federalOrdinaryTax),
      marginalBracket,
      qdivTax: taxResult.qdivTax,
      totalFederalTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax: taxResult.totalTax,
      effectiveRate: taxResult.effectiveRate,
      filingStatus, stateRate
    };
  }, [selectedTaxRow, inputs]);

  return (
  <div className="mt-6 animate-in fade-in duration-300">
    <div className="flex justify-between items-start mb-4 hidden print:flex">
      <h2 className="text-2xl font-bold text-slate-900">Phase 2: Distribution Allocation</h2>
      <img src={LOGO_URL} alt="Logo" className="h-16" />
    </div>
    {/* Manual Allocation Toggle */}
    <Card className="p-4 mb-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useManualAllocation}
              onChange={(e) => onToggleManualAllocation(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-mwm-green focus:ring-mwm-green"
            />
            <span className="font-medium text-slate-700">Manual Allocation Override</span>
          </label>
          {useManualAllocation && (
            <span className="text-xs bg-mwm-gold/20 text-mwm-gold/80 px-2 py-1 rounded-full font-medium">
              Custom Mode
            </span>
          )}
        </div>
        {useManualAllocation && (
          <button
            onClick={onRecalculateFromFormula}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Recalculate from Formula
          </button>
        )}
      </div>

      {useManualAllocation && (
        <div className="mt-4 space-y-4">
          {/* Preset Models + Mode Toggle */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Preset Model Selector */}
            <div>
              <span className="text-sm font-medium text-slate-600 mr-2">Preset:</span>
              <select
                onChange={(e) => {
                  const tp = inputs.totalPortfolio || 1;
                  const presets = {
                    '': null,
                    'formula': { b1: formulaAllocations.b1Val, b2: formulaAllocations.b2Val, b3: formulaAllocations.b3Val, b4: formulaAllocations.b4Val, b5: formulaAllocations.b5Val },
                    '4pct': { b1: Math.round(tp * 0.125), b2: Math.round(tp * 0.125), b3: Math.round(tp * 0.225), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.425) },
                    '5pct': { b1: Math.round(tp * 0.175), b2: Math.round(tp * 0.175), b3: Math.round(tp * 0.25), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.30) },
                    'aggressive': { b1: 0, b2: 0, b3: Math.round(tp * 0.20), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.70) },
                    'barbell': { b1: Math.min(Math.round((inputs.monthlySpending || 0) * 12 * 3), tp), b2: 0, b3: 0, b4: 0, b5: Math.max(0, tp - Math.min(Math.round((inputs.monthlySpending || 0) * 12 * 3), tp)) },
                    'balanced': { b1: 0, b2: 0, b3: tp, b4: 0, b5: 0 },
                  };
                  const preset = presets[e.target.value];
                  if (preset) {
                    ['b1', 'b2', 'b3', 'b4', 'b5'].forEach(k => onManualAllocationChange(k, preset[k], 'dollar'));
                  }
                  e.target.value = '';
                }}
                className="bg-white border text-xs font-bold rounded px-2 py-1.5"
                defaultValue=""
              >
                <option value="" disabled>Select a model...</option>
                <option value="formula">Formula (Calculated)</option>
                <option value="4pct">4% Model</option>
                <option value="5pct">5.5% Model</option>
                <option value="aggressive">Aggressive Growth</option>
                <option value="barbell">Barbell Strategy</option>
                <option value="balanced">Tactical Balanced</option>
              </select>
            </div>

            <span className="text-sm font-medium text-slate-600">Input Mode:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => onManualAllocationModeChange('dollar')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  manualAllocationMode === 'dollar'
                    ? 'bg-mwm-green text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Dollar $
              </button>
              <button
                onClick={() => onManualAllocationModeChange('percentage')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  manualAllocationMode === 'percentage'
                    ? 'bg-mwm-green text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Percentage %
              </button>
            </div>

            {/* Rebalance Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useManualForRebalance}
                onChange={(e) => onToggleManualForRebalance(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-mwm-green focus:ring-mwm-green"
              />
              <span className="text-sm text-slate-600">Use for Rebalancing</span>
              {useManualForRebalance && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Active
                </span>
              )}
            </label>
          </div>

          {/* Allocation Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { key: 'b1', label: 'B1 Liquidity', color: COLORS.shortTerm },
              { key: 'b2', label: 'B2 Bridge', color: COLORS.midTerm },
              { key: 'b3', label: 'B3 Tactical Balanced', color: COLORS.hedged },
              { key: 'b4', label: 'B4 Inc & Grth', color: COLORS.income },
              { key: 'b5', label: 'B5 LT Growth', color: COLORS.longTerm },
            ].map(({ key, label, color }) => (
              <div key={key} className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }}></span>
                  {label}
                </label>
                <div className="relative">
                  {manualAllocationMode === 'dollar' && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  )}
                  {manualAllocationMode === 'percentage' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  )}
                  <input
                    type="number"
                    step={manualAllocationMode === 'percentage' ? '0.1' : '1000'}
                    value={manualAllocationMode === 'percentage'
                      ? Number((manualPercentages[key] || 0).toFixed(1))
                      : Math.round(manualAllocations[key])}
                    onChange={(e) => onManualAllocationChange(key, parseFloat(e.target.value) || 0, manualAllocationMode)}
                    className={`w-full py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-mwm-green focus:border-mwm-green ${
                      manualAllocationMode === 'dollar' ? 'pl-5 pr-2' : 'pl-2 pr-6'
                    }`}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {manualAllocationMode === 'percentage'
                    ? `$${Math.round(manualAllocations[key]).toLocaleString()}`
                    : `${((manualAllocations[key] / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}%`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {useManualAllocation && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Total: <span className="font-bold">${(manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5).toLocaleString()}</span>
            <span className="text-slate-400 ml-2">
              ({(((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}%)
            </span>
          </span>
          <span className={`font-medium ${Math.abs((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio) < 1 ? 'text-green-600' : 'text-mwm-gold'}`}>
            {Math.abs((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio) < 1
              ? '✓ Matches portfolio'
              : `Difference: $${((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio).toLocaleString()}`}
          </span>
        </div>
      )}
    </Card>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="p-6 flex flex-col justify-center">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Target Allocation {useManualAllocation && <span className="text-xs font-normal text-mwm-gold">(Manual)</span>}</h3>
        <div className="h-64 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Liquidity', value: basePlan.b1Val, color: COLORS.shortTerm },
                  { name: 'Bridge', value: basePlan.b2Val, color: COLORS.midTerm },
                  { name: 'Tactical Balanced', value: basePlan.b3Val, color: COLORS.hedged },
                  { name: 'Inc & Grth', value: basePlan.b4Val, color: COLORS.income },
                  { name: 'Long Term Growth', value: Math.max(0, basePlan.b5Val), color: COLORS.longTerm },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                <Cell fill={COLORS.shortTerm} />
                <Cell fill={COLORS.midTerm} />
                <Cell fill={COLORS.hedged} />
                <Cell fill={COLORS.income} />
                <Cell fill={COLORS.longTerm} />
              </Pie>
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <AllocationRow
            color={COLORS.shortTerm} name="1. Liquidity"
            amount={basePlan.b1Val} percent={((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b1.return} stdDev={assumptions.b1.stdDev}
            historicalReturn={assumptions.b1.historical}
            description="Immediate liquidity buffer (Years 1-3)."
          />
          <AllocationRow
            color={COLORS.midTerm} name="2. Bridge"
            amount={basePlan.b2Val} percent={((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b2.return} stdDev={assumptions.b2.stdDev}
            historicalReturn={assumptions.b2.historical}
            description="Conservative growth bridge (Years 4-6)."
          />
          <AllocationRow
            color={COLORS.hedged} name="3. Tactical Balanced"
            amount={basePlan.b3Val} percent={((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b3.return} stdDev={assumptions.b3.stdDev}
            historicalReturn={assumptions.b3.historical}
            description="Moderate risk for intermediate needs (Years 7-14)."
          />
          <AllocationRow
            color={COLORS.income} name="4. Income & Growth"
            amount={basePlan.b4Val} percent={((basePlan.b4Val / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}
            returnRate={assumptions.b4.return} stdDev={assumptions.b4.stdDev}
            historicalReturn={assumptions.b4.historical}
            description={basePlan.b4Val > 0 ? "Income & dividends/yield allocation." : "No allocation — portfolio prioritized for spending needs."}
          />
          <AllocationRow
            color={COLORS.longTerm} name="5. Long Term Growth"
            amount={basePlan.b5Val} percent={((basePlan.b5Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b5.return} stdDev={assumptions.b5.stdDev}
            historicalReturn={assumptions.b5.historical}
            description="Growth engine for longevity protection."
          />
        </div>
      </Card>
    </div>

    <Card className="p-6 mt-6 print:hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Portfolio Sustainability</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => onSetShowCashFlowTable(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${!showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <BarChart2 className="w-3 h-3" /> Chart
            </button>
            <button
              onClick={() => onSetShowCashFlowTable(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <TableIcon className="w-3 h-3" /> Table
            </button>
          </div>
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <label className="text-[12px] font-bold text-slate-500 uppercase block mb-1">Rebalance Frequency</label>
            <select
              value={rebalanceFreq}
              onChange={(e) => onSetRebalanceFreq(parseInt(e.target.value))}
              className="bg-white border text-xs font-bold rounded px-2 py-1 w-full"
            >
              <option value={0}>Sequential (No Rebalance)</option>
              <option value={1}>Annual Rebalance</option>
              <option value={3}>Every 3 Years</option>
              <option value={6}>Every 6 Years</option>
            </select>
          </div>
          <label className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMonteCarlo}
              onChange={(e) => onSetShowMonteCarlo(e.target.checked)}
              className="accent-blue-600"
            />
            <span className="text-xs font-bold text-slate-600">Monte Carlo</span>
          </label>
        </div>
      </div>

      {!showCashFlowTable ? (
        <>
          {showMonteCarlo && monteCarloData ? (() => {
            const mcChartData = (monteCarloData.data || []).map((mc, idx) => ({
              year: mc.year,
              p90: Math.round(mc.p90),
              median: Math.round(mc.median),
              p10: Math.round(mc.p10),
              total: projectionData[idx]?.total || 0,
              benchmark: projectionData[idx]?.benchmark || 0,
            }));
            return (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Success Rate:</span>
                    <span className={`font-bold text-lg ${monteCarloData.successRate >= 90 ? 'text-mwm-green' : monteCarloData.successRate >= 75 ? 'text-mwm-gold' : 'text-red-600'}`}>
                      {monteCarloData.successRate?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Median Legacy:</span>
                    <span className="font-bold text-lg text-slate-800">${(monteCarloData.medianLegacy || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mcChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
                      <Tooltip
                        formatter={(val, name) => `$${Math.round(val).toLocaleString()}`}
                        labelFormatter={(l) => `Year ${l}`}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="p90" name="90th Percentile (Optimistic)" fill="#d1fae5" stroke="#10b981" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="median" name="50th Percentile (Median)" fill="#bfdbfe" stroke="#3b82f6" fillOpacity={0.5} />
                      <Area type="monotone" dataKey="p10" name="10th Percentile (Pessimistic)" fill="#fee2e2" stroke="#ef4444" fillOpacity={0.4} />
                      <Line type="monotone" dataKey="total" name="Deterministic Projection" stroke={COLORS.areaFill} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40" stroke={COLORS.benchmark} strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-3 bg-blue-50 text-xs text-blue-800 rounded border border-blue-100 flex items-start gap-2">
                  <Activity className="w-4 h-4 mt-0.5" />
                  <p>
                    <strong>Monte Carlo Simulation (1,000 iterations):</strong> Shows range of outcomes using randomized returns based on each bucket's expected return and standard deviation. <br />
                    <strong>Green Area:</strong> 90th percentile (best 10% of outcomes). <strong>Blue Area:</strong> Median outcome. <strong>Red Area:</strong> 10th percentile (worst 10%). <br />
                    <strong>Dashed Grey Line:</strong> Deterministic projection (fixed returns, no randomness).
                  </p>
                </div>
              </>
            );
          })() : (
            <>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(val, name) => {
                        if (name === 'Distribution Rate') return `${val.toFixed(2)}%`;
                        return `$${Math.round(val).toLocaleString()}`;
                      }}
                      labelFormatter={(l) => `Year ${l}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="total" name="Miller Portfolio Architect Strategy" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
                    <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40 (Annual Rebalance)" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-mwm-gold/10 text-xs text-mwm-gold/80 rounded border border-mwm-gold/20 flex items-start gap-2">
                <Activity className="w-4 h-4 mt-0.5" />
                <p>
                  <strong>Grey Area:</strong> Miller Portfolio Architect Strategy - dynamic bucket allocation optimized for retirement income. <br />
                  <strong>Gold Line:</strong> Benchmark 60/40 with annual rebalance for comparison. <br />
                  <strong>Red Line:</strong> Distribution rate - annual withdrawal as % of portfolio.
                </p>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="overflow-x-auto">
          {showMonteCarlo && monteCarloData?.scenarios && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Scenario:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setMcScenario('optimistic')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'optimistic' ? 'bg-mwm-green text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Optimistic
                </button>
                <button
                  onClick={() => setMcScenario('median')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'median' ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Median
                </button>
                <button
                  onClick={() => setMcScenario('conservative')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'conservative' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Conservative
                </button>
              </div>
              <span className="text-xs text-slate-400 italic">
                {mcScenario === 'optimistic' ? '90th percentile — better than 90% of simulated outcomes'
                  : mcScenario === 'conservative' ? '10th percentile — worse than only 10% of simulated outcomes'
                  : '50th percentile — the most likely outcome'}
              </span>
            </div>
          )}
          {(() => {
            const tableData = (showMonteCarlo && monteCarloData?.scenarios)
              ? (monteCarloData.scenarios[mcScenario] || [])
              : projectionData;
            return (
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-2 text-left">Age</th>
                    {clientInfo.isMarried && <th className="p-2 text-left">Partner Age</th>}
                    <th className="p-2">Start Balance</th>
                    <th className="p-2 text-mwm-green">Growth</th>
                    <th className="p-2 text-purple-600">Contribution</th>
                    <th className="p-2 text-blue-600">Income</th>
                    <th className="p-2 text-orange-600">Withdrawal</th>
                    {inputs.taxEnabled && <th className="p-2 text-red-600">Est. Tax</th>}
                    <th className="p-2 text-slate-800">{inputs.taxEnabled ? 'Gross Spend' : 'Total Spend'}</th>
                    {inputs.taxEnabled && <th className="p-2 text-slate-600">Net Spend</th>}
                    <th className="p-2 text-slate-900">End Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row) => (
                    <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                      {clientInfo.isMarried && <td className="p-2 text-left text-slate-500">{Math.floor(row.partnerAge || 0)}</td>}
                      <td className="p-2 text-slate-500">${(row.startBalance || 0).toLocaleString()}</td>
                      <td className={`p-2 ${(row.growth || 0) >= 0 ? 'text-mwm-green' : 'text-red-600'}`}>{(row.growth || 0) >= 0 ? `+$${(row.growth || 0).toLocaleString()}` : `($${Math.abs(row.growth || 0).toLocaleString()})`}</td>
                      <td className="p-2 text-purple-600">{(row.contribution || 0) > 0 ? `+$${row.contribution.toLocaleString()}` : '-'}</td>
                      <td className="p-2 text-blue-600" title={`SS: $${(row.ssIncomeDetail || 0).toLocaleString()} | Pension: $${(row.pensionIncomeDetail || 0).toLocaleString()}${row.employmentIncomeDetail ? ` | Employment: $${row.employmentIncomeDetail.toLocaleString()}` : ''}${row.otherIncomeDetail ? ` | Other: $${row.otherIncomeDetail.toLocaleString()}` : ''}`}>
                        +${(row.ssIncome || 0).toLocaleString()}
                        {(row.employmentIncomeDetail || 0) > 0 && <span className="text-teal-600 text-[10px] ml-0.5" title="Includes employment income">*</span>}
                      </td>
                      <td className="p-2 text-orange-600">-${(row.distribution || 0).toLocaleString()}</td>
                      {inputs.taxEnabled && (
                        <td
                          className="p-2 text-red-600 cursor-pointer hover:bg-red-50 hover:underline transition-colors"
                          title={`Federal: $${(row.federalTax || 0).toLocaleString()} | State: $${(row.stateTax || 0).toLocaleString()} | Eff: ${row.effectiveRate || '0'}% — Click for detail`}
                          onClick={() => setSelectedTaxRow(row)}
                        >
                          -${(row.totalTax || 0).toLocaleString()}
                        </td>
                      )}
                      <td className="p-2 font-medium text-slate-800">${(row.expenses || 0).toLocaleString()}</td>
                      {inputs.taxEnabled && (
                        <td className="p-2 text-slate-600">${Math.max(0, (row.expenses || 0) - (row.totalTax || 0)).toLocaleString()}</td>
                      )}
                      <td className={`p-2 font-bold ${(row.total || 0) > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
          {inputs.taxEnabled && (
            <div className="mt-3 p-2 bg-mwm-gold/10 text-xs text-mwm-gold/80 rounded border border-mwm-gold/20">
              <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} status, {inputs.traditionalPercent}% Trad / {inputs.rothPercent}% Roth / {inputs.nqPercent}% NQ, {inputs.stateCode && STATE_TAX_DATA[inputs.stateCode] ? `${STATE_TAX_DATA[inputs.stateCode].name} (${STATE_TAX_DATA[inputs.stateCode].rate}%${STATE_TAX_DATA[inputs.stateCode].ssTaxable ? ', taxes SS' : ', SS exempt'})` : `${inputs.stateRate}% state rate`}.{Object.keys(inputs.withdrawalOverrides || {}).length > 0 ? ` ${Object.keys(inputs.withdrawalOverrides).length} custom year override(s) applied.` : ''} Hover over tax amounts for breakdown. Click for detail.
            </div>
          )}
        </div>
      )}
    </Card>

    {/* Tax Detail Modal */}
    {selectedTaxRow && taxDetail && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTaxRow(null)}>
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
            <h3 className="font-bold text-lg text-slate-800">Tax Estimate Detail — Age {selectedTaxRow.age}</h3>
            <button onClick={() => setSelectedTaxRow(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <div className="p-4 space-y-4 text-sm">
            {/* Income Sources */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Income Sources</h4>
              <table className="w-full text-sm">
                <tbody>
                  {taxDetail.ssIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Social Security</td><td className="py-1 text-right font-medium">${taxDetail.ssIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.pensionIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Pension</td><td className="py-1 text-right font-medium">${taxDetail.pensionIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.vaIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">VA Income</td><td className="py-1 text-right font-medium">${taxDetail.vaIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.employmentIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Employment</td><td className="py-1 text-right font-medium">${taxDetail.employmentIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.otherIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Other Income</td><td className="py-1 text-right font-medium">${taxDetail.otherIncome.toLocaleString()}</td></tr>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">Portfolio Withdrawal</td>
                    <td className="py-1 text-right font-medium">${selectedTaxRow.distribution.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 pl-4 text-slate-500 text-xs">Traditional ({taxDetail.traditionalPercent}%)</td>
                    <td className="py-1 text-right text-xs">${Math.round(taxDetail.traditionalWithdrawal).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 pl-4 text-slate-500 text-xs">Roth ({taxDetail.rothPercent}%) — tax-free</td>
                    <td className="py-1 text-right text-xs text-mwm-green">${Math.round(taxDetail.rothWithdrawal).toLocaleString()}</td>
                  </tr>
                  {taxDetail.nqPercent > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-4 text-slate-500 text-xs">NQ ({taxDetail.nqPercent}%)</td>
                        <td className="py-1 text-right text-xs">${Math.round(taxDetail.nqWithdrawal).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Realized Cap Gains (LTCG)</td>
                        <td className="py-1 text-right text-[11px] text-red-500">${Math.round(taxDetail.nqTaxableGain).toLocaleString()}</td>
                      </tr>
                    </>
                  )}
                  {(taxDetail.nqQualifiedDividends > 0 || taxDetail.nqOrdinaryDividends > 0) && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">NQ Dividends (annual)</td>
                        <td className="py-1 text-right font-medium">${(taxDetail.nqQualifiedDividends + taxDetail.nqOrdinaryDividends).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Qualified (LTCG rates)</td>
                        <td className="py-1 text-right text-[11px]">${taxDetail.nqQualifiedDividends.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Ordinary (marginal rate)</td>
                        <td className="py-1 text-right text-[11px]">${taxDetail.nqOrdinaryDividends.toLocaleString()}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tax Calculation Steps */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Tax Calculation</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">1. Taxable Social Security</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.taxableSS).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400 w-20">{taxDetail.ssTier} tier</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">2. Gross Ordinary Income</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.grossOrdinaryIncome).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">3. Standard Deduction</td>
                    <td className="py-1 text-right font-medium text-mwm-green">-${taxDetail.totalDeduction.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">{taxDetail.isSenior ? `+$${taxDetail.seniorBonus.toLocaleString()} senior` : ''}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">4. Taxable Ordinary Income</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.taxableOrdinaryIncome).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">5. Federal Tax (ordinary)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.federalOrdinaryTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">{taxDetail.marginalBracket}% bracket</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">6. Preferential Tax (LTCG/QDiv)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.qdivTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">pref. rate</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">7. Total Federal Tax</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.totalFederalTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">8. State Tax ({taxDetail.stateRate}%)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.stateTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="py-1.5 font-bold text-slate-800">9. Total Estimated Tax</td>
                    <td className="py-1.5 text-right font-bold text-red-700">${taxDetail.totalTax.toLocaleString()}</td>
                    <td className="py-1.5 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-1.5 font-bold text-slate-800">10. Effective Rate</td>
                    <td className="py-1.5 text-right font-bold text-red-700">{taxDetail.effectiveRate}%</td>
                    <td className="py-1.5 pl-2 text-xs text-slate-400"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Assumptions footnote */}
            <div className="p-2 bg-slate-50 text-xs text-slate-500 rounded border border-slate-100">
              <strong>Assumptions:</strong> {taxDetail.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} filing status, {taxDetail.traditionalPercent}% Traditional / {taxDetail.rothPercent}% Roth / {taxDetail.nqPercent}% NQ, {taxDetail.stateRate}% state tax rate{taxDetail.isSenior ? ', 65+ senior deduction applied' : ''}.
            </div>
          </div>
        </div>
      </div>
    )}

  </div>
  );
};

export const WithdrawalOverrideModal = ({ projectionData, inputs, onWithdrawalOverrideChange, onClose }) => {
  const [rangeFrom, setRangeFrom] = useState(projectionData[0]?.age || 65);
  const [rangeTo, setRangeTo] = useState(projectionData[Math.min(7, projectionData.length - 1)]?.age || 72);
  const [rangeTrad, setRangeTrad] = useState(inputs.traditionalPercent);
  const [rangeRoth, setRangeRoth] = useState(inputs.rothPercent);
  const [rangeNq, setRangeNq] = useState(inputs.nqPercent);

  const handleOverrideEdit = (age, field, newValue) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
    const override = inputs.withdrawalOverrides?.[age] || {
      traditionalPercent: inputs.traditionalPercent,
      rothPercent: inputs.rothPercent,
      nqPercent: inputs.nqPercent
    };
    const fields = ['traditionalPercent', 'rothPercent', 'nqPercent'];
    const otherFields = fields.filter(f => f !== field);
    const remainder = 100 - clamped;
    const otherSum = override[otherFields[0]] + override[otherFields[1]];
    let val1, val2;
    if (otherSum === 0) {
      val1 = Math.round(remainder / 2);
      val2 = remainder - val1;
    } else {
      val1 = Math.round((override[otherFields[0]] / otherSum) * remainder);
      val2 = remainder - val1;
    }
    onWithdrawalOverrideChange(age, { ...override, [field]: clamped, [otherFields[0]]: val1, [otherFields[1]]: val2 });
  };

  const applyRange = () => {
    if (rangeTrad + rangeRoth + rangeNq !== 100) return;
    for (let age = rangeFrom; age <= rangeTo; age++) {
      const row = projectionData.find(r => r.age === age);
      if (row) {
        onWithdrawalOverrideChange(age, { traditionalPercent: rangeTrad, rothPercent: rangeRoth, nqPercent: rangeNq });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="font-bold text-lg text-slate-800">Withdrawal Strategy by Year</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onWithdrawalOverrideChange('__reset_all__')}
              className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors"
            >
              Reset All
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Range Applier */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">From Age</label>
              <input type="number" value={rangeFrom} onChange={e => setRangeFrom(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">To Age</label>
              <input type="number" value={rangeTo} onChange={e => setRangeTo(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">Trad %</label>
              <input type="number" value={rangeTrad} onChange={e => setRangeTrad(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">Roth %</label>
              <input type="number" value={rangeRoth} onChange={e => setRangeRoth(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">NQ %</label>
              <input type="number" value={rangeNq} onChange={e => setRangeNq(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <button
              onClick={applyRange}
              disabled={rangeTrad + rangeRoth + rangeNq !== 100}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rangeTrad + rangeRoth + rangeNq === 100
                  ? 'bg-mwm-green text-white hover:bg-mwm-green/80'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Apply Range
            </button>
            <span className={`text-[10px] font-medium ${rangeTrad + rangeRoth + rangeNq === 100 ? 'text-mwm-green' : 'text-red-500'}`}>
              Sum: {rangeTrad + rangeRoth + rangeNq}%
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                <th className="p-2">Est. Income</th>
                <th className="p-2">Eff. Rate</th>
                <th className="p-2">Est. Tax</th>
                <th className="p-2">Trad %</th>
                <th className="p-2">Roth %</th>
                <th className="p-2">NQ %</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map(row => {
                const override = inputs.withdrawalOverrides?.[row.age];
                const tradPct = override?.traditionalPercent ?? inputs.traditionalPercent;
                const rothPct = override?.rothPercent ?? inputs.rothPercent;
                const nqPct = override?.nqPercent ?? inputs.nqPercent;
                const isOverridden = !!override;

                return (
                  <tr key={row.age} className={`border-b border-slate-50 transition-colors ${isOverridden ? 'bg-mwm-gold/10' : 'hover:bg-slate-50'}`}>
                    <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                    <td className="p-2 text-blue-600">${row.ssIncome.toLocaleString()}</td>
                    <td className="p-2 text-slate-600">{row.effectiveRate || '0.0'}%</td>
                    <td className="p-2 text-red-600">${(row.totalTax || 0).toLocaleString()}</td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={tradPct}
                        onChange={e => handleOverrideEdit(row.age, 'traditionalPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={rothPct}
                        onChange={e => handleOverrideEdit(row.age, 'rothPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={nqPct}
                        onChange={e => handleOverrideEdit(row.age, 'nqPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      {isOverridden && (
                        <button
                          onClick={() => onWithdrawalOverrideChange(row.age, null)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Reset to default"
                        >
                          <RefreshCcw className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
