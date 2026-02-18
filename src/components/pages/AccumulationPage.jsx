import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { User, DollarSign, ArrowRight, FolderOpen, Loader, Trash2, LogOut, Info, Settings, Users, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber, calculateImpliedSpending } from '../../utils';
import { FormattedNumberInput, Disclaimer } from '../ui';

/**
 * Accumulation Page - Step 1 of the portfolio planning process
 * Collects client information and displays projected portfolio growth
 */
export const AccumulationPage = ({
  // Auth
  userRole,
  onLogout,
  // Scenarios
  savedScenarios,
  isLoadingScenarios,
  onLoadScenario,
  onDeleteScenario,
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
  onViewManagement,
  // Plan Filter
  planFilter = 'mine',
  onPlanFilterChange,
  hasTeams = false
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
        {/* Header */}
        <div className="bg-black p-4 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <img src={LOGO_URL} alt="Logo" className="h-12 sm:h-16 w-auto bg-white p-1 sm:p-2 rounded-lg flex-shrink-0" />
              <div>
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white">Retirement Growth Engine</h1>
                <p className="text-yellow-500 text-xs sm:text-sm mt-1">Map your accumulation phase before structuring your income.</p>
              </div>
            </div>
            {userRole !== 'client' && (
              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 border-t sm:border-t-0 border-slate-700 pt-3 sm:pt-0">
                <button
                  onClick={onViewManagement}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1 sm:gap-2"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Manage</span> Plans
                </button>
                <div className="text-right">
                  <p className="text-[12px] sm:text-xs text-gray-400 uppercase">Logged in as</p>
                  <p className="text-xs sm:text-sm font-bold text-emerald-400">
                    {userRole === 'master' ? 'Master Advisor' : 'Advisor'}
                  </p>
                  <button
                    onClick={onLogout}
                    className="text-[12px] text-white hover:text-red-400 flex items-center gap-1 justify-end mt-1"
                  >
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Left Column - Inputs */}
          <div className="space-y-4 sm:space-y-6">
            {/* Saved Scenarios (Advisor Only) */}
            {userRole !== 'client' && (
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" /> Load Saved Client
                  </h3>
                  {/* Plan Filter Dropdown */}
                  {(hasTeams || userRole === 'master') && (
                    <select
                      value={planFilter}
                      onChange={(e) => onPlanFilterChange && onPlanFilterChange(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="mine">My Plans</option>
                      {hasTeams && <option value="team">Team Plans</option>}
                      {userRole === 'master' && <option value="all">All Plans</option>}
                    </select>
                  )}
                </div>
                {planFilter === 'team' && (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 mb-2">
                    <Users className="w-3 h-3" /> Viewing team members' plans
                  </div>
                )}
                {isLoadingScenarios ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader className="w-3 h-3 animate-spin" /> Loading...
                  </div>
                ) : savedScenarios.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {savedScenarios.map(s => (
                      <div
                        key={s.id}
                        onClick={() => onLoadScenario(s)}
                        className="flex items-center justify-between p-2 rounded bg-slate-50 hover:bg-emerald-50 cursor-pointer border border-slate-200 transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-700">
                              {s.clientInfo.name || s.clientInfo.email || 'Unnamed'}
                            </p>
                            {s.isClientSubmission && (
                              <span className="bg-emerald-100 text-emerald-700 text-[12px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                New Submission
                              </span>
                            )}
                            {s.duplicateEmail && (
                              <span className="bg-amber-100 text-amber-700 text-[12px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Duplicate Email
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-slate-400">
                            <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                            {userRole === 'master' && (
                              <span className="bg-slate-200 px-1 rounded text-slate-600">{s.advisorEmail}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => onDeleteScenario(e, s.id)}
                          className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No saved clients found.</p>
                )}
              </div>
            )}

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
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="stateRate"
                      value={inputs.stateRate || 0}
                      onChange={onInputChange}
                      className="p-3 border rounded-lg w-full text-sm"
                    />
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
