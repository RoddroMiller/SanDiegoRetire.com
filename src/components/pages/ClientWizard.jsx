import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line } from 'recharts';
import { User, DollarSign, ArrowRight, ArrowLeft, Shield, Info, Activity, Briefcase, Send, TrendingUp, Clock, PiggyBank, BarChart2, Table as TableIcon, Plus, Trash2, AlertCircle } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber } from '../../utils';
import { Card, StatBox, FormattedNumberInput } from '../ui';

/**
 * Client Wizard - Multi-step flow for prospects/clients
 * Page 1: Contact info + Ages
 * Page 2: Portfolio, spending, savings + Accumulation chart
 * Page 3: Retirement income (SS, Pension) + SS Optimizer
 * Page 4: Summary + Solutions
 */
export const ClientWizard = ({
  // Data
  clientInfo,
  onClientChange,
  inputs,
  onInputChange,
  // Calculations
  accumulationData,
  projectionData,
  monteCarloData,
  ssAnalysis,
  ssPartnerAnalysis,
  // Actions
  onSaveProgress,
  onClientSubmit,
  saveStatus,
  // SS Optimizer
  targetMaxPortfolioAge,
  onSetTargetMaxPortfolioAge,
  onUpdateSSStartAge,
  onUpdatePartnerSSStartAge,
  // Additional Income
  onAddAdditionalIncome,
  onUpdateAdditionalIncome,
  onRemoveAdditionalIncome
}) => {
  const [wizardStep, setWizardStep] = useState(1);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Calculate improvement solutions
  const improvementSolutions = useMemo(() => {
    const currentSuccessRate = monteCarloData?.successRate || 0;
    const targetSuccessRate = 95;

    if (currentSuccessRate >= targetSuccessRate) {
      return { needed: false, delayYears: 0, additionalSavings: 0, spendingReduction: 0 };
    }

    // Calculate delay retirement solution (roughly 2-3% improvement per year)
    const successGap = targetSuccessRate - currentSuccessRate;
    const delayYears = Math.min(10, Math.ceil(successGap / 3));

    // Calculate additional savings needed (roughly $10k/year per 1% improvement)
    const additionalSavings = Math.ceil(successGap / 1) * 5000;

    // Calculate spending reduction (roughly $200/month per 1% improvement)
    const spendingReduction = Math.ceil(successGap * 150);

    return {
      needed: true,
      delayYears,
      additionalSavings,
      spendingReduction,
      currentRate: currentSuccessRate
    };
  }, [monteCarloData]);

  const handleNext = () => {
    // Validate contact info on page 1
    if (wizardStep === 1) {
      if (!clientInfo.name?.trim()) {
        setValidationError('Please enter your name');
        return;
      }
      if (!clientInfo.email?.trim()) {
        setValidationError('Please enter your email');
        return;
      }
      if (!clientInfo.phone?.trim()) {
        setValidationError('Please enter your phone number');
        return;
      }
    }

    setValidationError('');
    // Save progress before moving to next step
    onSaveProgress();
    setWizardStep(prev => Math.min(prev + 1, 4));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setWizardStep(prev => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };

  // Page 1: Contact Info + Ages
  const renderPage1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Let's Get Started</h2>
        <p className="text-slate-500 mt-2">Tell us about yourself and your retirement timeline</p>
      </div>

      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {validationError}
        </div>
      )}

      {/* Personal Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" /> Personal Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              className={`p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500 ${validationError && !clientInfo.name?.trim() ? 'border-red-300 bg-red-50' : ''}`}
              value={clientInfo.name}
              onChange={onClientChange}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              placeholder="Email"
              className={`p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500 ${validationError && !clientInfo.email?.trim() ? 'border-red-300 bg-red-50' : ''}`}
              value={clientInfo.email}
              onChange={onClientChange}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="phone"
              placeholder="Phone"
              className={`p-3 border rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500 ${validationError && !clientInfo.phone?.trim() ? 'border-red-300 bg-red-50' : ''}`}
              value={clientInfo.phone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                onClientChange({ target: { name: 'phone', value: formatted } });
              }}
            />
          </div>
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
      </div>

      {/* Age Inputs */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" /> Retirement Timeline
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>
    </div>
  );

  // Page 2: Portfolio, Spending, Savings + Chart
  const renderPage2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Your Financial Picture</h2>
        <p className="text-slate-500 mt-2">Current portfolio, spending, and savings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Financial Inputs
          </h3>

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
              className="p-3 border rounded-lg w-full text-lg font-bold text-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                Monthly Spending <Info className="w-3 h-3 text-slate-400" />
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
              Expected Return (%) <Info className="w-3 h-3 text-slate-400" />
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

          <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-slate-600">Projected Portfolio at Retirement</p>
            <p className="text-3xl font-bold text-emerald-700">
              ${accumulationData[accumulationData.length - 1]?.balance.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* Right: Chart */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Portfolio Growth Projection</h3>
          <div className="h-72">
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
        </div>
      </div>
    </div>
  );

  // Page 3: Retirement Income (SS, Pension)
  const renderPage3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Retirement Income Sources</h2>
        <p className="text-slate-500 mt-2">Social Security, pensions, and other income</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Social Security */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" /> Social Security
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Your Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Your Social Security benefit at Full Retirement Age (67) from your SSA statement.
                </div>
                <FormattedNumberInput
                  name="ssPIA"
                  value={inputs.ssPIA}
                  onChange={onInputChange}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Start Age <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  The age you plan to begin collecting Social Security benefits (62-70).
                </div>
                <input
                  type="number"
                  name="ssStartAge"
                  value={inputs.ssStartAge}
                  onChange={onInputChange}
                  min={62}
                  max={70}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
            </div>

            {clientInfo.isMarried && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Partner Benefit <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Your partner's Social Security benefit at Full Retirement Age.
                  </div>
                  <FormattedNumberInput
                    name="partnerSSPIA"
                    value={inputs.partnerSSPIA}
                    onChange={onInputChange}
                    className="p-3 border rounded-lg w-full"
                  />
                </div>
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Partner Start Age <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    The age your partner plans to begin collecting Social Security.
                  </div>
                  <input
                    type="number"
                    name="partnerSSStartAge"
                    value={inputs.partnerSSStartAge}
                    onChange={onInputChange}
                    min={62}
                    max={70}
                    className="p-3 border rounded-lg w-full"
                  />
                </div>
              </div>
            )}

            {/* SS Optimizer Summary */}
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs font-bold text-yellow-800 uppercase mb-3">Claiming Strategy Options</p>

              <div className="space-y-3">
                {/* Option 1: Maximize Legacy */}
                <div
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${inputs.ssStartAge === 70 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                  onClick={() => onUpdateSSStartAge(70)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Maximize Legacy</p>
                      <p className="text-xs text-slate-500">Delay claiming for highest lifetime benefits</p>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">Age 70</span>
                  </div>
                </div>

                {/* Option 2: Balanced / Recommended */}
                <div
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${inputs.ssStartAge === (ssAnalysis?.winner?.age || 67) && inputs.ssStartAge !== 70 && inputs.ssStartAge !== 62 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                  onClick={() => onUpdateSSStartAge(ssAnalysis?.winner?.age || 67)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Balanced (Recommended)</p>
                      <p className="text-xs text-slate-500">Optimized based on your portfolio & spending</p>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">Age {ssAnalysis?.winner?.age || 67}</span>
                  </div>
                </div>

                {/* Option 3: Maximize Early Portfolio */}
                <div
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${inputs.ssStartAge === 62 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                  onClick={() => onUpdateSSStartAge(62)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Maximize Early Portfolio</p>
                      <p className="text-xs text-slate-500">Start benefits early, preserve investments</p>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">Age 62</span>
                  </div>
                </div>
              </div>

              {clientInfo.isMarried && ssPartnerAnalysis && (
                <div className="mt-4 pt-3 border-t border-yellow-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-yellow-800 uppercase mb-1">Partner Recommendation</p>
                      <p className="text-sm text-slate-700">
                        Partner optimal claiming age: <strong className="text-emerald-700">{ssPartnerAnalysis?.winner?.age || 67}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => onUpdatePartnerSSStartAge(ssPartnerAnalysis?.winner?.age || 67)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      Apply Age {ssPartnerAnalysis?.winner?.age || 67}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Pension / Other Income */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Pension / Other Income
          </h3>

          <div className="space-y-4">
            {/* Primary Pension */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Monthly Pension <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Monthly pension or other guaranteed income amount.
                </div>
                <FormattedNumberInput
                  name="monthlyPension"
                  value={inputs.monthlyPension}
                  onChange={onInputChange}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Pension Start Age <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  The age your pension payments begin.
                </div>
                <input
                  type="number"
                  name="pensionStartAge"
                  value={inputs.pensionStartAge}
                  onChange={onInputChange}
                  min={55}
                  max={80}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
            </div>

            {/* Additional Income Streams */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-slate-700">Additional Income & One-Time Events</h4>
                <button
                  onClick={onAddAdditionalIncome}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Income
                </button>
              </div>

              {inputs.additionalIncomes?.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Add rental income, part-time work, inheritance, real estate sale, business sale, or other income sources.
                </p>
              )}

              {inputs.additionalIncomes?.map((income) => (
                <div key={income.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                  <div className="flex justify-between items-start mb-3">
                    <select
                      value={income.name}
                      onChange={(e) => {
                        const type = e.target.value;
                        onUpdateAdditionalIncome(income.id, 'name', type);
                        // Auto-set one-time for lump sum events
                        const oneTimeTypes = ['Real Estate Sale', 'Inheritance', 'Business Sale'];
                        const isOneTime = oneTimeTypes.includes(type);
                        onUpdateAdditionalIncome(income.id, 'isOneTime', isOneTime);
                        if (isOneTime) {
                          onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                        }
                      }}
                      className="text-sm font-medium text-slate-700 bg-white border rounded px-2 py-1"
                    >
                      <option value="">Select Type...</option>
                      <option value="Rental Income">Rental Income (Monthly)</option>
                      <option value="Part-Time Work">Part-Time Work (Monthly)</option>
                      <option value="Annuity">Annuity (Monthly)</option>
                      <option value="Real Estate Sale">Real Estate Sale (One-Time)</option>
                      <option value="Inheritance">Inheritance (One-Time)</option>
                      <option value="Business Sale">Business Sale (One-Time)</option>
                      <option value="Other">Other</option>
                    </select>
                    <button
                      onClick={() => onRemoveAdditionalIncome(income.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1">
                        {income.isOneTime ? 'Amount' : 'Monthly Amount'}
                      </label>
                      <FormattedNumberInput
                        value={income.amount}
                        onChange={(e) => onUpdateAdditionalIncome(income.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="p-2 border rounded w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase mb-1">
                        {income.isOneTime ? 'Age Received' : 'Start Age'}
                      </label>
                      <input
                        type="number"
                        value={income.startAge}
                        onChange={(e) => {
                          const age = parseInt(e.target.value) || 0;
                          onUpdateAdditionalIncome(income.id, 'startAge', age);
                          if (income.isOneTime) {
                            onUpdateAdditionalIncome(income.id, 'endAge', age);
                          }
                        }}
                        min={55}
                        max={100}
                        className="p-2 border rounded w-full text-sm"
                      />
                    </div>
                    {!income.isOneTime && (
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase mb-1">End Age</label>
                        <input
                          type="number"
                          value={income.endAge}
                          onChange={(e) => onUpdateAdditionalIncome(income.id, 'endAge', parseInt(e.target.value) || 100)}
                          min={income.startAge}
                          max={100}
                          className="p-2 border rounded w-full text-sm"
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-end gap-1">
                      <label className="flex items-center gap-1 text-[10px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={income.isOneTime}
                          onChange={(e) => {
                            onUpdateAdditionalIncome(income.id, 'isOneTime', e.target.checked);
                            if (e.target.checked) {
                              onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                            }
                          }}
                          className="w-3 h-3"
                        />
                        One-Time Event
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={income.inflationAdjusted}
                          onChange={(e) => onUpdateAdditionalIncome(income.id, 'inflationAdjusted', e.target.checked)}
                          className="w-3 h-3"
                        />
                        Inflation Adjusted
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  // Page 4: Summary + Solutions
  const renderPage4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Your Retirement Outlook</h2>
        <p className="text-slate-500 mt-2">Summary of your retirement plan projection</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox
          label="Starting Balance"
          value={`$${(inputs.totalPortfolio / 1000000).toFixed(2)}M`}
          subtext="At Retirement"
          icon={Briefcase}
          colorClass="bg-gray-800 text-white"
        />
        <StatBox
          label="Monthly Need"
          value={`$${inputs.monthlySpending.toLocaleString()}`}
          subtext="Inflation Adjusted"
          icon={DollarSign}
          colorClass="bg-yellow-500 text-white"
        />
        <StatBox
          label="Success Probability"
          value={`${monteCarloData?.successRate?.toFixed(1) || 0}%`}
          subtext="30-Year Projection"
          icon={Activity}
          colorClass={monteCarloData?.successRate > 80 ? "bg-emerald-600 text-white" : "bg-orange-500 text-white"}
        />
        <StatBox
          label="Legacy Balance"
          value={`$${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M`}
          subtext="Year 30 Projection"
          icon={Shield}
          colorClass="bg-emerald-800 text-white"
        />
      </div>

      {/* Portfolio Sustainability Chart */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Portfolio Sustainability</h3>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setShowCashFlowTable(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${!showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <BarChart2 className="w-3 h-3" /> Chart
            </button>
            <button
              onClick={() => setShowCashFlowTable(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <TableIcon className="w-3 h-3" /> Table
            </button>
          </div>
        </div>

        {!showCashFlowTable ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(val, name) => {
                    if (name === 'Distribution Rate') return `${val.toFixed(2)}%`;
                    return `$${val.toLocaleString()}`;
                  }}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Area type="monotone" dataKey="total" name="Portfolio Balance" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
                <Line type="monotone" dataKey="benchmark" name="Balanced 60/40" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-2 text-left">Age</th>
                  <th className="p-2">Start Balance</th>
                  <th className="p-2 text-emerald-600">Growth</th>
                  <th className="p-2 text-purple-600">Contribution</th>
                  <th className="p-2 text-blue-600">Income</th>
                  <th className="p-2 text-orange-600">Withdrawal</th>
                  <th className="p-2 text-slate-900">End Balance</th>
                </tr>
              </thead>
              <tbody>
                {projectionData.map((row) => (
                  <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                    <td className="p-2 text-slate-500">${row.startBalance.toLocaleString()}</td>
                    <td className="p-2 text-emerald-600">+${row.growth.toLocaleString()}</td>
                    <td className="p-2 text-purple-600">{row.contribution > 0 ? `+$${row.contribution.toLocaleString()}` : '-'}</td>
                    <td className="p-2 text-blue-600">+${row.ssIncome.toLocaleString()}</td>
                    <td className="p-2 text-orange-600">-${row.distribution.toLocaleString()}</td>
                    <td className={`p-2 font-bold ${row.total > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Improvement Solutions */}
      {improvementSolutions.needed && (
        <Card className="p-6 border-t-4 border-yellow-500">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-600" /> Ways to Improve Your Outcome
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            Your current success probability is <strong>{improvementSolutions.currentRate?.toFixed(1)}%</strong>.
            Here are three ways to reach 95% or higher:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-blue-800">Delay Retirement</h4>
              </div>
              <p className="text-2xl font-bold text-blue-700">{improvementSolutions.delayYears} years</p>
              <p className="text-xs text-blue-600 mt-1">
                Retire at age {clientInfo.retirementAge + improvementSolutions.delayYears} instead of {clientInfo.retirementAge}
              </p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-emerald-800">Save More</h4>
              </div>
              <p className="text-2xl font-bold text-emerald-700">${improvementSolutions.additionalSavings.toLocaleString()}/yr</p>
              <p className="text-xs text-emerald-600 mt-1">
                Increase annual savings to ${(clientInfo.annualSavings + improvementSolutions.additionalSavings).toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <h4 className="font-bold text-orange-800">Spend Less</h4>
              </div>
              <p className="text-2xl font-bold text-orange-700">-${improvementSolutions.spendingReduction.toLocaleString()}/mo</p>
              <p className="text-xs text-orange-600 mt-1">
                Reduce spending to ${(clientInfo.currentSpending - improvementSolutions.spendingReduction).toLocaleString()}/month
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {!improvementSolutions.needed && (
        <Card className="p-6 border-t-4 border-emerald-500">
          <div className="text-center">
            <Activity className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h3 className="font-bold text-xl text-slate-800 mb-2">You're On Track!</h3>
            <p className="text-slate-600">
              Your retirement plan has a {monteCarloData?.successRate?.toFixed(1)}% probability of success.
              You're well-positioned for a comfortable retirement.
            </p>
          </div>
        </Card>
      )}

      {/* Talk to Advisor CTA */}
      <div className="bg-black text-white p-8 rounded-xl text-center">
        <h3 className="text-2xl font-bold mb-2">Ready to Take the Next Step?</h3>
        <p className="text-gray-400 mb-6">
          Schedule a free consultation with a financial advisor to discuss your personalized retirement strategy.
        </p>
        <button
          onClick={onClientSubmit}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl transition-all"
        >
          <Send className="w-5 h-5" />
          {saveStatus === 'saving' ? 'Saving...' : 'Talk to an Advisor About My Plan'}
        </button>
      </div>
    </div>
  );

  // Progress indicator
  const renderProgress = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4].map((num) => (
        <div
          key={num}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
            wizardStep === num
              ? 'bg-emerald-600 text-white scale-110'
              : wizardStep > num
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-slate-200 text-slate-500'
          }`}
        >
          {num}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-black p-6 rounded-t-2xl text-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Retirement Planning</h1>
            <p className="text-yellow-500 text-sm mt-1">Step {wizardStep} of 4</p>
          </div>
          <img src={LOGO_URL} alt="Logo" className="h-12 w-auto bg-white p-2 rounded-lg" />
        </div>

        {/* Main Content */}
        <div className="bg-white p-8 rounded-b-2xl shadow-xl">
          {renderProgress()}

          {wizardStep === 1 && renderPage1()}
          {wizardStep === 2 && renderPage2()}
          {wizardStep === 3 && renderPage3()}
          {wizardStep === 4 && renderPage4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {wizardStep > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" /> Back
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 4 && (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-all"
              >
                Next <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientWizard;
