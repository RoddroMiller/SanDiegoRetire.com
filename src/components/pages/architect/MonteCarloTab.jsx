import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Area,
  Line,
} from 'recharts';
import { Activity, Shield, TrendingUp } from 'lucide-react';
import { COLORS } from '../../../constants';
import { Card, StatBox } from '../../ui';

export const MonteCarloTab = ({ monteCarloData, rebalanceFreq, onSetRebalanceFreq, assumptions, vaEnabled, vaInputs, onToggleVa, onVaInputChange, vaMonteCarloData, inputs, basePlan, vaAdjustedBasePlan }) => {
  const [scenario, setScenario] = useState('median');
  const simYears = monteCarloData?.data?.length || 30;
  const startAge = basePlan?.simulationStartAge || 65;
  const finalProjectionAge = startAge + simYears;

  const vaAllocationAmount = vaInputs && vaEnabled
    ? (vaInputs.allocationType === 'percentage'
        ? inputs.totalPortfolio * (vaInputs.allocationPercent / 100)
        : Math.min(vaInputs.allocationFixed, inputs.totalPortfolio))
    : 0;

  const annualGuaranteedIncome = vaEnabled && vaInputs
    ? vaAllocationAmount * (vaInputs.withdrawalRate / 100)
    : 0;

  const fmt = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${Math.round(val).toLocaleString()}`;
  const fmtPct = (val) => `${(val * 100).toFixed(1)}%`;

  const bucketLabels = [
    { key: 'b1', rKey: 'r1', label: 'B1', name: 'Liquidity', color: COLORS.shortTerm },
    { key: 'b2', rKey: 'r2', label: 'B2', name: 'Bridge', color: COLORS.midTerm },
    { key: 'b3', rKey: 'r3', label: 'B3', name: 'Tactical Balanced', color: COLORS.hedged },
    { key: 'b4', rKey: 'r4', label: 'B4', name: 'Income & Growth', color: COLORS.income },
    { key: 'b5', rKey: 'r5', label: 'B5', name: 'Long Term Growth', color: COLORS.longTerm },
  ];

  const scenarioKey = scenario === 'optimistic' ? 'optimistic' : scenario === 'conservative' ? 'conservative' : 'median';
  const scenarioData = monteCarloData?.scenarios?.[scenarioKey] || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      {/* Controls Row */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
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
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <label className="text-[12px] font-bold text-slate-500 uppercase block mb-1">Scenario View</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="bg-white border text-xs font-bold rounded px-2 py-1 w-full"
            >
              <option value="optimistic">Optimistic (90th Percentile)</option>
              <option value="median">Median (50th Percentile)</option>
              <option value="conservative">Conservative (10th Percentile)</option>
            </select>
          </div>
          {/* VA GIB Toggle */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vaEnabled}
                onChange={(e) => onToggleVa(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-xs font-bold text-slate-600">VA GIB Override</span>
            </label>
            {vaEnabled && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Active</span>
            )}
          </div>
        </div>
      </Card>

      {/* VA GIB Inputs (collapsed into its own card when enabled) */}
      {vaEnabled && (
        <Card className="p-4 print:hidden border-l-4 border-purple-500">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">Allocation Type:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => onVaInputChange('allocationType', 'percentage')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'percentage' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Percentage</button>
                <button
                  onClick={() => onVaInputChange('allocationType', 'fixed')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'fixed' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Fixed $</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {vaInputs.allocationType === 'percentage' ? 'Allocation %' : 'Allocation $'}
                </label>
                <div className="relative">
                  {vaInputs.allocationType === 'fixed' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>}
                  {vaInputs.allocationType === 'percentage' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>}
                  <input type="number"
                    value={Number(vaInputs.allocationType === 'percentage' ? vaInputs.allocationPercent : vaInputs.allocationFixed)}
                    onChange={(e) => onVaInputChange(vaInputs.allocationType === 'percentage' ? 'allocationPercent' : 'allocationFixed', parseFloat(e.target.value) || 0)}
                    className={`w-full py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 ${vaInputs.allocationType === 'percentage' ? 'pl-2 pr-6' : 'pl-6 pr-2'}`}
                    min="0" max={vaInputs.allocationType === 'percentage' ? 100 : inputs.totalPortfolio}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Income Start Age</label>
                <input type="number" value={vaInputs.incomeStartAge || 65}
                  onChange={(e) => onVaInputChange('incomeStartAge', parseInt(e.target.value) || 65)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" min="55" max="85"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Withdrawal Rate</label>
                <div className="relative">
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  <input type="number" step="0.1" value={Number(vaInputs.withdrawalRate)}
                    onChange={(e) => onVaInputChange('withdrawalRate', parseFloat(e.target.value) || 0)}
                    className="w-full pl-2 pr-6 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" min="0" max="10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">High Water Mark</label>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={vaInputs.highWaterMark}
                    onChange={(e) => onVaInputChange('highWaterMark', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-600">Step-up benefit</span>
                </label>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-xs font-medium text-purple-700 mb-1">VA Summary</div>
                <div className="text-sm">
                  <div><strong>${vaAllocationAmount.toLocaleString()}</strong> allocated</div>
                  <div className="text-purple-700"><strong>${Math.round(annualGuaranteedIncome).toLocaleString()}</strong>/yr @ age {vaInputs.incomeStartAge || 65}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Success Rate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox
          label={vaEnabled ? "Success Rate (Without VA)" : "Success Rate"}
          value={`${monteCarloData.successRate.toFixed(1)}%`}
          subtext="Iterations ending > $0"
          icon={Activity}
          colorClass={monteCarloData.successRate >= 85 ? "bg-mwm-green" : monteCarloData.successRate >= 65 ? "bg-orange-500" : "bg-red-500"}
        />
        {vaEnabled && vaMonteCarloData && (
          <StatBox
            label="Success Rate (With VA GIB)"
            value={`${vaMonteCarloData.successRate.toFixed(1)}%`}
            subtext="With guaranteed income"
            icon={Shield}
            colorClass={vaMonteCarloData.successRate >= 85 ? "bg-purple-500" : vaMonteCarloData.successRate >= 65 ? "bg-orange-500" : "bg-red-500"}
          />
        )}
        <div className={`${vaEnabled ? '' : 'md:col-span-2'} bg-indigo-50 p-4 rounded-lg text-sm text-indigo-900 flex items-center`}>
          <p>
            <strong>Simulation:</strong> 1,000 iterations, Gaussian distribution.
            Strategy: <strong>{rebalanceFreq === 0 ? 'Sequential Depletion' : `Bucket Refill Every ${rebalanceFreq} Year${rebalanceFreq > 1 ? 's' : ''}`}</strong>.
            Viewing: <strong>{scenario === 'optimistic' ? '90th Percentile' : scenario === 'conservative' ? '10th Percentile' : 'Median'}</strong>.
          </p>
        </div>
      </div>

      {/* Year-by-Year Returns by Bucket — Representative Iteration */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4">
          Returns by Bucket — {scenario === 'optimistic' ? 'Optimistic (90th %)' : scenario === 'conservative' ? 'Conservative (10th %)' : 'Median (50th %)'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Year</th>
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Age</th>
                {bucketLabels.map(b => (
                  <th key={b.key} className="text-right p-2 font-bold" style={{ color: b.color }}>{b.label} - {b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarioData.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="p-2 font-medium text-slate-700 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{idx + 1}</td>
                  <td className="p-2 text-slate-600 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{startAge + idx + 1}</td>
                  {bucketLabels.map(b => {
                    const val = row[b.rKey] || 0;
                    return (
                      <td key={b.key} className={`p-2 text-right font-mono ${val >= 0 ? 'text-mwm-green/80' : 'text-red-600'}`}>
                        {fmtPct(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Year-by-Year Bucket Balances — Representative Iteration */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4">
          Bucket Balances by Year — {scenario === 'optimistic' ? 'Optimistic (90th %)' : scenario === 'conservative' ? 'Conservative (10th %)' : 'Median (50th %)'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Year</th>
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Age</th>
                {bucketLabels.map(b => (
                  <th key={b.key} className="text-right p-2 font-bold" style={{ color: b.color }}>{b.label} - {b.name}</th>
                ))}
                <th className="text-right p-2 font-bold text-slate-800">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenarioData.map((row, idx) => {
                const bucketTotal = bucketLabels.reduce((sum, b) => sum + (row[b.key] || 0), 0);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-2 font-medium text-slate-700 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{idx + 1}</td>
                    <td className="p-2 text-slate-600 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{startAge + idx + 1}</td>
                    {bucketLabels.map(b => (
                      <td key={b.key} className="p-2 text-right font-mono text-slate-700">
                        {fmt(row[b.key] || 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{fmt(bucketTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Monte Carlo Range Chart */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Portfolio Range (Through Age {finalProjectionAge})</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monteCarloData.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
              <Legend />
              <Area type="monotone" dataKey="p90" name="Upside (90th Percentile)" stroke="#166534" strokeWidth={2} fill={COLORS.midTerm} fillOpacity={0.3} />
              <Area type="monotone" dataKey="p10" name="Downside (10th Percentile)" stroke="#dc2626" strokeWidth={2} fill="white" fillOpacity={1} />
              <Line type="monotone" dataKey="median" name="Median Outcome" stroke={COLORS.longTerm} strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* VA Impact Summary when enabled */}
      {vaEnabled && vaMonteCarloData && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" /> VA GIB Impact Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Success Rate Change</div>
              <div className={`text-2xl font-bold ${vaMonteCarloData.successRate - monteCarloData.successRate >= 0 ? 'text-mwm-green' : 'text-red-600'}`}>
                {vaMonteCarloData.successRate - monteCarloData.successRate >= 0 ? '+' : ''}
                {(vaMonteCarloData.successRate - monteCarloData.successRate).toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Legacy Change</div>
              <div className={`text-2xl font-bold ${(vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0) >= 0 ? 'text-mwm-green' : 'text-red-600'}`}>
                {(vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0) >= 0 ? '+' : ''}
                ${Math.round((vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0)).toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">VA Allocation</div>
              <div className="text-2xl font-bold text-purple-600">${vaAllocationAmount.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Annual Guaranteed</div>
              <div className="text-2xl font-bold text-purple-600">${Math.round(annualGuaranteedIncome).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Monthly Guaranteed</div>
              <div className="text-2xl font-bold text-purple-600">${Math.round(annualGuaranteedIncome / 12).toLocaleString()}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
