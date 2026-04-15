import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, ReferenceLine
} from 'recharts';
import { RefreshCw, TrendingUp, Shield, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

import { COLORS } from '../../../constants/colors';
import { runRebalancingComparison, runMonteCarloRebalancing } from '../../../utils/rebalancingEngine';
import { Card } from '../../ui';

const fmt = (val) => `$${Math.round(val).toLocaleString()}`;
const fmtK = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${Math.round(val / 1000)}k`;

const HISTORICAL_PERIODS = [
  { label: '2007-2012 (Great Recession)', startYear: 2007, years: 6 },
  { label: '2007-2017 (Recession + Recovery)', startYear: 2007, years: 11 },
  { label: '2000-2012 (Lost Decade)', startYear: 2000, years: 13 },
  { label: '2018-2024 (Recent Cycle)', startYear: 2018, years: 7 },
  { label: '2000-2024 (Full History)', startYear: 2000, years: 25 },
];

const PROJECTED_SCENARIOS = [
  { label: 'Optimistic (P90)', key: 'optimistic', color: '#10b981', years: 20 },
  { label: 'Median (P50)', key: 'median', color: '#3b82f6', years: 20 },
  { label: 'Conservative (P10)', key: 'conservative', color: '#f59e0b', years: 20 },
];

const ACTION_COLORS = {
  harvest: '#10b981',
  downturn_enter: '#ef4444',
  downturn_hold: '#f59e0b',
  recovery: '#3b82f6',
  scheduled: '#8b5cf6',
  none: 'transparent'
};

const ACTION_LABELS = {
  harvest: 'Gain Harvest',
  downturn_enter: 'Downturn Started',
  downturn_hold: 'Downturn Hold',
  recovery: 'Recovery',
  scheduled: 'Scheduled Rebalance',
  none: '-'
};

export const RebalancingTab = ({ inputs, basePlan, assumptions, projectionData }) => {
  const [selectedScenario, setSelectedScenario] = useState('historical-1');
  const [showDetails, setShowDetails] = useState(false);

  const annualWithdrawal = (inputs.monthlySpending || 5000) * 12;

  // Extract year-by-year withdrawal and surplus schedules from the actual plan projection
  const { withdrawalSchedule, surplusSchedule } = useMemo(() => {
    if (!projectionData || projectionData.length === 0) return { withdrawalSchedule: null, surplusSchedule: null };
    return {
      withdrawalSchedule: projectionData.map(r => r.distribution || 0),
      surplusSchedule: projectionData.map(r => r.surplus || 0)
    };
  }, [projectionData]);

  // Initial bucket allocation from base plan
  const initialBuckets = useMemo(() => ({
    b1: basePlan?.b1Val || inputs.totalPortfolio * 0.10,
    b2: basePlan?.b2Val || inputs.totalPortfolio * 0.12,
    b3: basePlan?.b3Val || inputs.totalPortfolio * 0.25,
    b4: basePlan?.b4Val || inputs.totalPortfolio * 0.10,
    b5: basePlan?.b5Val || inputs.totalPortfolio * 0.43,
  }), [basePlan, inputs.totalPortfolio]);

  const totalPortfolio = useMemo(() =>
    Object.values(initialBuckets).reduce((a, b) => a + b, 0),
  [initialBuckets]);

  // Parse which scenario is selected
  const isProjected = selectedScenario.startsWith('projected-');
  const historicalIdx = !isProjected ? parseInt(selectedScenario.split('-')[1]) : 0;
  const projectedKey = isProjected ? selectedScenario.split('-')[1] : null;

  // Historical comparison
  const historicalComparison = useMemo(() => {
    if (isProjected) return null;
    const period = HISTORICAL_PERIODS[historicalIdx];
    return runRebalancingComparison({
      initialBuckets,
      annualWithdrawal,
      withdrawalSchedule,
      surplusSchedule,
      startYear: period.startYear,
      years: period.years,
      assumptions,
      scheduledFreq: 3
    });
  }, [initialBuckets, annualWithdrawal, withdrawalSchedule, surplusSchedule, historicalIdx, assumptions, isProjected]);

  // Monte Carlo projected scenarios (computed once, cached)
  const mcResults = useMemo(() => {
    return runMonteCarloRebalancing({
      initialBuckets,
      annualWithdrawal,
      withdrawalSchedule,
      surplusSchedule,
      years: 20,
      assumptions,
      iterations: 500,
      scheduledFreq: 3
    });
  }, [initialBuckets, annualWithdrawal, withdrawalSchedule, surplusSchedule, assumptions]);

  // Active data based on selection
  const activeData = useMemo(() => {
    if (!isProjected && historicalComparison) {
      const period = HISTORICAL_PERIODS[historicalIdx];
      return {
        tactical: historicalComparison.tactical,
        scheduled: historicalComparison.scheduled,
        sequential: historicalComparison.sequential,
        label: period.label,
        years: period.years,
        isProjected: false
      };
    }
    if (isProjected && projectedKey && mcResults[projectedKey]) {
      const scenario = mcResults[projectedKey];
      return {
        tactical: scenario.tactical,
        scheduled: scenario.scheduled,
        sequential: null,
        label: scenario.label,
        years: 20,
        isProjected: true
      };
    }
    return null;
  }, [isProjected, historicalComparison, historicalIdx, mcResults, projectedKey]);

  if (!activeData) return null;

  // Chart data
  const chartData = activeData.tactical.map((t, idx) => {
    const s = activeData.scheduled[idx];
    const seq = activeData.sequential?.[idx];
    return {
      year: t.year,
      yearLabel: t.yearIndex === 0 ? 'Start' : (activeData.isProjected ? `Yr ${t.yearIndex}` : String(t.year)),
      tactical: t.endTotal,
      scheduled: s?.endTotal || 0,
      ...(seq ? { sequential: seq.endTotal } : {}),
      equityReturn: t.equityReturn,
      downturnMode: t.downturnMode,
      rebalanceAction: t.rebalanceAction
    };
  });

  // Bucket breakdown for tactical strategy
  const bucketData = activeData.tactical.map(t => ({
    year: t.year,
    yearLabel: t.yearIndex === 0 ? 'Start' : (activeData.isProjected ? `Yr ${t.yearIndex}` : String(t.year)),
    b1: t.b1, b2: t.b2, b3: t.b3, b4: t.b4, b5: t.b5,
    downturnMode: t.downturnMode
  }));

  const tacticalFinal = activeData.tactical[activeData.tactical.length - 1];
  const scheduledFinal = activeData.scheduled[activeData.scheduled.length - 1];
  const sequentialFinal = activeData.sequential?.[activeData.sequential.length - 1];

  const tacticalAdvantage = tacticalFinal.endTotal - scheduledFinal.endTotal;

  const harvestCount = activeData.tactical.filter(t => t.rebalanceAction === 'harvest').length;
  const downturnYears = activeData.tactical.filter(t => t.downturnMode).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-mwm-green" /> MWM Advanced Rebalancing Engine
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tactical portfolio harvesting vs. scheduled rebalancing — historical and projected scenarios
        </p>

        {/* Scenario selector */}
        <div className="mt-3">
          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">Historical Periods</p>
          <div className="flex flex-wrap gap-1.5">
            {HISTORICAL_PERIODS.map((p, idx) => (
              <button
                key={`h-${idx}`}
                onClick={() => setSelectedScenario(`historical-${idx}`)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  selectedScenario === `historical-${idx}`
                    ? 'bg-mwm-green text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5 mt-3">Projected Scenarios (Monte Carlo, 20 Years)</p>
          <div className="flex flex-wrap gap-1.5">
            {PROJECTED_SCENARIOS.map((s) => (
              <button
                key={`p-${s.key}`}
                onClick={() => setSelectedScenario(`projected-${s.key}`)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  selectedScenario === `projected-${s.key}`
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={selectedScenario === `projected-${s.key}` ? { backgroundColor: s.color } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Context bar */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span>Starting portfolio: <strong className="text-slate-700">{fmt(totalPortfolio)}</strong></span>
          <span>Annual withdrawal: <strong className="text-slate-700">
            {withdrawalSchedule ? 'Per plan projection' : fmt(annualWithdrawal)}
          </strong></span>
          <span>Scenario: <strong className="text-slate-700">{activeData.label}</strong></span>
        </div>
      </Card>

      {/* Comparison Summary */}
      <div className={`grid ${sequentialFinal ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
        <Card>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">MWM Tactical</p>
            <p className="text-2xl font-bold text-emerald-600">{fmtK(tacticalFinal.endTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">{harvestCount} harvests, {downturnYears} downturn yrs</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Scheduled (3-Yr)</p>
            <p className="text-2xl font-bold text-purple-600">{fmtK(scheduledFinal.endTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">Rebalance every 3 years</p>
          </div>
        </Card>
        {sequentialFinal && (
          <Card>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Sequential</p>
              <p className="text-2xl font-bold text-slate-500">{fmtK(sequentialFinal.endTotal)}</p>
              <p className="text-xs text-slate-400 mt-1">No rebalancing</p>
            </div>
          </Card>
        )}
        <Card>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Tactical Advantage</p>
            <p className={`text-2xl font-bold ${tacticalAdvantage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {tacticalAdvantage >= 0 ? '+' : ''}{fmtK(tacticalAdvantage)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalPortfolio > 0 ? `${((tacticalAdvantage / totalPortfolio) * 100).toFixed(1)}% of starting portfolio` : ''}
            </p>
          </div>
        </Card>
      </div>

      {/* Monte Carlo All-Scenarios Overview (when viewing a projected scenario) */}
      {isProjected && (
        <Card>
          <h3 className="font-semibold text-slate-800 text-base mb-3">Projected Outcomes — Tactical vs. Scheduled</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Scenario</th>
                <th className="p-2 text-right">Tactical Final</th>
                <th className="p-2 text-right">Scheduled Final</th>
                <th className="p-2 text-right">Tactical Edge</th>
                <th className="p-2 text-center">Downturn Years</th>
                <th className="p-2 text-center">Harvests</th>
              </tr>
            </thead>
            <tbody>
              {PROJECTED_SCENARIOS.map(s => {
                const mc = mcResults[s.key];
                if (!mc) return null;
                const tFinal = mc.tactical[mc.tactical.length - 1].endTotal;
                const sFinal = mc.scheduled[mc.scheduled.length - 1].endTotal;
                const edge = tFinal - sFinal;
                const dYrs = mc.tactical.filter(t => t.downturnMode).length;
                const hCount = mc.tactical.filter(t => t.rebalanceAction === 'harvest').length;
                const isActive = projectedKey === s.key;
                return (
                  <tr key={s.key} className={`border-b border-slate-50 ${isActive ? 'bg-slate-50 font-semibold' : ''}`}>
                    <td className="p-2 text-left">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </td>
                    <td className="p-2 text-right text-emerald-600">{fmtK(tFinal)}</td>
                    <td className="p-2 text-right text-purple-600">{fmtK(sFinal)}</td>
                    <td className={`p-2 text-right ${edge >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {edge >= 0 ? '+' : ''}{fmtK(edge)}
                    </td>
                    <td className="p-2 text-center text-amber-600">{dYrs}</td>
                    <td className="p-2 text-center text-emerald-600">{hCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Portfolio Value Comparison Chart */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3">Portfolio Value Over Time</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="yearLabel" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => [fmt(value), name]}
                labelFormatter={(label) => {
                  const row = chartData.find(d => d.yearLabel === label);
                  if (!row) return label;
                  const ret = row.equityReturn;
                  return activeData.isProjected
                    ? `${label} (Equity: ${ret > 0 ? '+' : ''}${ret?.toFixed(1)}%)`
                    : `${label} (S&P: ${ret > 0 ? '+' : ''}${ret?.toFixed(1)}%)`;
                }}
              />
              <Legend />
              <Line dataKey="tactical" stroke="#10b981" strokeWidth={2.5} name="MWM Tactical" dot={false} />
              <Line dataKey="scheduled" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Scheduled 3-Year" dot={false} />
              {!activeData.isProjected && (
                <Line dataKey="sequential" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" name="Sequential (No Rebalance)" dot={false} />
              )}
              {!activeData.isProjected && chartData.filter(d => d.rebalanceAction === 'downturn_enter').map(d => (
                <ReferenceLine key={`d-${d.year}`} x={d.yearLabel} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Downturn', position: 'top', fontSize: 9, fill: '#ef4444' }} />
              ))}
              {!activeData.isProjected && chartData.filter(d => d.rebalanceAction === 'recovery').map(d => (
                <ReferenceLine key={`r-${d.year}`} x={d.yearLabel} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Recovery', position: 'top', fontSize: 9, fill: '#3b82f6' }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-Bucket Performance (Tactical) */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3">Bucket Balances — Tactical Strategy</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bucketData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="yearLabel" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => fmt(value)} />
              <Legend />
              <Area type="monotone" dataKey="b1" stackId="1" fill={COLORS.shortTerm} stroke={COLORS.shortTerm} name="B1 - Liquidity" />
              <Area type="monotone" dataKey="b2" stackId="1" fill={COLORS.midTerm} stroke={COLORS.midTerm} name="B2 - Bridge" />
              <Area type="monotone" dataKey="b3" stackId="1" fill={COLORS.hedged} stroke={COLORS.hedged} name="B3 - Tactical Balanced" />
              <Area type="monotone" dataKey="b4" stackId="1" fill={COLORS.income} stroke={COLORS.income} name="B4 - Income & Growth" />
              <Area type="monotone" dataKey="b5" stackId="1" fill={COLORS.longTerm} stroke={COLORS.longTerm} name="B5 - Permanent Equity" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* MWM Framework Explanation */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> MWM Sequential Distribution Philosophy
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
            <h4 className="font-bold text-emerald-700 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Normal Markets
            </h4>
            <ul className="space-y-1 text-emerald-700">
              <li>When equity gains exceed projected returns, harvest the excess</li>
              <li>Refill B1 (Liquidity) and B2 (Bridge) to maintain 3-6 year spending coverage</li>
              <li>Preserve long-term equity positions for compounding</li>
              <li>Regular gain harvesting creates tax-efficient income events</li>
            </ul>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <h4 className="font-bold text-red-700 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Market Downturns
            </h4>
            <ul className="space-y-1 text-red-700">
              <li>Stop all equity sales immediately — do not rebalance out of equities</li>
              <li>Liquidate B1 (Liquidity) first, then B2 (Bridge) sequentially</li>
              <li>B1 + B2 provide 3-6 years of spending runway without touching equities</li>
              <li>Wait for B3-B5 recovery before resuming normal harvesting</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="font-bold text-blue-700 text-xs mb-1">Historical Example: 2007-2012</h4>
          <p className="text-xs text-blue-600">
            The S&P 500 fell 37% in 2008. A scheduled rebalancing approach would have forced selling equities at their lowest point.
            The MWM tactical approach instead liquidated B1 and B2 — preserving equity positions through the downturn.
            By 2012, equities had fully recovered, and the preserved equity positions grew back to pre-crisis levels.
            The result: higher portfolio value, no forced selling at the bottom, and sustained retirement income throughout.
          </p>
        </div>
      </Card>

      {/* Year-by-Year Detail Table */}
      <Card>
        <button onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            Year-by-Year Rebalancing Events
          </h3>
          {showDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showDetails && (
          <div className="mt-3 overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-2 text-left">{activeData.isProjected ? 'Year' : 'Year'}</th>
                  <th className="p-2 text-right">Equity Return</th>
                  <th className="p-2 text-right">Withdrawal</th>
                  <th className="p-2 text-right">Start</th>
                  <th className="p-2 text-right">End</th>
                  <th className="p-2 text-center">Mode</th>
                  <th className="p-2 text-center">Action</th>
                  <th className="p-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {activeData.tactical.map((row) => (
                  <tr key={row.year} className={`border-b border-slate-50 hover:bg-slate-50 ${
                    row.downturnMode ? 'bg-red-50/50' : row.rebalanceAction === 'harvest' ? 'bg-emerald-50/50' : ''
                  }`}>
                    <td className="p-2 text-left font-bold text-slate-700">
                      {row.yearIndex === 0 ? 'Start' : (activeData.isProjected ? `Yr ${row.yearIndex}` : row.year)}
                    </td>
                    <td className={`p-2 text-right font-mono ${row.equityReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.yearIndex === 0 ? '-' : `${row.equityReturn >= 0 ? '+' : ''}${row.equityReturn?.toFixed(1)}%`}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {row.yearIndex === 0 ? '-' : (
                        row.surplus > 0
                          ? <span className="text-emerald-600">+{fmtK(row.surplus)}</span>
                          : row.withdrawal > 0
                            ? <span className="text-red-500">({fmtK(row.withdrawal)})</span>
                            : <span className="text-slate-400">$0</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono">{fmtK(row.startTotal)}</td>
                    <td className="p-2 text-right font-mono">{fmtK(row.endTotal)}</td>
                    <td className="p-2 text-center">
                      {row.downturnMode ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Downturn</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Normal</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {row.rebalanceAction !== 'none' && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ backgroundColor: ACTION_COLORS[row.rebalanceAction] + '20', color: ACTION_COLORS[row.rebalanceAction] }}
                        >
                          {ACTION_LABELS[row.rebalanceAction]}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-left text-slate-400 text-[10px] max-w-[200px] truncate">{row.rebalanceDetail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
