import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Legend } from 'recharts';
import { User, DollarSign, ArrowRight, ArrowLeft, Shield, Info, Activity, Briefcase, Send, TrendingUp, Clock, PiggyBank, BarChart2, Table as TableIcon, Plus, Trash2, AlertCircle, LogOut, ExternalLink, X, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { formatPhoneNumber, getAdjustedSS, estimatePIAFromIncome } from '../../utils';
import { containsSSN } from '../../utils/piiValidation';
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
  onClientFinish,
  saveStatus,
  // SS Optimizer
  targetMaxPortfolioAge,
  onSetTargetMaxPortfolioAge,
  onUpdateSSStartAge,
  onUpdatePartnerSSStartAge,
  // Additional Income
  onAddAdditionalIncome,
  onUpdateAdditionalIncome,
  onRemoveAdditionalIncome,
  // Cash Flow Adjustments
  onAddCashFlowAdjustment,
  onUpdateCashFlowAdjustment,
  onRemoveCashFlowAdjustment,
  // Registered client props
  isRegisteredClient = false,
  onLogout
}) => {
  const [wizardStep, setWizardStep] = useState(1);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [mcScenario, setMcScenario] = useState('median');
  const [validationError, setValidationError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSSEstimator, setShowSSEstimator] = useState(false);
  const [ssEstimateIncome, setSSEstimateIncome] = useState('');
  const [showPartnerSSEstimator, setShowPartnerSSEstimator] = useState(false);
  const [partnerSSEstimateIncome, setPartnerSSEstimateIncome] = useState('');
  const [showWhatsNext, setShowWhatsNext] = useState(false);
  const [showSSAbout, setShowSSAbout] = useState(false);
  const [showPensionIncome, setShowPensionIncome] = useState(false);

  // Cap projection data at age 95 to avoid projecting legacy balances at unrealistic ages
  const cappedProjectionData = useMemo(() => {
    if (!projectionData || projectionData.length === 0) return projectionData;
    return projectionData.filter(row => row.age <= 95);
  }, [projectionData]);

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

  // Validate SS ages and income fields
  useEffect(() => {
    const errors = {};

    // Validate SS start age (must be 62-70)
    if (inputs.ssStartAge && (inputs.ssStartAge < 62 || inputs.ssStartAge > 70)) {
      errors.ssStartAge = 'Must be between 62 and 70';
    }
    if (inputs.partnerSSStartAge && (inputs.partnerSSStartAge < 62 || inputs.partnerSSStartAge > 70)) {
      errors.partnerSSStartAge = 'Must be between 62 and 70';
    }

    // Validate additional incomes
    if (inputs.additionalIncomes) {
      inputs.additionalIncomes.forEach(income => {
        if (!income.isOneTime && income.endAge < income.startAge) {
          errors[`income_${income.id}_endAge`] = 'End age must be >= start age';
        }
      });
    }

    setFieldErrors(errors);
  }, [inputs.ssStartAge, inputs.partnerSSStartAge, inputs.additionalIncomes]);

  // Auto-estimate SS PIA from income (or default $2500) when entering page 2 if not already set
  useEffect(() => {
    if (wizardStep === 2 && !inputs.ssPIA) {
      const income = clientInfo.annualIncome || 0;
      const pia = income > 0 ? estimatePIAFromIncome(income) : 2500;
      if (pia > 0) {
        onInputChange({ target: { name: 'ssPIA', value: pia } });
      }
    }
  }, [wizardStep]); // eslint-disable-line react-hooks/exhaustive-deps

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
        legacyBalance: monteCarloData?.medianLegacy || cappedProjectionData[cappedProjectionData.length - 1]?.total || 0
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

    const baseLegacy = monteCarloData?.medianLegacy || cappedProjectionData[cappedProjectionData.length - 1]?.total || 0;
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
  }, [selectedImprovements, customImprovements, inputs, clientInfo, monteCarloData, cappedProjectionData, accumulationData]);

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
        <p className="text-mwm-green font-semibold text-lg mb-2">Visualize Your Retirement</p>
        <h2 className="text-2xl font-bold text-slate-800">Let's Get Started</h2>
        <p className="text-slate-500 mt-2">See how your savings today can support your retirement lifestyle tomorrow</p>
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
          <User className="w-5 h-5 text-mwm-green" /> Personal Details
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
              className={`p-3 border rounded-lg w-full focus:ring-mwm-green focus:border-mwm-green ${validationError && !clientInfo.name?.trim() ? 'border-red-300 bg-red-50' : ''}`}
              value={clientInfo.name}
              onChange={(e) => {
                if (containsSSN(e.target.value)) {
                  alert('SSN/PII not allowed in this field for security purposes.');
                  return;
                }
                onClientChange(e);
              }}
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
              className={`p-3 border rounded-lg w-full focus:ring-mwm-green focus:border-mwm-green ${validationError && !clientInfo.email?.trim() ? 'border-red-300 bg-red-50' : ''}`}
              value={clientInfo.email}
              onChange={onClientChange}
            />
          </div>
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <input
              type="checkbox"
              name="isMarried"
              checked={clientInfo.isMarried}
              onChange={onClientChange}
              className="w-5 h-5 text-mwm-green"
            />
            <label className="text-sm text-slate-600">Married / Partner?</label>
          </div>
        </div>
      </div>

      {/* Age Inputs */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-mwm-green" /> Retirement Timeline
        </h3>
        {/* Your Info Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  ? 'bg-mwm-green text-white border-2 border-mwm-green'
                  : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-mwm-green/60'
              }`}
            >
              {clientInfo.isRetired ? '✓ Retired/Not Employed' : 'Already Retired/Not Employed?'}
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
        </div>
        {/* Partner Info Row */}
        {clientInfo.isMarried && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partner's Name</label>
              <input
                type="text"
                name="partnerName"
                value={clientInfo.partnerName || ''}
                onChange={onClientChange}
                placeholder="Partner's Name"
                className="p-3 border rounded-lg w-full text-sm"
              />
            </div>
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
                Partner Status
              </label>
              <button
                type="button"
                onClick={() => onClientChange({ target: { name: 'partnerIsRetired', type: 'checkbox', checked: !clientInfo.partnerIsRetired } })}
                className={`w-full p-3 rounded-lg font-bold transition-all ${
                  clientInfo.partnerIsRetired
                    ? 'bg-mwm-green text-white border-2 border-mwm-green'
                    : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-mwm-green/60'
                }`}
              >
                {clientInfo.partnerIsRetired ? '✓ Retired/Not Employed' : 'Already Retired/Not Employed?'}
              </button>
            </div>
            {!clientInfo.partnerIsRetired && (
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
            )}
          </div>
        )}
      </div>

      {/* Financial Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-mwm-green" /> Today's Financial Inputs
          </h3>

          <div className="relative group">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              Current Portfolio <Info className="w-3 h-3 text-slate-400" />
            </label>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
              Total of all 401k-type accounts, Roth, IRA, other retirement assets, and non-retirement investment accounts.
            </div>
            <FormattedNumberInput
              name="currentPortfolio"
              value={clientInfo.currentPortfolio}
              onChange={onClientChange}
              className="p-3 border rounded-lg w-full text-lg font-bold text-mwm-green/80"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                Current Monthly Spending <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                Your current monthly expenses including housing, utilities, food, transportation, healthcare, vacations, and entertainment. Excludes savings and taxes.
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
                Current Annual Savings <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                Your current yearly contributions to all retirement accounts (401k, IRA, Roth) plus after-tax savings and investment accounts.
              </div>
              <FormattedNumberInput
                name="annualSavings"
                value={clientInfo.annualSavings}
                onChange={onClientChange}
                className="p-3 border rounded-lg w-full"
              />
            </div>
          </div>

          <div className={`grid ${clientInfo.isMarried ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <div className="relative group">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                {clientInfo.isMarried ? 'Your Annual Income' : 'Annual Income (Including Bonus)'} <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                Your total annual income including salary, bonuses, and other regular employment income before taxes.
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
                  Partner Annual Income <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Partner's total annual income including salary, bonuses, and other regular employment income before taxes.
                </div>
                <FormattedNumberInput
                  name="partnerAnnualIncome"
                  value={clientInfo.partnerAnnualIncome}
                  onChange={onClientChange}
                  className="p-3 border rounded-lg w-full"
                />
              </div>
            )}
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

          <div className="mt-6 p-4 bg-mwm-green/10 rounded-lg border border-mwm-green/30">
            <p className="text-sm text-slate-600">Projected Portfolio at Retirement</p>
            <p className="text-3xl font-bold text-mwm-green/80">
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
                  formatter={(val) => `$${Math.round(val).toLocaleString()}`}
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

      {/* Key Assumptions - Full Width */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Projection Assumptions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <span className="text-mwm-green mt-0.5">•</span>
            <span>Annual savings increase with inflation each year</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-mwm-green mt-0.5">•</span>
            <span>Contributions made at start of year, then growth applied</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-mwm-green mt-0.5">•</span>
            <span>No withdrawals from portfolio before retirement</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-mwm-green mt-0.5">•</span>
            <span>Continuous savings until retirement date</span>
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
          <Shield className="w-5 h-5 text-mwm-green" /> Social Security
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
              <button type="button" onClick={() => setShowSSEstimator(!showSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                {showSSEstimator ? 'Hide estimator' : "Don't know? Estimate from income"}
              </button>
              {showSSEstimator && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Annual income"
                    value={ssEstimateIncome}
                    onChange={e => setSSEstimateIncome(e.target.value)}
                    className="p-2 border rounded w-full text-sm"
                  />
                  <button type="button" onClick={() => {
                    const pia = estimatePIAFromIncome(Number(ssEstimateIncome));
                    if (pia > 0) onInputChange({ target: { name: 'ssPIA', value: pia } });
                  }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                    Use Estimate
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Under FRA - ask for PIA and start age
            <>
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  Your Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Monthly Social Security benefit at Full Retirement Age (67). Find this on your SSA statement at ssa.gov.
                </div>
                <FormattedNumberInput
                  name="ssPIA"
                  value={inputs.ssPIA}
                  onChange={onInputChange}
                  className="p-3 border rounded-lg w-full"
                />
                <button type="button" onClick={() => setShowSSEstimator(!showSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                  {showSSEstimator ? 'Hide estimator' : "Don't know? Estimate from income"}
                </button>
                {showSSEstimator && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Annual income"
                      value={ssEstimateIncome}
                      onChange={e => setSSEstimateIncome(e.target.value)}
                      className="p-2 border rounded w-full text-sm"
                    />
                    <button type="button" onClick={() => {
                      const pia = estimatePIAFromIncome(Number(ssEstimateIncome));
                      if (pia > 0) onInputChange({ target: { name: 'ssPIA', value: pia } });
                    }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                      Use Estimate
                    </button>
                  </div>
                )}
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
                  className={`p-3 border rounded-lg w-full ${fieldErrors.ssStartAge ? 'border-red-500 bg-red-50' : ''}`}
                />
                {fieldErrors.ssStartAge && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.ssStartAge}</p>
                )}
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
                  <button type="button" onClick={() => setShowPartnerSSEstimator(!showPartnerSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                    {showPartnerSSEstimator ? 'Hide estimator' : "Estimate from income"}
                  </button>
                  {showPartnerSSEstimator && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Annual income"
                        value={partnerSSEstimateIncome}
                        onChange={e => setPartnerSSEstimateIncome(e.target.value)}
                        className="p-2 border rounded w-full text-sm"
                      />
                      <button type="button" onClick={() => {
                        const pia = estimatePIAFromIncome(Number(partnerSSEstimateIncome));
                        if (pia > 0) onInputChange({ target: { name: 'partnerSSPIA', value: pia } });
                      }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                        Use Estimate
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Partner under FRA - ask for PIA and start age
                <>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Partner Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Monthly Social Security benefit at Full Retirement Age (67). Find this on your SSA statement at ssa.gov.
                    </div>
                    <FormattedNumberInput
                      name="partnerSSPIA"
                      value={inputs.partnerSSPIA}
                      onChange={onInputChange}
                      className="p-3 border rounded-lg w-full"
                    />
                    <button type="button" onClick={() => setShowPartnerSSEstimator(!showPartnerSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                      {showPartnerSSEstimator ? 'Hide estimator' : "Estimate from income"}
                    </button>
                    {showPartnerSSEstimator && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Annual income"
                          value={partnerSSEstimateIncome}
                          onChange={e => setPartnerSSEstimateIncome(e.target.value)}
                          className="p-2 border rounded w-full text-sm"
                        />
                        <button type="button" onClick={() => {
                          const pia = estimatePIAFromIncome(Number(partnerSSEstimateIncome));
                          if (pia > 0) onInputChange({ target: { name: 'partnerSSPIA', value: pia } });
                        }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                          Use Estimate
                        </button>
                      </div>
                    )}
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
                      className={`p-3 border rounded-lg w-full ${fieldErrors.partnerSSStartAge ? 'border-red-500 bg-red-50' : ''}`}
                    />
                    {fieldErrors.partnerSSStartAge && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.partnerSSStartAge}</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Social Security Claiming Age Analysis - Collapsible factual narrative */}
      {clientInfo.currentAge < 67 && (
        <div className="p-4 bg-mwm-gold/10 rounded-lg border border-mwm-gold/30">
          <button
            onClick={() => setShowSSAbout(!showSSAbout)}
            className="w-full flex items-center justify-between text-left"
          >
            <p className="text-xs font-bold text-mwm-gold uppercase flex items-center gap-1">
              About Social Security Claiming Age
            </p>
            {showSSAbout ? <ChevronDown className="w-4 h-4 text-mwm-gold" /> : <ChevronRight className="w-4 h-4 text-mwm-gold" />}
          </button>

          {showSSAbout && <div className="text-sm text-slate-700 space-y-3 mt-3">
            <p>
              Social Security benefits can be claimed anytime between age 62 and 70. Claiming earlier means a smaller monthly
              benefit paid over more years; claiming later means a larger monthly benefit paid over fewer years. Benefits increase
              by approximately 8% per year for each year you delay past full retirement age (67).
            </p>

            <p>
              If you claim benefits before full retirement age and continue working, the Social Security earnings test
              may temporarily reduce your benefit. In 2025, $1 in benefits is withheld for every $2 earned above $23,400
              (or $1 for every $3 above $62,160 in the year you reach FRA). These withheld benefits are not lost — once
              you reach full retirement age, your monthly benefit is recalculated upward to credit the months benefits
              were reduced. After FRA, there is no earnings offset regardless of income.
            </p>

            {inputs.ssPIA > 0 && (
              <div className="p-3 bg-white rounded-lg border border-mwm-gold/30">
                <p className="font-bold text-slate-800 mb-2">Your Benefit at Different Claiming Ages</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-slate-500">Age 62</p>
                    <p className="font-bold text-slate-800">${Math.round(getAdjustedSS(inputs.ssPIA, 62)).toLocaleString()}/mo</p>
                    <p className="text-slate-400">70% of FRA</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-slate-500">Age 67 (FRA)</p>
                    <p className="font-bold text-slate-800">${Math.round(getAdjustedSS(inputs.ssPIA, 67)).toLocaleString()}/mo</p>
                    <p className="text-slate-400">100% of FRA</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-slate-500">Age 70</p>
                    <p className="font-bold text-slate-800">${Math.round(getAdjustedSS(inputs.ssPIA, 70)).toLocaleString()}/mo</p>
                    <p className="text-slate-400">124% of FRA</p>
                  </div>
                </div>
              </div>
            )}

            {ssAnalysis?.outcomes && (
              <div className="p-3 bg-white rounded-lg border border-mwm-gold/30">
                <p className="font-bold text-slate-800 mb-1">Portfolio Impact by Claiming Age</p>
                <p className="text-xs text-slate-600 mb-2">
                  This analysis simulates your full retirement plan under each claiming age, accounting for your spending,
                  other income sources, and portfolio growth. The result shows your projected portfolio balance
                  at age {targetMaxPortfolioAge || 80}:
                </p>
                <div className={`grid grid-cols-${ssAnalysis.outcomes.length} gap-2 text-center text-xs`}>
                  {ssAnalysis.outcomes.map(outcome => (
                    <div key={outcome.age} className={`p-2 rounded ${inputs.ssStartAge === outcome.age ? 'bg-mwm-green/10 border border-mwm-green/40' : 'bg-slate-50'}`}>
                      <p className="text-slate-500">Claim at {outcome.age}</p>
                      <p className="font-bold text-slate-800">${(outcome.balance / 1000000).toFixed(2)}M</p>
                      {inputs.ssStartAge === outcome.age && <p className="text-mwm-green text-[10px] font-bold">CURRENT SELECTION</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 italic">
              The right claiming age depends on your health, longevity expectations, other income sources, and overall financial picture.
              You can change your claiming age above to see how it affects your retirement projection.
            </p>

            {clientInfo.isMarried && clientInfo.partnerAge < 67 && ssPartnerAnalysis && (
              <div className="mt-2 pt-3 border-t border-mwm-gold/30">
                <p className="font-bold text-slate-800 text-xs mb-1">Partner's Claiming Age Analysis</p>
                <p className="text-xs text-slate-600">
                  Based on the same portfolio simulation, your partner's projected portfolio balance at age {targetMaxPortfolioAge || 80} by claiming age:{' '}
                  {ssPartnerAnalysis.outcomes.map((o, i) => (
                    <span key={o.age}>
                      {i > 0 && ', '}
                      <strong>age {o.age}: ${(o.balance / 1000000).toFixed(2)}M</strong>
                    </span>
                  ))}.
                </p>
              </div>
            )}
          </div>}
        </div>
      )}

      {/* Additional Income, Expenses & Life Events - Collapsible */}
      <Card className="p-6">
          <button
            onClick={() => setShowPensionIncome(!showPensionIncome)}
            className="w-full text-left flex items-center justify-between"
          >
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-mwm-green" /> Additional Income, Expenses & Life Events
            </h3>
            {showPensionIncome ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>

          {showPensionIncome && <div className="space-y-4 mt-4">
            {/* Client Pension */}
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{clientInfo.name || 'Client'}'s Pension</p>
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
                      ? 'bg-mwm-green text-white border-2 border-mwm-green'
                      : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-mwm-green/60'
                  }`}
                >
                  {inputs.pensionCOLA ? '✓ Yes' : 'No'}
                </button>
              </div>
            </div>

            {/* Partner Pension - only show if married */}
            {clientInfo.isMarried && (
              <>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mt-4">{clientInfo.partnerName || 'Partner'}'s Pension</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Monthly Pension <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      Partner's monthly pension or other guaranteed income amount.
                    </div>
                    <FormattedNumberInput
                      name="partnerMonthlyPension"
                      value={inputs.partnerMonthlyPension}
                      onChange={onInputChange}
                      className="p-3 border rounded-lg w-full"
                    />
                  </div>
                  <div className="relative group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      Pension Start Age <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                      The age partner's pension payments begin.
                    </div>
                    <input
                      type="number"
                      name="partnerPensionStartAge"
                      value={inputs.partnerPensionStartAge}
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
                      Does partner's pension have a Cost of Living Adjustment?
                    </div>
                    <button
                      type="button"
                      onClick={() => onInputChange({ target: { name: 'partnerPensionCOLA', type: 'checkbox', checked: !inputs.partnerPensionCOLA } })}
                      className={`w-full p-3 rounded-lg font-bold transition-all ${
                        inputs.partnerPensionCOLA
                          ? 'bg-mwm-green text-white border-2 border-mwm-green'
                          : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-mwm-green/60'
                      }`}
                    >
                      {inputs.partnerPensionCOLA ? '✓ Yes' : 'No'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Additional Income Streams */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-slate-700">Additional Retirement Income & One-Time Events</h4>
                <button
                  onClick={onAddAdditionalIncome}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-mwm-green/10 text-mwm-green/80 rounded-lg border border-mwm-green/30 hover:bg-mwm-green/20 transition-colors"
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
                  <div className="flex justify-between items-start mb-3 gap-2">
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
                    {clientInfo.isMarried && (
                      <select
                        value={income.owner || 'client'}
                        onChange={(e) => onUpdateAdditionalIncome(income.id, 'owner', e.target.value)}
                        className="text-sm font-medium text-slate-700 bg-white border rounded px-2 py-1"
                      >
                        <option value="client">{clientInfo.name || 'Client'}</option>
                        <option value="partner">{clientInfo.partnerName || 'Partner'}</option>
                        <option value="joint">Joint</option>
                      </select>
                    )}
                    <button
                      onClick={() => onRemoveAdditionalIncome(income.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[12px] text-slate-500 uppercase mb-1">
                        {income.isOneTime ? 'Amount' : 'Monthly Amount'}
                      </label>
                      <FormattedNumberInput
                        value={income.amount}
                        onChange={(e) => onUpdateAdditionalIncome(income.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="p-2 border rounded w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-slate-500 uppercase mb-1">
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
                        <label className="block text-[12px] text-slate-500 uppercase mb-1">End Age</label>
                        <input
                          type="number"
                          value={income.endAge}
                          onChange={(e) => onUpdateAdditionalIncome(income.id, 'endAge', parseInt(e.target.value) || 100)}
                          min={income.startAge}
                          max={100}
                          className={`p-2 border rounded w-full text-sm ${fieldErrors[`income_${income.id}_endAge`] ? 'border-red-500 bg-red-50' : ''}`}
                        />
                        {fieldErrors[`income_${income.id}_endAge`] && (
                          <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors[`income_${income.id}_endAge`]}</p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col justify-end gap-1">
                      <label className="flex items-center gap-1 text-[12px] text-slate-500">
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
                      <label className="flex items-center gap-1 text-[12px] text-slate-500">
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

            {/* Spending Adjustments */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <div className="relative group">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1 cursor-help">
                    Spending Adjustments <Info className="w-3 h-3 text-slate-400" />
                  </h4>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 bg-slate-800 text-white text-xs p-3 rounded shadow-lg z-20">
                    Add expected changes to your spending in retirement, such as a mortgage payoff (reduction), health insurance before Medicare (increase), or one-time expenses like a home renovation.
                  </div>
                </div>
                <button
                  onClick={onAddCashFlowAdjustment}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-mwm-gold/10 text-mwm-gold rounded-lg border border-mwm-gold/30 hover:bg-mwm-gold/20 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Adjustment
                </button>
              </div>

              {(!inputs.cashFlowAdjustments || inputs.cashFlowAdjustments.length === 0) && (
                <p className="text-xs text-slate-400 italic">
                  Mortgage payoff, reverse mortgage, health insurance, home renovation, etc.
                </p>
              )}

              {(inputs.cashFlowAdjustments || []).map((adj) => (
                <div key={adj.id} className="p-3 bg-mwm-gold/5 rounded-lg border border-mwm-gold/30 mb-3">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <select
                      value={adj.name}
                      onChange={(e) => {
                        const preset = e.target.value;
                        onUpdateCashFlowAdjustment(adj.id, 'name', preset);
                        const presetConfig = {
                          'Mortgage Payoff': { type: 'reduction' },
                          'Reverse Mortgage': { type: 'reduction' },
                          'Downsizing': { type: 'reduction' },
                          'Health Insurance (pre-Medicare)': { type: 'increase', endAge: 65 },
                          'Long-Term Care Insurance': { type: 'increase' },
                          'College Expenses': { type: 'increase' },
                          'Wedding': { type: 'one-time' },
                          'Major Medical': { type: 'one-time' },
                          'Home Renovation': { type: 'one-time' }
                        };
                        if (presetConfig[preset]) {
                          onUpdateCashFlowAdjustment(adj.id, 'type', presetConfig[preset].type);
                          if (presetConfig[preset].endAge) {
                            onUpdateCashFlowAdjustment(adj.id, 'endAge', presetConfig[preset].endAge);
                          }
                          if (presetConfig[preset].type === 'one-time') {
                            onUpdateCashFlowAdjustment(adj.id, 'endAge', adj.startAge);
                          }
                        }
                      }}
                      className="text-sm font-medium text-slate-700 bg-white border rounded px-2 py-1"
                    >
                      <option value="">Select Type...</option>
                      <option value="Mortgage Payoff">Mortgage Payoff</option>
                      <option value="Reverse Mortgage">Reverse Mortgage</option>
                      <option value="Downsizing">Downsizing</option>
                      <option value="Health Insurance (pre-Medicare)">Health Insurance (pre-Medicare)</option>
                      <option value="Long-Term Care Insurance">Long-Term Care Insurance</option>
                      <option value="College Expenses">College Expenses</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Major Medical">Major Medical</option>
                      <option value="Home Renovation">Home Renovation</option>
                      <option value="Other">Other</option>
                    </select>
                    {clientInfo.isMarried && (
                      <select
                        value={adj.owner || 'client'}
                        onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'owner', e.target.value)}
                        className="text-sm font-medium text-slate-700 bg-white border rounded px-2 py-1"
                      >
                        <option value="client">{clientInfo.name || 'Client'}</option>
                        <option value="partner">{clientInfo.partnerName || 'Partner'}</option>
                      </select>
                    )}
                    <button
                      onClick={() => onRemoveCashFlowAdjustment(adj.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[12px] text-slate-500 uppercase mb-1">
                        {adj.type === 'one-time' ? 'Amount' : 'Monthly Amount'}
                      </label>
                      <FormattedNumberInput
                        value={adj.amount}
                        onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="p-2 border rounded w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-slate-500 uppercase mb-1">
                        {adj.type === 'one-time' ? 'Age' : 'Start Age'}
                      </label>
                      <input
                        type="number"
                        value={adj.startAge}
                        onChange={(e) => {
                          const age = parseInt(e.target.value) || 0;
                          onUpdateCashFlowAdjustment(adj.id, 'startAge', age);
                          if (adj.type === 'one-time') onUpdateCashFlowAdjustment(adj.id, 'endAge', age);
                        }}
                        min={55}
                        max={100}
                        className="p-2 border rounded w-full text-sm"
                      />
                    </div>
                    {adj.type !== 'one-time' && (
                      <div>
                        <label className="block text-[12px] text-slate-500 uppercase mb-1">End Age</label>
                        <input
                          type="number"
                          value={adj.endAge}
                          onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'endAge', parseInt(e.target.value) || 100)}
                          min={adj.startAge}
                          max={100}
                          className="p-2 border rounded w-full text-sm"
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-end gap-1">
                      <select
                        value={adj.type}
                        onChange={(e) => {
                          onUpdateCashFlowAdjustment(adj.id, 'type', e.target.value);
                          if (e.target.value === 'one-time') onUpdateCashFlowAdjustment(adj.id, 'endAge', adj.startAge);
                        }}
                        className="text-sm bg-white border rounded px-1 py-1"
                      >
                        <option value="reduction">Reduction</option>
                        <option value="increase">Increase</option>
                        <option value="one-time">One-Time</option>
                      </select>
                      <label className="flex items-center gap-1 text-[12px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={adj.inflationAdjusted}
                          onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'inflationAdjusted', e.target.checked)}
                          className="w-3 h-3"
                        />
                        Inflation Adjusted
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>}
        </Card>

      {/* Summary Section */}
      <div className="text-center my-8">
        <h2 className="text-2xl font-bold text-slate-800">Your Retirement Outlook</h2>
        <p className="text-slate-500 mt-2">A personalized projection based on your unique financial situation</p>
        <p className="text-sm font-bold text-mwm-green/80 mt-2">This analysis uses Miller Wealth's proprietary methodology to model your retirement trajectory</p>
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
          colorClass={`bg-gray-800 text-white ${adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings) ? 'ring-2 ring-mwm-green/60' : ''}`}
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
            return `$${Math.round(portfolioWithdrawal).toLocaleString()}/mo from portfolio (before taxes)`;
          })()}
          icon={DollarSign}
          colorClass={`bg-mwm-gold text-white ${adjustedProjections.hasChanges && selectedImprovements.spending ? 'ring-2 ring-mwm-green/60' : ''}`}
        />
        <StatBox
          label="Success Probability"
          value={adjustedProjections.hasChanges
            ? `${adjustedProjections.successRate.toFixed(1)}%`
            : `${(monteCarloData?.successRate || 0).toFixed(1)}%`}
          subtext={adjustedProjections.hasChanges
            ? <><span className="line-through opacity-60">{(monteCarloData?.successRate || 0).toFixed(1)}%</span> → +{(adjustedProjections.successRate - (monteCarloData?.successRate || 0)).toFixed(1)}%</>
            : `At age ${Math.min(clientInfo.retirementAge + 30, 95)}`}
          icon={Activity}
          colorClass={`${(adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate) > 80 ? "bg-mwm-green" : "bg-orange-500"} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-mwm-gold/40' : ''}`}
        />
        <StatBox
          label="Legacy Balance"
          value={(() => {
            const legacy = adjustedProjections.hasChanges
              ? adjustedProjections.legacyBalance
              : (monteCarloData?.medianLegacy || cappedProjectionData[cappedProjectionData.length - 1]?.total || 0);
            return legacy >= 1000000 ? `$${(legacy / 1000000).toFixed(2)}M` : `$${Math.round(legacy).toLocaleString()}`;
          })()}
          subtext={adjustedProjections.hasChanges
            ? (() => {
                const baseLegacy = monteCarloData?.medianLegacy || cappedProjectionData[cappedProjectionData.length - 1]?.total || 0;
                return <><span className="line-through opacity-60">${(baseLegacy / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.legacyBalance - baseLegacy) / 1000).toFixed(0)}k</>;
              })()
            : `Median outcome at age ${cappedProjectionData[cappedProjectionData.length - 1]?.age || Math.min(clientInfo.retirementAge + 30, 95)}`}
          icon={Shield}
          colorClass={`bg-mwm-emerald text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-mwm-gold/40' : ''}`}
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
            {monteCarloData?.data ? (() => {
              const startAge = cappedProjectionData[0]?.age || clientInfo.retirementAge || 65;
              const mcChartData = (monteCarloData.data || []).slice(0, cappedProjectionData.length).map((mc, idx) => ({
                age: startAge + idx,
                p90: Math.round(mc.p90),
                median: Math.round(mc.median),
                p10: Math.round(mc.p10),
                total: cappedProjectionData[idx]?.total || 0,
              }));
              return (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mcChartData} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="age" tick={{ dy: 5 }} />
                      <YAxis tickFormatter={(val) => {
                        if (val >= 1000000) {
                          const millions = val / 1000000;
                          return millions >= 10 ? `$${Math.round(millions)}M` : `$${millions.toFixed(1)}M`;
                        }
                        return `$${Math.round(val / 1000)}k`;
                      }} />
                      <Tooltip
                        formatter={(val, name) => `$${Math.round(val).toLocaleString()}`}
                        labelFormatter={(l) => `Age ${l}`}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px', paddingBottom: '0px' }} />
                      <Area type="monotone" dataKey="p90" name="Optimistic (90th Percentile)" fill="#d1fae5" stroke="#10b981" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="median" name="Expected (Median)" fill="#bfdbfe" stroke="#3b82f6" fillOpacity={0.5} />
                      <Area type="monotone" dataKey="p10" name="Conservative (10th Percentile)" fill="#fee2e2" stroke="#ef4444" fillOpacity={0.4} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              );
            })() : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cappedProjectionData} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="age" tick={{ dy: 5 }} />
                    <YAxis tickFormatter={(val) => {
                      if (val >= 1000000) {
                        const millions = val / 1000000;
                        return millions >= 10 ? `$${Math.round(millions)}M` : `$${millions.toFixed(1)}M`;
                      }
                      return `$${Math.round(val / 1000)}k`;
                    }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(val, name) => {
                        if (name === 'Distribution Rate') return `${val.toFixed(2)}%`;
                        return `$${Math.round(val).toLocaleString()}`;
                      }}
                      labelFormatter={(l) => `Age ${l}`}
                    />
                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px', paddingBottom: '0px' }} />
                    <Area type="monotone" dataKey="total" name="Miller Portfolio Architect Strategy" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
                    <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40 (Annual Rebalance)" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <>
            {monteCarloData?.scenarios && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">Scenario:</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setMcScenario('optimistic')}
                    className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'optimistic' ? 'bg-mwm-green text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Optimistic
                  </button>
                  <button
                    onClick={() => setMcScenario('median')}
                    className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'median' ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Median
                  </button>
                  <button
                    onClick={() => setMcScenario('conservative')}
                    className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'conservative' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Conservative
                  </button>
                </div>
                <span className="text-xs text-slate-400 italic">
                  {mcScenario === 'optimistic' ? '90th percentile — better than 90% of simulated outcomes'
                    : mcScenario === 'conservative' ? '10th percentile — worse than only 10% of simulated outcomes'
                    : '50th percentile — the most likely outcome'}
                </span>
              </div>
            )}
            <div className="overflow-x-auto max-h-80">
              {(() => {
                const tableData = monteCarloData?.scenarios
                  ? (monteCarloData.scenarios[mcScenario] || []).filter(row => row.age <= 95)
                  : cappedProjectionData;
                return (
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="sticky top-0 bg-white">
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-2 text-left">Age</th>
                        <th className="p-2">Start Balance</th>
                        <th className="p-2 text-mwm-green">Growth</th>
                        <th className="p-2 text-purple-600">Contribution</th>
                        <th className="p-2 text-blue-600">Income</th>
                        <th className="p-2 text-orange-600">Withdrawal</th>
                        <th className="p-2 text-red-600">Est. Taxes</th>
                        <th className="p-2 text-slate-900">End Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                          <td className="p-2 text-slate-500">${(row.startBalance || 0).toLocaleString()}</td>
                          <td className={`p-2 ${(row.growth || 0) >= 0 ? 'text-mwm-green' : 'text-red-600'}`}>{(row.growth || 0) >= 0 ? `+$${row.growth.toLocaleString()}` : `($${Math.abs(row.growth).toLocaleString()})`}</td>
                          <td className="p-2 text-purple-600">{(row.contribution || 0) > 0 ? `+$${row.contribution.toLocaleString()}` : '-'}</td>
                          <td className="p-2 text-blue-600">+${(row.ssIncome || 0).toLocaleString()}</td>
                          <td className="p-2 text-orange-600">-${(row.distribution || 0).toLocaleString()}</td>
                          <td className="p-2 text-red-500">-${(row.totalTax || 0).toLocaleString()}</td>
                          <td className={`p-2 font-bold ${(row.total || 0) > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-slate-500 italic">
          Projections are generated using Monte Carlo simulation methodology (1,000 iterations) with randomized annual returns based on historical asset class performance and standard deviations. The chart displays the range of probable outcomes across optimistic (90th percentile), expected (median), and conservative (10th percentile) scenarios. All savings are assumed to be held in pre-tax retirement accounts (IRA/401k) with a 5% state income tax rate.
        </p>
      </Card>

      {/* Adjust Your Plan - Always visible */}
      <Card className="p-6 border-t-4 border-slate-400">
        <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-600" /> Adjust Your Plan
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Three factors have the greatest impact on retirement outcomes: <strong>when you retire</strong> — working longer allows your
          portfolio to grow while reducing the number of years you draw from it; <strong>how much you save before retirement</strong> — additional
          savings compound over time and increase the portfolio available at retirement; and <strong>how much you spend in retirement</strong> — a
          lower withdrawal rate extends portfolio longevity. Adjust any of these below to see how the projections change.
        </p>

        <div className={`grid ${clientInfo.isRetired ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'} gap-4`}>
          {!clientInfo.isRetired && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-2" />
              <h4 className="font-bold text-blue-800 text-sm">Retirement Age</h4>
              <div className="mt-3 flex items-center justify-center gap-2">
                <label className="text-xs font-bold text-blue-700 uppercase">Age</label>
                <FormattedNumberInput
                  name="retirementAge"
                  value={clientInfo.retirementAge}
                  onChange={onClientChange}
                  className="p-2 border border-blue-300 rounded-lg w-20 text-center font-bold text-blue-800 bg-white"
                />
              </div>
            </div>
          )}

          {!clientInfo.isRetired && (
            <div className="p-4 bg-mwm-green/10 rounded-lg border border-mwm-green/30 text-center">
              <PiggyBank className="w-5 h-5 text-mwm-green mx-auto mb-2" />
              <h4 className="font-bold text-mwm-emerald text-sm">Annual Savings</h4>
              <div className="mt-3 flex items-center justify-center gap-2">
                <label className="text-xs font-bold text-mwm-green/80 uppercase">Per Year</label>
                <FormattedNumberInput
                  name="annualSavings"
                  value={clientInfo.annualSavings}
                  onChange={onClientChange}
                  className="p-2 border border-mwm-green/40 rounded-lg w-28 text-center font-bold text-mwm-emerald bg-white"
                />
              </div>
            </div>
          )}

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center">
            <DollarSign className="w-5 h-5 text-orange-600 mx-auto mb-2" />
            <h4 className="font-bold text-orange-800 text-sm">Monthly Spending</h4>
            <div className="mt-3 flex items-center justify-center gap-2">
              <label className="text-xs font-bold text-orange-700 uppercase">Per Month</label>
              <FormattedNumberInput
                name="monthlySpending"
                value={inputs.monthlySpending}
                onChange={onInputChange}
                className="p-2 border border-orange-300 rounded-lg w-28 text-center font-bold text-orange-800 bg-white"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* What's Next Button */}
      <div className="text-center">
        <button
          onClick={() => setShowWhatsNext(true)}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-lg font-bold rounded-xl hover:from-slate-800 hover:to-slate-700 transition-all shadow-lg hover:shadow-xl"
        >
          <ArrowRight className="w-5 h-5" />
          What's Next?
        </button>
      </div>

      {/* What's Next Modal - One Process / 7 Pillars */}
      {showWhatsNext && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">A Great Projection Is Just the Starting Point</h2>
                <p className="text-slate-400 text-sm mt-1">There's so much more to a confident retirement</p>
              </div>
              <button
                onClick={() => setShowWhatsNext(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <p className="text-sm text-slate-700">
                Whether your success probability is 60% or 99%, the projection you just explored only accounts for
                one dimension of your financial life — the investment strategy. At Miller Wealth Management, we believe
                a truly confident retirement is built on <strong>seven pillars</strong>, each working together through
                what we call <strong>The One Process</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { num: '1', title: 'Investment Strategy', desc: 'The portfolio projection you just explored — critical, but only one of the seven pillars' },
                  { num: '2', title: 'Balance Sheet Optimization', desc: 'Aligning assets, liabilities, real estate holdings, and cash flow so every dollar works harder for your goals' },
                  { num: '3', title: 'Asset Protection', desc: 'Shielding what you\'ve built from lawsuits, creditors, and unforeseen risks' },
                  { num: '4', title: 'Proactive Tax Strategy', desc: 'Roth conversions, harvesting, asset location, and withdrawal sequencing — keeping more of what you\'ve earned' },
                  { num: '5', title: 'Legacy Planning', desc: 'Coordinating gifting, estate documents, and beneficiary designations so your wealth transfers exactly as intended' },
                  { num: '6', title: 'Philanthropy', desc: 'Giving strategically in ways that maximize impact and align with your tax picture' },
                  { num: '7', title: 'Family Stewardship', desc: 'Preparing heirs, establishing shared values, and creating a framework for multi-generational success' },
                ].map(pillar => (
                  <div key={pillar.num} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="w-7 h-7 rounded-full bg-mwm-green text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {pillar.num}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{pillar.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{pillar.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-mwm-green/10 rounded-lg border border-mwm-green/30">
                <p className="text-sm text-slate-700">
                  <strong>The One Process</strong> weaves all seven pillars into a single, coordinated strategy — reviewed and
                  adjusted as your life evolves. It's the difference between a projection on a screen and a plan you can
                  actually live by.
                </p>
              </div>

              <p className="text-sm text-slate-600 italic">
                An introductory call is free, carries no obligation, and takes about 20 minutes. We'll listen to what
                matters most to you and share how The One Process might apply to your situation.
              </p>
            </div>

            {/* Footer CTA */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 text-center">
              <button
                onClick={() => {
                  setShowWhatsNext(false);
                  onClientSubmit();
                }}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-2 px-8 py-4 bg-mwm-green hover:bg-mwm-green/80 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                <Send className="w-5 h-5" />
                {saveStatus === 'saving' ? 'Saving...' : 'Schedule an Intro Call'}
              </button>
              <p className="text-xs text-slate-500 mt-3">Free, no-obligation consultation</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Factors Warning */}
      <Card className="p-6 border-t-4 border-mwm-gold/60 bg-mwm-gold/10">
        <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-mwm-gold" /> Important Considerations
        </h3>
        <p className="text-sm text-slate-600 mb-3">
          While this projection provides valuable insights, life rarely follows a straight line. Several factors could impact your retirement:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/40 col-span-2 md:col-span-3">
            <span className="text-mwm-gold font-bold">•</span>
            <span className="font-semibold text-mwm-gold">Taxes are estimated using a conservative assumption (100% pre-tax accounts, 5% state rate) — proactive tax planning could meaningfully improve your outcome</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/40 col-span-2 md:col-span-3">
            <span className="text-mwm-gold font-bold">•</span>
            <span className="font-semibold text-mwm-gold">Asset Location, Distribution Strategy & Tax Management strategies can improve outcomes beyond the illustration</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Unexpected healthcare needs
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Market volatility
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Leaving workforce early
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Family elder-care obligations
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Supporting children financially
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border border-mwm-gold/30">
            <span className="text-mwm-gold/80">•</span> Inflation exceeding projections
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3 italic">
          A professional advisor can help you prepare for these uncertainties and build resilience into your plan.
        </p>
      </Card>

      {/* Talk to Advisor CTA */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 rounded-xl text-center">
        <h3 className="text-2xl font-bold mb-2">Your Projection is Just the Beginning</h3>
        <p className="text-gray-300 mb-4">
          This analysis shows what's possible—but achieving it requires a comprehensive strategy.
        </p>
        <p className="text-gray-400 mb-6 text-sm">
          Our advisors specialize in turning projections into reality through tax optimization,
          Social Security timing, risk management, and ongoing plan adjustments as life changes.
        </p>
        <button
          onClick={onClientSubmit}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 px-8 py-4 bg-mwm-green hover:bg-mwm-green/80 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
        >
          <Send className="w-5 h-5" />
          {saveStatus === 'saving' ? 'Saving...' : 'Talk to a Miller Wealth Management Advisor About My Plan'}
        </button>
        <p className="text-xs text-gray-500 mt-4">Free, no-obligation consultation</p>
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
              ? 'bg-mwm-green text-white scale-110'
              : wizardStep > num
              ? 'bg-mwm-green/30 text-mwm-emerald cursor-pointer hover:bg-mwm-green/40'
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
            <img src={LOGO_URL} alt="Logo" className="h-16 sm:h-20 md:h-[96px] w-auto bg-white p-1 sm:p-2 rounded-lg flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Retirement Planning</h1>
              <p className="text-mwm-gold text-xs sm:text-sm mt-1">Step {wizardStep} of 2</p>
            </div>
          </div>
          {isRegisteredClient && onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-xs sm:text-sm"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-b-2xl shadow-xl">
          {renderProgress()}

          {wizardStep === 1 && renderPage1()}
          {wizardStep === 2 && renderPage2()}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
            {wizardStep > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-sm sm:text-base"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Update Input Data
              </button>
            ) : (
              <div />
            )}

            {wizardStep === 2 && (
              <a
                href="https://www.millerwm.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-mwm-green/80 hover:text-mwm-emerald hover:bg-mwm-green/10 rounded-lg transition-all text-sm sm:text-base"
              >
                <ExternalLink className="w-4 h-4" /> Visit Miller Wealth Management Website
              </a>
            )}

            {wizardStep < 2 && (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-mwm-green/80 hover:bg-mwm-emerald text-white font-bold rounded-lg transition-all text-sm sm:text-base"
              >
                Next <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {wizardStep === 2 && (
              <button
                onClick={onClientFinish || onLogout || (() => window.location.reload())}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-sm sm:text-base"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'I Am Finished'} <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
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
