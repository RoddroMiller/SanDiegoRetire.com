import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Legend } from 'recharts';
import { User, DollarSign, ArrowRight, ArrowLeft, Shield, Info, Activity, Briefcase, Send, TrendingUp, Clock, PiggyBank, BarChart2, Table as TableIcon, Plus, Trash2, AlertCircle } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber, getAdjustedSS } from '../../utils';
import { Card, StatBox, FormattedNumberInput, Disclaimer, ImportantDisclosures } from '../ui';

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

  // Auto-save every 30 seconds while on page 2
  useEffect(() => {
    if (wizardStep === 2 && onSaveProgress) {
      const intervalId = setInterval(() => {
        try {
          onSaveProgress();
        } catch (error) {
          console.error('Auto-save error:', error);
        }
      }, 30000);
      return () => clearInterval(intervalId);
    }
  }, [wizardStep, onSaveProgress]);

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

    // Total income sources (not all start at retirement, but they help overall)
    const projectedIncome = sustainableWithdrawal + additionalIncomeAtRetirement + (oneTimeBoosts * 0.04);
    const incomeGap = Math.max(0, annualSpending - projectedIncome);

    // Calculate recommendations that would each independently solve the problem
    // Delay retirement: Each year adds ~4% to success rate through additional savings and portfolio growth
    const delayYears = Math.min(10, Math.max(1, Math.ceil(successGap / 4)));

    // Additional savings: Calculate how much additional monthly savings would close the income gap
    // Each dollar saved compounds over years to retirement
    const compoundFactor = Math.pow(1.07, yearsToRetirement);
    const targetAdditionalPortfolio = (annualSpending - projectedIncome) / 0.04;
    const rawAdditionalSavings = Math.max(0, targetAdditionalPortfolio) / yearsToRetirement / compoundFactor;
    const additionalSavings = Math.round(Math.max(500, rawAdditionalSavings) / 500) * 500;

    // Spending reduction: How much monthly spending reduction would make the plan sustainable
    const spendingReductionNeeded = Math.max(0, (annualSpending - projectedIncome)) / 12;
    const spendingReduction = Math.round(Math.max(100, spendingReductionNeeded) / 50) * 50;

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

    let adjustedPortfolio = inputs.totalPortfolio || (accumulationData[accumulationData.length - 1]?.balance || 0);
    let adjustedMonthlyNeed = inputs.monthlySpending;

    if (selectedImprovements.delay && customImprovements.delayYears > 0) {
      const delayYears = customImprovements.delayYears;
      const annualSavings = clientInfo.annualSavings || 0;
      const growthRate = (clientInfo.expectedReturn || 7) / 100;
      for (let i = 0; i < delayYears; i++) {
        adjustedPortfolio = adjustedPortfolio * (1 + growthRate) + annualSavings;
      }
    }

    if (selectedImprovements.savings && customImprovements.additionalSavings > 0) {
      const yearsToRetirement = Math.max(1, clientInfo.retirementAge - clientInfo.currentAge);
      const growthRate = (clientInfo.expectedReturn || 7) / 100;
      const fvFactor = (Math.pow(1 + growthRate, yearsToRetirement) - 1) / growthRate;
      adjustedPortfolio += customImprovements.additionalSavings * fvFactor;
    }

    if (selectedImprovements.spending && customImprovements.spendingReduction > 0) {
      adjustedMonthlyNeed = Math.max(0, inputs.monthlySpending - customImprovements.spendingReduction);
    }

    // Calculate success rate based on distribution rate
    // Distribution rate = (annual spending / portfolio) * 100
    const annualSpending = adjustedMonthlyNeed * 12;
    const distributionRate = adjustedPortfolio > 0 ? (annualSpending / adjustedPortfolio) * 100 : 100;

    // Success rate based on distribution rate:
    // <= 2% = 99%, 3% = 95%, 4% = 90%, 5% = 80%, 6% = 65%, 7% = 50%, 8%+ = declining
    let adjustedSuccessRate;
    if (distributionRate <= 2) {
      adjustedSuccessRate = 99;
    } else if (distributionRate <= 3) {
      adjustedSuccessRate = 99 - (distributionRate - 2) * 4; // 99 to 95
    } else if (distributionRate <= 4) {
      adjustedSuccessRate = 95 - (distributionRate - 3) * 5; // 95 to 90
    } else if (distributionRate <= 5) {
      adjustedSuccessRate = 90 - (distributionRate - 4) * 10; // 90 to 80
    } else if (distributionRate <= 6) {
      adjustedSuccessRate = 80 - (distributionRate - 5) * 15; // 80 to 65
    } else if (distributionRate <= 7) {
      adjustedSuccessRate = 65 - (distributionRate - 6) * 15; // 65 to 50
    } else if (distributionRate <= 10) {
      adjustedSuccessRate = 50 - (distributionRate - 7) * 10; // 50 to 20
    } else {
      adjustedSuccessRate = Math.max(5, 20 - (distributionRate - 10) * 5);
    }

    const baseLegacy = projectionData[projectionData.length - 1]?.total || 0;
    const portfolioRatio = adjustedPortfolio / (inputs.totalPortfolio || 1);
    const spendingRatio = adjustedMonthlyNeed / (inputs.monthlySpending || 1);
    const legacyMultiplier = portfolioRatio * (2 - spendingRatio);
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

    setWizardStep(prev => Math.min(prev + 1, 2));
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setWizardStep(prev => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };

  // Page 1: Contact Info + Ages + Portfolio, Spending, Savings + Chart
  const renderPage1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Let's Get Started</h2>
        <p className="text-slate-500 mt-2">Tell us about yourself and your financial picture</p>
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
              Retirement Status
            </label>
            <button
              type="button"
              onClick={() => onClientChange({ target: { name: 'isRetired', type: 'checkbox', checked: !clientInfo.isRetired } })}
              className={`w-full p-3 rounded-lg font-bold transition-all ${
                clientInfo.isRetired
                  ? 'bg-emerald-600 text-white border-2 border-emerald-600'
                  : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-emerald-400'
              }`}
            >
              {clientInfo.isRetired ? '✓ Already Retired' : 'Already Retired?'}
            </button>
          </div>
          {!clientInfo.isRetired && (
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
          )}
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

      {/* Financial Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

      <ImportantDisclosures />
    </div>
  );

  // Page 2: Retirement Income (SS, Pension) + Summary + Solutions
  const renderPage2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Retirement Income Sources</h2>
        <p className="text-slate-500 mt-2">Social Security, pensions, and other income</p>
      </div>

      {/* Social Security */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" /> Social Security
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {clientInfo.currentAge >= 67 ? (
            // Over FRA - ask for current benefit amount
            <div className="relative group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                Your Monthly SS Benefit <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                Your current monthly Social Security benefit amount.
              </div>
              <FormattedNumberInput
                name="ssPIA"
                value={inputs.ssPIA}
                onChange={onInputChange}
                className="p-3 border rounded-lg w-full"
              />
            </div>
          ) : (
            // Under FRA - ask for PIA and start age
            <>
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
            </>
          )}
          {clientInfo.isMarried && (
            <>
              {clientInfo.partnerAge >= 67 ? (
                // Partner over FRA - ask for current benefit amount
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Partner Monthly SS <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Your partner's current monthly Social Security benefit amount.
                  </div>
                  <FormattedNumberInput
                    name="partnerSSPIA"
                    value={inputs.partnerSSPIA}
                    onChange={onInputChange}
                    className="p-3 border rounded-lg w-full"
                  />
                </div>
              ) : (
                // Partner under FRA - ask for PIA and start age
                <>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Partner Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
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
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Claiming Strategy Options - Only show if under FRA */}
      {clientInfo.currentAge < 67 && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="relative group inline-block mb-3">
            <p className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-1 cursor-help">
              Claiming Strategy Options <Info className="w-3 h-3 text-yellow-600" />
            </p>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 bg-slate-800 text-white text-xs p-3 rounded shadow-lg z-20">
              <p className="font-bold mb-1">How is the recommendation calculated?</p>
              <p>We analyze each claiming age (62-70) by simulating your portfolio through retirement. The recommended age is the one that results in the largest portfolio balance at age 80, considering your spending needs and other income sources.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

            {/* Option 2: Full Retirement Age */}
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${inputs.ssStartAge === 67 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
              onClick={() => onUpdateSSStartAge(67)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-800">Full Retirement Age</p>
                  <p className="text-xs text-slate-500">Claim at FRA with no reduction or increase</p>
                </div>
                <span className="text-lg font-bold text-emerald-700">Age 67</span>
              </div>
            </div>

            {/* Option 3: Optimized / Recommended */}
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${inputs.ssStartAge === (ssAnalysis?.winner?.age || 67) && inputs.ssStartAge !== 70 && inputs.ssStartAge !== 67 && inputs.ssStartAge !== 62 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
              onClick={() => onUpdateSSStartAge(ssAnalysis?.winner?.age || 67)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-800">Optimized (Recommended)</p>
                  <p className="text-xs text-slate-500">Maximizes portfolio at age 80</p>
                </div>
                <span className="text-lg font-bold text-emerald-700">Age {ssAnalysis?.winner?.age || 67}</span>
              </div>
            </div>

            {/* Option 4: Maximize Early Portfolio */}
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

          {clientInfo.isMarried && clientInfo.partnerAge < 67 && ssPartnerAnalysis && (
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
      )}

      {/* Pension / Other Income */}
      <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Pension / Other Income
          </h3>

          <div className="space-y-4">
            {/* Primary Pension */}
            <div className="grid grid-cols-3 gap-4">
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
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  COLA <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Does your pension have a Cost of Living Adjustment (inflation increase)?
                </div>
                <button
                  type="button"
                  onClick={() => onInputChange({ target: { name: 'pensionCOLA', type: 'checkbox', checked: !inputs.pensionCOLA } })}
                  className={`w-full p-3 rounded-lg font-bold transition-all ${
                    inputs.pensionCOLA
                      ? 'bg-emerald-600 text-white border-2 border-emerald-600'
                      : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-emerald-400'
                  }`}
                >
                  {inputs.pensionCOLA ? '✓ Yes' : 'No'}
                </button>
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

      {/* Summary Section */}
      <div className="text-center my-8">
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
          label="Total Monthly Spend"
          value={adjustedProjections.hasChanges && selectedImprovements.spending
            ? `$${adjustedProjections.monthlyNeed.toLocaleString()}`
            : `$${inputs.monthlySpending.toLocaleString()}`}
          subtext={(() => {
            const monthlySpend = adjustedProjections.hasChanges && selectedImprovements.spending
              ? adjustedProjections.monthlyNeed
              : inputs.monthlySpending;
            const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge);
            const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) : 0;
            const portfolioWithdrawal = Math.max(0, monthlySpend - clientSS - partnerSS);
            return `$${Math.round(portfolioWithdrawal).toLocaleString()}/mo from portfolio`;
          })()}
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

      {/* Adjust Your Plan - Always visible */}
      <Card className="p-6 border-t-4 border-slate-400">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-600" /> Adjust Your Plan
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Fine-tune your retirement assumptions to see how changes affect your outlook.
        </p>

        <div className="space-y-4">
          {!clientInfo.isRetired && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-blue-800">Retirement Age</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Working longer allows your portfolio to grow and reduces years drawing from it.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-bold text-blue-700 uppercase">Age</label>
                    <FormattedNumberInput
                      name="retirementAge"
                      value={clientInfo.retirementAge}
                      onChange={onClientChange}
                      className="p-2 border border-blue-300 rounded-lg w-20 text-center font-bold text-blue-800 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!clientInfo.isRetired && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-start gap-3">
                <PiggyBank className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-emerald-800">Annual Savings</h4>
                  <p className="text-sm text-emerald-700 mt-1">
                    Saving more now boosts your retirement portfolio through compounding.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-bold text-emerald-700 uppercase">Per Year</label>
                    <FormattedNumberInput
                      name="annualSavings"
                      value={clientInfo.annualSavings}
                      onChange={onClientChange}
                      className="p-2 border border-emerald-300 rounded-lg w-28 text-center font-bold text-emerald-800 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-orange-800">Monthly Spending in Retirement</h4>
                <p className="text-sm text-orange-700 mt-1">
                  Adjusting your retirement lifestyle changes how much you need from your portfolio.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-orange-700 uppercase">Per Month</label>
                    <FormattedNumberInput
                      name="monthlySpending"
                      value={inputs.monthlySpending}
                      onChange={onInputChange}
                      className="p-2 border border-orange-300 rounded-lg w-28 text-center font-bold text-orange-800 bg-white"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const portfolioWithdrawal = (inputs.totalPortfolio * 0.04) / 12;
                      const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge);
                      const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) : 0;
                      const fourPercentMonthly = Math.round(portfolioWithdrawal + clientSS + partnerSS);
                      onInputChange({ target: { name: 'monthlySpending', value: fourPercentMonthly, type: 'number' } });
                    }}
                    className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Try 4% Rule (${(() => {
                      const portfolioWithdrawal = (inputs.totalPortfolio * 0.04) / 12;
                      const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge);
                      const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) : 0;
                      return Math.round(portfolioWithdrawal + clientSS + partnerSS).toLocaleString();
                    })()}/mo)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Planning Guidance */}
      {(() => {
        const successRate = monteCarloData?.successRate || 0;
        const legacyBalance = projectionData[projectionData.length - 1]?.total || 0;
        const annualSpending = inputs.monthlySpending * 12;
        const legacyToSpendingRatio = legacyBalance / annualSpending;
        const isLowSuccess = successRate < 80;
        const isVeryHighLegacy = successRate >= 95 && legacyToSpendingRatio > 20;

        if (isLowSuccess) {
          return (
            <Card className="p-6 border-t-4 border-yellow-500">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" /> Ways to Improve Your Outcome
              </h3>
              <p className="text-sm text-slate-600">
                Your current success probability is <strong>{successRate.toFixed(1)}%</strong>.
                Consider delaying retirement, increasing savings, or reducing spending using the controls above.
              </p>
              <p className="text-xs text-slate-500 mt-4 italic">
                Discuss these options with your financial advisor to determine the best approach for your situation.
              </p>
            </Card>
          );
        } else if (isVeryHighLegacy) {
          return (
            <Card className="p-6 border-t-4 border-purple-500">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" /> You May Be Leaving a Large Legacy
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                With a <strong>{successRate.toFixed(1)}%</strong> success probability and a projected legacy of
                <strong> ${(legacyBalance / 1000000).toFixed(2)}M</strong>, you may have more flexibility than you realize.
                Consider whether you'd prefer to enjoy more of your wealth during retirement:
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-purple-800">Consider Retiring Earlier</h4>
                      <p className="text-sm text-purple-700 mt-1">
                        With your strong financial position, you may be able to start retirement sooner and enjoy more years of freedom.
                        To explore this, go back to Step 1 and decrease your Retirement Age.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-indigo-800">Increase Your Retirement Lifestyle</h4>
                      <p className="text-sm text-indigo-700 mt-1">
                        You could afford a more comfortable retirement with additional travel, hobbies, or experiences.
                        To explore this, go back to Step 1 and increase your Monthly Spending.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-4 italic">
                Of course, if leaving a legacy is important to you, your current plan accomplishes that goal beautifully.
              </p>
            </Card>
          );
        } else {
          return (
            <Card className="p-6 border-t-4 border-emerald-500">
              <div className="text-center">
                <Activity className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <h3 className="font-bold text-xl text-slate-800 mb-2">You're On Track!</h3>
                <p className="text-slate-600">
                  Your retirement plan has a {successRate.toFixed(1)}% probability of success.
                  You're well-positioned for a comfortable retirement.
                </p>
              </div>
            </Card>
          );
        }
      })()}

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

      <ImportantDisclosures />
    </div>
  );

  // Progress indicator
  const renderProgress = () => (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
      {[1, 2].map((num) => (
        <div
          key={num}
          onClick={() => {
            if (num <= wizardStep) {
              setWizardStep(num);
              window.scrollTo(0, 0);
            }
          }}
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
            wizardStep === num
              ? 'bg-emerald-600 text-white scale-110'
              : wizardStep > num
              ? 'bg-emerald-200 text-emerald-800 cursor-pointer hover:bg-emerald-300'
              : 'bg-slate-200 text-slate-500'
          } ${num <= wizardStep ? 'cursor-pointer' : ''}`}
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
              <p className="text-yellow-500 text-xs sm:text-sm mt-1">Step {wizardStep} of 2</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-2xl shadow-xl">
          {renderProgress()}

          {wizardStep === 1 && renderPage1()}
          {wizardStep === 2 && renderPage2()}

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

            {wizardStep < 2 && (
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
