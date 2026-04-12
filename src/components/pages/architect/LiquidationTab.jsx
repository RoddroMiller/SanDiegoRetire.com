import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import {
  BarChart2, CheckCircle, Loader, Layers, Target, Table as TableIcon
} from 'lucide-react';

import { Card } from '../../ui';

// ============================================
// Liquidation Strategy Tab
// ============================================
const LiquidationTab = ({ liquidationData, inputs, onInputChange, onAccountSplitChange }) => {
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;

  if (!inputs.taxEnabled) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Enable Tax Impact Analysis in Inputs to use the Liquidation Optimizer.</p>
        </div>
      </Card>
    );
  }

  if (!liquidationData) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          <Loader className="w-8 h-8 mx-auto mb-3 text-slate-300 animate-spin" />
          <p className="font-medium">Computing optimized liquidation strategy...</p>
        </div>
      </Card>
    );
  }

  const { summary, optimizedProjection, currentProjection, yearDetails, optimizedSplit, topStrategies, isCurrentOptimal } = liquidationData;

  // Build comparison chart data
  const comparisonData = currentProjection.map((curr, idx) => {
    const opt = optimizedProjection[idx];
    return { age: curr.age, currentTax: curr.totalTax || 0, optimizedTax: opt?.totalTax || 0,
      savings: (curr.totalTax || 0) - (opt?.totalTax || 0), currentBalance: curr.total || 0, optimizedBalance: opt?.total || 0 };
  });
  let cumSavings = 0;
  comparisonData.forEach(d => { cumSavings += d.savings; d.cumulativeSavings = cumSavings; });

  const handleApply = () => {
    if (inputs.accounts && inputs.accounts.length > 0) return; // Can't override when accounts drive percentages
    onAccountSplitChange('traditionalPercent', optimizedSplit.tradPct);
    // The handler auto-distributes the other two, but we need exact values
    // So set all three via onInputChange
    onInputChange({ target: { name: 'traditionalPercent', value: optimizedSplit.tradPct, type: 'number' } });
    onInputChange({ target: { name: 'rothPercent', value: optimizedSplit.rothPct, type: 'number' } });
    onInputChange({ target: { name: 'nqPercent', value: optimizedSplit.nqPct, type: 'number' } });
  };

  return (
    <div className="space-y-6">
      {/* Recommended Split */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" /> Optimal Distribution Split
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Tested {topStrategies.length > 0 ? '441' : '0'} static allocation splits to find the one that maximizes after-tax legacy for heirs.
          {isCurrentOptimal && <span className="text-mwm-green font-medium ml-1">Your current split is already optimal.</span>}
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-3">Current Split: {summary.currentSplit.tradPct}% Trad / {summary.currentSplit.rothPct}% Roth / {summary.currentSplit.nqPct}% NQ</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Lifetime Taxes</span><span className="font-medium text-red-600">{fmt(summary.currentLifetimeTax)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Heir Tax on Trad</span><span className="font-medium text-red-500">{fmt(summary.currentTotalTaxBurden - summary.currentLifetimeTax)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total Family Tax</span><span className="text-red-700">{fmt(summary.currentTotalTaxBurden)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs space-y-1">
              <div className="flex gap-3">
                <span className="text-orange-600">Trad: {fmt(summary.currentLegacyBreakdown.traditional)}</span>
                <span className="text-mwm-green">Roth: {fmt(summary.currentLegacyBreakdown.roth)}</span>
                <span className="text-purple-600">NQ: {fmt(summary.currentLegacyBreakdown.nq)}</span>
              </div>
              <p className="font-bold text-blue-700 text-sm">After-Tax Legacy: {fmt(summary.currentAfterTaxLegacy)}</p>
            </div>
          </div>
          <div className={`border rounded-lg p-4 ${isCurrentOptimal ? 'border-slate-200' : 'border-mwm-green/30 bg-mwm-green/10/30'}`}>
            <p className="text-xs text-mwm-green/80 uppercase font-semibold mb-3">
              Optimized: {optimizedSplit.tradPct}% Trad / {optimizedSplit.rothPct}% Roth / {optimizedSplit.nqPct}% NQ
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Lifetime Taxes</span><span className="font-medium text-mwm-green">{fmt(summary.optimizedLifetimeTax)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Heir Tax on Trad</span><span className="font-medium text-mwm-green">{fmt(summary.optimizedTotalTaxBurden - summary.optimizedLifetimeTax)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total Family Tax</span><span className="text-mwm-green/80">{fmt(summary.optimizedTotalTaxBurden)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs space-y-1">
              <div className="flex gap-3">
                <span className="text-orange-600">Trad: {fmt(summary.optimizedLegacyBreakdown.traditional)}</span>
                <span className="text-mwm-green">Roth: {fmt(summary.optimizedLegacyBreakdown.roth)}</span>
                <span className="text-purple-600">NQ: {fmt(summary.optimizedLegacyBreakdown.nq)}</span>
              </div>
              <p className="font-bold text-blue-700 text-sm">After-Tax Legacy: {fmt(summary.optimizedAfterTaxLegacy)}</p>
            </div>
          </div>
        </div>
        {!isCurrentOptimal && !(inputs.accounts && inputs.accounts.length > 0) && (
          <button onClick={handleApply} className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-mwm-green text-white rounded-lg text-sm font-medium hover:bg-mwm-green/80 transition-colors">
            <CheckCircle className="w-4 h-4" /> Apply {optimizedSplit.tradPct}/{optimizedSplit.rothPct}/{optimizedSplit.nqPct} Split
          </button>
        )}
      </Card>

      {/* Improvement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Family Tax Savings</p>
            <p className={`text-2xl font-bold ${summary.totalTaxSavings > 0 ? 'text-mwm-green/80' : summary.totalTaxSavings < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {summary.totalTaxSavings > 0 ? '' : summary.totalTaxSavings < 0 ? '-' : ''}{fmt(Math.abs(summary.totalTaxSavings))}
            </p>
            <p className="text-xs text-slate-500 mt-1">lifetime + heir tax combined</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">After-Tax Legacy Improvement</p>
            <p className={`text-2xl font-bold ${summary.afterTaxLegacyImprovement > 0 ? 'text-mwm-green/80' : summary.afterTaxLegacyImprovement < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {summary.afterTaxLegacyImprovement > 0 ? '+' : ''}{fmt(summary.afterTaxLegacyImprovement)}
            </p>
            <p className="text-xs text-slate-500 mt-1">what heirs actually receive</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Roth % of Legacy</p>
            <div className="flex justify-center gap-4 mt-1">
              <div>
                <p className="text-lg font-bold text-slate-600">{summary.currentLegacy > 0 ? Math.round((summary.currentLegacyBreakdown.roth / summary.currentLegacy) * 100) : 0}%</p>
                <p className="text-[10px] text-slate-400">Current</p>
              </div>
              <div className="text-slate-300">→</div>
              <div>
                <p className="text-lg font-bold text-mwm-green/80">{summary.optimizedLegacy > 0 ? Math.round((summary.optimizedLegacyBreakdown.roth / summary.optimizedLegacy) * 100) : 0}%</p>
                <p className="text-[10px] text-mwm-green">Optimized</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Strategies Table */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-1 flex items-center gap-2">
          <Target className="w-4 h-4" /> Top 10 Distribution Splits by After-Tax Legacy
        </h3>
        <p className="text-xs text-slate-500 mb-3">Heir tax estimated at {summary.heirTaxRate}% on inherited Traditional accounts (SECURE Act 10-year rule).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-center">#</th>
                <th className="p-2 text-right">Trad %</th>
                <th className="p-2 text-right">Roth %</th>
                <th className="p-2 text-right">NQ %</th>
                <th className="p-2 text-right">Lifetime Tax</th>
                <th className="p-2 text-right">Gross Legacy</th>
                <th className="p-2 text-right">After-Tax Legacy</th>
              </tr>
            </thead>
            <tbody>
              {topStrategies.map((s, idx) => {
                const isBest = s.tradPct === optimizedSplit.tradPct && s.rothPct === optimizedSplit.rothPct && s.nqPct === optimizedSplit.nqPct;
                const isCurrent = s.tradPct === (summary.currentSplit?.tradPct) && s.rothPct === (summary.currentSplit?.rothPct) && s.nqPct === (summary.currentSplit?.nqPct);
                return (
                  <tr key={idx} className={`border-b border-slate-100 ${isBest ? 'bg-mwm-green/10 font-bold' : 'hover:bg-slate-50'}`}>
                    <td className="p-2 text-center text-slate-400">{idx + 1}{isBest && <span className="text-mwm-green ml-1">★</span>}{isCurrent && <span className="text-blue-500 ml-1">●</span>}</td>
                    <td className="p-2 text-right text-orange-600">{s.tradPct}%</td>
                    <td className="p-2 text-right text-mwm-green">{s.rothPct}%</td>
                    <td className="p-2 text-right text-purple-600">{s.nqPct}%</td>
                    <td className="p-2 text-right text-red-600">{fmt(s.lifetimeTax)}</td>
                    <td className="p-2 text-right text-slate-600">{fmt(s.grossLegacy)}</td>
                    <td className="p-2 text-right text-blue-700 font-medium">{fmt(s.afterTaxLegacy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tax Comparison Chart */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> Annual Tax: Current vs. Optimized
        </h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(value, name) => [fmt(value), name]} labelFormatter={(l) => `Age ${l}`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="currentTax" fill="#f87171" name="Current Tax" barSize={8} />
              <Bar yAxisId="left" dataKey="optimizedTax" fill="#34d399" name="Optimized Tax" barSize={8} />
              <Line yAxisId="right" dataKey="cumulativeSavings" stroke="#6366f1" strokeWidth={2} name="Cumulative Savings" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Account Balance Trajectories */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" /> Optimized Account Balance Trajectories
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearDetails} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(value, name) => [fmt(value), name]} labelFormatter={(l) => `Age ${l}`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="tradBalance" stackId="bal" fill="#f97316" stroke="#f97316" name="Traditional" fillOpacity={0.6} />
              <Area dataKey="rothBalance" stackId="bal" fill="#34d399" stroke="#34d399" name="Roth" fillOpacity={0.6} />
              <Area dataKey="nqBalance" stackId="bal" fill="#a78bfa" stroke="#a78bfa" name="NQ" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Year-by-Year Detail */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <TableIcon className="w-4 h-4" /> Year-by-Year Projection ({optimizedSplit.tradPct}/{optimizedSplit.rothPct}/{optimizedSplit.nqPct} split)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                <th className="p-2 text-right">Distribution</th>
                <th className="p-2 text-right">Tax</th>
                <th className="p-2 text-right">Eff. Rate</th>
                <th className="p-2 text-right">RMD</th>
                <th className="p-2 text-right">Trad Bal</th>
                <th className="p-2 text-right">Roth Bal</th>
                <th className="p-2 text-right">NQ Bal</th>
              </tr>
            </thead>
            <tbody>
              {yearDetails.map((row) => (
                <tr key={row.age} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                  <td className="p-2 text-right text-slate-700">{fmt(row.distribution)}</td>
                  <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                  <td className="p-2 text-right text-mwm-gold/80">{row.effectiveRate}%</td>
                  <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                  <td className="p-2 text-right text-orange-500">{fmt(row.tradBalance)}</td>
                  <td className="p-2 text-right text-mwm-green">{fmt(row.rothBalance)}</td>
                  <td className="p-2 text-right text-purple-500">{fmt(row.nqBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export { LiquidationTab };
