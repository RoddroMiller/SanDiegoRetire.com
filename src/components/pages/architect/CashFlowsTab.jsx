import React from 'react';
import { Table as TableIcon, ChevronRight, ChevronDown } from 'lucide-react';

import { STATE_TAX_DATA } from '../../../utils';
import { Card } from '../../ui';

// ============================================
// Cash Flows Tab - Transposed: metrics on Y-axis, years on X-axis
// ============================================
const CashFlowsTab = ({ projectionData, monteCarloData, inputs, clientInfo }) => {
  const [mcMode, setMcMode] = React.useState('deterministic');
  const [expandedSections, setExpandedSections] = React.useState({});
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeData = (mcMode !== 'deterministic' && monteCarloData?.scenarios?.[mcMode])
    ? monteCarloData.scenarios[mcMode]
    : projectionData;

  const hasEmployment = activeData.some(r => r.employmentIncomeDetail > 0);
  const hasOther = activeData.some(r => r.otherIncomeDetail > 0);
  const hasContributions = activeData.some(r => r.contribution > 0);
  const hasSurplus = activeData.some(r => (r.surplus || 0) > 0);
  const hasDistributions = activeData.some(r => r.distribution > 0);
  const hasIRMAA = inputs.irmaaEnabled && activeData.some(r => r.irmaaCost > 0);
  const hasRothConversions = inputs.taxEnabled && activeData.some(r => r.rothConversion > 0);
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

    // --- STARTING BALANCE & GROWTH ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Starting Balance', cls: 'font-bold text-slate-700', getValue: (r) => fmt(r.startBalance) },
      { label: 'Portfolio Growth', cls: '', getValue: (r) => `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`, dynamicCls: (r) => r.growth >= 0 ? 'text-mwm-green/80' : 'text-red-600' },
    );

    // --- INCOME SECTION ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Social Security', cls: 'text-blue-700', getValue: (r) => fmt(r.ssIncomeDetail || 0) },
      { label: 'Pension', cls: 'text-blue-700', getValue: (r) => fmt(r.pensionIncomeDetail || 0) },
    );
    if (hasEmployment) rows.push({ label: 'Employment Income', cls: 'text-teal-700', getValue: (r) => r.employmentIncomeDetail > 0 ? fmt(r.employmentIncomeDetail) : '-' });
    if (hasOther) rows.push({ label: 'Other Income', cls: 'text-cyan-700', getValue: (r) => r.otherIncomeDetail > 0 ? fmt(r.otherIncomeDetail) : '-' });
    if (hasContributions) rows.push({ label: 'One-Time Contributions', cls: 'text-purple-700', getValue: (r) => r.contribution > 0 ? `+${fmt(r.contribution)}` : '-' });
    rows.push(
      { label: 'Total Income', cls: 'font-bold text-blue-800 bg-blue-50', getValue: (r) => fmt(r.ssIncome) },
    );

    // --- EXPENSES SECTION ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Living Expenses', cls: 'text-slate-700', getValue: (r) => fmt(r.livingExpenses || r.expenses) },
    );
    if (inputs.taxEnabled) {
      rows.push(
        { label: 'Federal Tax', cls: 'text-red-600', getValue: (r) => fmt(r.federalTax || 0) },
        { label: 'State Tax', cls: 'text-red-600', getValue: (r) => fmt(r.stateTax || 0) },
      );
      if (hasIRMAA) {
        rows.push(
          { label: 'IRMAA Surcharge', cls: 'text-red-500', getValue: (r) => (r.irmaaCost || 0) > 0 ? fmt(r.irmaaCost) : '-' },
        );
      }
    }
    rows.push(
      { label: 'Total Expenses', cls: 'font-bold text-slate-800 bg-slate-50', getValue: (r) => fmt(r.expenses) },
    );
    if (inputs.taxEnabled) {
      rows.push(
        { label: 'Effective Tax Rate', cls: 'text-mwm-gold/80', getValue: (r) => `${r.effectiveRate || '0'}%` },
      );
    }

    // --- RMD SECTION ---
    if (hasRMD) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'RMD Floor', cls: 'text-orange-600', getValue: (r) => r.rmdAmount > 0 ? fmt(r.rmdAmount) : '-' },
      );
      if (hasRMDExcess) {
        rows.push({ label: 'RMD Excess → NQ', cls: 'text-teal-600', getValue: (r) => r.rmdExcess > 0 ? `+${fmt(r.rmdExcess)}` : '-' });
      }
    }

    // --- PORTFOLIO FLOW (combined contribution/distribution) ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
    );
    rows.push({
      label: 'portfolioFlow',
      isToggle: 'portfolioFlow',
      cls: 'font-bold cursor-pointer',
      getValue: (r) => {
        const surp = r.surplus || 0;
        const dist = r.distribution || 0;
        if (surp > 0 && dist === 0) return `+${fmt(surp)}`;
        if (dist > 0) return `-${fmt(dist)}`;
        return '-';
      },
      dynamicCls: (r) => {
        const surp = r.surplus || 0;
        const dist = r.distribution || 0;
        if (surp > 0 && dist === 0) return 'text-mwm-green font-bold';
        if (dist > 0) return 'text-orange-700 font-bold';
        return 'text-slate-400';
      }
    });
    rows.push({
      label: '  Traditional',
      cls: 'text-blue-600 pl-4',
      getValue: (r) => r.distribution > 0 ? `-${fmt(r.distribution * (r.traditionalPctUsed || 0) / 100)}` : '-',
      collapsibleParent: 'portfolioFlow'
    });
    rows.push({
      label: '  Roth',
      cls: 'text-mwm-green pl-4',
      getValue: (r) => r.distribution > 0 ? `-${fmt(r.distribution * (r.rothPctUsed || 0) / 100)}` : '-',
      collapsibleParent: 'portfolioFlow'
    });
    rows.push({
      label: '  Non-Qualified',
      cls: 'text-mwm-gold pl-4',
      getValue: (r) => {
        const surp = r.surplus || 0;
        const dist = r.distribution > 0 ? (r.nqWithdrawal || 0) : 0;
        if (surp > 0 && dist === 0) return `+${fmt(surp)}`;
        if (surp > 0 && dist > 0) return `+${fmt(surp)} / -${fmt(dist)}`;
        if (dist > 0) return `-${fmt(dist)}`;
        return '-';
      },
      collapsibleParent: 'portfolioFlow'
    });

    // --- ENDING BALANCE ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Ending Balance', cls: 'font-bold text-slate-900 bg-mwm-green/10 text-base', getValue: (r) => fmt(Math.max(0, r.total)) },
      { label: 'Distribution Rate', cls: '', getValue: (r) => {
        if ((r.surplus || 0) > 0 && r.distribution === 0) return 'n/a';
        return `${r.distRate?.toFixed(1) || '0'}%`;
      }, dynamicCls: (r) => (r.surplus || 0) > 0 && r.distribution === 0 ? 'text-mwm-green' : 'text-red-600' },
    );
    if (inputs.taxEnabled && activeData.some(r => r.traditionalBalanceDetail > 0)) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Balance', cls: 'text-blue-600', getValue: (r) => fmt(r.traditionalBalanceDetail || 0) },
      );
      if (hasRothConversions) {
        rows.push(
          { label: 'Roth Conversion', cls: 'text-teal-600', getValue: (r) => (r.rothConversion || 0) > 0 ? fmt(r.rothConversion) : '-' },
        );
      }
      rows.push(
        { label: 'Roth Balance', cls: 'text-mwm-green', getValue: (r) => fmt(r.rothBalanceDetail || 0) },
        { label: 'NQ Balance', cls: 'text-mwm-gold', getValue: (r) => fmt(r.nqBalanceDetail || 0) },
      );
    }

    // --- TAX ASSUMPTIONS (bottom, collapsible) ---
    if (inputs.taxEnabled) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      );
      rows.push({
        label: 'taxAssumptions',
        isToggle: 'taxAssumptions',
        cls: 'font-bold text-slate-600 cursor-pointer',
        getValue: () => '',
      });
      rows.push({
        label: '  Realized Cap Gains',
        cls: 'text-red-500 pl-4',
        getValue: (r) => fmt(r.nqTaxableGain || 0),
        collapsibleParent: 'taxAssumptions'
      });
      rows.push({
        label: '  Qualified Dividends',
        cls: 'text-purple-600 pl-4',
        getValue: (r) => fmt(r.nqQualifiedDividends || 0),
        collapsibleParent: 'taxAssumptions'
      });
      rows.push({
        label: '  Ordinary Dividends',
        cls: 'text-pink-600 pl-4',
        getValue: (r) => fmt(r.nqOrdinaryDividends || 0),
        collapsibleParent: 'taxAssumptions'
      });
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
          {allRows.map((rowDef, ri) => {
            // Skip collapsible children when their parent is collapsed
            if (rowDef.collapsibleParent && !expandedSections[rowDef.collapsibleParent]) {
              return null;
            }

            // Toggle row rendering (Portfolio Flow, Tax Assumptions)
            if (rowDef.isToggle) {
              const isExpanded = expandedSections[rowDef.isToggle];
              const icon = isExpanded ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />;
              const toggleLabel = rowDef.isToggle === 'portfolioFlow'
                ? 'Portfolio Contribution / Distribution'
                : 'Tax Assumption Detail';
              return (
                <tr key={ri} className="border-b border-slate-100">
                  <td
                    className={`p-1.5 text-left whitespace-nowrap font-medium sticky left-0 bg-white border-r border-slate-200 min-w-[160px] ${rowDef.cls || ''}`}
                    onClick={() => toggleSection(rowDef.isToggle)}
                  >
                    {icon} {toggleLabel}
                  </td>
                  {cols.map((col, ci) => (
                    <td key={ci} className={`p-1.5 text-right whitespace-nowrap ${rowDef.dynamicCls ? rowDef.dynamicCls(col) : rowDef.cls || ''}`}>
                      {rowDef.getValue(col)}
                    </td>
                  ))}
                </tr>
              );
            }

            return (
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
            );
          })}
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
              Comprehensive income, expenses, tax, and portfolio detail by year.
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
