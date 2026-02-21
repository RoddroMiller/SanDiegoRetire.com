import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, Area, AreaChart, LineChart
} from 'recharts';
import {
  Calculator, DollarSign, TrendingUp, Shield, Clock, AlertCircle,
  Activity, BarChart2, Briefcase, Download, Lock,
  RefreshCw, User, Users, FileText, ArrowRight,
  Info, CheckCircle, MousePointerClick, Save, FolderOpen, Loader,
  LogIn, LogOut, UserCheck, Send, Table as TableIcon, PiggyBank, Layers, Target, Upload
} from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { getAdjustedSS, generateAndDownloadIPS, calculateAnnualTax, calculateTaxableSS, calculateFederalTax } from '../../utils';
import { Card, StatBox, AllocationRow, FormattedNumberInput, Disclaimer } from '../ui';

/**
 * Architect Page - Step 2 of the portfolio planning process
 * Displays distribution phase strategy with bucket allocation and projections
 */
export const ArchitectPage = ({
  // Auth & Navigation
  userRole,
  // Save/Submit
  saveStatus,
  onSaveScenario,
  onClientSubmit,
  onGenerateReport,
  isGeneratingReport,
  // Client Data
  clientInfo,
  onClientChange,
  // Inputs & Assumptions
  inputs,
  onInputChange,
  assumptions,
  // UI State
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
  optimizerData,
  optimizerRebalanceFreq,
  onSetOptimizerRebalanceFreq,
  ssAnalysis,
  ssPartnerAnalysis,
  // SS Settings
  targetMaxPortfolioAge,
  onSetTargetMaxPortfolioAge,
  onUpdateSSStartAge,
  onUpdatePartnerSSStartAge,
  // Command Center (The One Process) integration
  commandCenterStatus,
  onSaveToCommandCenter,
  isCommandCenterConnected,
  commandCenterClients,
  isLoadingClients,
  // Manual Allocation Override
  useManualAllocation,
  manualAllocationMode,
  manualAllocations,
  manualPercentages,
  useManualForRebalance,
  onToggleManualAllocation,
  onToggleManualForRebalance,
  onManualAllocationChange,
  onManualAllocationModeChange,
  onRecalculateFromFormula,
  formulaAllocations,
  // VA GIB Override
  vaEnabled,
  vaInputs,
  onToggleVa,
  onVaInputChange,
  vaMonteCarloData,
  vaAdjustedBasePlan,
  vaOptimizerData,
  // 3-Way Account Split
  onAccountSplitChange,
  onWithdrawalOverrideChange
}) => {
  // Compute legacy balance at age 95 (or last available year)
  const legacyAt95 = useMemo(() => {
    const entry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    return entry?.total || 0;
  }, [projectionData]);

  // Command Center client selector state
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [selectedCommandCenterClient, setSelectedCommandCenterClient] = useState(null);

  // Withdrawal Override modal state
  const [showWithdrawalOverrides, setShowWithdrawalOverrides] = useState(false);

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
        legacyBalance: legacyAt95
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

    const baseLegacy = legacyAt95;
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

      {/* PRINT PAGE 1: Cover Page */}
      <div className="hidden print:flex flex-col min-h-[10in] break-after-page items-center justify-center text-center p-12 bg-white">
        <img src={LOGO_URL} alt="Logo" className="h-40 mb-8" />
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Retirement Strategy Illustration</h1>
        <div className="w-32 h-1.5 bg-emerald-600 mx-auto mb-10"></div>
        <p className="text-3xl text-slate-600 mb-3">Prepared for</p>
        <p className="text-4xl font-bold text-emerald-700 mb-16">{clientInfo.name || "Valued Client"}</p>
        <div className="text-left border-t border-slate-200 pt-10 w-full max-w-lg mx-auto space-y-4 text-lg text-slate-600">
          <p><strong>Email:</strong> {clientInfo.email || 'Not provided'}</p>
          <p><strong>Phone:</strong> {clientInfo.phone || 'Not provided'}</p>
          <p><strong>Prepared:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="mt-auto pt-12 text-base text-slate-400">
          <p>Miller Wealth Management</p>
          <p>www.millerwm.com | (480) 613-7400</p>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 md:mb-8 print:hidden">
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
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
            {userRole !== 'client' && isCommandCenterConnected && (
              <button
                onClick={() => setShowClientSelector(true)}
                disabled={commandCenterStatus === 'saving'}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg shadow-sm transition-all font-medium text-xs sm:text-sm ${commandCenterStatus === 'success' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                title="Save to The One Process Client Command Center"
              >
                {commandCenterStatus === 'saving' ? <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : commandCenterStatus === 'success' ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Upload className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span className="hidden sm:inline">{commandCenterStatus === 'success' ? 'Saved!' : 'Save to Client'}</span>
                <span className="sm:hidden">{commandCenterStatus === 'success' ? 'Saved!' : 'Client'}</span>
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

      {/* PRINT PAGE 2: Phase 1 - Accumulation */}
      <PrintPageWrapper pageNumber={2} title="Phase 1 - Accumulation" subtitle="Building your retirement portfolio">
        <div className="border rounded-lg p-3 mb-4">
          <AreaChart width={670} height={200} data={accumulationData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="balance" stroke={COLORS.hedged} fill={COLORS.hedged} fillOpacity={0.2} />
          </AreaChart>
        </div>
        <div className="grid grid-cols-4 gap-3 text-sm mb-4">
          <div className="bg-slate-50 p-2 rounded-lg">
            <p className="text-[12px] text-slate-500">Current Age</p>
            <p className="font-bold text-base">{clientInfo.currentAge}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg">
            <p className="text-[12px] text-slate-500">Retirement Age</p>
            <p className="font-bold text-base">{clientInfo.retirementAge}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg">
            <p className="text-[12px] text-slate-500">Current Portfolio</p>
            <p className="font-bold text-base">${clientInfo.currentPortfolio.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg">
            <p className="text-[12px] text-slate-500">Annual Savings</p>
            <p className="font-bold text-base">${clientInfo.annualSavings.toLocaleString()}</p>
          </div>
        </div>

        {/* Cash Flow Table for Accumulation Phase */}
        <div className="border border-slate-200 rounded-lg p-3 mb-4">
          <h3 className="font-bold text-base text-slate-800 mb-2">Accumulation Cash Flow</h3>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-1 text-left">Age</th>
                <th className="p-1 text-right">Start Balance</th>
                <th className="p-1 text-right text-emerald-600">Savings</th>
                <th className="p-1 text-right text-blue-600">Growth</th>
                <th className="p-1 text-right font-bold">End Balance</th>
              </tr>
            </thead>
            <tbody>
              {accumulationData.map((row, i) => {
                const prevBalance = i > 0 ? accumulationData[i - 1].balance : clientInfo.currentPortfolio;
                const savings = i > 0 ? Math.round(clientInfo.annualSavings * Math.pow(1 + (inputs.inflationRate / 100), i - 1)) : 0;
                const growth = i > 0 ? row.balance - prevBalance - savings : 0;
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-1">{row.age}</td>
                    <td className="p-1 text-right">${prevBalance.toLocaleString()}</td>
                    <td className="p-1 text-right text-emerald-600">{savings > 0 ? `+$${savings.toLocaleString()}` : '-'}</td>
                    <td className="p-1 text-right text-blue-600">{growth > 0 ? `+$${Math.round(growth).toLocaleString()}` : '-'}</td>
                    <td className="p-1 text-right font-bold">${row.balance.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-800 font-bold text-[13px]">Projected Portfolio at Retirement (Age {clientInfo.retirementAge})</p>
              <p className="text-xs text-emerald-600">Based on {clientInfo.expectedReturn}% expected return</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">${inputs.totalPortfolio.toLocaleString()}</p>
          </div>
        </div>
      </PrintPageWrapper>

      {/* MAIN ARCHITECT PAGE */}
      <div className="max-w-7xl mx-auto print:block print:break-after-page">

        <div className="space-y-6">

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
                : `$${(inputs.monthlySpending || clientInfo.currentSpending || 0).toLocaleString()}`}
              subtext={(() => {
                // Use year-1 portfolio withdrawal from simulation (accounts for all income sources & timing)
                const annualWithdrawal = projectionData[0]?.distribution || 0;
                return `$${Math.round(annualWithdrawal / 12).toLocaleString()}/mo from portfolio`;
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
                : "Positive balance at age 95"}
              icon={Activity}
              colorClass={`${(adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate) > 80 ? "bg-emerald-600" : "bg-orange-500"} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
            <StatBox
              label="Legacy Balance (Age 95)"
              value={adjustedProjections.hasChanges
                ? `$${(adjustedProjections.legacyBalance / 1000000).toFixed(2)}M`
                : `$${((legacyAt95) / 1000000).toFixed(2)}M`}
              subtext={adjustedProjections.hasChanges
                ? <><span className="line-through opacity-60">${((legacyAt95) / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.legacyBalance - (legacyAt95)) / 1000).toFixed(0)}k</>
                : "Projected value at age 95"}
              icon={Shield}
              colorClass={`bg-emerald-800 text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
          </div>

          {/* Quick Adjustments - Retirement Age & Savings */}
          {!clientInfo.isRetired && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-800 text-sm">Retirement Age</h4>
                  </div>
                  <FormattedNumberInput
                    name="retirementAge"
                    value={clientInfo.retirementAge}
                    onChange={onClientChange}
                    className="p-2 border border-blue-300 rounded-lg w-20 text-center font-bold text-blue-800 bg-white"
                  />
                </div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-3">
                  <PiggyBank className="w-5 h-5 text-emerald-600" />
                  <div className="flex-1">
                    <h4 className="font-bold text-emerald-800 text-sm">Annual Savings</h4>
                  </div>
                  <FormattedNumberInput
                    name="annualSavings"
                    value={clientInfo.annualSavings}
                    onChange={onClientChange}
                    className="p-2 border border-emerald-300 rounded-lg w-28 text-center font-bold text-emerald-800 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

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
              <button
                onClick={() => onSetActiveTab('optimizer')}
                className={`${activeTab === 'optimizer' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Target className="w-3 h-3 sm:w-4 sm:h-4" /> Optimizer
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
              useManualAllocation={useManualAllocation}
              manualAllocationMode={manualAllocationMode}
              manualAllocations={manualAllocations}
              manualPercentages={manualPercentages}
              useManualForRebalance={useManualForRebalance}
              onToggleManualAllocation={onToggleManualAllocation}
              onToggleManualForRebalance={onToggleManualForRebalance}
              onManualAllocationChange={onManualAllocationChange}
              onManualAllocationModeChange={onManualAllocationModeChange}
              onRecalculateFromFormula={onRecalculateFromFormula}
              formulaAllocations={formulaAllocations}
              onInputChange={onInputChange}
              onAccountSplitChange={onAccountSplitChange}
              onWithdrawalOverrideChange={onWithdrawalOverrideChange}
            />
          )}

          {activeTab === 'montecarlo' && (
            <MonteCarloTab
              monteCarloData={monteCarloData}
              rebalanceFreq={rebalanceFreq}
              vaEnabled={vaEnabled}
              vaInputs={vaInputs}
              onToggleVa={onToggleVa}
              onVaInputChange={onVaInputChange}
              vaMonteCarloData={vaMonteCarloData}
              inputs={inputs}
              basePlan={basePlan}
              vaAdjustedBasePlan={vaAdjustedBasePlan}
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

          {activeTab === 'optimizer' && (
            <OptimizerTab
              optimizerData={optimizerData}
              inputs={inputs}
              basePlan={basePlan}
              monteCarloData={monteCarloData}
              projectionData={projectionData}
              optimizerRebalanceFreq={optimizerRebalanceFreq}
              onSetOptimizerRebalanceFreq={onSetOptimizerRebalanceFreq}
              clientInfo={clientInfo}
              assumptions={assumptions}
              vaEnabled={vaEnabled}
              vaInputs={vaInputs}
              vaOptimizerData={vaOptimizerData}
            />
          )}
        </div>
        <div className="w-full print:hidden">
          <Disclaimer />
        </div>
      </div>

      {/* PRINT PAGE 3: Bucket Architecture */}
      <PrintPageWrapper pageNumber={3} title="Bucket Architecture" subtitle="Time-segmented allocation strategy">
        {/* Bucket Allocation Summary */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.shortTerm}20`, borderTop: `4px solid ${COLORS.shortTerm}` }}>
            <p className="text-xs font-bold text-slate-600">B1 - Short Term</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b1Val >= 1000000 ? `$${(basePlan.b1Val / 1000000).toFixed(2)}M` : `$${(basePlan.b1Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 1-3</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.midTerm}20`, borderTop: `4px solid ${COLORS.midTerm}` }}>
            <p className="text-xs font-bold text-slate-600">B2 - Mid Term</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b2Val >= 1000000 ? `$${(basePlan.b2Val / 1000000).toFixed(2)}M` : `$${(basePlan.b2Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 4-6</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.hedged}20`, borderTop: `4px solid ${COLORS.hedged}` }}>
            <p className="text-xs font-bold text-slate-600">B3 - Balanced</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b3Val >= 1000000 ? `$${(basePlan.b3Val / 1000000).toFixed(2)}M` : `$${(basePlan.b3Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 7-15</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.income}20`, borderTop: `4px solid ${COLORS.income}` }}>
            <p className="text-xs font-bold text-slate-600">B4 - Income</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b4Val >= 1000000 ? `$${(basePlan.b4Val / 1000000).toFixed(2)}M` : `$${(basePlan.b4Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b4Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">10% Fixed</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.longTerm}20`, borderTop: `4px solid ${COLORS.longTerm}` }}>
            <p className="text-xs font-bold text-slate-600">B5 - Long Term</p>
            <p className="text-xl font-bold text-slate-800">{Math.max(0, basePlan.b5Val) >= 1000000 ? `$${(Math.max(0, basePlan.b5Val) / 1000000).toFixed(2)}M` : `$${(Math.max(0, basePlan.b5Val) / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Remainder</p>
          </div>
        </div>

        {/* Strategy Explanation */}
        <div className="border border-slate-200 rounded-lg p-5 mb-4">
          <h3 className="font-bold text-base text-slate-800 mb-4">Time-Segmented Bucket Strategy</h3>
          <div className="grid grid-cols-2 gap-6 text-[13px] text-slate-600">
            <div>
              <p className="mb-3"><strong>How It Works:</strong> Assets are allocated into buckets based on when they'll be needed. Near-term needs are in conservative investments, while long-term assets can grow more aggressively.</p>
              <p><strong>Withdrawal Sequence:</strong> Distributions come from B1 first, then B2, B3, B4, and finally B5. This allows growth assets time to recover from market downturns.</p>
            </div>
            <div>
              <p className="mb-3"><strong>Rebalancing:</strong> Periodically, gains from growth buckets refill near-term buckets, maintaining the time-segmented structure.</p>
              <p><strong>Benefits:</strong> Reduces sequence-of-returns risk, provides psychological comfort during market volatility, and maintains liquidity for near-term needs.</p>
            </div>
          </div>
        </div>

        {/* Return Assumptions */}
        <div className="border border-slate-200 rounded-lg p-5">
          <h3 className="font-bold text-base text-slate-800 mb-4">Return Assumptions by Bucket</h3>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3 text-left">Bucket</th>
                <th className="p-3 text-center">Expected Return</th>
                <th className="p-3 text-center">Std Deviation</th>
                <th className="p-3 text-left">Investment Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3 font-medium">B1 - Short Term</td>
                <td className="p-3 text-center">{assumptions.b1.return}%</td>
                <td className="p-3 text-center">{assumptions.b1.stdDev}%</td>
                <td className="p-3">Cash, Money Market, Short-term Bonds</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-3 font-medium">B2 - Mid Term</td>
                <td className="p-3 text-center">{assumptions.b2.return}%</td>
                <td className="p-3 text-center">{assumptions.b2.stdDev}%</td>
                <td className="p-3">Intermediate Bonds, Conservative Allocation</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">B3 - Balanced</td>
                <td className="p-3 text-center">{assumptions.b3.return}%</td>
                <td className="p-3 text-center">{assumptions.b3.stdDev}%</td>
                <td className="p-3">60/40 Balanced Portfolio</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-3 font-medium">B4 - Income & Growth</td>
                <td className="p-3 text-center">{assumptions.b4.return}%</td>
                <td className="p-3 text-center">{assumptions.b4.stdDev}%</td>
                <td className="p-3">Dividend Stocks, REITs, Preferred</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">B5 - Long Term</td>
                <td className="p-3 text-center">{assumptions.b5.return}%</td>
                <td className="p-3 text-center">{assumptions.b5.stdDev}%</td>
                <td className="p-3">Equity Growth, Small Cap, International</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 4: Phase 2 - Distribution Phase Flowchart */}
      {(() => {
        // Helper function for conditional formatting
        const fmtMoney = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(2)}M` : `$${Math.round(val / 1000)}k`;

        // Get income data for each phase's first year
        const getPhaseIncome = (yearIndex) => {
          const row = projectionData[yearIndex] || {};
          const simAge = clientInfo.retirementAge + yearIndex;
          const partnerSimAge = clientInfo.partnerAge + yearIndex;
          const inflationFactor = Math.pow(1 + (inputs.inflationRate || 2.5) / 100, yearIndex);

          let ssMonthly = 0;
          if (simAge >= inputs.ssStartAge) {
            ssMonthly += Math.round(getAdjustedSS(inputs.ssPIA, inputs.ssStartAge) * inflationFactor);
          }
          if (clientInfo.isMarried && partnerSimAge >= inputs.partnerSSStartAge) {
            ssMonthly += Math.round(getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) * inflationFactor);
          }

          let pensionMonthly = 0;
          if (simAge >= inputs.pensionStartAge && inputs.monthlyPension > 0) {
            pensionMonthly += inputs.pensionCOLA
              ? Math.round(inputs.monthlyPension * inflationFactor)
              : inputs.monthlyPension;
          }
          if (clientInfo.isMarried && inputs.partnerMonthlyPension > 0 && partnerSimAge >= (inputs.partnerPensionStartAge || 65)) {
            pensionMonthly += inputs.partnerPensionCOLA
              ? Math.round(inputs.partnerMonthlyPension * inflationFactor)
              : inputs.partnerMonthlyPension;
          }

          const portfolioMonthly = Math.round((row.distribution || 0) / 12);
          const total = ssMonthly + pensionMonthly + portfolioMonthly;
          return { ss: ssMonthly, pension: pensionMonthly, portfolio: portfolioMonthly, total };
        };

        const phase1Income = getPhaseIncome(0);
        const phase2Income = getPhaseIncome(3);
        const phase3Income = getPhaseIncome(6);
        const phase4Income = getPhaseIncome(15);
        const phase5Income = getPhaseIncome(20);

        const buckets = [
          { label: 'B1 - Short Term', val: basePlan.b1Val, years: 'Years 1-3', color: COLORS.shortTerm, rate: `${fmtMoney(basePlan.b1Val / 3)}/yr`, end: '$0 @ Year 3', income: phase1Income },
          { label: 'B2 - Mid Term', val: basePlan.b2Val, years: 'Years 4-6', color: COLORS.midTerm, rate: `${fmtMoney(basePlan.b2Val / 3)}/yr`, end: '$0 @ Year 6', income: phase2Income },
          { label: 'B3 - Balanced 60/40', val: basePlan.b3Val, years: 'Years 7-15', color: COLORS.hedged, rate: `${fmtMoney(basePlan.b3Val / 9)}/yr`, end: '$0 @ Year 15', income: phase3Income },
          { label: 'B4 - Income & Growth', val: basePlan.b4Val, years: 'Years 16-20', color: COLORS.income, rate: `${fmtMoney(basePlan.b4Val / 5)}/yr`, end: '$0 @ Year 20', income: phase4Income },
          { label: 'B5 - Long Term', val: basePlan.b5Val, years: 'Year 21+', color: COLORS.longTerm, rate: '20 Years to grow', end: `${fmtMoney(projectionData[19]?.b5 || basePlan.b5Val * 2)} @ Yr 20`, income: phase5Income, isGrowth: true },
        ];

        return (
          <PrintPageWrapper pageNumber={4} title="Phase 2 - Distribution Strategy" subtitle="Bucket-based withdrawal sequence">
            {/* Starting Balance */}
            <div className="flex flex-col items-center mb-3">
              <div className="bg-slate-800 text-white px-10 py-2 rounded-lg shadow-lg text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Starting Retirement Portfolio</p>
                <p className="text-xl font-bold">{fmtMoney(inputs.totalPortfolio)}</p>
              </div>
              <div className="w-0.5 h-3 bg-slate-400"></div>
            </div>

            {/* 5 Buckets Row */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {buckets.map((b, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-white p-1.5 rounded-lg w-full text-center" style={{ backgroundColor: b.color }}>
                    <p className="text-xs font-semibold">{b.label}</p>
                    <p className="text-base font-bold">{fmtMoney(b.val)}</p>
                    <p className="text-xs opacity-80">{b.years}</p>
                  </div>
                  <div className="w-0.5 h-2" style={{ backgroundColor: b.color }}></div>
                  <div className="text-xs text-center text-slate-600 p-1 rounded w-full" style={{ backgroundColor: `${b.color}20` }}>
                    <p className="font-semibold">{b.rate}</p>
                  </div>
                  <div className="w-0.5 h-2" style={{ backgroundColor: b.color }}></div>
                  <div className={`px-2 py-0.5 rounded text-xs font-semibold ${b.isGrowth ? 'text-white' : 'bg-slate-200 text-slate-600'}`} style={b.isGrowth ? { backgroundColor: b.color } : undefined}>
                    {b.end}
                  </div>
                  {/* Income breakdown */}
                  <div className="w-full mt-1 p-1.5 bg-slate-50 rounded border border-slate-200 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><span>SS:</span><span>${b.income.ss.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Pension:</span><span>${b.income.pension.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Portfolio:</span><span>${b.income.portfolio.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold border-t border-slate-300 pt-0.5"><span>Total:</span><span>${b.income.total.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Flow explanation */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">→</span>
                <p className="text-xs text-slate-700">
                  <strong>Sequential Withdrawal Strategy:</strong> Withdrawals are taken from B1 first (years 1-3), then B2 (years 4-6),
                  then B3 (years 7-15), then B4 (years 16-20). Meanwhile, B5 remains invested for maximum growth over 20 years before being tapped.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.shortTerm }}></span> Short Term</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.midTerm }}></span> Mid Term</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.hedged }}></span> Balanced 60/40</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.income }}></span> Income & Growth</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.longTerm }}></span> Long Term</span>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">30-Year Success Probability</p>
                <div className={`text-3xl font-bold ${monteCarloData.successRate >= 85 ? 'text-emerald-600' : monteCarloData.successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {monteCarloData.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Based on 500 Monte Carlo simulations</p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${monteCarloData.successRate >= 85 ? 'bg-emerald-500' : monteCarloData.successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(monteCarloData.successRate, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="border-2 border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Projected Legacy (Age 95)</p>
                <div className="text-2xl font-bold text-indigo-600">
                  {fmtMoney(legacyAt95)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Median projected portfolio value</p>
                <div className="flex justify-center gap-3 mt-1 text-[11px]">
                  <span className="text-slate-500">Start: {fmtMoney(inputs.totalPortfolio)}</span>
                  <span className="text-slate-400">→</span>
                  <span className={`font-semibold ${legacyAt95 >= inputs.totalPortfolio ? 'text-emerald-600' : 'text-red-600'}`}>
                    {legacyAt95 >= inputs.totalPortfolio ? '+' : '-'}
                    {fmtMoney(Math.abs(legacyAt95 - inputs.totalPortfolio))}
                  </span>
                </div>
              </div>
            </div>
          </PrintPageWrapper>
        );
      })()}

      {/* PRINT PAGE 5: Portfolio Sustainability */}
      <PrintPageWrapper pageNumber={5} title="Portfolio Sustainability" subtitle={inputs.taxEnabled ? 'Projected portfolio balance and cash flow (with estimated taxes)' : 'Projected portfolio balance and annual cash flow detail'}>
        {/* Chart */}
        <div className="border border-slate-200 rounded-lg p-3 mb-4">
          <ComposedChart width={670} height={180} data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" dataKey="total" name="Bucket Strategy" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
            <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
          </ComposedChart>
        </div>

        {/* Cash Flow Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-[10px] text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold">
                <th className="p-1 text-left">Age</th>
                <th className="p-1">Start Bal.</th>
                <th className="p-1 text-emerald-600">Growth</th>
                <th className="p-1 text-blue-600">Income</th>
                <th className="p-1 text-orange-600">Withdrawal</th>
                {inputs.taxEnabled && <th className="p-1 text-red-600">Est. Tax</th>}
                <th className="p-1 text-slate-800">{inputs.taxEnabled ? 'Gross Spend' : 'Spending'}</th>
                {inputs.taxEnabled && <th className="p-1 text-slate-600">Net Spend</th>}
                <th className="p-1 text-slate-900">End Bal.</th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map((row, i) => (
                <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-1 text-left font-bold text-slate-700">{row.age}</td>
                  <td className="p-1 text-slate-500">${row.startBalance.toLocaleString()}</td>
                  <td className="p-1 text-emerald-600">+${row.growth.toLocaleString()}</td>
                  <td className="p-1 text-blue-600">+${row.ssIncome.toLocaleString()}</td>
                  <td className="p-1 text-orange-600">-${row.distribution.toLocaleString()}</td>
                  {inputs.taxEnabled && <td className="p-1 text-red-600">-${(row.totalTax || 0).toLocaleString()}</td>}
                  <td className="p-1 text-slate-800">${row.expenses.toLocaleString()}</td>
                  {inputs.taxEnabled && <td className="p-1 text-slate-600">${Math.max(0, row.expenses - (row.totalTax || 0)).toLocaleString()}</td>}
                  <td className={`p-1 font-bold ${row.total > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inputs.taxEnabled && (
          <div className="mt-2 p-1.5 bg-amber-50 text-[9px] text-amber-800 rounded border border-amber-100">
            <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} filing status, {inputs.traditionalPercent}% Traditional / {inputs.rothPercent}% Roth / {inputs.nqPercent}% Non-Qualified account mix, {inputs.stateRate}% state tax rate.
          </div>
        )}
      </PrintPageWrapper>

      {/* PRINT PAGE 6: Social Security Optimization */}
      <PrintPageWrapper pageNumber={6} title="Social Security Optimization" subtitle="Optimal claiming strategy analysis">
        {/* Primary Recommendation */}
        <div className="bg-black text-white p-4 rounded-lg mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-[13px] text-slate-400">Primary Client Recommendation</p>
              <p className="text-xl font-bold">
                Claim at Age <span className="text-emerald-400">{ssAnalysis.winner.age}</span> to maximize portfolio at age {targetMaxPortfolioAge}
              </p>
            </div>
          </div>
        </div>

        {/* Claiming Scenarios */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {ssAnalysis.outcomes.map((outcome) => (
            <div key={outcome.age} className={`p-3 rounded-lg border ${outcome.age === ssAnalysis.winner.age ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-xs font-bold text-slate-500">Claim at {outcome.age}</p>
              <p className={`text-base font-bold ${outcome.age === ssAnalysis.winner.age ? 'text-emerald-700' : 'text-slate-700'}`}>
                ${Math.round(outcome.balance).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400">Portfolio @ Age {targetMaxPortfolioAge}</p>
            </div>
          ))}
        </div>

        {/* Partner Section if married */}
        {clientInfo.isMarried && ssPartnerAnalysis && (
          <>
            <div className="bg-slate-800 text-white p-4 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-[13px] text-slate-400">Partner Recommendation</p>
                  <p className="text-xl font-bold">
                    Claim at Age <span className="text-yellow-500">{ssPartnerAnalysis.winner.age}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {ssPartnerAnalysis.outcomes.map((outcome) => (
                <div key={outcome.age} className={`p-3 rounded-lg border ${outcome.age === ssPartnerAnalysis.winner.age ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs font-bold text-slate-500">Claim at {outcome.age}</p>
                  <p className={`text-base font-bold ${outcome.age === ssPartnerAnalysis.winner.age ? 'text-yellow-700' : 'text-slate-700'}`}>
                    ${Math.round(outcome.balance).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Breakeven Chart */}
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="font-bold text-base text-slate-800 mb-2">Breakeven Analysis (Cumulative Benefits)</h3>
          <LineChart width={670} height={160} data={ssAnalysis.breakevenData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="claim62" name="@ 62" stroke="#f87171" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="claim67" name="@ 67" stroke="#eab308" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="claim70" name="@ 70" stroke="#059669" strokeWidth={2} dot={false} />
          </LineChart>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 7: Monte Carlo Simulation */}
      <PrintPageWrapper pageNumber={7} title="Monte Carlo Simulation" subtitle="Probability analysis based on 500 market scenarios">
        {/* Success Rate */}
        <div className={`${monteCarloData.successRate > 85 ? 'bg-emerald-500' : 'bg-orange-500'} text-white p-6 rounded-lg mb-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] opacity-80">Success Probability</p>
              <p className="text-4xl font-bold">{monteCarloData.successRate.toFixed(1)}%</p>
              <p className="text-[13px] opacity-80 mt-1">of simulations maintain positive portfolio balance</p>
            </div>
            <Activity className="w-16 h-16 opacity-50" />
          </div>
        </div>

        {/* Simulation Chart */}
        <div className="border border-slate-200 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-base text-slate-800 mb-2">Portfolio Outcome Range (30 Years)</h3>
          <ComposedChart width={670} height={240} data={monteCarloData.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" dataKey="p90" name="90th Percentile (Upside)" stroke="#166534" fill={COLORS.midTerm} fillOpacity={0.3} />
            <Area type="monotone" dataKey="p10" name="10th Percentile (Downside)" stroke="#dc2626" fill="white" fillOpacity={1} />
            <Line type="monotone" dataKey="median" name="Median Outcome" stroke={COLORS.longTerm} strokeWidth={3} dot={false} />
          </ComposedChart>
        </div>

        <div className="bg-slate-100 p-4 rounded-lg text-[13px]">
          <p className="text-slate-700">
            <strong>How to interpret:</strong> This simulation runs 500 random market scenarios using historical return patterns.
            The shaded area shows the range between best (90th percentile) and worst (10th percentile) outcomes.
            A success rate above 85% indicates a robust retirement plan.
          </p>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 8: Planning Guidance */}
      <PrintPageWrapper pageNumber={8} title="Planning Guidance" subtitle="Recommendations based on your analysis">
        {(() => {
          const successRate = monteCarloData?.successRate || 0;
          const legacyBalance = legacyAt95;
          const annualSpending = inputs.monthlySpending * 12;
          const legacyToSpendingRatio = annualSpending > 0 ? legacyBalance / annualSpending : 0;
          const isLowSuccess = successRate < 80;
          const isVeryHighLegacy = successRate >= 95 && legacyToSpendingRatio > 20;

          if (isLowSuccess) {
            return (
              <div className="border-l-4 border-yellow-500 bg-yellow-50 p-6 rounded-r-lg">
                <h3 className="font-bold text-base text-yellow-800 mb-4">Consider These Improvements</h3>
                <p className="text-[13px] text-yellow-700 mb-4">
                  Your current success probability is {successRate.toFixed(1)}%, which is below the recommended 80% threshold.
                </p>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-bold text-blue-800">Delay Retirement</h4>
                    <p className="text-[13px] text-slate-600">Working a few more years allows your portfolio to grow while reducing retirement years to fund.</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-bold text-emerald-800">Increase Savings</h4>
                    <p className="text-[13px] text-slate-600">Boosting annual savings will increase your retirement portfolio and improve success rate.</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-bold text-orange-800">Reduce Spending</h4>
                    <p className="text-[13px] text-slate-600">Lowering planned monthly distribution reduces withdrawal rate and extends portfolio longevity.</p>
                  </div>
                </div>
              </div>
            );
          } else if (isVeryHighLegacy) {
            return (
              <div className="border-l-4 border-purple-500 bg-purple-50 p-6 rounded-r-lg">
                <h3 className="font-bold text-base text-purple-800 mb-4">You May Be Leaving Too Large a Legacy</h3>
                <p className="text-[13px] text-purple-700 mb-4">
                  With a {successRate.toFixed(1)}% success rate and projected legacy of ${Math.round(legacyBalance).toLocaleString()},
                  you have more flexibility than you may realize.
                </p>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-bold text-purple-800">Consider Retiring Earlier</h4>
                    <p className="text-[13px] text-slate-600">Your strong financial position may allow you to start retirement sooner.</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <h4 className="font-bold text-purple-800">Increase Retirement Lifestyle</h4>
                    <p className="text-[13px] text-slate-600">You could afford a more comfortable retirement with additional travel, hobbies, or experiences.</p>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="border-l-4 border-emerald-500 bg-emerald-50 p-6 rounded-r-lg">
                <h3 className="font-bold text-base text-emerald-800 mb-4">You're On Track!</h3>
                <p className="text-[13px] text-emerald-700 mb-4">
                  Your retirement plan has a {successRate.toFixed(1)}% probability of success.
                  You're well-positioned for a comfortable retirement.
                </p>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold text-slate-800">Key Metrics Summary</h4>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-[13px]">
                    <div>
                      <p className="text-[12px] text-slate-500">Retirement Portfolio</p>
                      <p className="font-bold text-base">${inputs.totalPortfolio.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500">Monthly Distribution</p>
                      <p className="font-bold text-base">${inputs.monthlySpending.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500">Success Probability</p>
                      <p className="font-bold text-base text-emerald-600">{successRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500">Projected Legacy</p>
                      <p className="font-bold text-base">${Math.round(legacyBalance).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        })()}

        <div className="mt-4 bg-slate-100 p-4 rounded-lg text-[13px] text-slate-600">
          <p><strong>Disclaimer:</strong> All projections are hypothetical and based on the assumptions outlined in this document. Actual results may vary based on market conditions, changes in personal circumstances, and other factors. Please consult with your financial advisor before making any decisions.</p>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 9: Strategy Optimizer */}
      <PrintPageWrapper pageNumber={9} title="Strategy Comparison" subtitle="Alternative allocation strategies analyzed">
        {/* Strategy Comparison Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-1.5 text-left">Strategy</th>
                <th className="p-1.5 text-center">B1</th>
                <th className="p-1.5 text-center">B2</th>
                <th className="p-1.5 text-center">B3</th>
                <th className="p-1.5 text-center">B4</th>
                <th className="p-1.5 text-center">B5</th>
                <th className="p-1.5 text-center whitespace-nowrap">Success Rate</th>
                <th className="p-1.5 text-center whitespace-nowrap">Legacy (Age 95)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const fmtLegacy = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(2)}M` : `$${Math.round(val / 1000)}k`;
                return (
                  <>
              <tr className="border-b bg-emerald-50">
                <td className="p-1.5 font-bold">Current Model</td>
                <td className="p-1.5 text-center">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(0)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(0)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(0)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b4Val / inputs.totalPortfolio) * 100).toFixed(0)}%</td>
                <td className="p-1.5 text-center">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(0)}%</td>
                <td className="p-1.5 text-center font-bold text-emerald-700">{(monteCarloData?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(legacyAt95)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium">4% Model</td>
                <td className="p-1.5 text-center">12.5%</td>
                <td className="p-1.5 text-center">12.5%</td>
                <td className="p-1.5 text-center">22.5%</td>
                <td className="p-1.5 text-center">15%</td>
                <td className="p-1.5 text-center">37.5%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy4?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy4?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium">5.5% Model</td>
                <td className="p-1.5 text-center">17.5%</td>
                <td className="p-1.5 text-center">17.5%</td>
                <td className="p-1.5 text-center">25%</td>
                <td className="p-1.5 text-center">10%</td>
                <td className="p-1.5 text-center">30%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy5?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy5?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium">Balanced 60/40</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center">100%</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy6?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy6?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium">Aggressive Growth</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center">0%</td>
                <td className="p-1.5 text-center">20%</td>
                <td className="p-1.5 text-center">10%</td>
                <td className="p-1.5 text-center">70%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy1?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy1?.medianLegacy || 0)}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium">Barbell Strategy</td>
                <td className="p-1.5 text-center" colSpan="5">3 yrs cash in B1, remainder in B5</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy2?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy2?.medianLegacy || 0)}</td>
              </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Strategy Descriptions */}
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-base text-slate-800 mb-2">Strategy Descriptions</h4>
            <div className="space-y-2 text-slate-600">
              <p><strong>Current Model:</strong> Time-segmented bucket strategy based on spending gap analysis.</p>
              <p><strong>4% Model:</strong> Designed for traditional 4% withdrawal rate with balanced risk.</p>
              <p><strong>5.5% Model:</strong> Higher liquidity allocation for higher withdrawal rates.</p>
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-base text-slate-800 mb-2">Alternative Approaches</h4>
            <div className="space-y-2 text-slate-600">
              <p><strong>Balanced 60/40:</strong> Traditional single-bucket approach without time segmentation.</p>
              <p><strong>Aggressive Growth:</strong> Maximizes long-term growth with 70% in B5, minimal short-term reserves.</p>
              <p><strong>Barbell:</strong> Cash for near-term, maximum equity for long-term growth.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-slate-100 p-3 rounded-lg text-[13px] text-slate-500">
          <p><strong>Note:</strong> Success rates are based on 500-iteration Monte Carlo simulations. Legacy values represent median outcomes. Actual results will vary based on market conditions and personal circumstances.</p>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 10: Disclosures */}
      <PrintPageWrapper pageNumber={10} title="Important Disclosures" subtitle="Assumptions, methodology, and limitations">
        <div className="space-y-3 text-[13px] text-slate-600">
          {/* Return Assumptions */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Return & Interest Rate Assumptions</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1">The projected returns used in this analysis are based on historical averages and forward-looking estimates:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>B1 (Short Term): {assumptions.b1.return}% return, {assumptions.b1.stdDev}% std dev</li>
                  <li>B2 (Mid Term): {assumptions.b2.return}% return, {assumptions.b2.stdDev}% std dev</li>
                  <li>B3 (Balanced): {assumptions.b3.return}% return, {assumptions.b3.stdDev}% std dev</li>
                  <li>B4 (Income & Growth): {assumptions.b4.return}% return, {assumptions.b4.stdDev}% std dev</li>
                  <li>B5 (Long Term): {assumptions.b5.return}% return, {assumptions.b5.stdDev}% std dev</li>
                </ul>
              </div>
              <div>
                <p className="mb-1">These assumptions are estimates and actual results may vary significantly. Past performance does not guarantee future results.</p>
                <p className="mb-1"><strong>Inflation:</strong> {inputs.inflationRate}% annual rate for SS COLA and expense projections.</p>
                <p><strong>Personal Inflation:</strong> {inputs.personalInflationRate}% applied to retirement spending projections.</p>
              </div>
            </div>
          </div>

          {/* Monte Carlo Methodology */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Monte Carlo Simulation Methodology</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1">Success rates are calculated using Monte Carlo simulation:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>500 independent simulation iterations</li>
                  <li>Random returns using normal distribution</li>
                  <li>Returns correlated based on historical relationships</li>
                  <li>Annual rebalancing between buckets</li>
                  <li>30-year projection horizon</li>
                </ul>
              </div>
              <div>
                <p className="mb-1"><strong>Success Definition:</strong> Portfolio maintains positive balance throughout the 30-year projection period.</p>
                <p><strong>Limitations:</strong> Simulations cannot predict actual future returns. They provide a range of possible outcomes based on historical patterns and may not account for extreme market events or changes in tax law.</p>
              </div>
            </div>
          </div>

          {/* Social Security Assumptions */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Social Security & Income Assumptions</h3>
            <p className="mb-1">Social Security benefits adjusted based on claiming age: Before FRA (67): reduced ~6.67%/year. After FRA: increased 8%/year up to age 70. Annual COLA applied based on assumed inflation rate. Pension income assumes continued payment per stated terms with COLA only if indicated.</p>
          </div>

          {/* General Disclaimers */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h3 className="font-bold text-sm text-slate-800 mb-2">General Disclaimers</h3>
            <p className="mb-1">This analysis is for educational and illustrative purposes only and should not be construed as personalized investment advice. Projections are hypothetical and do not represent actual investment results.</p>
            <p className="mb-1">Investment involves risk, including possible loss of principal. No guarantee any strategy will achieve its objectives. Diversification does not ensure profit or protect against loss. Tax considerations are important but not fully addressed here - consult a qualified tax professional.</p>
            <p>Report generated {new Date().toLocaleDateString()}. Regular reviews and updates recommended.</p>
          </div>

          {/* Regulatory Disclosure */}
          <div className="bg-slate-100 rounded-lg p-3 text-[13px]">
            <p>Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial. The opinions voiced in this material are for general information only and are not intended to provide specific advice or recommendations for any individual.</p>
          </div>
        </div>
      </PrintPageWrapper>

      {/* Command Center Client Selector Modal */}
      {showClientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Save to Command Center</h3>
              <button
                onClick={() => setShowClientSelector(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">Select a client to save this portfolio plan:</p>
              {isLoadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-slate-600">Loading clients...</span>
                </div>
              ) : commandCenterClients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No clients found in Command Center.</p>
                  <p className="text-sm text-slate-400 mt-1">Create a client in the Command Center first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {commandCenterClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedCommandCenterClient(client)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedCommandCenterClient?.id === client.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-slate-800">{client.displayName}</div>
                      {client.email && (
                        <div className="text-sm text-slate-500">{client.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowClientSelector(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedCommandCenterClient) {
                    alert('Please select a client first.');
                    return;
                  }
                  const result = await onSaveToCommandCenter(selectedCommandCenterClient.id);
                  if (result.success) {
                    alert(result.message);
                    setShowClientSelector(false);
                    setSelectedCommandCenterClient(null);
                  } else {
                    alert(`Error: ${result.message}`);
                  }
                }}
                disabled={!selectedCommandCenterClient || commandCenterStatus === 'saving'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {commandCenterStatus === 'saving' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Save to Client
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Strategy Override Modal */}
      {showWithdrawalOverrides && projectionData && (
        <WithdrawalOverrideModal
          projectionData={projectionData}
          inputs={inputs}
          onWithdrawalOverrideChange={onWithdrawalOverrideChange}
          onClose={() => setShowWithdrawalOverrides(false)}
        />
      )}
    </div>
  );
};

// Sub-components for tabs
const AllocationTab = ({
  inputs, basePlan, assumptions, projectionData, clientInfo,
  showCashFlowTable, onSetShowCashFlowTable, rebalanceFreq, onSetRebalanceFreq,
  useManualAllocation, manualAllocationMode, manualAllocations, manualPercentages,
  useManualForRebalance, onToggleManualAllocation, onToggleManualForRebalance,
  onManualAllocationChange, onManualAllocationModeChange,
  onRecalculateFromFormula, formulaAllocations,
  onInputChange, onAccountSplitChange, onWithdrawalOverrideChange
}) => {
  const [selectedTaxRow, setSelectedTaxRow] = useState(null);

  // Compute tax detail when a row is selected
  const taxDetail = useMemo(() => {
    if (!selectedTaxRow || !inputs.taxEnabled) return null;
    const row = selectedTaxRow;

    // Use actual percentages from simulation row (supports per-year overrides)
    const tradPctVal = row.traditionalPctUsed ?? inputs.traditionalPercent ?? 60;
    const rothPctVal = row.rothPctUsed ?? inputs.rothPercent ?? 25;
    const nqPctVal = row.nqPctUsed ?? inputs.nqPercent ?? 15;
    const tradPct = tradPctVal / 100;
    const rothPct = rothPctVal / 100;
    const nqPct = nqPctVal / 100;

    const traditionalWithdrawal = row.distribution * tradPct;
    const rothWithdrawal = row.distribution * rothPct;
    const nqWithdrawal = row.distribution * nqPct;

    // NQ breakdown from simulation row
    const nqTaxableGain = row.nqTaxableGain || 0;
    const nqCostBasis = row.nqCostBasis || 0;
    const nqQualifiedDividends = row.nqQualifiedDividends || 0;
    const nqOrdinaryDividends = row.nqOrdinaryDividends || 0;

    const ssIncome = row.ssIncomeDetail || 0;
    const pensionIncome = row.pensionIncomeDetail || 0;
    const vaIncome = row.vaIncomeDetail || 0;
    const otherIncome = row.otherIncomeDetail || 0;
    const employmentIncome = row.employmentIncomeDetail || 0;
    const filingStatus = inputs.filingStatus || 'married';
    const stateRate = inputs.stateRate || 0;

    // Pension + VA treated as ordinary income in tax calc
    const pensionForTax = pensionIncome + vaIncome;

    // Step 1: Taxable SS (NQ ordinary dividends count as ordinary income)
    const ordinaryIncomeBeforeSS = pensionForTax + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;
    const taxableSS = calculateTaxableSS(ssIncome, ordinaryIncomeBeforeSS, filingStatus);

    // Determine SS tier
    const combinedIncome = ordinaryIncomeBeforeSS + (ssIncome * 0.5);
    const thresholds = filingStatus === 'married'
      ? { low: 32000, high: 44000 }
      : { low: 25000, high: 34000 };
    const ssTier = ssIncome <= 0 ? 'N/A' : combinedIncome <= thresholds.low ? '0%' : combinedIncome <= thresholds.high ? '50%' : '85%';

    // Step 2: Gross ordinary income (includes NQ ordinary dividends)
    const grossOrdinaryIncome = taxableSS + pensionForTax + traditionalWithdrawal + nqOrdinaryDividends + otherIncome;

    // Step 3: Standard deduction
    const isSenior = row.age >= 65;
    const baseDeduction = filingStatus === 'married' ? 29200 : 14600;
    const seniorBonusPer = filingStatus === 'married' ? 1550 : 1950;
    const seniorBonus = isSenior ? (filingStatus === 'married' ? seniorBonusPer * 2 : seniorBonusPer) : 0;
    const totalDeduction = baseDeduction + seniorBonus;

    // Step 4: Taxable ordinary income
    const taxableOrdinaryIncome = Math.max(0, grossOrdinaryIncome - totalDeduction);

    // Step 5: Federal tax on ordinary income
    const federalOrdinaryTax = calculateFederalTax(taxableOrdinaryIncome, filingStatus);

    // Marginal bracket
    const brackets = filingStatus === 'married'
      ? [{ max: 23200, rate: 10 }, { max: 94300, rate: 12 }, { max: 201050, rate: 22 }, { max: 383900, rate: 24 }, { max: 487450, rate: 32 }, { max: 731200, rate: 35 }, { max: Infinity, rate: 37 }]
      : [{ max: 11600, rate: 10 }, { max: 47150, rate: 12 }, { max: 100525, rate: 22 }, { max: 191950, rate: 24 }, { max: 243725, rate: 32 }, { max: 609350, rate: 35 }, { max: Infinity, rate: 37 }];
    const marginalBracket = taxableOrdinaryIncome > 0
      ? (brackets.find(b => taxableOrdinaryIncome <= b.max)?.rate || 37)
      : 0;

    // Preferential income: NQ capital gains + NQ qualified dividends
    const totalPreferentialIncome = nqTaxableGain + nqQualifiedDividends;

    // Use calculateAnnualTax for the final numbers (ensures consistency)
    const taxResult = calculateAnnualTax({
      ssIncome,
      pensionIncome: pensionForTax,
      traditionalWithdrawal,
      rothWithdrawal,
      nqTaxableGain,
      nqQualifiedDividends,
      nqOrdinaryDividends,
      otherIncome
    }, { filingStatus, stateRate }, isSenior);

    return {
      ssIncome, pensionIncome, vaIncome, employmentIncome, otherIncome,
      traditionalWithdrawal, rothWithdrawal,
      traditionalPercent: tradPctVal,
      rothPercent: rothPctVal,
      nqPercent: nqPctVal,
      nqWithdrawal, nqCostBasis, nqTaxableGain, nqQualifiedDividends, nqOrdinaryDividends,
      totalPreferentialIncome,
      taxableSS, ssTier,
      grossOrdinaryIncome, baseDeduction, seniorBonus, totalDeduction, isSenior,
      taxableOrdinaryIncome, federalOrdinaryTax: Math.round(federalOrdinaryTax),
      marginalBracket,
      qdivTax: taxResult.qdivTax,
      totalFederalTax: taxResult.federalTax,
      stateTax: taxResult.stateTax,
      totalTax: taxResult.totalTax,
      effectiveRate: taxResult.effectiveRate,
      filingStatus, stateRate
    };
  }, [selectedTaxRow, inputs]);

  return (
  <div className="mt-6 animate-in fade-in duration-300">
    <div className="flex justify-between items-start mb-4 hidden print:flex">
      <h2 className="text-2xl font-bold text-slate-900">Phase 2: Distribution Allocation</h2>
      <img src={LOGO_URL} alt="Logo" className="h-12" />
    </div>
    {/* Manual Allocation Toggle */}
    <Card className="p-4 mb-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useManualAllocation}
              onChange={(e) => onToggleManualAllocation(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="font-medium text-slate-700">Manual Allocation Override</span>
          </label>
          {useManualAllocation && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
              Custom Mode
            </span>
          )}
        </div>
        {useManualAllocation && (
          <button
            onClick={onRecalculateFromFormula}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Recalculate from Formula
          </button>
        )}
      </div>

      {useManualAllocation && (
        <div className="mt-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Input Mode:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => onManualAllocationModeChange('dollar')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  manualAllocationMode === 'dollar'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Dollar $
              </button>
              <button
                onClick={() => onManualAllocationModeChange('percentage')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  manualAllocationMode === 'percentage'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Percentage %
              </button>
            </div>

            {/* Rebalance Toggle */}
            <label className="flex items-center gap-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={useManualForRebalance}
                onChange={(e) => onToggleManualForRebalance(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-600">Use for Rebalancing</span>
              {useManualForRebalance && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Active
                </span>
              )}
            </label>
          </div>

          {/* Allocation Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { key: 'b1', label: 'B1 Short Term', color: COLORS.shortTerm },
              { key: 'b2', label: 'B2 Mid Term', color: COLORS.midTerm },
              { key: 'b3', label: 'B3 Balanced', color: COLORS.hedged },
              { key: 'b4', label: 'B4 Inc & Gro', color: COLORS.income },
              { key: 'b5', label: 'B5 Long Term', color: COLORS.longTerm },
            ].map(({ key, label, color }) => (
              <div key={key} className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }}></span>
                  {label}
                </label>
                <div className="relative">
                  {manualAllocationMode === 'dollar' && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  )}
                  {manualAllocationMode === 'percentage' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  )}
                  <input
                    type="number"
                    step={manualAllocationMode === 'percentage' ? '0.1' : '1000'}
                    value={manualAllocationMode === 'percentage'
                      ? Number((manualPercentages[key] || 0).toFixed(1))
                      : Math.round(manualAllocations[key])}
                    onChange={(e) => onManualAllocationChange(key, parseFloat(e.target.value) || 0, manualAllocationMode)}
                    className={`w-full py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      manualAllocationMode === 'dollar' ? 'pl-5 pr-2' : 'pl-2 pr-6'
                    }`}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {manualAllocationMode === 'percentage'
                    ? `$${Math.round(manualAllocations[key]).toLocaleString()}`
                    : `${((manualAllocations[key] / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}%`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {useManualAllocation && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Total: <span className="font-bold">${(manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5).toLocaleString()}</span>
            <span className="text-slate-400 ml-2">
              ({(((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}%)
            </span>
          </span>
          <span className={`font-medium ${Math.abs((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio) < 1 ? 'text-green-600' : 'text-amber-600'}`}>
            {Math.abs((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio) < 1
              ? '✓ Matches portfolio'
              : `Difference: $${((manualAllocations.b1 + manualAllocations.b2 + manualAllocations.b3 + manualAllocations.b4 + manualAllocations.b5) - inputs.totalPortfolio).toLocaleString()}`}
          </span>
        </div>
      )}
    </Card>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="p-6 flex flex-col justify-center">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Target Allocation {useManualAllocation && <span className="text-xs font-normal text-amber-600">(Manual)</span>}</h3>
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
            <label className="text-[12px] font-bold text-slate-500 uppercase block mb-1">Rebalance Frequency</label>
            <select
              value={rebalanceFreq}
              onChange={(e) => onSetRebalanceFreq(parseInt(e.target.value))}
              className="bg-white border text-xs font-bold rounded px-2 py-1 w-full"
            >
              <option value={0}>Sequential (No Rebalance)</option>
              <option value={1}>Annual Rebalance</option>
              <option value={3}>Every 3 Years</option>
              <option value={6}>Every 6 Years</option>
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
                    return `$${Math.round(val).toLocaleString()}`;
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
                <th className="p-2 text-blue-600">Income</th>
                <th className="p-2 text-orange-600">Withdrawal</th>
                {inputs.taxEnabled && <th className="p-2 text-red-600">Est. Tax</th>}
                <th className="p-2 text-slate-800">{inputs.taxEnabled ? 'Gross Spend' : 'Total Spend'}</th>
                {inputs.taxEnabled && <th className="p-2 text-slate-600">Net Spend</th>}
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
                  <td className="p-2 text-blue-600" title={`SS: $${(row.ssIncomeDetail || 0).toLocaleString()} | Pension: $${(row.pensionIncomeDetail || 0).toLocaleString()}${row.employmentIncomeDetail ? ` | Employment: $${row.employmentIncomeDetail.toLocaleString()}` : ''}${row.otherIncomeDetail ? ` | Other: $${row.otherIncomeDetail.toLocaleString()}` : ''}`}>
                    +${row.ssIncome.toLocaleString()}
                    {row.employmentIncomeDetail > 0 && <span className="text-teal-600 text-[10px] ml-0.5" title="Includes employment income">*</span>}
                  </td>
                  <td className="p-2 text-orange-600">-${row.distribution.toLocaleString()}</td>
                  {inputs.taxEnabled && (
                    <td
                      className="p-2 text-red-600 cursor-pointer hover:bg-red-50 hover:underline transition-colors"
                      title={`Federal: $${(row.federalTax || 0).toLocaleString()} | State: $${(row.stateTax || 0).toLocaleString()} | Eff: ${row.effectiveRate || '0'}% — Click for detail`}
                      onClick={() => setSelectedTaxRow(row)}
                    >
                      -${(row.totalTax || 0).toLocaleString()}
                    </td>
                  )}
                  <td className="p-2 font-medium text-slate-800">${row.expenses.toLocaleString()}</td>
                  {inputs.taxEnabled && (
                    <td className="p-2 text-slate-600">${Math.max(0, row.expenses - (row.totalTax || 0)).toLocaleString()}</td>
                  )}
                  <td className={`p-2 font-bold ${row.total > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {inputs.taxEnabled && (
            <div className="mt-3 p-2 bg-amber-50 text-xs text-amber-800 rounded border border-amber-100">
              <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} status, {inputs.traditionalPercent}% Trad / {inputs.rothPercent}% Roth / {inputs.nqPercent}% NQ, {inputs.stateRate}% state rate.{Object.keys(inputs.withdrawalOverrides || {}).length > 0 ? ` ${Object.keys(inputs.withdrawalOverrides).length} custom year override(s) applied.` : ''} Hover over tax amounts for breakdown. Click for detail.
            </div>
          )}
        </div>
      )}
    </Card>

    {/* Tax Detail Modal */}
    {selectedTaxRow && taxDetail && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTaxRow(null)}>
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
            <h3 className="font-bold text-lg text-slate-800">Tax Estimate Detail — Age {selectedTaxRow.age}</h3>
            <button onClick={() => setSelectedTaxRow(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <div className="p-4 space-y-4 text-sm">
            {/* Income Sources */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Income Sources</h4>
              <table className="w-full text-sm">
                <tbody>
                  {taxDetail.ssIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Social Security</td><td className="py-1 text-right font-medium">${taxDetail.ssIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.pensionIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Pension</td><td className="py-1 text-right font-medium">${taxDetail.pensionIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.vaIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">VA Income</td><td className="py-1 text-right font-medium">${taxDetail.vaIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.employmentIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Employment</td><td className="py-1 text-right font-medium">${taxDetail.employmentIncome.toLocaleString()}</td></tr>
                  )}
                  {taxDetail.otherIncome > 0 && (
                    <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Other Income</td><td className="py-1 text-right font-medium">${taxDetail.otherIncome.toLocaleString()}</td></tr>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">Portfolio Withdrawal</td>
                    <td className="py-1 text-right font-medium">${selectedTaxRow.distribution.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 pl-4 text-slate-500 text-xs">Traditional ({taxDetail.traditionalPercent}%)</td>
                    <td className="py-1 text-right text-xs">${Math.round(taxDetail.traditionalWithdrawal).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 pl-4 text-slate-500 text-xs">Roth ({taxDetail.rothPercent}%) — tax-free</td>
                    <td className="py-1 text-right text-xs text-emerald-600">${Math.round(taxDetail.rothWithdrawal).toLocaleString()}</td>
                  </tr>
                  {taxDetail.nqPercent > 0 && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-4 text-slate-500 text-xs">NQ ({taxDetail.nqPercent}%)</td>
                        <td className="py-1 text-right text-xs">${Math.round(taxDetail.nqWithdrawal).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Cost Basis (tax-free)</td>
                        <td className="py-1 text-right text-[11px] text-emerald-600">${Math.round(taxDetail.nqCostBasis).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Capital Gain (LTCG)</td>
                        <td className="py-1 text-right text-[11px] text-red-500">${Math.round(taxDetail.nqTaxableGain).toLocaleString()}</td>
                      </tr>
                    </>
                  )}
                  {(taxDetail.nqQualifiedDividends > 0 || taxDetail.nqOrdinaryDividends > 0) && (
                    <>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">NQ Dividends (annual)</td>
                        <td className="py-1 text-right font-medium">${(taxDetail.nqQualifiedDividends + taxDetail.nqOrdinaryDividends).toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Qualified (LTCG rates)</td>
                        <td className="py-1 text-right text-[11px]">${taxDetail.nqQualifiedDividends.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Ordinary (marginal rate)</td>
                        <td className="py-1 text-right text-[11px]">${taxDetail.nqOrdinaryDividends.toLocaleString()}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tax Calculation Steps */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Tax Calculation</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">1. Taxable Social Security</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.taxableSS).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400 w-20">{taxDetail.ssTier} tier</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">2. Gross Ordinary Income</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.grossOrdinaryIncome).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">3. Standard Deduction</td>
                    <td className="py-1 text-right font-medium text-emerald-600">-${taxDetail.totalDeduction.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">{taxDetail.isSenior ? `+$${taxDetail.seniorBonus.toLocaleString()} senior` : ''}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">4. Taxable Ordinary Income</td>
                    <td className="py-1 text-right font-medium">${Math.round(taxDetail.taxableOrdinaryIncome).toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">5. Federal Tax (ordinary)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.federalOrdinaryTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">{taxDetail.marginalBracket}% bracket</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">6. Preferential Tax (LTCG/QDiv)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.qdivTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400">pref. rate</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">7. Total Federal Tax</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.totalFederalTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1 text-slate-600">8. State Tax ({taxDetail.stateRate}%)</td>
                    <td className="py-1 text-right font-medium text-red-600">${taxDetail.stateTax.toLocaleString()}</td>
                    <td className="py-1 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="py-1.5 font-bold text-slate-800">9. Total Estimated Tax</td>
                    <td className="py-1.5 text-right font-bold text-red-700">${taxDetail.totalTax.toLocaleString()}</td>
                    <td className="py-1.5 pl-2 text-xs text-slate-400"></td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-1.5 font-bold text-slate-800">10. Effective Rate</td>
                    <td className="py-1.5 text-right font-bold text-red-700">{taxDetail.effectiveRate}%</td>
                    <td className="py-1.5 pl-2 text-xs text-slate-400"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Assumptions footnote */}
            <div className="p-2 bg-slate-50 text-xs text-slate-500 rounded border border-slate-100">
              <strong>Assumptions:</strong> {taxDetail.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} filing status, {taxDetail.traditionalPercent}% Traditional / {taxDetail.rothPercent}% Roth / {taxDetail.nqPercent}% NQ, {taxDetail.stateRate}% state tax rate{taxDetail.isSenior ? ', 65+ senior deduction applied' : ''}.
            </div>
          </div>
        </div>
      </div>
    )}

  </div>
  );
};

const WithdrawalOverrideModal = ({ projectionData, inputs, onWithdrawalOverrideChange, onClose }) => {
  const [rangeFrom, setRangeFrom] = useState(projectionData[0]?.age || 65);
  const [rangeTo, setRangeTo] = useState(projectionData[Math.min(7, projectionData.length - 1)]?.age || 72);
  const [rangeTrad, setRangeTrad] = useState(inputs.traditionalPercent);
  const [rangeRoth, setRangeRoth] = useState(inputs.rothPercent);
  const [rangeNq, setRangeNq] = useState(inputs.nqPercent);

  const handleOverrideEdit = (age, field, newValue) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
    const override = inputs.withdrawalOverrides?.[age] || {
      traditionalPercent: inputs.traditionalPercent,
      rothPercent: inputs.rothPercent,
      nqPercent: inputs.nqPercent
    };
    const fields = ['traditionalPercent', 'rothPercent', 'nqPercent'];
    const otherFields = fields.filter(f => f !== field);
    const remainder = 100 - clamped;
    const otherSum = override[otherFields[0]] + override[otherFields[1]];
    let val1, val2;
    if (otherSum === 0) {
      val1 = Math.round(remainder / 2);
      val2 = remainder - val1;
    } else {
      val1 = Math.round((override[otherFields[0]] / otherSum) * remainder);
      val2 = remainder - val1;
    }
    onWithdrawalOverrideChange(age, { ...override, [field]: clamped, [otherFields[0]]: val1, [otherFields[1]]: val2 });
  };

  const applyRange = () => {
    if (rangeTrad + rangeRoth + rangeNq !== 100) return;
    for (let age = rangeFrom; age <= rangeTo; age++) {
      const row = projectionData.find(r => r.age === age);
      if (row) {
        onWithdrawalOverrideChange(age, { traditionalPercent: rangeTrad, rothPercent: rangeRoth, nqPercent: rangeNq });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="font-bold text-lg text-slate-800">Withdrawal Strategy by Year</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onWithdrawalOverrideChange('__reset_all__')}
              className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors"
            >
              Reset All
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* Range Applier */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">From Age</label>
              <input type="number" value={rangeFrom} onChange={e => setRangeFrom(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">To Age</label>
              <input type="number" value={rangeTo} onChange={e => setRangeTo(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">Trad %</label>
              <input type="number" value={rangeTrad} onChange={e => setRangeTrad(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">Roth %</label>
              <input type="number" value={rangeRoth} onChange={e => setRangeRoth(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase block">NQ %</label>
              <input type="number" value={rangeNq} onChange={e => setRangeNq(parseInt(e.target.value) || 0)} min="0" max="100" className="w-14 px-1.5 py-1 border rounded text-xs" />
            </div>
            <button
              onClick={applyRange}
              disabled={rangeTrad + rangeRoth + rangeNq !== 100}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rangeTrad + rangeRoth + rangeNq === 100
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Apply Range
            </button>
            <span className={`text-[10px] font-medium ${rangeTrad + rangeRoth + rangeNq === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
              Sum: {rangeTrad + rangeRoth + rangeNq}%
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                <th className="p-2">Est. Income</th>
                <th className="p-2">Eff. Rate</th>
                <th className="p-2">Est. Tax</th>
                <th className="p-2">Trad %</th>
                <th className="p-2">Roth %</th>
                <th className="p-2">NQ %</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map(row => {
                const override = inputs.withdrawalOverrides?.[row.age];
                const tradPct = override?.traditionalPercent ?? inputs.traditionalPercent;
                const rothPct = override?.rothPercent ?? inputs.rothPercent;
                const nqPct = override?.nqPercent ?? inputs.nqPercent;
                const isOverridden = !!override;

                return (
                  <tr key={row.age} className={`border-b border-slate-50 transition-colors ${isOverridden ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                    <td className="p-2 text-blue-600">${row.ssIncome.toLocaleString()}</td>
                    <td className="p-2 text-slate-600">{row.effectiveRate || '0.0'}%</td>
                    <td className="p-2 text-red-600">${(row.totalTax || 0).toLocaleString()}</td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={tradPct}
                        onChange={e => handleOverrideEdit(row.age, 'traditionalPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={rothPct}
                        onChange={e => handleOverrideEdit(row.age, 'rothPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min="0" max="100" step="5"
                        value={nqPct}
                        onChange={e => handleOverrideEdit(row.age, 'nqPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 border rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      {isOverridden && (
                        <button
                          onClick={() => onWithdrawalOverrideChange(row.age, null)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Reset to default"
                        >
                          <RefreshCcw className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MonteCarloTab = ({ monteCarloData, rebalanceFreq, vaEnabled, vaInputs, onToggleVa, onVaInputChange, vaMonteCarloData, inputs, basePlan, vaAdjustedBasePlan }) => {
  // Calculate VA allocation amount for display
  const vaAllocationAmount = vaInputs && vaEnabled
    ? (vaInputs.allocationType === 'percentage'
        ? inputs.totalPortfolio * (vaInputs.allocationPercent / 100)
        : Math.min(vaInputs.allocationFixed, inputs.totalPortfolio))
    : 0;

  const annualGuaranteedIncome = vaEnabled && vaInputs
    ? vaAllocationAmount * (vaInputs.withdrawalRate / 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      {/* VA GIB Override Section */}
      <Card className="p-4 print:hidden border-l-4 border-purple-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vaEnabled}
                onChange={(e) => onToggleVa(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="font-medium text-slate-700">VA GIB Override</span>
            </label>
            {vaEnabled && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                VA GIB Active
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            <Shield className="w-4 h-4 inline mr-1" />
            Variable Annuity with Guaranteed Income Benefit
          </div>
        </div>

        {vaEnabled && (
          <div className="mt-4 space-y-4">
            {/* Allocation Type Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">Allocation Type:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => onVaInputChange('allocationType', 'percentage')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'percentage'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Percentage
                </button>
                <button
                  onClick={() => onVaInputChange('allocationType', 'fixed')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'fixed'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Fixed $
                </button>
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {/* Allocation Input */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {vaInputs.allocationType === 'percentage' ? 'Allocation %' : 'Allocation $'}
                </label>
                <div className="relative">
                  {vaInputs.allocationType === 'fixed' && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  )}
                  {vaInputs.allocationType === 'percentage' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  )}
                  <input
                    type="number"
                    value={Number(vaInputs.allocationType === 'percentage' ? vaInputs.allocationPercent : vaInputs.allocationFixed)}
                    onChange={(e) => onVaInputChange(
                      vaInputs.allocationType === 'percentage' ? 'allocationPercent' : 'allocationFixed',
                      parseFloat(e.target.value) || 0
                    )}
                    className={`w-full py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      vaInputs.allocationType === 'percentage' ? 'pl-2 pr-6' : 'pl-6 pr-2'
                    }`}
                    min="0"
                    max={vaInputs.allocationType === 'percentage' ? 100 : inputs.totalPortfolio}
                  />
                </div>
              </div>

              {/* Income Start Age */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Income Start Age
                </label>
                <input
                  type="number"
                  value={vaInputs.incomeStartAge || 65}
                  onChange={(e) => onVaInputChange('incomeStartAge', parseInt(e.target.value) || 65)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  min="55"
                  max="85"
                />
                <div className="text-xs text-slate-400 mt-0.5">When income begins</div>
              </div>

              {/* Withdrawal Rate */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Withdrawal Rate
                </label>
                <div className="relative">
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  <input
                    type="number"
                    step="0.1"
                    value={Number(vaInputs.withdrawalRate)}
                    onChange={(e) => onVaInputChange('withdrawalRate', parseFloat(e.target.value) || 0)}
                    onBlur={(e) => {
                      // Clean up any leading zeros on blur
                      const val = parseFloat(e.target.value) || 0;
                      if (val !== vaInputs.withdrawalRate) {
                        onVaInputChange('withdrawalRate', val);
                      }
                    }}
                    className="w-full pl-2 pr-6 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    min="0"
                    max="10"
                  />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Typically 5-7%</div>
              </div>

              {/* High Water Mark */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  High Water Mark
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={vaInputs.highWaterMark}
                    onChange={(e) => onVaInputChange('highWaterMark', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-600">Step-up benefit</span>
                </label>
              </div>

              {/* Summary */}
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-xs font-medium text-purple-700 mb-1">VA Summary</div>
                <div className="text-sm">
                  <div><strong>${vaAllocationAmount.toLocaleString()}</strong> allocated to VA</div>
                  <div className="text-purple-700"><strong>${Math.round(annualGuaranteedIncome).toLocaleString()}</strong>/yr @ age {vaInputs.incomeStartAge || 65}</div>
                </div>
              </div>
            </div>

            {/* Adjusted Bucket Allocations */}
            {vaAdjustedBasePlan && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-medium text-slate-700 mb-2">Adjusted Bucket Allocations (with VA income)</div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-500">B1</div>
                    <div className="font-bold">${(vaAdjustedBasePlan.b1Val / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">B2</div>
                    <div className="font-bold">${(vaAdjustedBasePlan.b2Val / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">B3</div>
                    <div className="font-bold">${(vaAdjustedBasePlan.b3Val / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">B4</div>
                    <div className="font-bold">${(vaAdjustedBasePlan.b4Val / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">B5</div>
                    <div className="font-bold">${(vaAdjustedBasePlan.b5Val / 1000).toFixed(0)}k</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Bucket total: ${((vaAdjustedBasePlan.b1Val + vaAdjustedBasePlan.b2Val + vaAdjustedBasePlan.b3Val + vaAdjustedBasePlan.b4Val + vaAdjustedBasePlan.b5Val) / 1000).toFixed(0)}k + VA: ${(vaAllocationAmount / 1000).toFixed(0)}k = ${(inputs.totalPortfolio / 1000).toFixed(0)}k
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Success Rate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox
          label={vaEnabled ? "Success Rate (Without VA)" : "Success Rate"}
          value={`${monteCarloData.successRate.toFixed(1)}%`}
          subtext="Iterations ending > $0"
          icon={Activity}
          colorClass={monteCarloData.successRate > 85 ? "bg-emerald-500" : "bg-orange-500"}
        />
        {vaEnabled && vaMonteCarloData && (
          <StatBox
            label="Success Rate (With VA GIB)"
            value={`${vaMonteCarloData.successRate.toFixed(1)}%`}
            subtext="With guaranteed income"
            icon={Shield}
            colorClass={vaMonteCarloData.successRate > 85 ? "bg-purple-500" : "bg-orange-500"}
          />
        )}
        <div className={`${vaEnabled ? '' : 'md:col-span-2'} bg-indigo-50 p-4 rounded-lg text-sm text-indigo-900 flex items-center`}>
          <p>
            <strong>Simulation Logic:</strong> 500 iterations using Gaussian distribution.
            Strategy: <strong>{rebalanceFreq === 0 ? 'Sequential Depletion' : `Bucket Refill Every ${rebalanceFreq} Years`}</strong>.
          </p>
        </div>
      </div>

      {/* Side-by-Side Charts when VA enabled */}
      {vaEnabled && vaMonteCarloData ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Without VA */}
            <Card className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-4">Without VA</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monteCarloData.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="p90" name="90th %" stroke="#166534" strokeWidth={2} fill={COLORS.midTerm} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="p10" name="10th %" stroke="#dc2626" strokeWidth={2} fill="white" fillOpacity={1} />
                    <Line type="monotone" dataKey="median" name="Median" stroke={COLORS.longTerm} strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-around text-center">
                <div>
                  <span className={`text-2xl font-bold ${monteCarloData.successRate > 85 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {monteCarloData.successRate.toFixed(1)}%
                  </span>
                  <div className="text-slate-500 text-sm">Success Rate</div>
                </div>
                <div>
                  <span className="text-2xl font-bold text-slate-700">
                    ${(monteCarloData.medianLegacy || 0).toLocaleString()}
                  </span>
                  <div className="text-slate-500 text-sm">Median Legacy</div>
                </div>
              </div>
            </Card>

            {/* With VA GIB */}
            <Card className="p-6 border-2 border-purple-200">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" /> With VA GIB
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={vaMonteCarloData.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="p90" name="90th %" stroke="#7c3aed" strokeWidth={2} fill="#a78bfa" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="p10" name="10th %" stroke="#dc2626" strokeWidth={2} fill="white" fillOpacity={1} />
                    <Line type="monotone" dataKey="median" name="Median" stroke="#000000" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-around text-center">
                <div>
                  <span className={`text-2xl font-bold ${vaMonteCarloData.successRate > 85 ? 'text-purple-600' : 'text-orange-600'}`}>
                    {vaMonteCarloData.successRate.toFixed(1)}%
                  </span>
                  <div className="text-slate-500 text-sm">Success Rate</div>
                </div>
                <div>
                  <span className="text-2xl font-bold text-purple-700">
                    ${(vaMonteCarloData.medianLegacy || 0).toLocaleString()}
                  </span>
                  <div className="text-slate-500 text-sm">Median Legacy</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Impact Summary */}
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" /> VA GIB Impact Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">Success Rate Change</div>
                <div className={`text-2xl font-bold ${vaMonteCarloData.successRate - monteCarloData.successRate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {vaMonteCarloData.successRate - monteCarloData.successRate >= 0 ? '+' : ''}
                  {(vaMonteCarloData.successRate - monteCarloData.successRate).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">Legacy Change</div>
                <div className={`text-2xl font-bold ${(vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0) >= 0 ? '+' : ''}
                  ${Math.round((vaMonteCarloData.medianLegacy || 0) - (monteCarloData.medianLegacy || 0)).toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">VA Allocation</div>
                <div className="text-2xl font-bold text-purple-600">
                  ${vaAllocationAmount.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">Annual Guaranteed</div>
                <div className="text-2xl font-bold text-purple-600">
                  ${Math.round(annualGuaranteedIncome).toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">Monthly Guaranteed</div>
                <div className="text-2xl font-bold text-purple-600">
                  ${Math.round(annualGuaranteedIncome / 12).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white/50 rounded-lg text-sm text-slate-600">
              <strong>Note:</strong> VA GIB provides guaranteed lifetime income regardless of market performance.
              The benefit base {vaInputs.highWaterMark ? 'steps up on market gains (high water mark)' : 'remains fixed'}.
              Withdrawal rate of {vaInputs.withdrawalRate}% is applied to the benefit base.
              VA incurs approximately 1.5% annual fees and grows with B5 (long-term) returns.
            </div>
          </Card>
        </>
      ) : (
        /* Standard single chart when VA not enabled */
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
      )}
    </div>
  );
};

const SSOptimizationTab = ({ clientInfo, inputs, ssAnalysis, ssPartnerAnalysis, targetMaxPortfolioAge, onSetTargetMaxPortfolioAge, onUpdateSSStartAge, onUpdatePartnerSSStartAge }) => (
  <div className="space-y-6 animate-in fade-in duration-300 mt-6">
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg text-slate-800">Optimization Analysis</h3>
          <p className="text-sm text-slate-500">Determine the optimal claiming strategy based on portfolio impact.</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <label className="block text-[12px] font-bold text-yellow-800 uppercase mb-1">
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
              <p className="text-[12px] text-slate-400">Projected Portfolio @ Age {targetMaxPortfolioAge}</p>
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
                <p className="text-[12px] text-slate-400">Projected Portfolio @ Age {targetMaxPortfolioAge}</p>
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
  const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
  const legacyBalance = legacyEntry?.total || 0;
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
              <strong>To make changes:</strong> Use the Inputs page to adjust your
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
            of <strong>${Math.round(legacyBalance).toLocaleString()}</strong> - that's over {legacyToSpendingRatio.toFixed(0)}x your annual spending!
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
              <strong>To make changes:</strong> Use the Inputs page to adjust your
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
        <Card className="p-6 print:break-before-page">
          <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-emerald-600" /> Bucket Strategy Details
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

const OptimizerTab = ({ optimizerData, inputs, basePlan, monteCarloData, projectionData, optimizerRebalanceFreq, onSetOptimizerRebalanceFreq, clientInfo, assumptions, vaEnabled, vaInputs, vaOptimizerData }) => {
  const [selectedIPSStrategy, setSelectedIPSStrategy] = useState(null);
  const [selectedIPSRebalanceFreq, setSelectedIPSRebalanceFreq] = useState(optimizerRebalanceFreq);
  const [showVaResults, setShowVaResults] = useState(false);

  // Use VA optimizer data when VA is enabled and toggle is on
  const activeOptimizerData = (vaEnabled && showVaResults && vaOptimizerData) ? vaOptimizerData : optimizerData;

  // Safety check - if optimizerData isn't ready yet, show loading
  if (!optimizerData || !optimizerData.strategy1 || !optimizerData.strategy2 || !optimizerData.strategy3) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-slate-600">Calculating optimization strategies...</span>
      </div>
    );
  }

  // Distribution strategy options
  const distributionStrategies = [
    { value: 0, label: 'Sequential Distribution', description: 'Withdraw from buckets in order (B1→B2→B3→B4→B5) without rebalancing' },
    { value: 1, label: 'Annual Rebalance', description: 'Rebalance to target allocations every year' },
    { value: 3, label: 'Rebalance Every 3 Years', description: 'Rebalance to target allocations every 3 years' },
    { value: 6, label: 'Rebalance Every 6 Years', description: 'Rebalance to target allocations every 6 years' }
  ];

  // Helper to format allocation as percentages
  const getAllocationPercentages = (allocationData) => {
    const total = inputs.totalPortfolio;
    if (total === 0 || !allocationData) return { b1: '0', b2: '0', b3: '0', b4: '0', b5: '0' };
    return {
      b1: (((allocationData.b1Val || 0) / total) * 100).toFixed(0),
      b2: (((allocationData.b2Val || 0) / total) * 100).toFixed(0),
      b3: (((allocationData.b3Val || 0) / total) * 100).toFixed(0),
      b4: (((allocationData.b4Val || 0) / total) * 100).toFixed(0),
      b5: (((allocationData.b5Val || 0) / total) * 100).toFixed(0),
    };
  };

  // Build strategies array - runOptimizedSimulation returns { successRate, medianLegacy, allocation }
  const strategies = [
    {
      key: 'strategy3',
      name: 'Current Model',
      successRate: activeOptimizerData?.strategy3?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy3?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy3?.allocation || {},
      isCurrent: true
    },
    {
      key: 'strategy4',
      name: '4% Model',
      successRate: activeOptimizerData?.strategy4?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy4?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy4?.allocation || {}
    },
    {
      key: 'strategy5',
      name: '5.5% Model',
      successRate: activeOptimizerData?.strategy5?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy5?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy5?.allocation || {}
    },
    {
      key: 'strategy6',
      name: 'Balanced 60/40',
      successRate: activeOptimizerData?.strategy6?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy6?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy6?.allocation || {}
    },
    {
      key: 'strategy1',
      name: 'Aggressive Growth',
      successRate: activeOptimizerData?.strategy1?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy1?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy1?.allocation || {}
    },
    {
      key: 'strategy2',
      name: 'Barbell Strategy',
      successRate: activeOptimizerData?.strategy2?.successRate || 0,
      medianLegacy: activeOptimizerData?.strategy2?.medianLegacy || 0,
      allocation: activeOptimizerData?.strategy2?.allocation || {}
    },
  ];

  // Find "Safest" - highest success rate
  const sortedBySuccessRate = [...strategies].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
  const safestStrategy = sortedBySuccessRate[0];

  // Find "Best" - largest legacy among strategies with similar success rate (within 5% of safest)
  const similarSuccessThreshold = (safestStrategy.successRate || 0) - 5;
  const strategiesWithSimilarSuccess = strategies.filter(s => (s.successRate || 0) >= similarSuccessThreshold);
  const sortedByLegacy = [...strategiesWithSimilarSuccess].sort((a, b) => (b.medianLegacy || 0) - (a.medianLegacy || 0));
  const bestStrategy = sortedByLegacy[0];

  const StrategyCard = ({ strategy, isBest, isSafest, isSelected, onSelect }) => {
    const pct = getAllocationPercentages(strategy.allocation);
    const successRate = strategy.successRate || 0;
    const legacy = strategy.medianLegacy || 0;
    const hasHighlight = isBest || isSafest;

    return (
      <Card
        className={`p-5 cursor-pointer transition-all ${
          isSelected
            ? 'ring-2 ring-indigo-500 bg-indigo-50'
            : hasHighlight
              ? 'ring-2 ' + (isBest ? 'ring-emerald-500 bg-emerald-50' : 'ring-blue-500 bg-blue-50')
              : 'hover:shadow-md'
        }`}
        onClick={() => onSelect(strategy)}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              {strategy.name}
              {isBest && <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded">Best</span>}
              {isSafest && !isBest && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">Safest</span>}
              {isSelected && <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded">Selected for IPS</span>}
            </h4>
            {strategy.isCurrent && <span className="text-xs text-slate-500">Your current allocation</span>}
          </div>
        </div>

        {/* Success Rate */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-slate-600">Success Rate</span>
            <span className={`font-bold text-lg ${successRate >= 85 ? 'text-emerald-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
              {successRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${successRate >= 85 ? 'bg-emerald-500' : successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, successRate)}%` }}
            />
          </div>
        </div>

        {/* Projected Legacy */}
        <div className="mb-4 p-3 bg-slate-100 rounded-lg">
          <p className="text-xs text-slate-500">Projected Legacy (Age 95)</p>
          <p className="font-bold text-lg text-slate-800">${Math.round(legacy).toLocaleString()}</p>
        </div>

        {/* Allocation Breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Allocation</p>
          <div className="flex gap-1 h-4 rounded overflow-hidden">
            {pct.b1 > 0 && <div style={{ width: `${pct.b1}%`, backgroundColor: COLORS.shortTerm }} title={`B1: ${pct.b1}%`} />}
            {pct.b2 > 0 && <div style={{ width: `${pct.b2}%`, backgroundColor: COLORS.midTerm }} title={`B2: ${pct.b2}%`} />}
            {pct.b3 > 0 && <div style={{ width: `${pct.b3}%`, backgroundColor: COLORS.hedged }} title={`B3: ${pct.b3}%`} />}
            {pct.b4 > 0 && <div style={{ width: `${pct.b4}%`, backgroundColor: COLORS.income }} title={`B4: ${pct.b4}%`} />}
            {pct.b5 > 0 && <div style={{ width: `${pct.b5}%`, backgroundColor: COLORS.longTerm }} title={`B5: ${pct.b5}%`} />}
          </div>
          <div className="grid grid-cols-5 gap-1 text-[12px] text-center">
            <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.shortTerm }}></span>B1: {pct.b1}%</div>
            <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.midTerm }}></span>B2: {pct.b2}%</div>
            <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.hedged }}></span>B3: {pct.b3}%</div>
            <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.income }}></span>B4: {pct.b4}%</div>
            <div><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS.longTerm }}></span>B5: {pct.b5}%</div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      {/* Distribution Strategy Selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-slate-600" />
            <span className="font-medium text-slate-700">Distribution Strategy:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {distributionStrategies.map((strategy) => (
              <button
                key={strategy.value}
                onClick={() => onSetOptimizerRebalanceFreq(strategy.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  optimizerRebalanceFreq === strategy.value
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={strategy.description}
              >
                {strategy.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {distributionStrategies.find(s => s.value === optimizerRebalanceFreq)?.description}
        </p>
      </Card>

      {/* Strategy Comparison Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
          <Target className="w-6 h-6 text-emerald-600" /> Allocation Strategy Comparison
        </h3>
        <p className="text-slate-600 mt-1">Compare different bucket allocation strategies based on Monte Carlo simulations</p>
      </div>

      {/* VA Toggle */}
      {vaEnabled && vaOptimizerData && (
        <Card className="p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVaResults}
                  onChange={(e) => setShowVaResults(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-slate-700">Show with VA GIB</span>
              </label>
              {showVaResults && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                  VA Applied
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500">
              <Shield className="w-4 h-4 inline mr-1" />
              {vaInputs.allocationType === 'percentage' ? `${vaInputs.allocationPercent}%` : `$${vaInputs.allocationFixed.toLocaleString()}`} allocation, {vaInputs.withdrawalRate}% withdrawal @ age {vaInputs.incomeStartAge || 65}
            </div>
          </div>
        </Card>
      )}

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map(strategy => (
          <StrategyCard
            key={strategy.key}
            strategy={strategy}
            isBest={strategy.key === bestStrategy.key}
            isSafest={strategy.key === safestStrategy.key}
            isSelected={selectedIPSStrategy?.key === strategy.key}
            onSelect={setSelectedIPSStrategy}
          />
        ))}
      </div>

      {/* IPS Generation Section */}
      <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-full">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">Investment Policy Statement</h4>
              <p className="text-slate-600 text-sm mt-1">
                {selectedIPSStrategy
                  ? `Generate an IPS document using the "${selectedIPSStrategy.name}" strategy with ${distributionStrategies.find(s => s.value === selectedIPSRebalanceFreq)?.label || 'Sequential Distribution'}.`
                  : 'Click on a strategy above to select it for your Investment Policy Statement, then choose a distribution strategy below.'
                }
              </p>
            </div>
          </div>

          {/* IPS Distribution Strategy Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-16">
            <span className="text-sm font-medium text-slate-600">Distribution Strategy for IPS:</span>
            <div className="flex flex-wrap gap-2">
              {distributionStrategies.map((strategy) => (
                <button
                  key={strategy.value}
                  onClick={() => setSelectedIPSRebalanceFreq(strategy.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedIPSRebalanceFreq === strategy.value
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={strategy.description}
                >
                  {strategy.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                const strategyToUse = selectedIPSStrategy || bestStrategy;
                generateAndDownloadIPS({
                  clientInfo,
                  inputs,
                  assumptions,
                  selectedStrategy: strategyToUse,
                  distributionFreq: selectedIPSRebalanceFreq,
                  monteCarloData
                });
              }}
              disabled={!clientInfo?.name}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                clientInfo?.name
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
              title={!clientInfo?.name ? 'Please enter client name to generate IPS' : ''}
            >
              <Download className="w-5 h-5" />
              Generate IPS
            </button>
          </div>
        </div>
        {!clientInfo?.name && (
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Client name is required to generate the Investment Policy Statement.
          </p>
        )}
      </Card>

      {/* Recommendation Box */}
      <Card className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 rounded-full">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Recommendation</h4>
            <p className="text-slate-700 mt-1">
              {bestStrategy.key === safestStrategy.key ? (
                // Best and Safest are the same strategy
                bestStrategy.isCurrent ? (
                  <>Your current allocation is optimal - it has both the highest success rate ({bestStrategy.successRate?.toFixed(1)}%) and the largest projected legacy (${Math.round(bestStrategy.medianLegacy || 0).toLocaleString()}).</>
                ) : (
                  <>The <strong>{bestStrategy.name}</strong> strategy is both the safest ({bestStrategy.successRate?.toFixed(1)}% success rate) and offers the largest projected legacy (${Math.round(bestStrategy.medianLegacy || 0).toLocaleString()}).</>
                )
              ) : (
                // Best and Safest are different strategies
                <>
                  <strong>{bestStrategy.name}</strong> offers the best balance with a {bestStrategy.successRate?.toFixed(1)}% success rate and the largest legacy of ${Math.round(bestStrategy.medianLegacy || 0).toLocaleString()}.
                  {safestStrategy.key !== bestStrategy.key && (
                    <> For maximum safety, <strong>{safestStrategy.name}</strong> has the highest success rate at {safestStrategy.successRate?.toFixed(1)}%.</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Strategy Explanations */}
      <Card className="p-5">
        <h4 className="font-bold text-slate-800 mb-4">Strategy Descriptions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-l-4 border-emerald-500 pl-4">
            <h5 className="font-medium text-slate-800">Current Model</h5>
            <p className="text-sm text-slate-600">
              Your existing bucket allocation based on spending gap analysis. Balances liquidity needs
              across multiple time horizons with income-generating assets.
            </p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h5 className="font-medium text-slate-800">4% Model</h5>
            <p className="text-sm text-slate-600">
              12.5% B1, 12.5% B2, 22.5% B3, 15% B4, 37.5% B5. Designed for traditional 4% withdrawal rate
              with balanced risk across all buckets.
            </p>
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <h5 className="font-medium text-slate-800">5.5% Model</h5>
            <p className="text-sm text-slate-600">
              17.5% B1, 17.5% B2, 25% B3, 10% B4, 30% B5. Higher liquidity allocation for clients
              with higher withdrawal rates.
            </p>
          </div>
          <div className="border-l-4 border-slate-500 pl-4">
            <h5 className="font-medium text-slate-800">Balanced 60/40</h5>
            <p className="text-sm text-slate-600">
              100% in B3 (60/40 balanced). Traditional single-bucket approach without
              time-segmented strategy.
            </p>
          </div>
          <div className="border-l-4 border-indigo-500 pl-4">
            <h5 className="font-medium text-slate-800">Aggressive Growth</h5>
            <p className="text-sm text-slate-600">
              0% B1, 0% B2, 20% B3, 10% B4, 70% B5. Maximizes long-term growth potential
              with minimal short-term reserves.
            </p>
          </div>
          <div className="border-l-4 border-purple-500 pl-4">
            <h5 className="font-medium text-slate-800">Barbell Strategy</h5>
            <p className="text-sm text-slate-600">
              3 years cash in B1, remainder in B5. Extreme approach maximizing equity exposure
              while maintaining near-term liquidity.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

const TOTAL_PAGES = 10;

const PrintFooter = ({ pageNumber }) => (
  <div className="border-t border-slate-200 pt-4 mt-6">
    <div className="flex justify-between text-[11px] text-slate-400 mb-2">
      <span>Miller Wealth Management | Confidential</span>
      <span>Page {pageNumber} of {TOTAL_PAGES}</span>
    </div>
    <p className="text-[10px] text-slate-400 text-center leading-tight">
      Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial.
    </p>
  </div>
);

const PrintPageWrapper = ({ pageNumber, title, subtitle, children }) => (
  <div className="hidden print:flex flex-col min-h-[10in] break-after-page p-6">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <img src={LOGO_URL} alt="Logo" className="h-10" />
    </div>
    <div className="w-full h-0.5 bg-emerald-600 mb-4"></div>
    <div className="flex-1">
      {children}
    </div>
    <PrintFooter pageNumber={pageNumber} />
  </div>
);

// Closing page removed - not in user's 8-page requirements

export default ArchitectPage;
