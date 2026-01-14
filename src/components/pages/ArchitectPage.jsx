import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, Area, AreaChart, LineChart
} from 'recharts';
import {
  Calculator, DollarSign, TrendingUp, Shield, Clock, AlertCircle, Settings,
  ChevronDown, ChevronUp, Activity, BarChart2, Briefcase, Download, Lock,
  RefreshCw, Percent, Plus, Trash2, History, User, Users, FileText, ArrowRight,
  Info, CheckCircle, RefreshCcw, MousePointerClick, Save, FolderOpen, Loader,
  LogIn, LogOut, UserCheck, Send, Table as TableIcon, PiggyBank, Layers
} from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { getAdjustedSS } from '../../utils';
import { Card, StatBox, AllocationRow, FormattedNumberInput, Disclaimer } from '../ui';

/**
 * Architect Page - Step 2 of the portfolio planning process
 * Displays distribution phase strategy with bucket allocation and projections
 */
export const ArchitectPage = ({
  // Auth & Navigation
  userRole,
  onBackToInputs,
  // Save/Submit
  saveStatus,
  onSaveScenario,
  onClientSubmit,
  onGenerateReport,
  isGeneratingReport,
  // Client Data
  clientInfo,
  // Inputs & Assumptions
  inputs,
  onInputChange,
  assumptions,
  onAssumptionChange,
  onApplyHistoricalAverages,
  onApplyFourPercentRule,
  // UI State
  showSettings,
  onToggleSettings,
  activeTab,
  onSetActiveTab,
  rebalanceFreq,
  onSetRebalanceFreq,
  showCashFlowTable,
  onSetShowCashFlowTable,
  // Calculations
  basePlan,
  accumulationData,
  projectionData,
  monteCarloData,
  ssAnalysis,
  ssPartnerAnalysis,
  // SS Settings
  targetMaxPortfolioAge,
  onSetTargetMaxPortfolioAge,
  onUpdateSSStartAge,
  onUpdatePartnerSSStartAge,
  // Additional Income
  onAddAdditionalIncome,
  onUpdateAdditionalIncome,
  onRemoveAdditionalIncome,
  // Navigation
  onViewManagement
}) => {
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
          if (income.startAge >= clientInfo.currentAge) {
            oneTimeBoosts += income.amount;
          }
        } else {
          if (income.startAge <= clientInfo.retirementAge && income.endAge >= clientInfo.retirementAge) {
            additionalIncomeAtRetirement += income.amount * 12;
          }
        }
      });
    }

    const sustainableWithdrawal = portfolio * 0.04;
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
      hasAdditionalIncome: additionalIncomeAtRetirement > 0 || oneTimeBoosts > 0,
      additionalIncomeAmount: additionalIncomeAtRetirement,
      oneTimeAmount: oneTimeBoosts
    };
  }, [monteCarloData, clientInfo, inputs, accumulationData]);

  // Initialize custom improvement values
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

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-800 ${isGeneratingReport ? 'print-mode' : 'p-4 sm:p-6 lg:p-8'}`}>

      {/* REPORT HEADER (Print Only) */}
      <div className="hidden print:flex flex-col h-screen break-after-page items-center justify-center text-center p-12">
        <img src={LOGO_URL} alt="Logo" className="h-48 mb-8" />
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Retirement Illustration Strategy</h1>
        <p className="text-2xl text-slate-500 mb-12">Prepared for {clientInfo.name || "Valued Client"}</p>
        <div className="text-left border-t pt-8 w-full max-w-md mx-auto space-y-2 text-slate-600">
          <p><strong>Email:</strong> {clientInfo.email}</p>
          <p><strong>Phone:</strong> {clientInfo.phone}</p>
          <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 md:mb-8 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 sm:h-12 md:h-[72px] w-auto object-contain" />
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">Portfolio Architect</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Distribution Phase Strategy</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button onClick={onBackToInputs} className="px-2 sm:px-4 py-1.5 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs sm:text-sm">
              <span className="hidden sm:inline">Back to </span>Inputs
            </button>
            {userRole !== 'client' && onViewManagement && (
              <button
                onClick={onViewManagement}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Manage</span> Plans
              </button>
            )}
            {userRole !== 'client' && (
              <button
                onClick={onSaveScenario}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg shadow-sm transition-all font-medium text-xs sm:text-sm ${saveStatus === 'success' ? 'bg-green-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              >
                {saveStatus === 'saving' ? <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : saveStatus === 'success' ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Save className="w-3 h-3 sm:w-4 sm:h-4" />}
                {saveStatus === 'success' ? 'Saved' : 'Save'}
              </button>
            )}
            {userRole === 'client' && (
              <button
                onClick={onClientSubmit}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg shadow-sm transition-all font-medium text-xs sm:text-sm ${saveStatus === 'success' ? 'bg-green-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              >
                {saveStatus === 'saving' ? <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span className="hidden sm:inline">{saveStatus === 'success' ? 'Opening...' : 'Talk to an advisor'}</span>
                <span className="sm:hidden">{saveStatus === 'success' ? 'Opening...' : 'Contact'}</span>
              </button>
            )}
            {userRole !== 'client' && (
              <button onClick={onGenerateReport} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-black text-white rounded-lg hover:bg-gray-800 shadow-sm transition-all font-medium text-xs sm:text-sm">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">PDF</span> Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PAGE 1: About Us (Print Only) */}
      <div className="hidden print:block break-after-page p-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">About Miller Wealth Management</h2>
        <div className="bg-slate-50 p-8 rounded-xl border border-slate-100">
          <h3 className="text-xl font-bold text-emerald-700 mb-4">COMPANY & FOUNDER OVERVIEW</h3>
          <p className="mb-4 text-slate-700"><strong>Helping individuals, families, and businesses identify, plan, and pursue their financial goals since 2011.</strong></p>
          <p className="mb-6 text-slate-600 leading-relaxed">Miller Wealth Management is a full-service wealth planning and investment advisory firm providing customized guidance and unmatched service to a select number of individuals, families, and business owners. Our mission is to become our clients' most trusted advisor by leveraging an understandable, tailored process that aims to help our clients reach their stated goals while building a lasting relationship based on trust.</p>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-2">INDIVIDUALS & FAMILIES</h4>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>Investment Management</li>
                <li>Retirement Planning</li>
                <li>Holistic Financial Planning</li>
                <li>Risk Management & Insurance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-2">BUSINESS SERVICES</h4>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>Corporate Retirement Plans</li>
                <li>Key Employment Incentives</li>
                <li>Employer-Sponsored 529 Plans</li>
                <li>Succession & Exit Planning</li>
              </ul>
            </div>
          </div>

          <h3 className="text-xl font-bold text-emerald-700 mb-2">FOUNDER - RODD R. MILLER</h3>
          <p className="text-slate-600 leading-relaxed text-sm">Miller Wealth Management was founded in 2011 by Rodd R. Miller. Rodd visualized an independent wealth management firm that was dedicated to helping clients strategize and pursue important milestones throughout their financial lives. Rodd is an Arizona native and a graduate of the University of San Diego where he received his Bachelor of Business Administration degree and earned the magna cum laude honor. He has committed a lifetime to finance, with a career that spans private equity, real estate development finance, and ultimately wealth management. Rodd is a Certified Financial Planner™ (CFP®).</p>
        </div>
        <PrintFooter pageNumber={1} />
      </div>

      {/* PAGE 2: ACCUMULATION SUMMARY (Print Only) */}
      <div className="hidden print:block break-after-page p-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Phase 1: Accumulation</h2>
          <img src={LOGO_URL} alt="Logo" className="h-12" />
        </div>
        <div className="h-[500px] w-full border rounded-xl p-4 mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={accumulationData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
              <Area type="monotone" dataKey="balance" stroke={COLORS.hedged} fill={COLORS.hedged} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-8 text-lg">
          <div>
            <p className="text-slate-500">Current Portfolio</p>
            <p className="font-bold">${clientInfo.currentPortfolio.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Annual Savings</p>
            <p className="font-bold">${clientInfo.annualSavings.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Projected Retirement Value</p>
            <p className="font-bold text-emerald-600">${inputs.totalPortfolio.toLocaleString()}</p>
          </div>
        </div>
        <PrintFooter pageNumber={2} />
      </div>

      {/* MAIN ARCHITECT PAGE */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 print:block print:break-after-page">

        {/* Left Sidebar - Inputs */}
        <div className="lg:col-span-3 space-y-6 print:hidden">
          <Card className="p-5 border-t-4 border-emerald-500">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Retirement Inputs
            </h3>
            <div className="space-y-4">
              <div className="relative group">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  Starting Portfolio <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="text-xs text-slate-400 mb-1">(From Accumulation Phase)</div>
                <div className="absolute left-0 top-0 mt-[-40px] hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Your projected portfolio value at retirement from the accumulation phase.
                </div>
                <FormattedNumberInput name="totalPortfolio" value={inputs.totalPortfolio} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm font-bold text-emerald-700 bg-emerald-50" />
              </div>

              <div className="relative group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Monthly Spending Need <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <button
                    onClick={onApplyFourPercentRule}
                    className="text-[9px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors font-medium"
                  >
                    Set to 4% Rule
                  </button>
                </div>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Based on ${clientInfo.currentSpending.toLocaleString()} current spend adjusted for inflation over {clientInfo.retirementAge - clientInfo.currentAge} years.
                </div>
                <FormattedNumberInput name="monthlySpending" value={inputs.monthlySpending} onChange={onInputChange} className="w-full mt-1 px-3 py-2 border rounded-md text-sm font-bold text-slate-700" />
              </div>

              <div className="pt-2">
                <button onClick={onToggleSettings} className="text-xs text-emerald-600 underline flex items-center gap-1">
                  {showSettings ? "Hide Settings" : "Advanced Settings"}
                </button>
                {showSettings && (
                  <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-200 space-y-2">
                    <div className="relative group">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        Inflation Rate (%) <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        General inflation rate for income sources like Social Security and pensions.
                      </div>
                      <input type="number" step="0.1" name="inflationRate" value={inputs.inflationRate} onChange={onInputChange} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                    <div className="relative group">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        Personal Inflation Rate (%) <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        Your personal spending inflation, typically lower than general inflation in retirement.
                      </div>
                      <input type="number" step="0.1" name="personalInflationRate" value={inputs.personalInflationRate} onChange={onInputChange} className="w-full px-2 py-1 text-xs border rounded" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1"><Shield className="w-3 h-3" /> Social Security</h4>
                  <button
                    onClick={() => onSetActiveTab('ss')}
                    className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors font-medium"
                  >
                    Get Recommendation
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative group">
                      <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        Your Social Security benefit at Full Retirement Age (67) from your SSA statement.
                      </div>
                      <FormattedNumberInput name="ssPIA" value={inputs.ssPIA} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                    <div className="relative group">
                      <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Start Age (62-70) <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        The age you plan to begin collecting Social Security benefits.
                      </div>
                      <input type="number" name="ssStartAge" value={inputs.ssStartAge} onChange={onInputChange} min={62} max={70} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                  </div>
                  {clientInfo.isMarried && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative group">
                        <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                          Partner Benefit <Info className="w-3 h-3 text-slate-400" />
                        </label>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                          Your partner's Social Security benefit at Full Retirement Age.
                        </div>
                        <FormattedNumberInput name="partnerSSPIA" value={inputs.partnerSSPIA} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                      </div>
                      <div className="relative group">
                        <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                          Start Age (62-70) <Info className="w-3 h-3 text-slate-400" />
                        </label>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                          The age your partner plans to begin collecting Social Security.
                        </div>
                        <input type="number" name="partnerSSStartAge" value={inputs.partnerSSStartAge} onChange={onInputChange} min={62} max={70} className="w-full px-2 py-1 border rounded-md text-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1 mb-3"><DollarSign className="w-3 h-3" /> Pension / Other Income</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative group">
                      <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Monthly Pension <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        Monthly pension or other guaranteed income amount.
                      </div>
                      <FormattedNumberInput name="monthlyPension" value={inputs.monthlyPension} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                    <div className="relative group">
                      <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Pension Start Age <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                        The age your pension payments begin.
                      </div>
                      <input type="number" name="pensionStartAge" value={inputs.pensionStartAge} onChange={onInputChange} min={55} max={80} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                  </div>

                  {/* Additional Income Streams */}
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Additional Income & One-Time Events</span>
                      <button
                        onClick={onAddAdditionalIncome}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-emerald-50 text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-100"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    {inputs.additionalIncomes?.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">
                        Rental income, inheritance, real estate sale, etc.
                      </p>
                    )}

                    {inputs.additionalIncomes?.map((income) => (
                      <div key={income.id} className="p-2 bg-slate-50 rounded border border-slate-200 mb-2">
                        <div className="flex justify-between items-center mb-2">
                          <select
                            value={income.name}
                            onChange={(e) => {
                              const type = e.target.value;
                              onUpdateAdditionalIncome(income.id, 'name', type);
                              // Auto-set one-time for lump sum events
                              const oneTimeTypes = ['Real Estate Sale', 'Inheritance', 'Business Sale'];
                              const isOneTime = oneTimeTypes.includes(type);
                              onUpdateAdditionalIncome(income.id, 'isOneTime', isOneTime);
                              if (isOneTime) onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                            }}
                            className="text-[10px] font-medium bg-white border rounded px-1 py-0.5"
                          >
                            <option value="">Type...</option>
                            <option value="Rental Income">Rental Income (Monthly)</option>
                            <option value="Part-Time Work">Part-Time Work (Monthly)</option>
                            <option value="Annuity">Annuity (Monthly)</option>
                            <option value="Real Estate Sale">Real Estate Sale (One-Time)</option>
                            <option value="Inheritance">Inheritance (One-Time)</option>
                            <option value="Business Sale">Business Sale (One-Time)</option>
                            <option value="Other">Other</option>
                          </select>
                          <button onClick={() => onRemoveAdditionalIncome(income.id)} className="p-0.5 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase">{income.isOneTime ? 'Amount' : 'Monthly'}</label>
                            <FormattedNumberInput
                              value={income.amount}
                              onChange={(e) => onUpdateAdditionalIncome(income.id, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-full px-1 py-0.5 border rounded text-[10px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase">{income.isOneTime ? 'Age' : 'Start'}</label>
                            <input
                              type="number"
                              value={income.startAge}
                              onChange={(e) => {
                                const age = parseInt(e.target.value) || 0;
                                onUpdateAdditionalIncome(income.id, 'startAge', age);
                                if (income.isOneTime) onUpdateAdditionalIncome(income.id, 'endAge', age);
                              }}
                              className="w-full px-1 py-0.5 border rounded text-[10px]"
                            />
                          </div>
                          {!income.isOneTime && (
                            <div>
                              <label className="block text-[8px] text-slate-500 uppercase">End</label>
                              <input
                                type="number"
                                value={income.endAge}
                                onChange={(e) => onUpdateAdditionalIncome(income.id, 'endAge', parseInt(e.target.value) || 100)}
                                className="w-full px-1 py-0.5 border rounded text-[10px]"
                              />
                            </div>
                          )}
                          <div className="flex flex-col justify-end gap-0.5">
                            <label className="flex items-center gap-0.5 text-[8px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={income.isOneTime}
                                onChange={(e) => {
                                  onUpdateAdditionalIncome(income.id, 'isOneTime', e.target.checked);
                                  if (e.target.checked) onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                                }}
                                className="w-2.5 h-2.5"
                              />
                              One-Time
                            </label>
                            <label className="flex items-center gap-0.5 text-[8px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={income.inflationAdjusted}
                                onChange={(e) => onUpdateAdditionalIncome(income.id, 'inflationAdjusted', e.target.checked)}
                                className="w-2.5 h-2.5"
                              />
                              Inflation Adj
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <button onClick={onToggleSettings} className="flex items-center justify-between w-full text-sm font-semibold text-slate-700">
              <span>Return Assumptions</span>
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSettings && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={onApplyHistoricalAverages}
                  className="w-full text-xs flex items-center justify-center gap-1 bg-yellow-50 text-yellow-700 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors mb-3 font-medium"
                >
                  <RefreshCcw className="w-3 h-3" /> Use Historical Averages
                </button>
                {Object.entries(assumptions).map(([key, data]) => (
                  <div key={key} className="p-2 bg-slate-50 rounded">
                    <p className="font-bold text-xs text-slate-700 mb-1">{data.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">Return %</label>
                        <input type="number" value={data.return} onChange={(e) => onAssumptionChange(key, 'return', e.target.value)} className="w-full px-2 py-1 text-xs border rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">StdDev %</label>
                        <input type="number" value={data.stdDev} onChange={(e) => onAssumptionChange(key, 'stdDev', e.target.value)} className="w-full px-2 py-1 text-xs border rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Dashboard */}
        <div className="lg:col-span-9 space-y-6">

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBox
              label="Starting Balance"
              value={adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings)
                ? `$${(adjustedProjections.portfolio / 1000000).toFixed(2)}M`
                : `$${(inputs.totalPortfolio / 1000000).toFixed(2)}M`}
              subtext={adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings)
                ? <><span className="line-through opacity-60">${(inputs.totalPortfolio / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.portfolio - inputs.totalPortfolio) / 1000).toFixed(0)}k</>
                : "Accumulation + Contributions"}
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
              icon={AlertCircle}
              colorClass={`bg-yellow-500 text-white ${adjustedProjections.hasChanges && selectedImprovements.spending ? 'ring-2 ring-emerald-400' : ''}`}
            />
            <StatBox
              label="Success Probability"
              value={adjustedProjections.hasChanges
                ? `${adjustedProjections.successRate.toFixed(1)}%`
                : `${(monteCarloData?.successRate || 0).toFixed(1)}%`}
              subtext={adjustedProjections.hasChanges
                ? <><span className="line-through opacity-60">{(monteCarloData?.successRate || 0).toFixed(1)}%</span> → +{(adjustedProjections.successRate - (monteCarloData?.successRate || 0)).toFixed(1)}%</>
                : "Positive balance at 30yrs"}
              icon={Activity}
              colorClass={`${(adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate) > 80 ? "bg-emerald-600" : "bg-orange-500"} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
            <StatBox
              label="Legacy Balance (30yr)"
              value={adjustedProjections.hasChanges
                ? `$${(adjustedProjections.legacyBalance / 1000000).toFixed(2)}M`
                : `$${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M`}
              subtext={adjustedProjections.hasChanges
                ? <><span className="line-through opacity-60">${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.legacyBalance - (projectionData[projectionData.length - 1]?.total || 0)) / 1000).toFixed(0)}k</>
                : "Projected Ending Value"}
              icon={Shield}
              colorClass={`bg-emerald-800 text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 print:hidden -mx-4 sm:mx-0">
            <nav className="-mb-px flex space-x-2 sm:space-x-4 md:space-x-8 overflow-x-auto px-4 sm:px-0 scrollbar-hide" aria-label="Tabs">
              <button
                onClick={() => onSetActiveTab('chart')}
                className={`${activeTab === 'chart' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <BarChart2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Allocation &</span> Plan
              </button>
              <button
                onClick={() => onSetActiveTab('montecarlo')}
                className={`${activeTab === 'montecarlo' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" /> Monte Carlo
              </button>
              <button
                onClick={() => onSetActiveTab('ss')}
                className={`${activeTab === 'ss' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> SS <span className="hidden sm:inline">Optimization</span>
              </button>
              <button
                onClick={() => onSetActiveTab('improve')}
                className={`${activeTab === 'improve' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> Improve
              </button>
              <button
                onClick={() => onSetActiveTab('architecture')}
                className={`${activeTab === 'architecture' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Layers className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Architecture</span><span className="sm:hidden">Arch</span>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'chart' && (
            <AllocationTab
              inputs={inputs}
              basePlan={basePlan}
              assumptions={assumptions}
              projectionData={projectionData}
              clientInfo={clientInfo}
              showCashFlowTable={showCashFlowTable}
              onSetShowCashFlowTable={onSetShowCashFlowTable}
              rebalanceFreq={rebalanceFreq}
              onSetRebalanceFreq={onSetRebalanceFreq}
            />
          )}

          {activeTab === 'montecarlo' && (
            <MonteCarloTab
              monteCarloData={monteCarloData}
              rebalanceFreq={rebalanceFreq}
            />
          )}

          {activeTab === 'ss' && (
            <SSOptimizationTab
              clientInfo={clientInfo}
              inputs={inputs}
              ssAnalysis={ssAnalysis}
              ssPartnerAnalysis={ssPartnerAnalysis}
              targetMaxPortfolioAge={targetMaxPortfolioAge}
              onSetTargetMaxPortfolioAge={onSetTargetMaxPortfolioAge}
              onUpdateSSStartAge={onUpdateSSStartAge}
              onUpdatePartnerSSStartAge={onUpdatePartnerSSStartAge}
            />
          )}

          {activeTab === 'improve' && (
            <ImproveOutcomeTab
              clientInfo={clientInfo}
              inputs={inputs}
              monteCarloData={monteCarloData}
              projectionData={projectionData}
              onInputChange={onInputChange}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureTab
              inputs={inputs}
              basePlan={basePlan}
              assumptions={assumptions}
              projectionData={projectionData}
            />
          )}
        </div>
        <div className="max-w-7xl mx-auto print:hidden">
          <Disclaimer />
        </div>
      </div>

      {/* Print-only pages for additional content would go here */}
      <PrintClosingPage clientInfo={clientInfo} />
    </div>
  );
};

// Sub-components for tabs
const AllocationTab = ({ inputs, basePlan, assumptions, projectionData, clientInfo, showCashFlowTable, onSetShowCashFlowTable, rebalanceFreq, onSetRebalanceFreq }) => (
  <div className="mt-6 animate-in fade-in duration-300">
    <div className="flex justify-between items-start mb-4 hidden print:flex">
      <h2 className="text-2xl font-bold text-slate-900">Phase 2: Distribution Allocation</h2>
      <img src={LOGO_URL} alt="Logo" className="h-12" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="p-6 flex flex-col justify-center">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Target Allocation</h3>
        <div className="h-64 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Short Term', value: basePlan.b1Val, color: COLORS.shortTerm },
                  { name: 'Mid Term', value: basePlan.b2Val, color: COLORS.midTerm },
                  { name: 'Balanced 60/40', value: basePlan.b3Val, color: COLORS.hedged },
                  { name: 'Inc & Gro', value: basePlan.b4Val, color: COLORS.income },
                  { name: 'Long Term', value: Math.max(0, basePlan.b5Val), color: COLORS.longTerm },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                <Cell fill={COLORS.shortTerm} />
                <Cell fill={COLORS.midTerm} />
                <Cell fill={COLORS.hedged} />
                <Cell fill={COLORS.income} />
                <Cell fill={COLORS.longTerm} />
              </Pie>
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <AllocationRow
            color={COLORS.shortTerm} name="1. Short Term"
            amount={basePlan.b1Val} percent={((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b1.return} stdDev={assumptions.b1.stdDev}
            historicalReturn={assumptions.b1.historical}
            description="Immediate liquidity buffer (Years 1-3)."
          />
          <AllocationRow
            color={COLORS.midTerm} name="2. Mid Term"
            amount={basePlan.b2Val} percent={((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b2.return} stdDev={assumptions.b2.stdDev}
            historicalReturn={assumptions.b2.historical}
            description="Conservative growth bridge (Years 4-6)."
          />
          <AllocationRow
            color={COLORS.hedged} name="3. Balanced 60/40"
            amount={basePlan.b3Val} percent={((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b3.return} stdDev={assumptions.b3.stdDev}
            historicalReturn={assumptions.b3.historical}
            description="Moderate risk for intermediate needs (Years 7-14)."
          />
          <AllocationRow
            color={COLORS.income} name="4. Income & Growth"
            amount={basePlan.b4Val} percent="10.0"
            returnRate={assumptions.b4.return} stdDev={assumptions.b4.stdDev}
            historicalReturn={assumptions.b4.historical}
            description="Fixed 10% allocation for dividends/yield."
          />
          <AllocationRow
            color={COLORS.longTerm} name="5. Long Term"
            amount={basePlan.b5Val} percent={((basePlan.b5Val / inputs.totalPortfolio) * 100).toFixed(1)}
            returnRate={assumptions.b5.return} stdDev={assumptions.b5.stdDev}
            historicalReturn={assumptions.b5.historical}
            description="Growth engine for longevity protection."
          />
        </div>
      </Card>
    </div>

    <Card className="p-6 mt-6 print:hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Portfolio Sustainability</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => onSetShowCashFlowTable(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${!showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <BarChart2 className="w-3 h-3" /> Chart
            </button>
            <button
              onClick={() => onSetShowCashFlowTable(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 ${showCashFlowTable ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              <TableIcon className="w-3 h-3" /> Table
            </button>
          </div>
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Rebalance Frequency</label>
            <select
              value={rebalanceFreq}
              onChange={(e) => onSetRebalanceFreq(parseInt(e.target.value))}
              className="bg-white border text-xs font-bold rounded px-2 py-1 w-full"
            >
              <option value={0}>Sequential (No Rebalance)</option>
              <option value={1}>Annual Rebalance</option>
              <option value={3}>Every 3 Years</option>
            </select>
          </div>
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
          <div className="mt-4 p-3 bg-yellow-50 text-xs text-yellow-800 rounded border border-yellow-100 flex items-start gap-2">
            <Activity className="w-4 h-4 mt-0.5" />
            <p>
              <strong>Grey Area:</strong> Miller Portfolio Architect Strategy - dynamic bucket allocation optimized for retirement income. <br />
              <strong>Gold Line:</strong> Benchmark 60/40 with annual rebalance for comparison. <br />
              <strong>Red Line:</strong> Distribution rate - annual withdrawal as % of portfolio.
            </p>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                {clientInfo.isMarried && <th className="p-2 text-left">Partner Age</th>}
                <th className="p-2">Start Balance</th>
                <th className="p-2 text-emerald-600">Growth</th>
                <th className="p-2 text-purple-600">Contribution</th>
                <th className="p-2 text-blue-600">Income (SS/Pens)</th>
                <th className="p-2 text-orange-600">Withdrawal</th>
                <th className="p-2 text-slate-800">Total Spend</th>
                <th className="p-2 text-slate-900">End Balance</th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map((row) => (
                <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                  {clientInfo.isMarried && <td className="p-2 text-left text-slate-500">{Math.floor(row.partnerAge)}</td>}
                  <td className="p-2 text-slate-500">${row.startBalance.toLocaleString()}</td>
                  <td className="p-2 text-emerald-600">+${row.growth.toLocaleString()}</td>
                  <td className="p-2 text-purple-600">{row.contribution > 0 ? `+$${row.contribution.toLocaleString()}` : '-'}</td>
                  <td className="p-2 text-blue-600">+${row.ssIncome.toLocaleString()}</td>
                  <td className="p-2 text-orange-600">-${row.distribution.toLocaleString()}</td>
                  <td className="p-2 font-medium text-slate-800">${row.expenses.toLocaleString()}</td>
                  <td className={`p-2 font-bold ${row.total > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  </div>
);

const MonteCarloTab = ({ monteCarloData, rebalanceFreq }) => (
  <div className="space-y-6 animate-in fade-in duration-300 mt-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatBox
        label="Success Rate"
        value={`${monteCarloData.successRate.toFixed(1)}%`}
        subtext="Iterations ending > $0"
        icon={Activity}
        colorClass={monteCarloData.successRate > 85 ? "bg-emerald-500" : "bg-orange-500"}
      />
      <div className="md:col-span-2 bg-indigo-50 p-4 rounded-lg text-sm text-indigo-900 flex items-center">
        <p>
          <strong>Simulation Logic:</strong> 500 iterations using Gaussian distribution.
          Strategy: <strong>{rebalanceFreq === 0 ? 'Sequential Depletion' : `Bucket Refill Every ${rebalanceFreq} Years`}</strong>.
        </p>
      </div>
    </div>

    <Card className="p-6">
      <h3 className="font-bold text-lg text-slate-800 mb-6">Monte Carlo Range (30 Years)</h3>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monteCarloData.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
            <Legend />
            <Area type="monotone" dataKey="p90" name="Upside (90th Percentile)" stroke="#166534" strokeWidth={2} fill={COLORS.midTerm} fillOpacity={0.3} />
            <Area type="monotone" dataKey="p10" name="Downside (10th Percentile)" stroke="#dc2626" strokeWidth={2} fill="white" fillOpacity={1} />
            <Line type="monotone" dataKey="median" name="Median Outcome" stroke={COLORS.longTerm} strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
);

const SSOptimizationTab = ({ clientInfo, inputs, ssAnalysis, ssPartnerAnalysis, targetMaxPortfolioAge, onSetTargetMaxPortfolioAge, onUpdateSSStartAge, onUpdatePartnerSSStartAge }) => (
  <div className="space-y-6 animate-in fade-in duration-300 mt-6">
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg text-slate-800">Optimization Analysis</h3>
          <p className="text-sm text-slate-500">Determine the optimal claiming strategy based on portfolio impact.</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <label className="block text-[10px] font-bold text-yellow-800 uppercase mb-1">
            At what age do you want your portfolio value maximized?
          </label>
          <select
            value={targetMaxPortfolioAge}
            onChange={(e) => onSetTargetMaxPortfolioAge(parseInt(e.target.value))}
            className="w-full text-sm font-bold p-1 rounded border border-yellow-300 bg-white text-slate-800"
          >
            <option value={70}>Age 70 (Maximize Early)</option>
            <option value={75}>Age 75</option>
            <option value={80}>Age 80</option>
            <option value={85}>Age 85</option>
            <option value={90}>Age 90 (Maximize Late)</option>
            <option value={95}>Age 95 (Maximize Legacy)</option>
          </select>
        </div>
      </div>

      {/* Client Recommendation */}
      <div className="mb-12">
        <div className="bg-black text-white p-6 rounded-xl mb-6 flex items-center gap-4">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <div>
            <h4 className="text-lg font-bold">Primary Client Recommendation</h4>
            <p className="text-gray-400 text-sm mt-1">
              Claim at Age <strong className="text-emerald-400 text-lg">{ssAnalysis.winner.age}</strong> to maximize portfolio balance at age {targetMaxPortfolioAge}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {ssAnalysis.outcomes.map((outcome) => (
            <div
              onClick={() => onUpdateSSStartAge(outcome.age)}
              key={outcome.age}
              className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all relative ${outcome.age === ssAnalysis.winner.age ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-emerald-300'}`}
            >
              <div className="absolute top-2 right-2 opacity-50">
                <MousePointerClick className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Claim at {outcome.age}</p>
              <p className={`text-xl font-bold ${outcome.age === ssAnalysis.winner.age ? 'text-emerald-700' : 'text-slate-700'}`}>
                ${Math.round(outcome.balance).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">Projected Portfolio @ Age {targetMaxPortfolioAge}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Partner Recommendation */}
      {clientInfo.isMarried && ssPartnerAnalysis && (
        <div className="mb-12 border-t pt-8">
          <div className="bg-slate-800 text-white p-6 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="w-10 h-10 text-yellow-500" />
              <div>
                <h4 className="text-lg font-bold">Partner Recommendation</h4>
                <p className="text-gray-400 text-sm mt-1">
                  Claim at Age <strong className="text-yellow-500 text-lg">{ssPartnerAnalysis.winner.age}</strong> to maximize portfolio balance at age {targetMaxPortfolioAge}.
                </p>
              </div>
            </div>
            <button
              onClick={() => onUpdatePartnerSSStartAge(ssPartnerAnalysis.winner.age)}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Apply Age {ssPartnerAnalysis.winner.age}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {ssPartnerAnalysis.outcomes.map((outcome) => (
              <div
                onClick={() => onUpdatePartnerSSStartAge(outcome.age)}
                key={outcome.age}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all relative ${outcome.age === ssPartnerAnalysis.winner.age ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 bg-slate-50 hover:border-yellow-300'}`}
              >
                <div className="absolute top-2 right-2 opacity-50">
                  <MousePointerClick className="w-4 h-4 text-yellow-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Claim at {outcome.age}</p>
                <p className={`text-xl font-bold ${outcome.age === ssPartnerAnalysis.winner.age ? 'text-yellow-700' : 'text-slate-700'}`}>
                  ${Math.round(outcome.balance).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400">Projected Portfolio @ Age {targetMaxPortfolioAge}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakeven Chart */}
      <div className="border-t pt-8">
        <h4 className="font-bold text-slate-800 mb-4">Breakeven Analysis (Cumulative Benefits)</h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ssAnalysis.breakevenData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="claim62" name="Claim @ 62" stroke="#f87171" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="claim67" name="Claim @ 67" stroke="#eab308" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="claim70" name="Claim @ 70" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Assumes benefits are reinvested at {inputs.ssReinvestRate || 4.5}% annually.
        </p>
      </div>
    </Card>
  </div>
);

// Improve Outcome Tab - Advisory Only
const ImproveOutcomeTab = ({ clientInfo, inputs, monteCarloData, projectionData, onInputChange }) => {
  const successRate = monteCarloData?.successRate || 0;
  const legacyBalance = projectionData[projectionData.length - 1]?.total || 0;
  const annualSpending = inputs.monthlySpending * 12;
  const legacyToSpendingRatio = annualSpending > 0 ? legacyBalance / annualSpending : 0;
  const isLowSuccess = successRate < 80;
  const isVeryHighLegacy = successRate >= 95 && legacyToSpendingRatio > 20;

  if (isLowSuccess) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 mt-6">
        <Card className="p-6 border-t-4 border-yellow-500">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-600" /> Planning Guidance
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Your current success probability is <strong>{successRate.toFixed(1)}%</strong>, which is below
            the recommended 80% threshold. Consider the following adjustments to improve your retirement outlook:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-blue-800">Delay Retirement</h4>
              </div>
              <p className="text-sm text-blue-700">
                Working a few more years allows your portfolio to grow while reducing the number of retirement years to fund.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-emerald-800">Increase Savings</h4>
              </div>
              <p className="text-sm text-emerald-700">
                Boosting your annual savings will increase your retirement portfolio and improve your success rate.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <h4 className="font-bold text-orange-800">Reduce Spending</h4>
              </div>
              <p className="text-sm text-orange-700">
                Lowering your planned monthly distribution reduces the withdrawal rate and extends portfolio longevity.
              </p>
              <button
                onClick={() => {
                  const portfolioWithdrawal = (inputs.totalPortfolio * 0.04) / 12;
                  const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge);
                  const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) : 0;
                  const fourPercentMonthly = Math.round(portfolioWithdrawal + clientSS + partnerSS);
                  onInputChange({ target: { name: 'monthlySpending', value: fourPercentMonthly, type: 'number' } });
                }}
                className="mt-3 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
              >
                Try the 4% Rule (${(() => {
                  const portfolioWithdrawal = (inputs.totalPortfolio * 0.04) / 12;
                  const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge);
                  const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) : 0;
                  return Math.round(portfolioWithdrawal + clientSS + partnerSS).toLocaleString();
                })()}/mo)
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
            <p className="text-sm text-slate-700">
              <strong>To make changes:</strong> Use the inputs in the Settings panel to the left to adjust your
              retirement age, monthly distribution, or other planning assumptions. The projections will update automatically.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (isVeryHighLegacy) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 mt-6">
        <Card className="p-6 border-t-4 border-purple-500">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" /> Planning Guidance
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Your plan shows a <strong>{successRate.toFixed(1)}%</strong> success rate with a projected legacy
            of <strong>${legacyBalance.toLocaleString()}</strong> - that's over {legacyToSpendingRatio.toFixed(0)}x your annual spending!
          </p>

          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 mb-6">
            <h4 className="font-bold text-purple-800 mb-2">You May Be Leaving Too Large a Legacy</h4>
            <p className="text-sm text-purple-700 mb-3">
              Unless leaving a substantial inheritance is a priority, you have options to enjoy more of your wealth:
            </p>
            <ul className="text-sm text-purple-700 space-y-2 list-disc list-inside">
              <li><strong>Retire earlier</strong> - You may be able to stop working sooner than planned</li>
              <li><strong>Spend more in retirement</strong> - Increase your monthly distribution for a more comfortable lifestyle</li>
              <li><strong>Save less now</strong> - Enjoy more of your current income while still achieving your goals</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
            <p className="text-sm text-slate-700">
              <strong>To make changes:</strong> Use the inputs in the Settings panel to the left to adjust your
              retirement age, monthly distribution, or savings rate. The projections will update automatically.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // On track
  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
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
    </div>
  );
};

// Architecture Tab - Detailed portfolio breakdown with pie chart and bucket distributions
const ArchitectureTab = ({ inputs, basePlan, assumptions, projectionData }) => {
  // Prepare withdrawal data for the chart
  const withdrawalData = projectionData.map(row => ({
    year: row.year,
    age: row.age,
    'B1 Short Term': row.w1 || 0,
    'B2 Mid Term': row.w2 || 0,
    'B3 Balanced': row.w3 || 0,
    'B4 Income & Growth': row.w4 || 0,
    'B5 Long Term': row.w5 || 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie Chart - Target Allocation */}
        <Card className="p-6">
          <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" /> Target Allocation
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Short Term (B1)', value: basePlan.b1Val, color: COLORS.shortTerm },
                    { name: 'Mid Term (B2)', value: basePlan.b2Val, color: COLORS.midTerm },
                    { name: 'Balanced 60/40 (B3)', value: basePlan.b3Val, color: COLORS.hedged },
                    { name: 'Income & Growth (B4)', value: basePlan.b4Val, color: COLORS.income },
                    { name: 'Long Term (B5)', value: Math.max(0, basePlan.b5Val), color: COLORS.longTerm },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  <Cell fill={COLORS.shortTerm} />
                  <Cell fill={COLORS.midTerm} />
                  <Cell fill={COLORS.hedged} />
                  <Cell fill={COLORS.income} />
                  <Cell fill={COLORS.longTerm} />
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-slate-800">${inputs.totalPortfolio.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Total Portfolio at Retirement</p>
          </div>
        </Card>

        {/* Bucket Details Table */}
        <Card className="p-6">
          <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" /> Bucket Strategy Details
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.shortTerm}20`, borderLeft: `4px solid ${COLORS.shortTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 1: Short Term</p>
                  <p className="text-xs text-slate-500">Years 1-3 • Immediate liquidity</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b1Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b1.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.midTerm}20`, borderLeft: `4px solid ${COLORS.midTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 2: Mid Term</p>
                  <p className="text-xs text-slate-500">Years 4-6 • Conservative growth</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b2Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b2.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.hedged}20`, borderLeft: `4px solid ${COLORS.hedged}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 3: Balanced 60/40</p>
                  <p className="text-xs text-slate-500">Years 7-14 • Moderate risk</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b3Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b3.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.income}20`, borderLeft: `4px solid ${COLORS.income}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 4: Income & Growth</p>
                  <p className="text-xs text-slate-500">Fixed 10% • Dividends/yield</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b4Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">10.0% • {assumptions.b4.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.longTerm}20`, borderLeft: `4px solid ${COLORS.longTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 5: Long Term</p>
                  <p className="text-xs text-slate-500">Years 15+ • Growth engine</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${Math.max(0, basePlan.b5Val).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b5.return}% return</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Withdrawals by Bucket Chart */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" /> Withdrawals by Bucket
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={withdrawalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${(val / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} labelFormatter={(l) => `Year ${l}`} />
              <Legend />
              <Bar dataKey="B1 Short Term" stackId="1" fill={COLORS.shortTerm} />
              <Bar dataKey="B2 Mid Term" stackId="1" fill={COLORS.midTerm} />
              <Bar dataKey="B3 Balanced" stackId="1" fill={COLORS.hedged} />
              <Bar dataKey="B4 Income & Growth" stackId="1" fill={COLORS.income} />
              <Bar dataKey="B5 Long Term" stackId="1" fill={COLORS.longTerm} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          This chart shows which bucket withdrawals come from each year. Sequential distribution takes from B1 first, then B2, B3, B4, and finally B5.
        </p>
      </Card>
    </div>
  );
};

const PrintFooter = ({ pageNumber }) => (
  <div className="border-t border-gray-100 pt-4 mt-auto">
    <div className="flex justify-between text-[10px] text-gray-400 mb-2">
      <span>Miller Wealth Management | Confidential</span>
      <span>Page {pageNumber} of 8</span>
    </div>
    <p className="text-[8px] text-gray-400 text-center leading-tight">
      Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial.
    </p>
  </div>
);

const PrintClosingPage = ({ clientInfo }) => (
  <div className="hidden print:block break-after-page p-8">
    <div className="flex justify-between items-start mb-8">
      <h2 className="text-3xl font-bold text-slate-900">Thank You</h2>
      <img src={LOGO_URL} alt="Logo" className="h-12" />
    </div>

    <p className="text-lg text-slate-700 mb-8">
      Dear {clientInfo.name || "Valued Client"},
    </p>
    <p className="text-slate-600 mb-6 leading-relaxed">
      Thank you for taking the time to explore your retirement strategy with Miller Wealth Management. This illustration is designed to provide a framework for understanding the potential outcomes of different planning decisions.
    </p>
    <p className="text-slate-600 mb-6 leading-relaxed">
      Please remember that all projections are hypothetical and based on the assumptions outlined in this document. Actual results may vary based on market conditions, changes in personal circumstances, and other factors.
    </p>
    <p className="text-slate-600 mb-6 leading-relaxed">
      We encourage you to review this information carefully and reach out with any questions. Our team is here to help you navigate the complexities of retirement planning and work toward your financial goals.
    </p>

    <div className="mt-8 mb-12">
      <p className="font-bold text-slate-800">Warm regards,</p>
      <div className="h-12"></div>
      <p className="font-bold text-slate-900">Rodd R. Miller, CFP®</p>
      <p className="text-slate-600 text-xs">Founder & President<br />Miller Wealth Management</p>
    </div>

    <div className="mt-auto bg-slate-50 p-6 rounded-xl border border-slate-200">
      <p className="text-center font-bold text-slate-800 mb-4 text-sm">We invite you to work with a firm that is committed to providing customized financial guidance and unmatched personal service. Please contact us to schedule a no-obligation consultation.</p>
      <div className="flex justify-around text-xs font-bold text-emerald-700">
        <span>(480) 613-7400</span>
        <span>info@millerwm.com</span>
        <span>www.millerwm.com</span>
      </div>
    </div>

    <PrintFooter pageNumber={7} />
  </div>
);

export default ArchitectPage;
