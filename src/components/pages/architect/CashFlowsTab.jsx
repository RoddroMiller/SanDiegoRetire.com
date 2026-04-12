import React from 'react';
import { Table as TableIcon } from 'lucide-react';

import { STATE_TAX_DATA } from '../../../utils';
import { Card } from '../../ui';

// ============================================
// Cash Flows Tab - Transposed: metrics on Y-axis, years on X-axis
// ============================================
const CashFlowsTab = ({ projectionData, monteCarloData, inputs, clientInfo }) => {
  const [mcMode, setMcMode] = React.useState('deterministic'); // 'deterministic' | 'optimistic' | 'median' | 'conservative'
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;
  const fmtShort = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${Math.round(val)}`;

  const activeData = (mcMode !== 'deterministic' && monteCarloData?.scenarios?.[mcMode])
    ? monteCarloData.scenarios[mcMode]
    : projectionData;

  const hasEmployment = activeData.some(r => r.employmentIncomeDetail > 0);
  const hasOther = activeData.some(r => r.otherIncomeDetail > 0);
  const hasContributions = activeData.some(r => r.contribution > 0);
  const hasNqData = inputs.taxEnabled && activeData.some(r => r.nqWithdrawal > 0);
  const hasRMD = inputs.taxEnabled && activeData.some(r => r.rmdAmount > 0);
  const hasRMDExcess = hasRMD && activeData.some(r => r.rmdExcess > 0);

  // Build row definitions for the transposed table
  const buildRows = () => {
    const rows = [
      { label: 'Plan Year', cls: 'font-bold text-slate-800 bg-slate-100', getValue: (r) => r.year },
      { label: `${clientInfo.name || 'Client'} Age`, cls: 'font-bold text-slate-700 bg-slate-50', getValue: (r) => r.age },
    ];
    if (clientInfo.isMarried) {
      rows.push({ label: `${clientInfo.partnerName || 'Partner'} Age`, cls: 'text-slate-500 bg-slate-50', getValue: (r) => Math.floor(r.partnerAge) });
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Starting Balance', cls: 'text-slate-700', getValue: (r) => fmt(r.startBalance) },
      { label: 'Growth', cls: '', getValue: (r) => `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`, dynamicCls: (r) => r.growth >= 0 ? 'text-mwm-green/80' : 'text-red-600' },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Social Security', cls: 'text-blue-700', getValue: (r) => fmt(r.ssIncomeDetail || 0) },
      { label: 'Pension', cls: 'text-blue-700', getValue: (r) => fmt(r.pensionIncomeDetail || 0) },
    );
    if (hasEmployment) rows.push({ label: 'Employment Income', cls: 'text-teal-700', getValue: (r) => r.employmentIncomeDetail > 0 ? fmt(r.employmentIncomeDetail) : '-' });
    if (hasOther) rows.push({ label: 'Other Income', cls: 'text-cyan-700', getValue: (r) => r.otherIncomeDetail > 0 ? fmt(r.otherIncomeDetail) : '-' });
    if (hasContributions) rows.push({ label: 'One-Time Contributions', cls: 'text-purple-700', getValue: (r) => r.contribution > 0 ? `+${fmt(r.contribution)}` : '-' });
    rows.push(
      { label: 'Total Income', cls: 'font-bold text-blue-800 bg-blue-50', getValue: (r) => fmt(r.ssIncome) },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Total Spending', cls: 'font-bold text-slate-800', getValue: (r) => fmt(r.expenses) },
      { label: 'Portfolio Withdrawal', cls: 'text-orange-700', getValue: (r) => fmt(r.distribution) },
    );
    if (hasRMD) {
      rows.push({ label: 'RMD Floor', cls: 'text-orange-600', getValue: (r) => r.rmdAmount > 0 ? fmt(r.rmdAmount) : '-' });
      if (hasRMDExcess) {
        rows.push({ label: 'RMD Excess → NQ', cls: 'text-teal-600', getValue: (r) => r.rmdExcess > 0 ? `+${fmt(r.rmdExcess)}` : '-' });
      }
    }
    if (inputs.taxEnabled) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Federal Tax', cls: 'text-red-600', getValue: (r) => fmt(r.federalTax || 0) },
        { label: 'State Tax', cls: 'text-red-600', getValue: (r) => fmt(r.stateTax || 0) },
        { label: 'Total Tax', cls: 'font-bold text-red-700 bg-red-50', getValue: (r) => fmt(r.totalTax || 0) },
        { label: 'Effective Rate', cls: 'text-mwm-gold/80', getValue: (r) => `${r.effectiveRate || '0'}%` },
      );
    }
    if (hasNqData) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Withdrawal', cls: 'text-blue-600', getValue: (r) => fmt(r.distribution * (r.traditionalPctUsed || 0) / 100) },
        { label: 'Roth Withdrawal', cls: 'text-mwm-green', getValue: (r) => fmt(r.distribution * (r.rothPctUsed || 0) / 100) },
        { label: 'NQ Withdrawal', cls: 'text-mwm-gold', getValue: (r) => fmt(r.nqWithdrawal || 0) },
        { label: '  Realized Cap Gains', cls: 'text-red-500 pl-4', getValue: (r) => fmt(r.nqTaxableGain || 0) },
        { label: 'Qualified Dividends', cls: 'text-purple-600', getValue: (r) => fmt(r.nqQualifiedDividends || 0) },
        { label: 'Ordinary Dividends', cls: 'text-pink-600', getValue: (r) => fmt(r.nqOrdinaryDividends || 0) },
      );
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Distribution Rate', cls: 'text-red-600', getValue: (r) => `${r.distRate?.toFixed(1) || '0'}%` },
      { label: 'Ending Balance', cls: 'font-bold text-slate-900 bg-mwm-green/10 text-base', getValue: (r) => fmt(Math.max(0, r.total)) },
    );
    if (inputs.taxEnabled && activeData.some(r => r.traditionalBalanceDetail > 0)) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Balance', cls: 'text-blue-600', getValue: (r) => fmt(r.traditionalBalanceDetail || 0) },
        { label: 'Roth Balance', cls: 'text-mwm-green', getValue: (r) => fmt(r.rothBalanceDetail || 0) },
        { label: 'NQ Balance', cls: 'text-mwm-gold', getValue: (r) => fmt(r.nqBalanceDetail || 0) },
      );
    }
    return rows;
  };

  const allRows = buildRows();

  // 5-year chunks for print
  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < activeData.length; i += chunkSize) {
    chunks.push(activeData.slice(i, i + chunkSize));
  }

  const renderTransposedTable = (cols, fontSize = 'text-xs') => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className={`w-full ${fontSize} border-collapse`}>
        <tbody>
          {allRows.map((rowDef, ri) => (
            <tr key={ri} className={rowDef.isSeparator ? 'h-1' : 'border-b border-slate-100'}>
              <td className={`p-1.5 text-left whitespace-nowrap font-medium sticky left-0 bg-white border-r border-slate-200 min-w-[160px] ${rowDef.cls || ''}`}>
                {rowDef.label}
              </td>
              {cols.map((col, ci) => (
                <td key={ci} className={`p-1.5 text-right whitespace-nowrap ${rowDef.isSeparator ? '' : rowDef.dynamicCls ? rowDef.dynamicCls(col) : rowDef.cls || ''}`}>
                  {rowDef.isSeparator ? '' : rowDef.getValue(col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
              <TableIcon className="w-5 h-5" /> Detailed Retirement Cash Flows
            </h3>
            <p className="text-sm text-slate-500">
              Comprehensive income, withdrawal, tax, and portfolio detail by year.
            </p>
          </div>
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
        {mcMode !== 'deterministic' && (
          <p className="text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded">
            <strong>Monte Carlo — {mcMode === 'optimistic' ? '90th Percentile' : mcMode === 'median' ? '50th Percentile (Median)' : '10th Percentile'}:</strong>
            {' '}{mcMode === 'optimistic' ? 'Better than 90% of simulated outcomes.' : mcMode === 'median' ? 'Middle-of-the-road outcome from 1,000 simulations.' : 'Worse than only 10% of simulated outcomes — stress test scenario.'}
          </p>
        )}

        {renderTransposedTable(activeData)}

        {inputs.taxEnabled && (
          <div className="mt-3 p-2 bg-mwm-gold/10 text-xs text-mwm-gold/80 rounded border border-mwm-gold/20">
            <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} status, {inputs.traditionalPercent}% Trad / {inputs.rothPercent}% Roth / {inputs.nqPercent}% NQ, {inputs.stateCode && STATE_TAX_DATA[inputs.stateCode] ? `${STATE_TAX_DATA[inputs.stateCode].name} (${STATE_TAX_DATA[inputs.stateCode].rate}%${STATE_TAX_DATA[inputs.stateCode].ssTaxable ? ', taxes SS' : ', SS exempt'})` : `${inputs.stateRate}% state rate`}.{Object.keys(inputs.withdrawalOverrides || {}).length > 0 ? ` ${Object.keys(inputs.withdrawalOverrides).length} custom year override(s) applied.` : ''}
          </div>
        )}
      </Card>

    </div>
  );
};

export { CashFlowsTab };
