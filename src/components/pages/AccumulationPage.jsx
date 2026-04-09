import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { User, DollarSign, ArrowRight, Info, AlertTriangle, ChevronDown, ChevronUp, Clock, Plus, Trash2, Settings } from 'lucide-react';

import { COLORS } from '../../constants';
import { formatPhoneNumber, calculateImpliedSpending, STATE_TAX_DATA } from '../../utils';
import { FormattedNumberInput, Disclaimer } from '../ui';

/**
 * Accumulation Page - Step 1 of the portfolio planning process
 * Collects client information and displays projected portfolio growth
 */
export const AccumulationPage = ({
  // Auth
  userRole,
  // Client Data
  clientInfo,
  onClientChange,
  // Inputs (for tax-implied spending)
  inputs,
  onInputChange,
  // Chart Data
  accumulationData,
  // Navigation
  onProceed,
  // Account CRUD
  onAddAccount,
  onUpdateAccount,
  onRemoveAccount,
}) => {
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  const impliedSpending = useMemo(() => {
    if (!clientInfo.annualIncome || clientInfo.annualIncome <= 0) return null;
    return calculateImpliedSpending({
      annualIncome: clientInfo.annualIncome,
      partnerAnnualIncome: clientInfo.partnerAnnualIncome || 0,
      annualSavings: clientInfo.annualSavings,
      filingStatus: inputs?.filingStatus || 'married',
      stateRate: inputs?.stateRate || 0,
      isMarried: clientInfo.isMarried
    });
  }, [clientInfo.annualIncome, clientInfo.partnerAnnualIncome, clientInfo.annualSavings, clientInfo.isMarried, inputs?.filingStatus, inputs?.stateRate]);

  const spendingDifference = impliedSpending
    ? impliedSpending.impliedMonthly - clientInfo.currentSpending
    : 0;

  const hasStaggeredRetirement = clientInfo.isMarried &&
    clientInfo.retirementAge !== clientInfo.partnerRetirementAge;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-3 sm:p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Left Column - Inputs */}
          <div className="space-y-4 sm:space-y-6">
            {/* Personal Details */}
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" /> Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                className="p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
                value={clientInfo.name}
                onChange={onClientChange}
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                className="p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
                value={clientInfo.email}
                onChange={onClientChange}
              />
              <input
                type="text"
                name="phone"
                placeholder="Phone"
                className="p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
                value={clientInfo.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  onClientChange({ target: { name: 'phone', value: formatted } });
                }}
              />
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  name="isMarried"
                  checked={clientInfo.isMarried}
                  onChange={onClientChange}
                  className="w-5 h-5 text-emerald-600"
                />
                <label className="text-sm text-slate-600">Married / Partner?</label>
              </div>
              {clientInfo.isMarried && (
                <input
                  type="text"
                  name="partnerName"
                  value={clientInfo.partnerName || ''}
                  onChange={onClientChange}
                  placeholder="Partner's Name"
                  className="p-3 border rounded-lg text-sm"
                />
              )}
            </div>

            {/* Age Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Your Age <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Your current age used to calculate years until retirement.
                </div>
                <FormattedNumberInput
                  name="currentAge"
                  value={clientInfo.currentAge}
                  onChange={onClientChange}
                  className="p-3 border rounded-lg w-full font-bold text-slate-700"
                />
              </div>
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Retirement Age <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  The age you plan to stop working and begin taking distributions.
                </div>
                <FormattedNumberInput
                  name="retirementAge"
                  value={clientInfo.retirementAge}
                  onChange={onClientChange}
                  className="p-3 border rounded-lg w-full font-bold text-slate-700"
                />
              </div>
              {clientInfo.isMarried && (
                <>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Partner Age <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Your partner's current age for joint planning calculations.
                    </div>
                    <FormattedNumberInput
                      name="partnerAge"
                      value={clientInfo.partnerAge}
                      onChange={onClientChange}
                      className="p-3 border rounded-lg w-full font-bold text-slate-700"
                    />
                  </div>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Partner Retire Age <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      The age your partner plans to retire.
                    </div>
                    <FormattedNumberInput
                      name="partnerRetirementAge"
                      value={clientInfo.partnerRetirementAge}
                      onChange={onClientChange}
                      className="p-3 border rounded-lg w-full font-bold text-slate-700"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Financial Inputs */}
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 pt-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Financial Inputs
            </h3>
            <div className="space-y-4">
              {/* Advanced toggle */}
              {inputs.accounts && inputs.accounts.length > 0 ? (
                /* --- Advanced Mode: Per-account entry --- */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      Portfolio Accounts
                    </label>
                    <button
                      type="button"
                      onClick={onAddAccount}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <Plus className="w-3 h-3" /> Add Account
                    </button>
                  </div>
                  {inputs.accounts.map((acct) => (
                    <div key={acct.id} className="grid grid-cols-12 gap-1.5 items-end p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-500 uppercase">Label</label>
                        <input
                          type="text"
                          value={acct.label}
                          onChange={(e) => onUpdateAccount(acct.id, 'label', e.target.value)}
                          placeholder="e.g. 401k"
                          className="w-full px-2 py-1.5 border rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase">Owner</label>
                        <select
                          value={acct.owner}
                          onChange={(e) => onUpdateAccount(acct.id, 'owner', e.target.value)}
                          className="w-full px-1 py-1.5 border rounded bg-white text-xs"
                        >
                          <option value="client">{clientInfo.name || 'Client'}</option>
                          {clientInfo.isMarried && <option value="partner">{clientInfo.partnerName || 'Partner'}</option>}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase">Type</label>
                        <select
                          value={`${acct.type}-${acct.subtype}`}
                          onChange={(e) => {
                            const [type, subtype] = e.target.value.split('-');
                            onUpdateAccount(acct.id, 'type', type);
                            onUpdateAccount(acct.id, 'subtype', subtype);
                          }}
                          className="w-full px-1 py-1.5 border rounded bg-white text-xs"
                        >
                          <option value="traditional-ira">Trad IRA</option>
                          <option value="traditional-401k">Trad 401k</option>
                          <option value="roth-ira">Roth IRA</option>
                          <option value="roth-401k">Roth 401k</option>
                          <option value="nq-brokerage">NQ</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase">Balance</label>
                        <FormattedNumberInput
                          value={acct.balance}
                          onChange={(e) => onUpdateAccount(acct.id, 'balance', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase">Ann. Contrib</label>
                        <FormattedNumberInput
                          value={acct.annualContribution}
                          onChange={(e) => onUpdateAccount(acct.id, 'annualContribution', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button type="button" onClick={() => onRemoveAccount(acct.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Summary */}
                  <div className="px-2 py-1.5 bg-emerald-50 rounded border border-emerald-200 text-xs font-medium space-y-0.5">
                    <div className="flex justify-between text-emerald-800">
                      <span>Today: ${inputs.accounts.reduce((s, a) => s + (a.balance || 0), 0).toLocaleString()}</span>
                      <span>Annual Savings: ${inputs.accounts.reduce((s, a) => s + (a.annualContribution || 0), 0).toLocaleString()}</span>
                    </div>
                    {accumulationData.length > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Projected at retirement: ${accumulationData[accumulationData.length - 1].balance.toLocaleString()}</span>
                        <span>Trad {inputs.traditionalPercent}% | Roth {inputs.rothPercent}% | NQ {inputs.nqPercent}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* --- Simple Mode: single portfolio + savings --- */
                <>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Current Portfolio <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Total of all 401k, Roth, IRA, other retirement assets, and non-retirement investment accounts.
                    </div>
                    <FormattedNumberInput
                      name="currentPortfolio"
                      value={clientInfo.currentPortfolio}
                      onChange={onClientChange}
                      className="p-3 border rounded-lg w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onAddAccount}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 rounded border border-dashed border-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                  >
                    <Settings className="w-3 h-3" /> Advanced — enter individual accounts
                  </button>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Current Monthly Spend <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    All monthly expenses including housing, utilities, food, transportation, healthcare, vacations, and entertainment. Excludes savings and taxes.
                  </div>
                  <FormattedNumberInput
                    name="currentSpending"
                    value={clientInfo.currentSpending}
                    onChange={onClientChange}
                    className="p-3 border rounded-lg w-full"
                  />
                </div>
                {!(inputs.accounts && inputs.accounts.length > 0) && (
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Annual Savings <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Total yearly contributions to all retirement accounts (401k, IRA, Roth) plus after-tax savings and investment accounts.
                    </div>
                    <FormattedNumberInput
                      name="annualSavings"
                      value={clientInfo.annualSavings}
                      onChange={onClientChange}
                      className="p-3 border rounded-lg w-full"
                    />
                  </div>
                )}
              </div>
              {/* Income Fields for Tax-Implied Spending */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Annual Income <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Total gross annual employment income (salary, wages, self-employment).
                  </div>
                  <FormattedNumberInput
                    name="annualIncome"
                    value={clientInfo.annualIncome}
                    onChange={onClientChange}
                    className="p-3 border rounded-lg w-full"
                  />
                </div>
                {clientInfo.isMarried && (
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Partner Income <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Partner's gross annual employment income.
                    </div>
                    <FormattedNumberInput
                      name="partnerAnnualIncome"
                      value={clientInfo.partnerAnnualIncome || 0}
                      onChange={onClientChange}
                      className="p-3 border rounded-lg w-full"
                    />
                  </div>
                )}
              </div>
              {/* Filing Status and State Tax Rate */}
              {clientInfo.annualIncome > 0 && inputs && onInputChange && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filing Status</label>
                    <select
                      name="filingStatus"
                      value={inputs.filingStatus || 'married'}
                      onChange={onInputChange}
                      className="p-3 border rounded-lg w-full text-sm"
                    >
                      <option value="married">Married Filing Jointly</option>
                      <option value="single">Single</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State</label>
                    <select
                      name="stateCode"
                      value={inputs.stateCode || ''}
                      onChange={(e) => {
                        const code = e.target.value;
                        const data = STATE_TAX_DATA[code];
                        onInputChange({ target: { name: 'stateCode', value: code, type: 'text' } });
                        if (data) {
                          onInputChange({ target: { name: 'stateRate', value: data.rate, type: 'number' } });
                        }
                      }}
                      className="p-3 border rounded-lg w-full text-sm"
                    >
                      <option value="">Select state...</option>
                      {Object.entries(STATE_TAX_DATA)
                        .sort((a, b) => a[1].name.localeCompare(b[1].name))
                        .map(([code, data]) => (
                          <option key={code} value={code}>
                            {data.name} ({data.rate === 0 ? 'No tax' : data.brackets ? `up to ${data.rate}%` : `${data.rate}% flat`})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Projected Annual Portfolio Returns (%) <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Expected average annual return on your investments during accumulation phase.
                </div>
                <input
                  type="number"
                  step="0.1"
                  name="expectedReturn"
                  value={clientInfo.expectedReturn}
                  onChange={onClientChange}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
            </div>

            {/* Tax-Implied Spending Comparison */}
            {impliedSpending && impliedSpending.impliedMonthly > 0 && (
              <div className={`p-4 rounded-xl border ${Math.abs(spendingDifference) > 500 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <h4 className="text-sm font-bold text-slate-700 mb-3">Tax-Implied Spending Analysis</h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 uppercase mb-1">Client-Reported</p>
                    <p className="text-xl font-bold text-slate-800">${clientInfo.currentSpending.toLocaleString()}/mo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 uppercase mb-1">Income-Implied</p>
                    <p className="text-xl font-bold text-slate-800">${impliedSpending.impliedMonthly.toLocaleString()}/mo</p>
                  </div>
                </div>
                {Math.abs(spendingDifference) > 500 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-100 rounded-lg mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Difference of <strong>${Math.abs(spendingDifference).toLocaleString()}/mo</strong>.
                      {spendingDifference > 0
                        ? ' Client may be underreporting spending or has additional income not captured.'
                        : ' Client may be overreporting spending, has debt payments, or additional savings not captured.'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  {showTaxBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Tax Breakdown
                </button>
                {showTaxBreakdown && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Federal Tax:</span><span className="font-medium">${impliedSpending.federalTax.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>State Tax:</span><span className="font-medium">${impliedSpending.stateTax.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>SS Tax (FICA):</span><span className="font-medium">${impliedSpending.ssTax.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Medicare Tax:</span><span className="font-medium">${impliedSpending.medicareTax.toLocaleString()}</span></div>
                    <div className="col-span-2 flex justify-between border-t border-slate-200 pt-1 font-bold">
                      <span>Total Tax:</span><span>${impliedSpending.totalTax.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Staggered Retirement Indicator */}
            {hasStaggeredRetirement && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-800">Staggered Retirement Timeline</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      {clientInfo.retirementAge < clientInfo.partnerRetirementAge
                        ? `You retire at ${clientInfo.retirementAge}, partner continues working until ${clientInfo.partnerRetirementAge} (${clientInfo.partnerRetirementAge - clientInfo.retirementAge} year gap). Partner's employment income will supplement retirement cash flow during gap years.`
                        : `Partner retires at ${clientInfo.partnerRetirementAge}, you continue working until ${clientInfo.retirementAge} (${clientInfo.retirementAge - clientInfo.partnerRetirementAge} year gap). Your continued employment income will supplement savings.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chart */}
          <div className="flex flex-col justify-between">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Projected Growth</h3>
              <div className="flex-grow min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accumulationData}>
                    <defs>
                      <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.hedged} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS.hedged} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(val) => `$${val / 1000}k`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(val) => `$${val.toLocaleString()}`}
                      labelFormatter={(label) => `Age ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={COLORS.hedged}
                      fillOpacity={1}
                      fill="url(#colorGrowth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">Projected Portfolio at Retirement</p>
                <p className="text-3xl font-bold text-emerald-700">
                  ${accumulationData[accumulationData.length - 1]?.balance.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <button
              onClick={onProceed}
              className="mt-6 w-full bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              Proceed to Portfolio Architect <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
};

export default AccumulationPage;
