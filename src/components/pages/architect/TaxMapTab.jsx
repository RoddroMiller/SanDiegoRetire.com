import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Bar, Line
} from 'recharts';
import { DollarSign, Table as TableIcon } from 'lucide-react';

import { getInflationAdjustedBrackets, getInflationAdjustedDeduction } from '../../../utils';
import { Card } from '../../ui';

const TAX_BRACKET_BASE_YEAR = 2026;
const BRACKET_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const BRACKET_LABELS = ['12%', '22%', '24%', '32%', '35%'];

export const TaxMapTab = ({ projectionData, inputs, clientInfo, basePlan }) => {
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;

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

      // Taxable income components
      const tradWithdrawal = row.distribution * (row.traditionalPctUsed || 0) / 100;
      const taxableSS = row.taxableSS || 0;
      const pension = row.pensionIncomeDetail || 0;
      // NQ ordinary dividends are taxed at ordinary rates; LTCG and qualified divs are preferential
      const nqOrdinaryDivs = row.nqOrdinaryDividends || 0;
      const nqPreferential = (row.nqTaxableGain || 0) + (row.nqQualifiedDividends || 0);
      const otherEmployment = (row.otherIncomeDetail || 0) + (row.employmentIncomeDetail || 0);
      const rmd = row.rmdAmount || 0;

      // Total ordinary taxable income (before deduction, for bracket comparison)
      // NQ LTCG and qualified dividends are taxed at capital gains rates, NOT ordinary income rates
      const totalOrdinaryIncome = taxableSS + pension + tradWithdrawal + nqOrdinaryDivs + otherEmployment;

      // Bracket thresholds (add deduction so they represent gross income thresholds)
      const bracket12Top = brackets.length > 1 ? brackets[1].max + deduction : 0;
      const bracket22Top = brackets.length > 2 ? brackets[2].max + deduction : 0;
      const bracket24Top = brackets.length > 3 ? brackets[3].max + deduction : 0;
      const bracket32Top = brackets.length > 4 ? brackets[4].max + deduction : 0;

      // Which bracket is the taxpayer in?
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
        age: row.age,
        taxableSS,
        pension,
        tradWithdrawal: Math.round(tradWithdrawal),
        nqOrdinaryDivs: Math.round(nqOrdinaryDivs),
        nqPreferential: Math.round(nqPreferential),
        otherEmployment: Math.round(otherEmployment),
        totalOrdinaryIncome: Math.round(totalOrdinaryIncome),
        rmd: Math.round(rmd),
        bracket12Top,
        bracket22Top,
        bracket24Top,
        bracket32Top,
        deduction,
        currentBracket,
        headroom: Math.round(headroom),
        taxableAfterDeduction: Math.round(taxableAfterDeduction),
        totalTax: row.totalTax || 0,
        effectiveRate: row.effectiveRate || '0.0'
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
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* Stacked bars for ordinary taxable income components */}
              <Bar dataKey="taxableSS" stackId="income" fill="#60a5fa" name="Taxable SS" />
              <Bar dataKey="pension" stackId="income" fill="#34d399" name="Pension" />
              <Bar dataKey="tradWithdrawal" stackId="income" fill="#f97316" name="Traditional" />
              <Bar dataKey="nqOrdinaryDivs" stackId="income" fill="#c084fc" name="NQ Ordinary Divs" />
              <Bar dataKey="otherEmployment" stackId="income" fill="#94a3b8" name="Other/Employment" />
              {/* Preferential income (LTCG + qualified divs) — taxed at cap gains rates, not ordinary */}
              <Bar dataKey="nqPreferential" stackId="income" fill="#a78bfa" name="NQ Cap Gains (LTCG rate)" />
              {/* Bracket threshold lines */}
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
                <th className="p-2 text-right">RMD</th>
                <th className="p-2 text-right">Total Tax</th>
                <th className="p-2 text-right">Eff. Rate</th>
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
                  <tr key={row.age} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                    <td className="p-2 text-right text-blue-600">{fmt(row.totalOrdinaryIncome)}</td>
                    <td className="p-2 text-right text-slate-500">{fmt(row.deduction)}</td>
                    <td className="p-2 text-right text-slate-700">{fmt(row.taxableAfterDeduction)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bracketColor}`}>{row.currentBracket}</span>
                    </td>
                    <td className="p-2 text-right text-mwm-green">{fmt(row.headroom)}</td>
                    <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                    <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                    <td className="p-2 text-right text-mwm-gold/80">{row.effectiveRate}%</td>
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
