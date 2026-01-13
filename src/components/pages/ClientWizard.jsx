import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Legend } from 'recharts';
import { User, DollarSign, ArrowRight, ArrowLeft, Shield, Info, Activity, Briefcase, Send, TrendingUp, Clock, PiggyBank, BarChart2, Table as TableIcon, Plus, Trash2, AlertCircle } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber } from '../../utils';
import { Card, StatBox, FormattedNumberInput, Disclaimer } from '../ui';

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

  // Improvement solution selections
  const [selectedImprovements, setSelectedImprovements] = useState({
    delay: false,
    savings: false,
    spending: false
  });
  const [customImprovements, setCustomImprovements] = useState({
    delayYears: 0,
    additionalSavings: 0,
    spendingReduction: 0
  });

  // Calculate improvement solutions based on actual financial picture
  const improvementSolutions = useMemo(() => {
    const currentSuccessRate = monteCarloData?.successRate || 0;
    const targetSuccessRate = 95;

    if (currentSuccessRate >= targetSuccessRate) {
      return { needed: false, delayYears: 0, additionalSavings: 0, spendingReduction: 0 };
    }

    const successGap = targetSuccessRate - currentSuccessRate;
    const yearsToRetirement = Math.max(1, clientInfo.retirementAge - clientInfo.currentAge);
    const annualSpending = inputs.monthlySpending * 12;
    const portfolio = inputs.totalPortfolio || (accumulationData[accumulationData.length - 1]?.balance || 0);

    // Calculate existing additional income at retirement (annual)
    let additionalIncomeAtRetirement = 0;
    let oneTimeBoosts = 0;

    if (inputs.additionalIncomes && inputs.additionalIncomes.length > 0) {
      inputs.additionalIncomes.forEach(income => {
        if (income.isOneTime) {
          // One-time events add to portfolio, spread impact over 30 years
          if (income.startAge >= clientInfo.currentAge) {
            oneTimeBoosts += income.amount;
          }
        } else {
          // Recurring income at retirement age
          if (income.startAge <= clientInfo.retirementAge && income.endAge >= clientInfo.retirementAge) {
            additionalIncomeAtRetirement += income.amount * 12;
          }
        }
      });
    }

    // Estimate annual income gap (what the portfolio needs to cover after other income)
    // Using 4% rule as baseline for sustainable withdrawal
    const sustainableWithdrawal = portfolio * 0.04;
    const ssIncome = (inputs.ssPIA || 0) * 12; // Will start later but helps overall
    const pensionIncome = (inputs.monthlyPension || 0) * 12;

    // Total income sources (not all start at retirement, but they help overall)
    const projectedIncome = sustainableWithdrawal + additionalIncomeAtRetirement + (oneTimeBoosts * 0.04);
    const incomeGap = Math.max(0, annualSpending - projectedIncome);

    // Scale recommendations based on actual gap and situation
    // If there's significant additional income, recommendations should be smaller
    const gapRatio = incomeGap / Math.max(annualSpending, 1);
    const adjustmentFactor = Math.max(0.2, Math.min(1, gapRatio)); // Between 20% and 100%

    // Delay retirement: Each year of delay adds ~1 year of savings + portfolio growth
    // More impactful for smaller portfolios
    const baseDelayYears = Math.ceil(successGap / 4); // ~4% improvement per year
    const delayYears = Math.min(10, Math.max(1, Math.round(baseDelayYears * adjustmentFactor)));

    // Additional savings: Based on years to retirement and income gap
    // Each dollar saved compounds over years to retirement
    const compoundFactor = Math.pow(1.07, yearsToRetirement); // Assume 7% growth
    const targetAdditionalPortfolio = incomeGap / 0.04; // What additional portfolio would close the gap
    const rawAdditionalSavings = targetAdditionalPortfolio / yearsToRetirement / compoundFactor;
    const additionalSavings = Math.round(Math.max(1000, rawAdditionalSavings * adjustmentFactor) / 1000) * 1000;

    // Spending reduction: Direct impact on sustainability
    // Each $1 less in monthly spending = $12 less annual need = $300 less portfolio needed (at 4%)
    const spendingReductionNeeded = incomeGap / 12; // Monthly gap
    const spendingReduction = Math.round(Math.max(100, spendingReductionNeeded * adjustmentFactor) / 50) * 50;

    return {
      needed: true,
      delayYears,
      additionalSavings,
      spendingReduction,
      currentRate: currentSuccessRate,
      // Include context for display
      hasAdditionalIncome: additionalIncomeAtRetirement > 0 || oneTimeBoosts > 0,
      additionalIncomeAmount: additionalIncomeAtRetirement,
      oneTimeAmount: oneTimeBoosts
    };
  }, [monteCarloData, clientInfo, inputs, accumulationData]);

  // Initialize custom improvement values when improvementSolutions changes
  useEffect(() => {
    if (improvementSolutions.needed) {
      setCustomImprovements({
        delayYears: improvementSolutions.delayYears,
        additionalSavings: improvementSolutions.additionalSavings,
        spendingReduction: improvementSolutions.spendingReduction
      });
    }
  }, [improvementSolutions]);

  // Calculate adjusted projections based on selected improvements
  const adjustedProjections = useMemo(() => {
    const hasAnySelection = selectedImprovements.delay || selectedImprovements.savings || selectedImprovements.spending;

    if (!hasAnySelection) {
      return {
        hasChanges: false,
        portfolio: inputs.totalPortfolio,
        monthlyNeed: inputs.monthlySpending,
        successRate: monteCarloData?.successRate || 0,
        legacyBalance: projectionData[projectionData.length - 1]?.total || 0
      };
    }

    // Start with current values
    let adjustedPortfolio = inputs.totalPortfolio || (accumulationData[accumulationData.length - 1]?.balance || 0);
    let adjustedMonthlyNeed = inputs.monthlySpending;
    let successRateBoost = 0;

    // Delay retirement: more years to save + portfolio growth
    if (selectedImprovements.delay && customImprovements.delayYears > 0) {
      const delayYears = customImprovements.delayYears;
      const annualSavings = clientInfo.annualSavings || 0;
      const growthRate = (clientInfo.expectedReturn || 7) / 100;

      // Additional savings during delay years
      for (let i = 0; i < delayYears; i++) {
        adjustedPortfolio = adjustedPortfolio * (1 + growthRate) + annualSavings;
      }

      // Success rate improvement (~3-4% per year of delay)
      successRateBoost += delayYears * 3.5;
    }

    // Save more: additional savings compounded to retirement
    if (selectedImprovements.savings && customImprovements.additionalSavings > 0) {
      const yearsToRetirement = Math.max(1, clientInfo.retirementAge - clientInfo.currentAge);
      const growthRate = (clientInfo.expectedReturn || 7) / 100;
      const additionalSavings = customImprovements.additionalSavings;

      // Future value of additional annual savings
      const fvFactor = (Math.pow(1 + growthRate, yearsToRetirement) - 1) / growthRate;
      adjustedPortfolio += additionalSavings * fvFactor;

      // Success rate improvement based on portfolio increase
      const portfolioIncrease = (additionalSavings * fvFactor) / (inputs.totalPortfolio || 1);
      successRateBoost += Math.min(15, portfolioIncrease * 20);
    }

    // Spend less in retirement: direct reduction in monthly need
    if (selectedImprovements.spending && customImprovements.spendingReduction > 0) {
      adjustedMonthlyNeed = Math.max(0, inputs.monthlySpending - customImprovements.spendingReduction);

      // Success rate improvement (~1% per $100 reduction in monthly spending
      successRateBoost += Math.min(20, customImprovements.spendingReduction / 100);
    }

    // Calculate adjusted success rate (capped at 99%)
    const baseSuccessRate = monteCarloData?.successRate || 0;
    const adjustedSuccessRate = Math.min(99, baseSuccessRate + successRateBoost);

    // Estimate adjusted legacy balance
    // Simplified: assume legacy grows proportionally with portfolio increase and spending decrease
    const baseLegacy = projectionData[projectionData.length - 1]?.total || 0;
    const portfolioRatio = adjustedPortfolio / (inputs.totalPortfolio || 1);
    const spendingRatio = adjustedMonthlyNeed / (inputs.monthlySpending || 1);
    const legacyMultiplier = portfolioRatio * (2 - spendingRatio); // Higher portfolio + lower spending = higher legacy
    const adjustedLegacy = Math.max(0, baseLegacy * legacyMultiplier);

    return {
      hasChanges: true,
      portfolio: adjustedPortfolio,
      monthlyNeed: adjustedMonthlyNeed,
      successRate: adjustedSuccessRate,
      legacyBalance: adjustedLegacy
    };
  }, [selectedImprovements, customImprovements, inputs, clientInfo, monteCarloData, projectionData, accumulationData]);

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

    // Save progress before moving to next step (with error handling)
    try {
      if (onSaveProgress) {
        onSaveProgress();
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      // Continue to next step even if save fails
    }

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
          value={adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings)
            ? `$${(adjustedProjections.portfolio / 1000000).toFixed(2)}M`
            : `$${(inputs.totalPortfolio / 1000000).toFixed(2)}M`}
          subtext={adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings)
            ? <><span className="line-through opacity-60">${(inputs.totalPortfolio / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.portfolio - inputs.totalPortfolio) / 1000).toFixed(0)}k</>
            : "At Retirement"}
          icon={Briefcase}
          colorClass={`bg-gray-800 text-white ${adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings) ? 'ring-2 ring-emerald-400' : ''}`}
        />
        <StatBox
          label="Monthly Need"
          value={adjustedProjections.hasChanges && selectedImprovements.spending
            ? `$${adjustedProjections.monthlyNeed.toLocaleString()}`
            : `$${inputs.monthlySpending.toLocaleString()}`}
          subtext={adjustedProjections.hasChanges && selectedImprovements.spending
            ? <><span className="line-through opacity-60">${inputs.monthlySpending.toLocaleString()}</span> → -${(inputs.monthlySpending - adjustedProjections.monthlyNeed).toLocaleString()}/mo</>
            : "Inflation Adjusted"}
          icon={DollarSign}
          colorClass={`bg-yellow-500 text-white ${adjustedProjections.hasChanges && selectedImprovements.spending ? 'ring-2 ring-emerald-400' : ''}`}
        />
        <StatBox
          label="Success Probability"
          value={adjustedProjections.hasChanges
            ? `${adjustedProjections.successRate.toFixed(1)}%`
            : `${(monteCarloData?.successRate || 0).toFixed(1)}%`}
          subtext={adjustedProjections.hasChanges
            ? <><span className="line-through opacity-60">{(monteCarloData?.successRate || 0).toFixed(1)}%</span> → +{(adjustedProjections.successRate - (monteCarloData?.successRate || 0)).toFixed(1)}%</>
            : "30-Year Projection"}
          icon={Activity}
          colorClass={`${(adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate) > 80 ? "bg-emerald-600" : "bg-orange-500"} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
        />
        <StatBox
          label="Legacy Balance"
          value={adjustedProjections.hasChanges
            ? `$${(adjustedProjections.legacyBalance / 1000000).toFixed(2)}M`
            : `$${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M`}
          subtext={adjustedProjections.hasChanges
            ? <><span className="line-through opacity-60">${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.legacyBalance - (projectionData[projectionData.length - 1]?.total || 0)) / 1000).toFixed(0)}k</>
            : "Year 30 Projection"}
          icon={Shield}
          colorClass={`bg-emerald-800 text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
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
          <>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(val, name) => {
                      if (name === 'Distribution Rate') return `${val.toFixed(2)}%`;
                      return `$${val.toLocaleString()}`;
                    }}
                    labelFormatter={(l) => `Year ${l}`}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="Miller Portfolio Architect Strategy" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
                  <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40 (Annual Rebalance)" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
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
          <p className="text-sm text-slate-600 mb-4">
            Your current success probability is <strong>{improvementSolutions.currentRate?.toFixed(1)}%</strong>.
            Select one or more options below and adjust the amounts to see what works for you:
          </p>
          {improvementSolutions.hasAdditionalIncome && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <strong>Note:</strong> These recommendations already factor in your additional income
              {improvementSolutions.additionalIncomeAmount > 0 && (
                <span> (${(improvementSolutions.additionalIncomeAmount / 12).toLocaleString()}/mo recurring)</span>
              )}
              {improvementSolutions.oneTimeAmount > 0 && (
                <span> and one-time events (${improvementSolutions.oneTimeAmount.toLocaleString()})</span>
              )}
              .
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Delay Retirement Option */}
            <div
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedImprovements.delay
                  ? 'bg-blue-100 border-blue-500 shadow-md'
                  : 'bg-blue-50 border-blue-200 hover:border-blue-400'
              }`}
              onClick={() => setSelectedImprovements(prev => ({ ...prev, delay: !prev.delay }))}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedImprovements.delay}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedImprovements(prev => ({ ...prev, delay: e.target.checked }));
                    }}
                    className="w-5 h-5 text-blue-600 rounded border-blue-300"
                  />
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h4 className="font-bold text-blue-800">Delay Retirement</h4>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-blue-600 uppercase font-bold">Years to Delay</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={customImprovements.delayYears}
                  onChange={(e) => {
                    e.stopPropagation();
                    setCustomImprovements(prev => ({ ...prev, delayYears: parseInt(e.target.value) || 0 }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-2 border rounded text-lg font-bold text-blue-700 bg-white"
                />
                <p className="text-xs text-blue-600">
                  New retirement age: <strong>{clientInfo.retirementAge + customImprovements.delayYears}</strong>
                </p>
              </div>
            </div>

            {/* Save More Option */}
            <div
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedImprovements.savings
                  ? 'bg-emerald-100 border-emerald-500 shadow-md'
                  : 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
              }`}
              onClick={() => setSelectedImprovements(prev => ({ ...prev, savings: !prev.savings }))}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedImprovements.savings}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedImprovements(prev => ({ ...prev, savings: e.target.checked }));
                    }}
                    className="w-5 h-5 text-emerald-600 rounded border-emerald-300"
                  />
                  <PiggyBank className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-emerald-800">Save More</h4>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-emerald-600 uppercase font-bold">Additional Savings/Year</label>
                <FormattedNumberInput
                  value={customImprovements.additionalSavings}
                  onChange={(e) => {
                    setCustomImprovements(prev => ({ ...prev, additionalSavings: parseFloat(e.target.value) || 0 }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-2 border rounded text-lg font-bold text-emerald-700 bg-white"
                />
                <p className="text-xs text-emerald-600">
                  New total: <strong>${(clientInfo.annualSavings + customImprovements.additionalSavings).toLocaleString()}/yr</strong>
                </p>
              </div>
            </div>

            {/* Spend Less in Retirement Option */}
            <div
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedImprovements.spending
                  ? 'bg-orange-100 border-orange-500 shadow-md'
                  : 'bg-orange-50 border-orange-200 hover:border-orange-400'
              }`}
              onClick={() => setSelectedImprovements(prev => ({ ...prev, spending: !prev.spending }))}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedImprovements.spending}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedImprovements(prev => ({ ...prev, spending: e.target.checked }));
                    }}
                    className="w-5 h-5 text-orange-600 rounded border-orange-300"
                  />
                  <DollarSign className="w-5 h-5 text-orange-600" />
                  <h4 className="font-bold text-orange-800">Spend Less in Retirement</h4>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-orange-600 uppercase font-bold">Reduce Monthly Need</label>
                <FormattedNumberInput
                  value={customImprovements.spendingReduction}
                  onChange={(e) => {
                    setCustomImprovements(prev => ({ ...prev, spendingReduction: parseFloat(e.target.value) || 0 }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-2 border rounded text-lg font-bold text-orange-700 bg-white"
                />
                <p className="text-xs text-orange-600">
                  New retirement need: <strong>${Math.max(0, inputs.monthlySpending - customImprovements.spendingReduction).toLocaleString()}/mo</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Selected Improvements Summary */}
          {(selectedImprovements.delay || selectedImprovements.savings || selectedImprovements.spending) && (
            <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-300">
              <h4 className="font-bold text-slate-800 mb-3">Your Selected Improvements</h4>
              <div className="space-y-2 text-sm">
                {selectedImprovements.delay && (
                  <div className="flex items-center gap-2 text-blue-700">
                    <Clock className="w-4 h-4" />
                    <span>Delay retirement by <strong>{customImprovements.delayYears} years</strong> (retire at {clientInfo.retirementAge + customImprovements.delayYears})</span>
                  </div>
                )}
                {selectedImprovements.savings && (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <PiggyBank className="w-4 h-4" />
                    <span>Save an additional <strong>${customImprovements.additionalSavings.toLocaleString()}/year</strong></span>
                  </div>
                )}
                {selectedImprovements.spending && (
                  <div className="flex items-center gap-2 text-orange-700">
                    <DollarSign className="w-4 h-4" />
                    <span>Reduce retirement monthly need by <strong>${customImprovements.spendingReduction.toLocaleString()}/month</strong> (to ${Math.max(0, inputs.monthlySpending - customImprovements.spendingReduction).toLocaleString()}/mo)</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3 italic">
                Discuss these options with your advisor to see the impact on your retirement projections.
              </p>
            </div>
          )}
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
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
      {[1, 2, 3, 4].map((num) => (
        <div
          key={num}
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-black p-4 sm:p-6 rounded-t-2xl text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 sm:h-12 md:h-[72px] w-auto bg-white p-1 sm:p-2 rounded-lg flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Retirement Planning</h1>
              <p className="text-yellow-500 text-xs sm:text-sm mt-1">Step {wizardStep} of 4</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-2xl shadow-xl">
          {renderProgress()}

          {wizardStep === 1 && renderPage1()}
          {wizardStep === 2 && renderPage2()}
          {wizardStep === 3 && renderPage3()}
          {wizardStep === 4 && renderPage4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
            {wizardStep > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-sm sm:text-base"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 4 && (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-all text-sm sm:text-base"
              >
                Next <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          <Disclaimer />
        </div>
      </div>
    </div>
  );
};

export default ClientWizard;
