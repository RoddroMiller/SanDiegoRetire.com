import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { User, DollarSign, ArrowRight, FolderOpen, Loader, Trash2, LogOut, Info, Settings } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber } from '../../utils';
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
  // Chart Data
  accumulationData,
  // Navigation
  onProceed,
  onViewManagement
}) => {
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
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> Load Saved Client {userRole === 'master' && '(Master View)'}
                </h3>
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
