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
import { getAdjustedSS, getImpliedPIA, applyDeemedFiling, generateAndDownloadIPS, calculateAnnualTax, calculateTaxableSS, calculateFederalTax, getInflationAdjustedBrackets, getInflationAdjustedDeduction, STATE_TAX_DATA, calculateBasePlan, runSimulation } from '../../utils';
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
  rebalanceTargets,
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
  ssBreakevenResults,
  ssPartnerAnalysis,
  ssSimResults,
  ssPartnerSimResults,
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
  teamClients,
  isLoadingTeamClients,
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
  // Compute legacy balance and final projection age
  const lastProjectionEntry = useMemo(() => projectionData[projectionData.length - 1], [projectionData]);
  const finalProjectionAge = lastProjectionEntry?.age || 95;
  const legacyAt95 = useMemo(() => {
    if (monteCarloData?.medianLegacy != null) return monteCarloData.medianLegacy;
    const entry = projectionData.find(p => p.age >= 95) || lastProjectionEntry;
    return entry?.total || 0;
  }, [monteCarloData, projectionData, lastProjectionEntry]);

  // Command Center client selector state
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [selectedCommandCenterClient, setSelectedCommandCenterClient] = useState(null);
  const [selectedOwnerAdvisorId, setSelectedOwnerAdvisorId] = useState(null);

  // Portfolio Sustainability chart mode (shared between Allocation tab and SS Optimizer)
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);

  // SS Optimizer outcomes from actual simulation (deterministic) — used by both tab and print
  const ssOutcomesForDisplay = useMemo(() => {
    if (!ssSimResults || ssSimResults.length === 0) return ssAnalysis.outcomes;
    return ssSimResults.map(r => ({ age: r.age, balance: r.deterministicBalance }));
  }, [ssSimResults, ssAnalysis.outcomes]);

  const ssWinnerForDisplay = useMemo(() =>
    ssOutcomesForDisplay.reduce((prev, cur) => cur.balance > prev.balance ? cur : prev, ssOutcomesForDisplay[0]),
    [ssOutcomesForDisplay]
  );

  const ssPartnerOutcomesForDisplay = useMemo(() => {
    if (!ssPartnerSimResults || ssPartnerSimResults.length === 0) return ssPartnerAnalysis?.outcomes || [];
    return ssPartnerSimResults.map(r => ({ age: r.age, balance: r.deterministicBalance }));
  }, [ssPartnerSimResults, ssPartnerAnalysis]);

  const ssPartnerWinnerForDisplay = useMemo(() =>
    ssPartnerOutcomesForDisplay.length > 0
      ? ssPartnerOutcomesForDisplay.reduce((prev, cur) => cur.balance > prev.balance ? cur : prev, ssPartnerOutcomesForDisplay[0])
      : null,
    [ssPartnerOutcomesForDisplay]
  );

  // SS Matrix optimization state (shared between interactive tab and print page)
  const [ssMatrixData, setSsMatrixData] = useState(null);
  const [isRunningMatrix, setIsRunningMatrix] = useState(false);

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

  // --- Cash Flow print page data ---
  const cashFlowPrintData = useMemo(() => {
    const fmt = (val) => `$${Math.round(val).toLocaleString()}`;
    const hasEmployment = projectionData.some(r => r.employmentIncomeDetail > 0);
    const hasOther = projectionData.some(r => r.otherIncomeDetail > 0);
    const hasContributions = projectionData.some(r => r.contribution > 0);
    const hasNqData = inputs.taxEnabled && projectionData.some(r => r.nqWithdrawal > 0);
    const hasRMD = inputs.taxEnabled && projectionData.some(r => r.rmdAmount > 0);
    const hasRMDExcess = hasRMD && projectionData.some(r => r.rmdExcess > 0);

    const rows = [
      { label: 'Plan Year', cls: 'font-bold text-slate-800 bg-slate-100', getValue: (r) => r.year },
      { label: `${clientInfo.name || 'Client'} Age`, cls: 'font-bold text-slate-700 bg-slate-50', getValue: (r) => r.age },
    ];
    if (clientInfo.isMarried) {
      rows.push({ label: `${clientInfo.partnerName || 'Partner'} Age`, cls: 'text-slate-500 bg-slate-50', getValue: (r) => Math.floor(r.partnerAge) });
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Starting Balance', cls: 'text-slate-700', getValue: (r) => fmt(r.startBalance) },
      { label: 'Growth', cls: '', getValue: (r) => `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`, dynamicCls: (r) => r.growth >= 0 ? 'text-emerald-700' : 'text-red-600' },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Social Security', cls: 'text-blue-700', getValue: (r) => fmt(r.ssIncomeDetail || 0) },
      { label: 'Pension', cls: 'text-blue-700', getValue: (r) => fmt(r.pensionIncomeDetail || 0) },
    );
    if (hasEmployment) rows.push({ label: 'Employment Income', cls: 'text-teal-700', getValue: (r) => r.employmentIncomeDetail > 0 ? fmt(r.employmentIncomeDetail) : '-' });
    if (hasOther) rows.push({ label: 'Other Income', cls: 'text-cyan-700', getValue: (r) => r.otherIncomeDetail > 0 ? fmt(r.otherIncomeDetail) : '-' });
    if (hasContributions) rows.push({ label: 'One-Time Contributions', cls: 'text-purple-700', getValue: (r) => r.contribution > 0 ? `+${fmt(r.contribution)}` : '-' });
    rows.push(
      { label: 'Total Income', cls: 'font-bold text-blue-800 bg-blue-50', getValue: (r) => fmt(r.ssIncome) },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Total Spending', cls: 'font-bold text-slate-800', getValue: (r) => fmt(r.expenses) },
      { label: 'Portfolio Withdrawal', cls: 'text-orange-700', getValue: (r) => fmt(r.distribution) },
    );
    if (hasRMD) {
      rows.push({ label: 'RMD Floor', cls: 'text-orange-600', getValue: (r) => r.rmdAmount > 0 ? fmt(r.rmdAmount) : '-' });
      if (hasRMDExcess) {
        rows.push({ label: 'RMD Excess → NQ', cls: 'text-teal-600', getValue: (r) => r.rmdExcess > 0 ? `+${fmt(r.rmdExcess)}` : '-' });
      }
    }
    if (inputs.taxEnabled) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Federal Tax', cls: 'text-red-600', getValue: (r) => fmt(r.federalTax || 0) },
        { label: 'State Tax', cls: 'text-red-600', getValue: (r) => fmt(r.stateTax || 0) },
        { label: 'Total Tax', cls: 'font-bold text-red-700 bg-red-50', getValue: (r) => fmt(r.totalTax || 0) },
        { label: 'Effective Rate', cls: 'text-amber-700', getValue: (r) => `${r.effectiveRate || '0'}%` },
      );
    }
    if (hasNqData) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Withdrawal', cls: 'text-blue-600', getValue: (r) => fmt(r.distribution * (r.traditionalPctUsed || 0) / 100) },
        { label: 'Roth Withdrawal', cls: 'text-emerald-600', getValue: (r) => fmt(r.distribution * (r.rothPctUsed || 0) / 100) },
        { label: 'NQ Withdrawal', cls: 'text-amber-600', getValue: (r) => fmt(r.nqWithdrawal || 0) },
        { label: '  Realized Cap Gains', cls: 'text-red-500 pl-4', getValue: (r) => fmt(r.nqTaxableGain || 0) },
        { label: 'Qualified Dividends', cls: 'text-purple-600', getValue: (r) => fmt(r.nqQualifiedDividends || 0) },
        { label: 'Ordinary Dividends', cls: 'text-pink-600', getValue: (r) => fmt(r.nqOrdinaryDividends || 0) },
      );
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Distribution Rate', cls: 'text-red-600', getValue: (r) => `${r.distRate?.toFixed(1) || '0'}%` },
      { label: 'Ending Balance', cls: 'font-bold text-slate-900 bg-emerald-50 text-base', getValue: (r) => fmt(Math.max(0, r.total)) },
    );

    const chunks = [];
    for (let i = 0; i < projectionData.length; i += 5) {
      chunks.push(projectionData.slice(i, i + 5));
    }

    return { rows, chunks };
  }, [projectionData, inputs, clientInfo]);

  const cashFlowPageCount = cashFlowPrintData.chunks.length;
  const totalPrintPages = 10 + cashFlowPageCount; // 10 base pages + N cash flow pages

  const renderCashFlowPrintTable = (cols, allRows) => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-[11px] border-collapse">
        <tbody>
          {allRows.map((rowDef, ri) => (
            <tr key={ri} className={rowDef.isSeparator ? 'h-1' : 'border-b border-slate-100'}>
              <td className={`p-1.5 text-left whitespace-nowrap font-medium bg-white border-r border-slate-200 min-w-[160px] ${rowDef.cls || ''}`}>
                {rowDef.label}
              </td>
              {cols.map((col, ci) => (
                <td key={ci} className={`p-1.5 text-right whitespace-nowrap ${rowDef.isSeparator ? '' : rowDef.dynamicCls ? rowDef.dynamicCls(col) : rowDef.cls || ''}`}>
                  {rowDef.isSeparator ? '' : rowDef.getValue(col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-800 ${isGeneratingReport ? 'print-mode' : 'p-4 sm:p-6 lg:p-8'}`}>

      {/* PRINT PAGE 1: Cover Page */}
      <div className="hidden print:flex flex-col min-h-[10in] break-after-page items-center justify-center text-center p-12 bg-white">
        <img src={LOGO_URL} alt="Logo" className="h-56 mb-8" />
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
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 md:mb-8 print:hidden no-print">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {clientInfo.name && (
              <div className="flex items-center gap-2 mr-auto">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-800 text-sm sm:text-base">{clientInfo.name}</span>
                {clientInfo.isMarried && clientInfo.partnerName && (
                  <span className="text-xs sm:text-sm text-slate-500">&amp; {clientInfo.partnerName}</span>
                )}
              </div>
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
      <PrintPageWrapper pageNumber={2} totalPages={totalPrintPages} title="Phase 1 - Accumulation" subtitle="Building your retirement portfolio">
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
                <th className="px-1 py-0.5 text-left">Age</th>
                <th className="px-1 py-0.5 text-right">Start Balance</th>
                <th className="px-1 py-0.5 text-right text-emerald-600">Savings</th>
                <th className="px-1 py-0.5 text-right text-blue-600">Growth</th>
                <th className="px-1 py-0.5 text-right font-bold">End Balance</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const MAX_ROWS = 10;
                const total = accumulationData.length;
                // Build list of indices to display
                let displayIndices;
                if (total <= MAX_ROWS) {
                  displayIndices = accumulationData.map((_, i) => i);
                } else {
                  const indexSet = new Set();
                  // First 3
                  for (let i = 0; i < 3 && i < total; i++) indexSet.add(i);
                  // Last 3
                  for (let i = Math.max(0, total - 3); i < total; i++) indexSet.add(i);
                  // One-time event years during accumulation
                  const retAge = clientInfo.retirementAge;
                  (inputs.additionalIncomes || []).forEach(income => {
                    if (income.isOneTime && income.startAge < retAge) {
                      const idx = accumulationData.findIndex(r => r.age === income.startAge);
                      if (idx >= 0) indexSet.add(idx);
                    }
                  });
                  // Fill remaining slots with evenly spaced years
                  const remaining = MAX_ROWS - indexSet.size;
                  if (remaining > 0) {
                    const candidates = [];
                    for (let i = 0; i < total; i++) {
                      if (!indexSet.has(i)) candidates.push(i);
                    }
                    const step = candidates.length / (remaining + 1);
                    for (let j = 1; j <= remaining; j++) {
                      indexSet.add(candidates[Math.round(step * j - 1)] ?? candidates[candidates.length - 1]);
                    }
                  }
                  displayIndices = [...indexSet].sort((a, b) => a - b).slice(0, MAX_ROWS);
                }
                // Render rows with ellipsis separators for gaps
                const rows = [];
                displayIndices.forEach((idx, pos) => {
                  if (pos > 0 && idx > displayIndices[pos - 1] + 1) {
                    rows.push(
                      <tr key={`gap-${idx}`}><td colSpan={5} className="py-0 leading-none text-center text-slate-300 text-[8px]">⋮</td></tr>
                    );
                  }
                  const row = accumulationData[idx];
                  const prevBalance = idx > 0 ? accumulationData[idx - 1].balance : clientInfo.currentPortfolio;
                  const savings = idx > 0 ? Math.round(clientInfo.annualSavings * Math.pow(1 + (inputs.inflationRate / 100), idx - 1)) : 0;
                  const growth = idx > 0 ? row.balance - prevBalance - savings : 0;
                  rows.push(
                    <tr key={idx} className={pos % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-1 py-0.5">{row.age}</td>
                      <td className="px-1 py-0.5 text-right">${prevBalance.toLocaleString()}</td>
                      <td className="px-1 py-0.5 text-right text-emerald-600">{savings > 0 ? `+$${savings.toLocaleString()}` : '-'}</td>
                      <td className="px-1 py-0.5 text-right text-blue-600">{growth > 0 ? `+$${Math.round(growth).toLocaleString()}` : '-'}</td>
                      <td className="px-1 py-0.5 text-right font-bold">${row.balance.toLocaleString()}</td>
                    </tr>
                  );
                });
                return rows;
              })()}
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
      <div className="max-w-7xl mx-auto print:hidden no-print">

        <div className="space-y-6">

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
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
                : `Positive balance through age ${finalProjectionAge}`}
              icon={Activity}
              colorClass={`${(() => { const sr = adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate; return sr >= 85 ? "bg-emerald-600" : sr >= 65 ? "bg-orange-500" : "bg-red-600"; })()} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
            <StatBox
              label={`Legacy Balance (Age ${finalProjectionAge})`}
              value={adjustedProjections.hasChanges
                ? `$${(adjustedProjections.legacyBalance / 1000000).toFixed(2)}M`
                : `$${((legacyAt95) / 1000000).toFixed(2)}M`}
              subtext={adjustedProjections.hasChanges
                ? <><span className="line-through opacity-60">${((legacyAt95) / 1000000).toFixed(2)}M</span> → +${((adjustedProjections.legacyBalance - (legacyAt95)) / 1000).toFixed(0)}k</>
                : `Projected value at age ${finalProjectionAge}`}
              icon={Shield}
              colorClass={`bg-emerald-800 text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-yellow-300' : ''}`}
            />
          </div>

          {/* Quick Adjustments - Retirement Age & Savings */}
          <div className={`print:hidden grid grid-cols-1 ${!clientInfo.isRetired ? 'md:grid-cols-3' : 'md:grid-cols-1 max-w-md'} gap-4`}>
            {!clientInfo.isRetired && (
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
            )}
            {!clientInfo.isRetired && (
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
            )}
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <h4 className="font-bold text-orange-800 text-sm">Monthly Spending</h4>
                </div>
                <FormattedNumberInput
                  name="monthlySpending"
                  value={inputs.monthlySpending}
                  onChange={onInputChange}
                  className="p-2 border border-orange-300 rounded-lg w-28 text-center font-bold text-orange-800 bg-white"
                />
              </div>
            </div>
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
              <button
                onClick={() => onSetActiveTab('optimizer')}
                className={`${activeTab === 'optimizer' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Target className="w-3 h-3 sm:w-4 sm:h-4" /> Optimizer
              </button>
              <button
                onClick={() => onSetActiveTab('taxmap')}
                className={`${activeTab === 'taxmap' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" /> Tax Map
              </button>
              <button
                onClick={() => onSetActiveTab('cashflows')}
                className={`${activeTab === 'cashflows' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <TableIcon className="w-3 h-3 sm:w-4 sm:h-4" /> Cash Flows
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
              monteCarloData={monteCarloData}
              clientInfo={clientInfo}
              showCashFlowTable={showCashFlowTable}
              onSetShowCashFlowTable={onSetShowCashFlowTable}
              rebalanceFreq={rebalanceFreq}
              onSetRebalanceFreq={onSetRebalanceFreq}
              showMonteCarlo={showMonteCarlo}
              onSetShowMonteCarlo={setShowMonteCarlo}
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
              onSetRebalanceFreq={onSetRebalanceFreq}
              assumptions={assumptions}
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
              assumptions={assumptions}
              basePlan={basePlan}
              rebalanceFreq={rebalanceFreq}
              rebalanceTargets={rebalanceTargets}
              useManualAllocation={useManualAllocation}
              manualAllocations={manualAllocations}
              ssAnalysis={ssAnalysis}
              ssBreakevenResults={ssBreakevenResults}
              clientOutcomes={ssOutcomesForDisplay}
              clientWinner={ssWinnerForDisplay}
              partnerOutcomes={ssPartnerOutcomesForDisplay}
              partnerWinner={ssPartnerWinnerForDisplay}
              targetMaxPortfolioAge={targetMaxPortfolioAge}
              onSetTargetMaxPortfolioAge={onSetTargetMaxPortfolioAge}
              onUpdateSSStartAge={onUpdateSSStartAge}
              onUpdatePartnerSSStartAge={onUpdatePartnerSSStartAge}
              onInputChange={onInputChange}
              matrixData={ssMatrixData}
              isRunningMatrix={isRunningMatrix}
              onSetMatrixData={setSsMatrixData}
              onSetIsRunningMatrix={setIsRunningMatrix}
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

          {activeTab === 'taxmap' && (
            <TaxMapTab
              projectionData={projectionData}
              inputs={inputs}
              clientInfo={clientInfo}
              basePlan={basePlan}
            />
          )}

          {activeTab === 'cashflows' && (
            <CashFlowsTab
              projectionData={projectionData}
              monteCarloData={monteCarloData}
              inputs={inputs}
              clientInfo={clientInfo}
            />
          )}
        </div>
        <div className="w-full print:hidden">
          <Disclaimer />
        </div>
      </div>

      {/* PRINT PAGE 3: Bucket Architecture */}
      <PrintPageWrapper pageNumber={3} totalPages={totalPrintPages} title="Bucket Architecture" subtitle="Time-segmented allocation strategy">
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
          <PrintPageWrapper pageNumber={4} totalPages={totalPrintPages} title="Phase 2 - Distribution Strategy" subtitle="Bucket-based withdrawal sequence">
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
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Success Probability (Age {finalProjectionAge})</p>
                <div className={`text-3xl font-bold ${monteCarloData.successRate >= 85 ? 'text-emerald-600' : monteCarloData.successRate >= 65 ? 'text-orange-600' : 'text-red-600'}`}>
                  {monteCarloData.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Based on 1,000 Monte Carlo simulations</p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${monteCarloData.successRate >= 85 ? 'bg-emerald-500' : monteCarloData.successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(monteCarloData.successRate, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="border-2 border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Projected Legacy (Age {finalProjectionAge})</p>
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
      <PrintPageWrapper pageNumber={5} totalPages={totalPrintPages} title="Portfolio Sustainability" subtitle={inputs.taxEnabled ? 'Projected portfolio balance and cash flow (with estimated taxes)' : 'Projected portfolio balance and annual cash flow detail'}>
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
              {projectionData
                .filter((row, i) => {
                  const yearNum = i + 1; // 1-indexed year
                  return yearNum <= 15 || yearNum % 5 === 0;
                })
                .map((row, i) => (
                <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-1 text-left font-bold text-slate-700">{row.age}</td>
                  <td className="p-1 text-slate-500">${row.startBalance.toLocaleString()}</td>
                  <td className={`p-1 ${row.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.growth >= 0 ? `+$${row.growth.toLocaleString()}` : `($${Math.abs(row.growth).toLocaleString()})`}</td>
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

      {/* PRINT PAGES 6+: Cash Flow Detail (5 years per page) */}
      {cashFlowPrintData.chunks.map((chunk, idx) => {
        const startAge = chunk[0]?.age;
        const endAge = chunk[chunk.length - 1]?.age;
        return (
          <PrintPageWrapper
            key={`cf-${idx}`}
            pageNumber={6 + idx}
            totalPages={totalPrintPages}
            title={`Cash Flow Detail — Ages ${startAge}–${endAge}`}
            subtitle={`Plan years ${chunk[0]?.year}–${chunk[chunk.length - 1]?.year}`}
          >
            {renderCashFlowPrintTable(chunk, cashFlowPrintData.rows)}
          </PrintPageWrapper>
        );
      })}

      {/* PRINT PAGE: Social Security Optimization */}
      <PrintPageWrapper pageNumber={6 + cashFlowPageCount} totalPages={totalPrintPages} title="Social Security Optimization" subtitle="Optimal claiming strategy analysis">
        {(() => {
          const FRA = 67;
          const fmt = (v) => `$${Math.round(v).toLocaleString()}`;
          const pct = (v) => `${(v * 100).toFixed(1)}%`;

          // Client benefit details
          const cAge = inputs.ssStartAge;
          const cInputPIA = inputs.ssPIA;
          const cReceiving = inputs.ssCurrentlyReceiving;
          const cPIA = cReceiving ? getImpliedPIA(cInputPIA, cAge) : cInputPIA;
          const cOwn = cReceiving ? cInputPIA : getAdjustedSS(cPIA, cAge);
          const cYearsEarly = Math.max(0, FRA - cAge);
          const cYearsLate = Math.max(0, cAge - FRA);
          const cReduction = cPIA > 0 && !cReceiving ? (1 - cOwn / cPIA) : 0;
          const cBonus = cPIA > 0 && !cReceiving && cAge > FRA ? (cOwn / cPIA - 1) : 0;

          const pPartnerPIA = clientInfo.isMarried
            ? (inputs.partnerSSCurrentlyReceiving ? getImpliedPIA(inputs.partnerSSPIA, inputs.partnerSSStartAge) : inputs.partnerSSPIA)
            : 0;
          const cSpousalExcess = clientInfo.isMarried ? Math.max(0, pPartnerPIA * 0.5 - cPIA) : 0;
          const dispAgeDiff = clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge);
          const cDispSpousalAge = clientInfo.isMarried ? Math.min(FRA, Math.max(cAge, inputs.partnerSSStartAge + dispAgeDiff)) : cAge;
          const cAfterDeemed = clientInfo.isMarried ? applyDeemedFiling(cOwn, pPartnerPIA, true, cAge, cPIA, cDispSpousalAge) : cOwn;
          const cSpousalApplies = cAfterDeemed > cOwn;

          // Partner benefit details
          let pOwn = 0, pAfterDeemed = 0, pYearsEarly = 0, pYearsLate = 0, pReduction = 0, pBonus = 0, pSpousalExcess = 0, pSpousalApplies = false, pPIA = 0;
          if (clientInfo.isMarried) {
            const pAge = inputs.partnerSSStartAge;
            const pInputPIA = inputs.partnerSSPIA;
            const pRec = inputs.partnerSSCurrentlyReceiving;
            pPIA = pRec ? getImpliedPIA(pInputPIA, pAge) : pInputPIA;
            pOwn = pRec ? pInputPIA : getAdjustedSS(pPIA, pAge);
            pYearsEarly = Math.max(0, FRA - pAge);
            pYearsLate = Math.max(0, pAge - FRA);
            pReduction = pPIA > 0 && !pRec ? (1 - pOwn / pPIA) : 0;
            pBonus = pPIA > 0 && !pRec && pAge > FRA ? (pOwn / pPIA - 1) : 0;
            pSpousalExcess = Math.max(0, cPIA * 0.5 - pPIA);
            const pDispSpousalAge = Math.min(FRA, Math.max(pAge, cAge - dispAgeDiff));
            pAfterDeemed = applyDeemedFiling(pOwn, cPIA, true, pAge, pPIA, pDispSpousalAge);
            pSpousalApplies = pAfterDeemed > pOwn;
          }

          const totalMonthly = cAfterDeemed + pAfterDeemed;

          // Compact benefit row renderer
          const BenefitRow = ({ label, pia, claimAge, yearsEarly, yearsLate, reduction, bonus, ownBenefit, spousalExcess, spousalApplies, afterDeemed, receiving }) => (
            <div className="text-[9px] leading-tight">
              <p className="font-bold text-slate-700 text-[10px] mb-0.5">{label}</p>
              <div className="grid grid-cols-2 gap-x-3">
                <span className="text-slate-500">PIA (FRA 67)</span><span className="text-right font-medium">{fmt(pia)}/mo</span>
                <span className="text-slate-500">Claim age</span>
                <span className="text-right font-medium">
                  {claimAge}{yearsEarly > 0 && <span className="text-red-500"> ({yearsEarly}yr early)</span>}{yearsLate > 0 && <span className="text-emerald-600"> ({yearsLate}yr late)</span>}
                </span>
                {!receiving && reduction > 0 && <><span className="text-red-500">Early reduction</span><span className="text-right text-red-500">-{pct(reduction)}</span></>}
                {!receiving && bonus > 0 && <><span className="text-emerald-600">Delayed credits</span><span className="text-right text-emerald-600">+{pct(bonus)}</span></>}
                <span className="text-slate-500">Own benefit</span><span className="text-right font-medium">{fmt(ownBenefit)}/mo</span>
                {clientInfo.isMarried && spousalExcess > 0 && <><span className="text-blue-600">Spousal excess</span><span className="text-right text-blue-600">+{fmt(afterDeemed - ownBenefit)}/mo</span></>}
                <span className="text-slate-700 font-bold border-t border-slate-200 pt-0.5">Total benefit</span>
                <span className="text-right font-bold text-emerald-700 border-t border-slate-200 pt-0.5">{fmt(afterDeemed)}/mo</span>
              </div>
            </div>
          );

          return (
            <>
              {/* Benefits Calculation Detail — side-by-side compact */}
              <div className={`grid ${clientInfo.isMarried ? 'grid-cols-2' : 'grid-cols-1 max-w-sm'} gap-4 mb-3 p-3 border border-slate-200 rounded-lg`}>
                <BenefitRow label={clientInfo.name || 'Client'} pia={cPIA} claimAge={cAge} yearsEarly={cYearsEarly} yearsLate={cYearsLate} reduction={cReduction} bonus={cBonus} ownBenefit={cOwn} spousalExcess={cSpousalExcess} spousalApplies={cSpousalApplies} afterDeemed={cAfterDeemed} receiving={cReceiving} />
                {clientInfo.isMarried && (
                  <BenefitRow label={clientInfo.partnerName || 'Partner'} pia={pPIA} claimAge={inputs.partnerSSStartAge} yearsEarly={pYearsEarly} yearsLate={pYearsLate} reduction={pReduction} bonus={pBonus} ownBenefit={pOwn} spousalExcess={pSpousalExcess} spousalApplies={pSpousalApplies} afterDeemed={pAfterDeemed} receiving={inputs.partnerSSCurrentlyReceiving} />
                )}
              </div>
              {clientInfo.isMarried && (
                <div className="flex justify-end mb-3">
                  <span className="text-[10px] font-bold text-emerald-700">Combined: {fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
                </div>
              )}

              {/* Claiming Age Matrix */}
              {clientInfo.isMarried && ssMatrixData ? (
                <>
                  <div className="bg-black text-white p-2 rounded-lg mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <p className="text-[11px] font-bold">
                      Optimal: Primary <span className="text-emerald-400">{ssMatrixData.winner.clientAge}</span> + Spouse <span className="text-emerald-400">{ssMatrixData.winner.partnerAge}</span>
                      <span className="text-gray-400 font-normal ml-2">Portfolio at {targetMaxPortfolioAge}: {fmt(Math.round(ssMatrixData.winner.balance))}</span>
                    </p>
                  </div>
                  {(() => {
                    const allBal = ssMatrixData.matrix.map(m => m.balance);
                    const minB = Math.min(...allBal);
                    const maxB = Math.max(...allBal);
                    const rng = maxB - minB || 1;
                    return (
                      <table className="w-full border-collapse text-[9px] mb-2">
                        <thead>
                          <tr>
                            <th className="p-1 bg-slate-100 border border-slate-200 text-[8px] text-slate-500">
                              <div className="flex flex-col items-center leading-none"><span>Spouse</span><span>\</span><span>Primary</span></div>
                            </th>
                            {ssMatrixData.ages.map(a => (
                              <th key={a} className="p-1 bg-slate-100 border border-slate-200 text-center font-bold text-slate-700">{a}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ssMatrixData.ages.map(pAge => (
                            <tr key={pAge}>
                              <td className="p-1 bg-slate-100 border border-slate-200 text-center font-bold text-slate-700">{pAge}</td>
                              {ssMatrixData.ages.map(cAge => {
                                const cell = ssMatrixData.matrix.find(m => m.clientAge === cAge && m.partnerAge === pAge);
                                const bal = cell?.balance || 0;
                                const isOpt = ssMatrixData.winner.clientAge === cAge && ssMatrixData.winner.partnerAge === pAge;
                                const isSel = inputs.ssStartAge === cAge && inputs.partnerSSStartAge === pAge;
                                const p = (bal - minB) / rng;
                                const bg = isOpt ? 'bg-emerald-200 font-bold' : isSel ? 'bg-blue-100' : p >= 0.85 ? 'bg-emerald-100' : p >= 0.6 ? 'bg-emerald-50' : p >= 0.35 ? 'bg-yellow-50' : p >= 0.15 ? 'bg-orange-50' : 'bg-red-50';
                                return (
                                  <td key={cAge} className={`p-1 border border-slate-200 text-center ${bg}`}>
                                    ${(bal / 1000000).toFixed(2)}M
                                    {isOpt && <span className="block text-[7px] text-emerald-700">BEST</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                  <p className="text-[8px] text-slate-400 text-center">Portfolio balance at age {targetMaxPortfolioAge}. Primary claiming age across top, spouse claiming age down left.</p>
                </>
              ) : !clientInfo.isMarried ? (
                /* Single client — compact 9-card row */
                <>
                  <div className="bg-black text-white p-2 rounded-lg mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <p className="text-[11px]"><span className="text-slate-400">Recommendation:</span> Claim at Age <span className="text-emerald-400 font-bold">{ssWinnerForDisplay.age}</span> to maximize portfolio at age {targetMaxPortfolioAge}</p>
                  </div>
                  <div className="grid grid-cols-9 gap-1 mb-2">
                    {ssOutcomesForDisplay.map((o) => (
                      <div key={o.age} className={`p-1 rounded border text-center ${o.age === ssWinnerForDisplay.age ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="text-[9px] font-bold text-slate-500">{o.age}</p>
                        <p className={`text-[10px] font-bold ${o.age === ssWinnerForDisplay.age ? 'text-emerald-700' : 'text-slate-700'}`}>
                          ${Math.round(o.balance / 1000).toLocaleString()}k
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center mb-2">
                  <p className="text-[10px] text-slate-400">Run the Claiming Age Optimization Matrix from the SS Optimizer tab to include the 81-scenario grid here.</p>
                </div>
              )}

              {/* Compact rationale */}
              <div className="border border-slate-200 rounded-lg p-2 mt-1">
                <p className="text-[9px] text-slate-600 leading-relaxed">
                  <strong>Strategy:</strong> With IRA withdrawals, each $1 costs ${inputs.ssMarginalTaxRate > 0 ? `$${(1 / (1 - inputs.ssMarginalTaxRate / 100)).toFixed(2)}` : '$1.00'} after tax.
                  At {inputs.ssReinvestRate || 4.5}% growth, delaying to 67 breaks even at <strong>{ssBreakevenResults?.vs67?.breakevenAge?.toFixed(1) || 'N/A'}</strong>,
                  to 70 at <strong>{ssBreakevenResults?.vs70?.breakevenAge?.toFixed(1) || 'N/A'}</strong>.
                  {clientInfo.isMarried && ' Deemed filing: lower earner receives the higher of own benefit or 50% of higher earner\'s PIA.'}
                </p>
              </div>
            </>
          );
        })()}
      </PrintPageWrapper>

      {/* PRINT PAGE: Monte Carlo Simulation */}
      <PrintPageWrapper pageNumber={7 + cashFlowPageCount} totalPages={totalPrintPages} title="Monte Carlo Simulation" subtitle="Probability analysis based on 1,000 market scenarios">
        {/* Success Rate */}
        <div className={`${monteCarloData.successRate >= 85 ? 'bg-emerald-500' : monteCarloData.successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'} text-white p-6 rounded-lg mb-4`}>
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
            <strong>How to interpret:</strong> This simulation runs 1,000 random market scenarios using historical return patterns.
            The shaded area shows the range between best (90th percentile) and worst (10th percentile) outcomes.
            A success rate above 85% indicates a robust retirement plan.
          </p>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE: Strategy Comparison */}
      <PrintPageWrapper pageNumber={8 + cashFlowPageCount} totalPages={totalPrintPages} title="Strategy Comparison" subtitle="Alternative allocation strategies analyzed">
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
                <th className="p-1.5 text-center whitespace-nowrap">Legacy (Age {finalProjectionAge})</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const fmtLegacy = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(2)}M` : `$${Math.round(val / 1000)}k`;
                return (
                  <>
              <tr className="border-b bg-emerald-50">
                <td className="p-1.5 font-bold">Current Model</td>
                <td className="p-1.5 text-center">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b4Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center font-bold text-emerald-700">{(monteCarloData?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(legacyAt95)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium">4% Model</td>
                <td className="p-1.5 text-center">12.5%</td>
                <td className="p-1.5 text-center">12.5%</td>
                <td className="p-1.5 text-center">22.5%</td>
                <td className="p-1.5 text-center">10.0%</td>
                <td className="p-1.5 text-center">42.5%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy4?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy4?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium">5.5% Model</td>
                <td className="p-1.5 text-center">17.5%</td>
                <td className="p-1.5 text-center">17.5%</td>
                <td className="p-1.5 text-center">25.0%</td>
                <td className="p-1.5 text-center">10.0%</td>
                <td className="p-1.5 text-center">30.0%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy5?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy5?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium">Balanced 60/40</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center">100.0%</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center font-bold">{(optimizerData?.strategy6?.successRate || 0).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{fmtLegacy(optimizerData?.strategy6?.medianLegacy || 0)}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium">Aggressive Growth</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center">0.0%</td>
                <td className="p-1.5 text-center">20.0%</td>
                <td className="p-1.5 text-center">10.0%</td>
                <td className="p-1.5 text-center">70.0%</td>
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
          <p><strong>Note:</strong> Success rates are based on 1,000-iteration Monte Carlo simulations. Legacy values represent median outcomes. Actual results will vary based on market conditions and personal circumstances.</p>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE: Disclosures */}
      <PrintPageWrapper pageNumber={9 + cashFlowPageCount} totalPages={totalPrintPages} title="Important Disclosures" subtitle="Assumptions, methodology, and limitations">
        <div className="space-y-2 text-[12px] text-slate-600">
          {/* Return Assumptions */}
          <div className="border border-slate-200 rounded-lg p-2">
            <h3 className="font-bold text-[12px] text-slate-800 mb-1">Return & Interest Rate Assumptions</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-0.5">Projected returns based on historical averages and forward-looking estimates:</p>
                <ul className="list-disc list-inside ml-1">
                  <li>B1 (Short Term): {assumptions.b1.return}% return, {assumptions.b1.stdDev}% std dev</li>
                  <li>B2 (Mid Term): {assumptions.b2.return}% return, {assumptions.b2.stdDev}% std dev</li>
                  <li>B3 (Balanced): {assumptions.b3.return}% return, {assumptions.b3.stdDev}% std dev</li>
                  <li>B4 (Income & Growth): {assumptions.b4.return}% return, {assumptions.b4.stdDev}% std dev</li>
                  <li>B5 (Long Term): {assumptions.b5.return}% return, {assumptions.b5.stdDev}% std dev</li>
                </ul>
              </div>
              <div>
                <p className="mb-0.5">These assumptions are estimates and actual results may vary significantly. Past performance does not guarantee future results.</p>
                <p className="mb-0.5"><strong>Inflation:</strong> {inputs.inflationRate}% annual rate for SS COLA and expense projections.</p>
                <p><strong>Personal Inflation:</strong> {inputs.personalInflationRate}% applied to retirement spending projections.</p>
              </div>
            </div>
          </div>

          {/* Monte Carlo Methodology */}
          <div className="border border-slate-200 rounded-lg p-2">
            <h3 className="font-bold text-[12px] text-slate-800 mb-1">Monte Carlo Simulation Methodology</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-0.5">Success rates calculated using Monte Carlo simulation: 1,000 independent iterations with random returns using normal distribution, correlated based on historical relationships, with annual rebalancing over a 30-year projection horizon.</p>
              </div>
              <div>
                <p className="mb-0.5"><strong>Success Definition:</strong> Portfolio maintains positive balance throughout the projection period.</p>
                <p><strong>Limitations:</strong> Simulations cannot predict actual future returns. They provide a range of possible outcomes based on historical patterns and may not account for extreme market events or changes in tax law.</p>
              </div>
            </div>
          </div>

          {/* Social Security Assumptions */}
          <div className="border border-slate-200 rounded-lg p-2">
            <h3 className="font-bold text-[12px] text-slate-800 mb-1">Social Security & Income Assumptions</h3>
            <p>Social Security benefits adjusted based on claiming age: Before FRA (67): reduced ~6.67%/year. After FRA: increased 8%/year up to age 70. Annual COLA applied based on assumed inflation rate. Pension income assumes continued payment per stated terms with COLA only if indicated.</p>
          </div>

          {/* General Disclaimers */}
          <div className="border border-slate-200 rounded-lg p-2">
            <h3 className="font-bold text-[12px] text-slate-800 mb-1">General Disclaimers</h3>
            <p className="mb-0.5">This analysis is for educational and illustrative purposes only and should not be construed as personalized investment advice. Projections are hypothetical and do not represent actual investment results. Investment involves risk, including possible loss of principal. No guarantee any strategy will achieve its objectives. Diversification does not ensure profit or protect against loss. Tax considerations are important but not fully addressed here - consult a qualified tax professional.</p>
            <p>Report generated {new Date().toLocaleDateString()}. Regular reviews and updates recommended.</p>
          </div>

          {/* Regulatory Disclosure */}
          <div className="bg-slate-100 rounded-lg p-2">
            <p>Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial. The opinions voiced in this material are for general information only and are not intended to provide specific advice or recommendations for any individual.</p>
          </div>
        </div>
      </PrintPageWrapper>

      {/* PRINT PAGE 10: Back Cover - The One Process */}
      <div className="hidden print:flex flex-col min-h-[10in] break-after-page p-12 bg-white">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <img src={LOGO_URL} alt="Logo" className="h-36 mb-6" />
          <h2 className="text-3xl font-bold text-slate-900 mb-2">The One Process</h2>
          <div className="w-24 h-1 bg-emerald-600 mx-auto mb-3"></div>
          <p className="text-[13px] text-slate-600 mb-8 max-w-lg">
            A truly confident retirement is built on <strong>seven pillars</strong>, each working together through one coordinated strategy — reviewed and refined as life evolves.
          </p>

          <div className="grid grid-cols-2 gap-3 w-full max-w-xl mb-10">
            {[
              { num: '1', title: 'Investment Strategy', desc: 'Time-segmented bucket strategy engineered for income, growth, and resilience' },
              { num: '2', title: 'Balance Sheet Optimization', desc: 'Aligning assets, liabilities, and cash flow so every dollar works harder' },
              { num: '3', title: 'Asset Protection', desc: 'Shielding what you\'ve built from lawsuits, creditors, and unforeseen risks' },
              { num: '4', title: 'Proactive Tax Strategy', desc: 'Roth conversions, harvesting, and withdrawal sequencing to keep more of what you\'ve earned' },
              { num: '5', title: 'Legacy Planning', desc: 'Coordinating gifting, estate documents, and beneficiary designations so your wealth transfers exactly as intended' },
              { num: '6', title: 'Philanthropy', desc: 'Giving strategically in ways that maximize impact and align with your tax picture' },
              { num: '7', title: 'Family Stewardship', desc: 'Preparing heirs, establishing shared values, and creating a framework for multi-generational success' },
            ].map(pillar => (
              <div key={pillar.num} className={`flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-left ${pillar.num === '7' ? 'col-span-2 max-w-xs mx-auto' : ''}`}>
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  {pillar.num}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-[12px]">{pillar.title}</p>
                  <p className="text-[10px] text-slate-600 leading-tight">{pillar.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* QR Code & CTA */}
          <div className="border-t border-slate-200 pt-6 w-full max-w-md">
            <p className="text-lg font-bold text-slate-900 mb-1">Ready to explore your full plan?</p>
            <p className="text-[13px] text-slate-600 mb-4">Scan to schedule a complimentary consultation</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(SCHEDULING_URL)}`}
              alt="Schedule a meeting"
              className="mx-auto mb-3"
              style={{ width: '120px', height: '120px' }}
            />
            <p className="text-[12px] text-slate-500">www.millerwm.com | (480) 613-7400</p>
          </div>
        </div>
      </div>

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
              {(isLoadingClients || isLoadingTeamClients) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-slate-600">Loading clients...</span>
                </div>
              ) : commandCenterClients.length === 0 && (!teamClients || teamClients.length === 0) ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No clients found in Command Center.</p>
                  <p className="text-sm text-slate-400 mt-1">Create a client in the Command Center first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {/* Your Clients */}
                  {commandCenterClients.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 pt-1">Your Clients</div>
                      {commandCenterClients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setSelectedCommandCenterClient(client);
                            setSelectedOwnerAdvisorId(null);
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedCommandCenterClient?.id === client.id && !selectedOwnerAdvisorId
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
                    </>
                  )}

                  {/* Team Clients */}
                  {teamClients && teamClients.length > 0 && (
                    <>
                      <div className="border-t border-slate-200 mt-3 pt-3">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">Team Clients</div>
                      </div>
                      {teamClients.map((advisor) => (
                        <div key={advisor.advisorId}>
                          <div className="text-xs font-medium text-slate-400 px-1 py-1">
                            {advisor.advisorName}'s Clients
                          </div>
                          {advisor.clients.map((client) => (
                            <button
                              key={`${advisor.advisorId}-${client.id}`}
                              onClick={() => {
                                setSelectedCommandCenterClient(client);
                                setSelectedOwnerAdvisorId(advisor.advisorId);
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedCommandCenterClient?.id === client.id && selectedOwnerAdvisorId === advisor.advisorId
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
                      ))}
                    </>
                  )}
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
                  const result = await onSaveToCommandCenter(selectedCommandCenterClient.id, selectedOwnerAdvisorId);
                  if (result.success) {
                    alert(result.message);
                    setShowClientSelector(false);
                    setSelectedCommandCenterClient(null);
                    setSelectedOwnerAdvisorId(null);
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
  inputs, basePlan, assumptions, projectionData, monteCarloData, clientInfo,
  showCashFlowTable, onSetShowCashFlowTable, rebalanceFreq, onSetRebalanceFreq,
  showMonteCarlo, onSetShowMonteCarlo,
  useManualAllocation, manualAllocationMode, manualAllocations, manualPercentages,
  useManualForRebalance, onToggleManualAllocation, onToggleManualForRebalance,
  onManualAllocationChange, onManualAllocationModeChange,
  onRecalculateFromFormula, formulaAllocations,
  onInputChange, onAccountSplitChange, onWithdrawalOverrideChange
}) => {
  const [selectedTaxRow, setSelectedTaxRow] = useState(null);
  const [mcScenario, setMcScenario] = useState('median');

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
      <img src={LOGO_URL} alt="Logo" className="h-16" />
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
          {/* Preset Models + Mode Toggle */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Preset Model Selector */}
            <div>
              <span className="text-sm font-medium text-slate-600 mr-2">Preset:</span>
              <select
                onChange={(e) => {
                  const tp = inputs.totalPortfolio || 1;
                  const presets = {
                    '': null,
                    'formula': { b1: formulaAllocations.b1Val, b2: formulaAllocations.b2Val, b3: formulaAllocations.b3Val, b4: formulaAllocations.b4Val, b5: formulaAllocations.b5Val },
                    '4pct': { b1: Math.round(tp * 0.125), b2: Math.round(tp * 0.125), b3: Math.round(tp * 0.225), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.425) },
                    '5pct': { b1: Math.round(tp * 0.175), b2: Math.round(tp * 0.175), b3: Math.round(tp * 0.25), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.30) },
                    'aggressive': { b1: 0, b2: 0, b3: Math.round(tp * 0.20), b4: Math.round(tp * 0.10), b5: Math.round(tp * 0.70) },
                    'barbell': { b1: Math.min(Math.round((inputs.monthlySpending || 0) * 12 * 3), tp), b2: 0, b3: 0, b4: 0, b5: Math.max(0, tp - Math.min(Math.round((inputs.monthlySpending || 0) * 12 * 3), tp)) },
                    'balanced': { b1: 0, b2: 0, b3: tp, b4: 0, b5: 0 },
                  };
                  const preset = presets[e.target.value];
                  if (preset) {
                    ['b1', 'b2', 'b3', 'b4', 'b5'].forEach(k => onManualAllocationChange(k, preset[k], 'dollar'));
                  }
                  e.target.value = '';
                }}
                className="bg-white border text-xs font-bold rounded px-2 py-1.5"
                defaultValue=""
              >
                <option value="" disabled>Select a model...</option>
                <option value="formula">Formula (Calculated)</option>
                <option value="4pct">4% Model</option>
                <option value="5pct">5.5% Model</option>
                <option value="aggressive">Aggressive Growth</option>
                <option value="barbell">Barbell Strategy</option>
                <option value="balanced">Balanced 60/40</option>
              </select>
            </div>

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
            <label className="flex items-center gap-2 cursor-pointer">
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
            amount={basePlan.b4Val} percent={((basePlan.b4Val / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}
            returnRate={assumptions.b4.return} stdDev={assumptions.b4.stdDev}
            historicalReturn={assumptions.b4.historical}
            description={basePlan.b4Val > 0 ? "Income & dividends/yield allocation." : "No allocation — portfolio prioritized for spending needs."}
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
          <label className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMonteCarlo}
              onChange={(e) => onSetShowMonteCarlo(e.target.checked)}
              className="accent-blue-600"
            />
            <span className="text-xs font-bold text-slate-600">Monte Carlo</span>
          </label>
        </div>
      </div>

      {!showCashFlowTable ? (
        <>
          {showMonteCarlo && monteCarloData ? (() => {
            const mcChartData = (monteCarloData.data || []).map((mc, idx) => ({
              year: mc.year,
              p90: Math.round(mc.p90),
              median: Math.round(mc.median),
              p10: Math.round(mc.p10),
              total: projectionData[idx]?.total || 0,
              benchmark: projectionData[idx]?.benchmark || 0,
            }));
            return (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Success Rate:</span>
                    <span className={`font-bold text-lg ${monteCarloData.successRate >= 90 ? 'text-emerald-600' : monteCarloData.successRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {monteCarloData.successRate?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">Median Legacy:</span>
                    <span className="font-bold text-lg text-slate-800">${(monteCarloData.medianLegacy || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mcChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} />
                      <Tooltip
                        formatter={(val, name) => `$${Math.round(val).toLocaleString()}`}
                        labelFormatter={(l) => `Year ${l}`}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="p90" name="90th Percentile (Optimistic)" fill="#d1fae5" stroke="#10b981" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="median" name="50th Percentile (Median)" fill="#bfdbfe" stroke="#3b82f6" fillOpacity={0.5} />
                      <Area type="monotone" dataKey="p10" name="10th Percentile (Pessimistic)" fill="#fee2e2" stroke="#ef4444" fillOpacity={0.4} />
                      <Line type="monotone" dataKey="total" name="Deterministic Projection" stroke={COLORS.areaFill} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="benchmark" name="Benchmark 60/40" stroke={COLORS.benchmark} strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-3 bg-blue-50 text-xs text-blue-800 rounded border border-blue-100 flex items-start gap-2">
                  <Activity className="w-4 h-4 mt-0.5" />
                  <p>
                    <strong>Monte Carlo Simulation (1,000 iterations):</strong> Shows range of outcomes using randomized returns based on each bucket's expected return and standard deviation. <br />
                    <strong>Green Area:</strong> 90th percentile (best 10% of outcomes). <strong>Blue Area:</strong> Median outcome. <strong>Red Area:</strong> 10th percentile (worst 10%). <br />
                    <strong>Dashed Grey Line:</strong> Deterministic projection (fixed returns, no randomness).
                  </p>
                </div>
              </>
            );
          })() : (
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
          )}
        </>
      ) : (
        <div className="overflow-x-auto">
          {showMonteCarlo && monteCarloData?.scenarios && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Scenario:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setMcScenario('optimistic')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mcScenario === 'optimistic' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
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
          {(() => {
            const tableData = (showMonteCarlo && monteCarloData?.scenarios)
              ? (monteCarloData.scenarios[mcScenario] || [])
              : projectionData;
            return (
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
                  {tableData.map((row) => (
                    <tr key={row.year} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                      {clientInfo.isMarried && <td className="p-2 text-left text-slate-500">{Math.floor(row.partnerAge || 0)}</td>}
                      <td className="p-2 text-slate-500">${(row.startBalance || 0).toLocaleString()}</td>
                      <td className={`p-2 ${(row.growth || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(row.growth || 0) >= 0 ? `+$${(row.growth || 0).toLocaleString()}` : `($${Math.abs(row.growth || 0).toLocaleString()})`}</td>
                      <td className="p-2 text-purple-600">{(row.contribution || 0) > 0 ? `+$${row.contribution.toLocaleString()}` : '-'}</td>
                      <td className="p-2 text-blue-600" title={`SS: $${(row.ssIncomeDetail || 0).toLocaleString()} | Pension: $${(row.pensionIncomeDetail || 0).toLocaleString()}${row.employmentIncomeDetail ? ` | Employment: $${row.employmentIncomeDetail.toLocaleString()}` : ''}${row.otherIncomeDetail ? ` | Other: $${row.otherIncomeDetail.toLocaleString()}` : ''}`}>
                        +${(row.ssIncome || 0).toLocaleString()}
                        {(row.employmentIncomeDetail || 0) > 0 && <span className="text-teal-600 text-[10px] ml-0.5" title="Includes employment income">*</span>}
                      </td>
                      <td className="p-2 text-orange-600">-${(row.distribution || 0).toLocaleString()}</td>
                      {inputs.taxEnabled && (
                        <td
                          className="p-2 text-red-600 cursor-pointer hover:bg-red-50 hover:underline transition-colors"
                          title={`Federal: $${(row.federalTax || 0).toLocaleString()} | State: $${(row.stateTax || 0).toLocaleString()} | Eff: ${row.effectiveRate || '0'}% — Click for detail`}
                          onClick={() => setSelectedTaxRow(row)}
                        >
                          -${(row.totalTax || 0).toLocaleString()}
                        </td>
                      )}
                      <td className="p-2 font-medium text-slate-800">${(row.expenses || 0).toLocaleString()}</td>
                      {inputs.taxEnabled && (
                        <td className="p-2 text-slate-600">${Math.max(0, (row.expenses || 0) - (row.totalTax || 0)).toLocaleString()}</td>
                      )}
                      <td className={`p-2 font-bold ${(row.total || 0) > 0 ? 'text-slate-900' : 'text-red-500'}`}>${Math.round(row.total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
          {inputs.taxEnabled && (
            <div className="mt-3 p-2 bg-amber-50 text-xs text-amber-800 rounded border border-amber-100">
              <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} status, {inputs.traditionalPercent}% Trad / {inputs.rothPercent}% Roth / {inputs.nqPercent}% NQ, {inputs.stateCode && STATE_TAX_DATA[inputs.stateCode] ? `${STATE_TAX_DATA[inputs.stateCode].name} (${STATE_TAX_DATA[inputs.stateCode].rate}%${STATE_TAX_DATA[inputs.stateCode].ssTaxable ? ', taxes SS' : ', SS exempt'})` : `${inputs.stateRate}% state rate`}.{Object.keys(inputs.withdrawalOverrides || {}).length > 0 ? ` ${Object.keys(inputs.withdrawalOverrides).length} custom year override(s) applied.` : ''} Hover over tax amounts for breakdown. Click for detail.
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
                        <td className="py-1 pl-8 text-slate-400 text-[11px]">Realized Cap Gains (LTCG)</td>
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

const MonteCarloTab = ({ monteCarloData, rebalanceFreq, onSetRebalanceFreq, assumptions, vaEnabled, vaInputs, onToggleVa, onVaInputChange, vaMonteCarloData, inputs, basePlan, vaAdjustedBasePlan }) => {
  const [scenario, setScenario] = useState('median');
  const simYears = monteCarloData?.data?.length || 30;
  const startAge = basePlan?.simulationStartAge || 65;
  const finalProjectionAge = startAge + simYears;

  const vaAllocationAmount = vaInputs && vaEnabled
    ? (vaInputs.allocationType === 'percentage'
        ? inputs.totalPortfolio * (vaInputs.allocationPercent / 100)
        : Math.min(vaInputs.allocationFixed, inputs.totalPortfolio))
    : 0;

  const annualGuaranteedIncome = vaEnabled && vaInputs
    ? vaAllocationAmount * (vaInputs.withdrawalRate / 100)
    : 0;

  const fmt = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${Math.round(val).toLocaleString()}`;
  const fmtPct = (val) => `${(val * 100).toFixed(1)}%`;

  const bucketLabels = [
    { key: 'b1', rKey: 'r1', label: 'B1', name: 'Short Term', color: COLORS.shortTerm },
    { key: 'b2', rKey: 'r2', label: 'B2', name: 'Mid Term', color: COLORS.midTerm },
    { key: 'b3', rKey: 'r3', label: 'B3', name: 'Balanced', color: COLORS.hedged },
    { key: 'b4', rKey: 'r4', label: 'B4', name: 'Income & Growth', color: COLORS.income },
    { key: 'b5', rKey: 'r5', label: 'B5', name: 'Long Term', color: COLORS.longTerm },
  ];

  const scenarioKey = scenario === 'optimistic' ? 'optimistic' : scenario === 'conservative' ? 'conservative' : 'median';
  const scenarioData = monteCarloData?.scenarios?.[scenarioKey] || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      {/* Controls Row */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
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
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <label className="text-[12px] font-bold text-slate-500 uppercase block mb-1">Scenario View</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="bg-white border text-xs font-bold rounded px-2 py-1 w-full"
            >
              <option value="optimistic">Optimistic (90th Percentile)</option>
              <option value="median">Median (50th Percentile)</option>
              <option value="conservative">Conservative (10th Percentile)</option>
            </select>
          </div>
          {/* VA GIB Toggle */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vaEnabled}
                onChange={(e) => onToggleVa(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-xs font-bold text-slate-600">VA GIB Override</span>
            </label>
            {vaEnabled && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Active</span>
            )}
          </div>
        </div>
      </Card>

      {/* VA GIB Inputs (collapsed into its own card when enabled) */}
      {vaEnabled && (
        <Card className="p-4 print:hidden border-l-4 border-purple-500">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">Allocation Type:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => onVaInputChange('allocationType', 'percentage')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'percentage' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Percentage</button>
                <button
                  onClick={() => onVaInputChange('allocationType', 'fixed')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    vaInputs.allocationType === 'fixed' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Fixed $</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {vaInputs.allocationType === 'percentage' ? 'Allocation %' : 'Allocation $'}
                </label>
                <div className="relative">
                  {vaInputs.allocationType === 'fixed' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>}
                  {vaInputs.allocationType === 'percentage' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>}
                  <input type="number"
                    value={Number(vaInputs.allocationType === 'percentage' ? vaInputs.allocationPercent : vaInputs.allocationFixed)}
                    onChange={(e) => onVaInputChange(vaInputs.allocationType === 'percentage' ? 'allocationPercent' : 'allocationFixed', parseFloat(e.target.value) || 0)}
                    className={`w-full py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 ${vaInputs.allocationType === 'percentage' ? 'pl-2 pr-6' : 'pl-6 pr-2'}`}
                    min="0" max={vaInputs.allocationType === 'percentage' ? 100 : inputs.totalPortfolio}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Income Start Age</label>
                <input type="number" value={vaInputs.incomeStartAge || 65}
                  onChange={(e) => onVaInputChange('incomeStartAge', parseInt(e.target.value) || 65)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" min="55" max="85"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Withdrawal Rate</label>
                <div className="relative">
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  <input type="number" step="0.1" value={Number(vaInputs.withdrawalRate)}
                    onChange={(e) => onVaInputChange('withdrawalRate', parseFloat(e.target.value) || 0)}
                    className="w-full pl-2 pr-6 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" min="0" max="10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">High Water Mark</label>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={vaInputs.highWaterMark}
                    onChange={(e) => onVaInputChange('highWaterMark', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-600">Step-up benefit</span>
                </label>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-xs font-medium text-purple-700 mb-1">VA Summary</div>
                <div className="text-sm">
                  <div><strong>${vaAllocationAmount.toLocaleString()}</strong> allocated</div>
                  <div className="text-purple-700"><strong>${Math.round(annualGuaranteedIncome).toLocaleString()}</strong>/yr @ age {vaInputs.incomeStartAge || 65}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Success Rate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox
          label={vaEnabled ? "Success Rate (Without VA)" : "Success Rate"}
          value={`${monteCarloData.successRate.toFixed(1)}%`}
          subtext="Iterations ending > $0"
          icon={Activity}
          colorClass={monteCarloData.successRate >= 85 ? "bg-emerald-500" : monteCarloData.successRate >= 65 ? "bg-orange-500" : "bg-red-500"}
        />
        {vaEnabled && vaMonteCarloData && (
          <StatBox
            label="Success Rate (With VA GIB)"
            value={`${vaMonteCarloData.successRate.toFixed(1)}%`}
            subtext="With guaranteed income"
            icon={Shield}
            colorClass={vaMonteCarloData.successRate >= 85 ? "bg-purple-500" : vaMonteCarloData.successRate >= 65 ? "bg-orange-500" : "bg-red-500"}
          />
        )}
        <div className={`${vaEnabled ? '' : 'md:col-span-2'} bg-indigo-50 p-4 rounded-lg text-sm text-indigo-900 flex items-center`}>
          <p>
            <strong>Simulation:</strong> 1,000 iterations, Gaussian distribution.
            Strategy: <strong>{rebalanceFreq === 0 ? 'Sequential Depletion' : `Bucket Refill Every ${rebalanceFreq} Year${rebalanceFreq > 1 ? 's' : ''}`}</strong>.
            Viewing: <strong>{scenario === 'optimistic' ? '90th Percentile' : scenario === 'conservative' ? '10th Percentile' : 'Median'}</strong>.
          </p>
        </div>
      </div>

      {/* Year-by-Year Returns by Bucket — Representative Iteration */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4">
          Returns by Bucket — {scenario === 'optimistic' ? 'Optimistic (90th %)' : scenario === 'conservative' ? 'Conservative (10th %)' : 'Median (50th %)'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Year</th>
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Age</th>
                {bucketLabels.map(b => (
                  <th key={b.key} className="text-right p-2 font-bold" style={{ color: b.color }}>{b.label} - {b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarioData.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="p-2 font-medium text-slate-700 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{idx + 1}</td>
                  <td className="p-2 text-slate-600 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{startAge + idx + 1}</td>
                  {bucketLabels.map(b => {
                    const val = row[b.rKey] || 0;
                    return (
                      <td key={b.key} className={`p-2 text-right font-mono ${val >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtPct(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Year-by-Year Bucket Balances — Representative Iteration */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4">
          Bucket Balances by Year — {scenario === 'optimistic' ? 'Optimistic (90th %)' : scenario === 'conservative' ? 'Conservative (10th %)' : 'Median (50th %)'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Year</th>
                <th className="text-left p-2 font-bold text-slate-600 sticky left-0 bg-white">Age</th>
                {bucketLabels.map(b => (
                  <th key={b.key} className="text-right p-2 font-bold" style={{ color: b.color }}>{b.label} - {b.name}</th>
                ))}
                <th className="text-right p-2 font-bold text-slate-800">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenarioData.map((row, idx) => {
                const bucketTotal = bucketLabels.reduce((sum, b) => sum + (row[b.key] || 0), 0);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-2 font-medium text-slate-700 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{idx + 1}</td>
                    <td className="p-2 text-slate-600 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? 'rgb(248,250,252)' : 'white' }}>{startAge + idx + 1}</td>
                    {bucketLabels.map(b => (
                      <td key={b.key} className="p-2 text-right font-mono text-slate-700">
                        {fmt(row[b.key] || 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{fmt(bucketTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Monte Carlo Range Chart */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Portfolio Range (Through Age {finalProjectionAge})</h3>
        <div className="h-80 w-full">
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

      {/* VA Impact Summary when enabled */}
      {vaEnabled && vaMonteCarloData && (
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
              <div className="text-2xl font-bold text-purple-600">${vaAllocationAmount.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Annual Guaranteed</div>
              <div className="text-2xl font-bold text-purple-600">${Math.round(annualGuaranteedIncome).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-1">Monthly Guaranteed</div>
              <div className="text-2xl font-bold text-purple-600">${Math.round(annualGuaranteedIncome / 12).toLocaleString()}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

const SSOptimizationTab = ({ clientInfo, inputs, assumptions, basePlan, rebalanceFreq, rebalanceTargets, useManualAllocation, manualAllocations, ssAnalysis, ssBreakevenResults, clientOutcomes, clientWinner, partnerOutcomes, partnerWinner, targetMaxPortfolioAge, onSetTargetMaxPortfolioAge, onUpdateSSStartAge, onUpdatePartnerSSStartAge, onInputChange, matrixData, isRunningMatrix, onSetMatrixData, onSetIsRunningMatrix }) => {
  const [showBenefitDetails, setShowBenefitDetails] = useState(false);

  const runMatrixOptimization = () => {
    onSetIsRunningMatrix(true);
    setTimeout(() => {
      const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];
      const matrix = [];
      let winner = { clientAge: 67, partnerAge: 67, balance: -1 };

      for (const cAge of ages) {
        for (const pAge of ages) {
          const testInputs = { ...inputs, ssStartAge: cAge, partnerSSStartAge: pAge };
          let testBasePlan = calculateBasePlan(testInputs, assumptions, clientInfo);
          if (useManualAllocation) {
            testBasePlan = { ...testBasePlan, b1Val: manualAllocations.b1, b2Val: manualAllocations.b2, b3Val: manualAllocations.b3, b4Val: manualAllocations.b4, b5Val: manualAllocations.b5 };
          }
          const projection = runSimulation(testBasePlan, assumptions, testInputs, rebalanceFreq, false, null, rebalanceTargets);
          const row = projection.find(p => p.age >= targetMaxPortfolioAge) || projection[projection.length - 1];
          const balance = Math.max(0, row?.total ?? 0);

          matrix.push({ clientAge: cAge, partnerAge: pAge, balance });
          if (balance > winner.balance) {
            winner = { clientAge: cAge, partnerAge: pAge, balance };
          }
        }
      }

      onSetMatrixData({ matrix, winner, ages });
      onSetIsRunningMatrix(false);
    }, 50);
  };

  const applyMatrixWinner = () => {
    if (matrixData?.winner) {
      onUpdateSSStartAge(matrixData.winner.clientAge);
      onUpdatePartnerSSStartAge(matrixData.winner.partnerAge);
    }
  };
  return (
  <div className="space-y-6 animate-in fade-in duration-300 mt-6">
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg text-slate-800">Optimization Analysis</h3>
          <p className="text-sm text-slate-500">Determine the optimal claiming strategy based on portfolio impact.</p>
          <p className="text-xs text-slate-400 mt-1">
            Data Source: <span className="font-bold text-slate-600">Deterministic Projection</span> (from Portfolio Sustainability table)
          </p>
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

      {/* SS Benefit Calculation Details (Collapsible) */}
      {(() => {
        const FRA = 67;
        const fmt = (v) => `$${Math.round(v).toLocaleString()}`;
        const pct = (v) => `${(v * 100).toFixed(1)}%`;

        // Build details for each person
        const people = [];

        // Client — use implied PIA when currently receiving
        const cAge = inputs.ssStartAge;
        const cInputPIA = inputs.ssPIA;
        const cReceiving = inputs.ssCurrentlyReceiving;
        const cPIA = cReceiving ? getImpliedPIA(cInputPIA, cAge) : cInputPIA;
        const cOwn = cReceiving ? cInputPIA : getAdjustedSS(cPIA, cAge);
        const cYearsEarly = Math.max(0, FRA - cAge);
        const cYearsLate = Math.max(0, cAge - FRA);
        const cReduction = cPIA > 0 && !cReceiving ? (1 - cOwn / cPIA) : 0;
        const cBonus = cPIA > 0 && !cReceiving && cAge > FRA ? (cOwn / cPIA - 1) : 0;

        // Spousal excess: always uses implied PIA for the excess computation
        const pPartnerPIA = clientInfo.isMarried
          ? (inputs.partnerSSCurrentlyReceiving ? getImpliedPIA(inputs.partnerSSPIA, inputs.partnerSSStartAge) : inputs.partnerSSPIA)
          : 0;
        const cSpousalRaw = clientInfo.isMarried ? pPartnerPIA * 0.5 : 0;
        const cSpousalExcess = clientInfo.isMarried ? Math.max(0, cSpousalRaw - cPIA) : 0;
        const dispAgeDiff = clientInfo.currentAge - (clientInfo.partnerAge || clientInfo.currentAge);
        const cDispSpousalAge = clientInfo.isMarried
          ? Math.min(FRA, Math.max(cAge, inputs.partnerSSStartAge + dispAgeDiff))
          : cAge;
        const cAfterDeemed = clientInfo.isMarried
          ? applyDeemedFiling(cOwn, pPartnerPIA, true, cAge, cPIA, cDispSpousalAge)
          : cOwn;
        const cSpousalApplies = cAfterDeemed > cOwn;

        people.push({
          label: clientInfo.name || 'Client',
          pia: cPIA,
          inputPIA: cInputPIA,
          claimAge: cAge,
          receiving: cReceiving,
          ownBenefit: cOwn,
          yearsEarly: cYearsEarly,
          yearsLate: cYearsLate,
          reductionPct: cReduction,
          bonusPct: cBonus,
          spousalRaw: cSpousalRaw,
          spousalExcess: cSpousalExcess,
          reducedExcess: cAfterDeemed - cOwn,
          afterDeemed: cAfterDeemed,
          spousalApplies: cSpousalApplies,
          isMarried: clientInfo.isMarried
        });

        // Partner
        if (clientInfo.isMarried) {
          const pAge = inputs.partnerSSStartAge;
          const pInputPIA = inputs.partnerSSPIA;
          const pReceiving = inputs.partnerSSCurrentlyReceiving;
          const pPIA = pReceiving ? getImpliedPIA(pInputPIA, pAge) : pInputPIA;
          const pOwn = pReceiving ? pInputPIA : getAdjustedSS(pPIA, pAge);
          const pYearsEarly = Math.max(0, FRA - pAge);
          const pYearsLate = Math.max(0, pAge - FRA);
          const pReduction = pPIA > 0 && !pReceiving ? (1 - pOwn / pPIA) : 0;
          const pBonus = pPIA > 0 && !pReceiving && pAge > FRA ? (pOwn / pPIA - 1) : 0;

          const pSpousalRaw = cPIA * 0.5;
          const pSpousalExcess = Math.max(0, pSpousalRaw - pPIA);
          const pDispSpousalAge = Math.min(FRA, Math.max(pAge, cAge - dispAgeDiff));
          const pAfterDeemed = applyDeemedFiling(pOwn, cPIA, true, pAge, pPIA, pDispSpousalAge);
          const pSpousalApplies = pAfterDeemed > pOwn;

          people.push({
            label: clientInfo.partnerName || 'Partner',
            pia: pPIA,
            inputPIA: pInputPIA,
            claimAge: pAge,
            receiving: pReceiving,
            ownBenefit: pOwn,
            yearsEarly: pYearsEarly,
            yearsLate: pYearsLate,
            reductionPct: pReduction,
            bonusPct: pBonus,
            spousalRaw: pSpousalRaw,
            spousalExcess: pSpousalExcess,
            reducedExcess: pAfterDeemed - pOwn,
            afterDeemed: pAfterDeemed,
            spousalApplies: pSpousalApplies,
            isMarried: true
          });
        }

        const totalMonthly = people.reduce((sum, p) => sum + p.afterDeemed, 0);

        return (
          <div className="bg-slate-50 rounded-xl border border-slate-200 mb-8">
            <button
              onClick={() => setShowBenefitDetails(!showBenefitDetails)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100 rounded-xl transition-colors"
            >
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Benefit Calculation Details
              </h4>
              <div className="flex items-center gap-3">
                {clientInfo.isMarried && (
                  <span className="text-sm font-bold text-emerald-700">{fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
                )}
                <span className={`text-slate-400 transition-transform ${showBenefitDetails ? 'rotate-180' : ''}`}>&#9660;</span>
              </div>
            </button>
            {showBenefitDetails && (
              <div className="px-5 pb-5">
                <div className={`grid grid-cols-1 ${clientInfo.isMarried ? 'md:grid-cols-2' : ''} gap-6`}>
                  {people.map((p) => (
                    <div key={p.label} className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200 pb-1">{p.label}</p>
                      <table className="w-full text-xs">
                        <tbody>
                          <tr>
                            <td className="py-0.5 text-slate-500">PIA (benefit at FRA 67)</td>
                            <td className="py-0.5 text-right font-bold text-slate-700">
                              {p.receiving
                                ? <span>{fmt(p.pia)}/mo <span className="text-amber-600">(implied from {fmt(p.inputPIA)} @ age {p.claimAge})</span></span>
                                : `${fmt(p.pia)}/mo`}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">Claiming age</td>
                            <td className="py-0.5 text-right font-bold text-slate-700">
                              {p.claimAge}
                              {p.yearsEarly > 0 && <span className="text-red-500 ml-1">({p.yearsEarly}yr early)</span>}
                              {p.yearsLate > 0 && <span className="text-emerald-600 ml-1">({p.yearsLate}yr delayed)</span>}
                            </td>
                          </tr>
                          {!p.receiving && p.reductionPct > 0 && (
                            <tr>
                              <td className="py-0.5 text-red-500">Early claiming reduction</td>
                              <td className="py-0.5 text-right font-bold text-red-500">-{pct(p.reductionPct)}</td>
                            </tr>
                          )}
                          {!p.receiving && p.bonusPct > 0 && (
                            <tr>
                              <td className="py-0.5 text-emerald-600">Delayed retirement credits</td>
                              <td className="py-0.5 text-right font-bold text-emerald-600">+{pct(p.bonusPct)}</td>
                            </tr>
                          )}
                          <tr className="border-t border-slate-200">
                            <td className="py-0.5 text-slate-500">Own benefit{p.receiving ? ' (current)' : ''}</td>
                            <td className="py-0.5 text-right font-bold text-slate-700">{fmt(p.ownBenefit)}/mo</td>
                          </tr>
                          {p.isMarried && (
                            <>
                              <tr>
                                <td className="py-0.5 text-slate-500">50% of spouse's PIA</td>
                                <td className="py-0.5 text-right text-slate-500">{fmt(p.spousalRaw)}/mo</td>
                              </tr>
                              <tr>
                                <td className="py-0.5 text-slate-500">Spousal excess (50% spouse PIA - own PIA)</td>
                                <td className="py-0.5 text-right text-slate-500">
                                  {p.spousalExcess > 0 ? `${fmt(p.spousalExcess)}/mo` : 'None (own PIA higher)'}
                                </td>
                              </tr>
                              {p.spousalApplies && (
                                <tr>
                                  <td className="py-0.5 text-blue-600">Reduced spousal excess{p.yearsEarly > 0 ? ` (${pct(p.spousalExcess > 0 ? 1 - p.reducedExcess / p.spousalExcess : 0)} reduction)` : ''}</td>
                                  <td className="py-0.5 text-right font-bold text-blue-600">+{fmt(p.reducedExcess)}/mo</td>
                                </tr>
                              )}
                              <tr>
                                <td className="py-0.5 text-slate-500">After deemed filing</td>
                                <td className="py-0.5 text-right font-bold text-slate-700">
                                  {fmt(p.afterDeemed)}/mo
                                  {p.spousalApplies
                                    ? <span className="text-blue-600 ml-1">(own + spousal excess)</span>
                                    : <span className="text-slate-400 ml-1">(own only)</span>}
                                </td>
                              </tr>
                            </>
                          )}
                          <tr className="border-t border-slate-300 bg-white">
                            <td className="py-1 text-slate-700 font-bold">Monthly benefit</td>
                            <td className="py-1 text-right font-bold text-emerald-700 text-sm">{fmt(p.afterDeemed)}/mo</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">Annual benefit</td>
                            <td className="py-0.5 text-right font-bold text-slate-700">{fmt(p.afterDeemed * 12)}/yr</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
                {clientInfo.isMarried && (
                  <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Combined Household SS</span>
                    <span className="text-sm font-bold text-emerald-700">{fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Combined Claiming Age Matrix */}
      {clientInfo.isMarried ? (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-slate-800">Claiming Age Optimization Matrix</h4>
              <p className="text-xs text-slate-500 mt-1">
                81 scenarios — Primary claiming age (columns) vs. Spouse claiming age (rows). Portfolio balance at age {targetMaxPortfolioAge}.
              </p>
            </div>
            <button
              onClick={runMatrixOptimization}
              disabled={isRunningMatrix}
              className="px-5 py-2.5 bg-black hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-lg transition-all flex items-center gap-2"
            >
              {isRunningMatrix ? (
                <><Loader className="w-4 h-4 animate-spin" /> Running...</>
              ) : (
                <><Calculator className="w-4 h-4" /> {matrixData ? 'Re-Run' : 'Run'} Optimization</>
              )}
            </button>
          </div>

          {matrixData ? (
            <>
              {/* Winner callout */}
              <div className="bg-black text-white p-4 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold">
                      Optimal: Primary Age <span className="text-emerald-400 text-lg">{matrixData.winner.clientAge}</span> + Spouse Age <span className="text-emerald-400 text-lg">{matrixData.winner.partnerAge}</span>
                    </p>
                    <p className="text-gray-400 text-xs">
                      Portfolio at {targetMaxPortfolioAge}: <strong className="text-emerald-400">${Math.round(matrixData.winner.balance).toLocaleString()}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={applyMatrixWinner}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Apply Optimal
                </button>
              </div>

              {/* Matrix grid */}
              {(() => {
                const allBalances = matrixData.matrix.map(m => m.balance);
                const minBal = Math.min(...allBalances);
                const maxBal = Math.max(...allBalances);
                const range = maxBal - minBal || 1;
                return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 sticky left-0 z-10">
                        <div className="flex flex-col items-center">
                          <span>Spouse</span>
                          <span className="text-slate-400">\</span>
                          <span>Primary</span>
                        </div>
                      </th>
                      {matrixData.ages.map(age => (
                        <th key={age} className="p-1.5 bg-slate-100 border border-slate-200 text-center font-bold text-slate-700 min-w-[80px]">
                          {age}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.ages.map(partnerAge => (
                      <tr key={partnerAge}>
                        <td className="p-1.5 bg-slate-100 border border-slate-200 text-center font-bold text-slate-700 sticky left-0 z-10">
                          {partnerAge}
                        </td>
                        {matrixData.ages.map(clientAge => {
                          const cell = matrixData.matrix.find(m => m.clientAge === clientAge && m.partnerAge === partnerAge);
                          const balance = cell?.balance || 0;
                          const isOptimal = matrixData.winner.clientAge === clientAge && matrixData.winner.partnerAge === partnerAge;
                          const isSelected = inputs.ssStartAge === clientAge && inputs.partnerSSStartAge === partnerAge;
                          const pct = (balance - minBal) / range;

                          // Heat map: red (low) -> yellow (mid) -> green (high)
                          let bgColor;
                          if (isOptimal) {
                            bgColor = 'bg-emerald-200 ring-2 ring-emerald-600';
                          } else if (isSelected) {
                            bgColor = 'bg-blue-100 ring-2 ring-blue-500';
                          } else if (pct >= 0.85) {
                            bgColor = 'bg-emerald-100';
                          } else if (pct >= 0.6) {
                            bgColor = 'bg-emerald-50';
                          } else if (pct >= 0.35) {
                            bgColor = 'bg-yellow-50';
                          } else if (pct >= 0.15) {
                            bgColor = 'bg-orange-50';
                          } else {
                            bgColor = 'bg-red-50';
                          }

                          return (
                            <td
                              key={clientAge}
                              onClick={() => {
                                onUpdateSSStartAge(clientAge);
                                onUpdatePartnerSSStartAge(partnerAge);
                              }}
                              className={`p-1.5 border border-slate-200 text-center cursor-pointer hover:ring-2 hover:ring-slate-400 transition-all ${bgColor}`}
                            >
                              <p className={`font-bold text-[11px] ${isOptimal ? 'text-emerald-800' : isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                                ${(balance / 1000000).toFixed(2)}M
                              </p>
                              {isOptimal && <p className="text-[8px] font-bold text-emerald-700 uppercase">Best</p>}
                              {isSelected && !isOptimal && <p className="text-[8px] font-bold text-blue-600 uppercase">Selected</p>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                );
              })()}
              <p className="text-[10px] text-slate-400 mt-2 text-center">Click any cell to apply that claiming age combination. Values show portfolio balance at age {targetMaxPortfolioAge}.</p>
            </>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
              <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Click "Run Optimization" to calculate all 81 claiming age combinations</p>
              <p className="text-xs text-slate-400 mt-1">Primary ages 62-70 vs. Spouse ages 62-70</p>
            </div>
          )}
        </div>
      ) : (
        /* Single client — keep original linear display */
        <div className="mb-12">
          <div className="bg-black text-white p-6 rounded-xl mb-6 flex items-center gap-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
            <div>
              <h4 className="text-lg font-bold">Claiming Recommendation</h4>
              <p className="text-gray-400 text-sm mt-1">
                Claim at Age <strong className="text-emerald-400 text-lg">{clientWinner.age}</strong> to maximize portfolio balance at age {targetMaxPortfolioAge}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-9 gap-3 mb-8">
            {clientOutcomes.map((outcome) => {
              const isWinner = outcome.age === clientWinner.age;
              const isSelected = outcome.age === inputs.ssStartAge;
              return (
              <div
                onClick={() => onUpdateSSStartAge(outcome.age)}
                key={outcome.age}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all relative ${isWinner ? 'border-emerald-500 bg-emerald-50' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-emerald-300'}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  {isSelected && (
                    <span className="bg-blue-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">Selected</span>
                  )}
                  {isWinner && !isSelected && (
                    <span className="bg-emerald-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">Best</span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500">Age {outcome.age}</p>
                <p className={`text-sm font-bold ${isWinner ? 'text-emerald-700' : isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                  ${Math.round(outcome.balance).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400">@ Age {targetMaxPortfolioAge}</p>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Wealth-Based Breakeven Analysis */}
      <div className="border-t pt-8">
        <h4 className="font-bold text-slate-800 mb-2">True Break-Even Analysis</h4>
        <p className="text-xs text-slate-500 mb-4">Compares Total Net Wealth (portfolio balance) between claiming early vs. delaying, accounting for portfolio opportunity cost and IRA tax drag during bridge years.</p>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* NQ/IRA Funding Mix */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Bridge Funding: NQ {inputs.ssBridgeNqPercent}% / IRA {100 - inputs.ssBridgeNqPercent}%
            </label>
            <input
              type="range" min="0" max="100" step="10"
              value={inputs.ssBridgeNqPercent}
              onChange={(e) => onInputChange({ target: { name: 'ssBridgeNqPercent', value: parseInt(e.target.value), type: 'number' } })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>100% IRA</span><span>100% NQ</span>
            </div>
          </div>

          {/* Marginal Tax Bracket */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Marginal Tax Bracket</label>
            <select
              value={inputs.ssMarginalTaxRate}
              onChange={(e) => onInputChange({ target: { name: 'ssMarginalTaxRate', value: parseInt(e.target.value), type: 'number' } })}
              className="w-full text-sm p-1.5 rounded border border-slate-300 bg-white text-slate-800"
            >
              <option value={10}>10%</option>
              <option value={12}>12%</option>
              <option value={22}>22%</option>
              <option value={24}>24%</option>
              <option value={32}>32%</option>
              <option value={35}>35%</option>
              <option value={37}>37%</option>
            </select>
          </div>
        </div>

        {/* Break-Even Age Callouts */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key: 'vs67', label: '62 vs 67', delayAge: 67 },
            { key: 'vs70', label: '62 vs 70', delayAge: 70 }
          ].map(({ key, label, delayAge }) => {
            const be = ssBreakevenResults?.[key]?.breakevenAge;
            return (
              <div key={key} className={`p-3 rounded-lg flex items-center gap-3 ${be === null ? 'bg-red-50 border border-red-200' : be <= 80 ? 'bg-emerald-50 border border-emerald-200' : be <= 85 ? 'bg-yellow-50 border border-yellow-200' : 'bg-orange-50 border border-orange-200'}`}>
                <div className="text-center min-w-[60px]">
                  <p className={`text-xl font-bold ${be === null ? 'text-red-600' : be <= 80 ? 'text-emerald-700' : be <= 85 ? 'text-yellow-700' : 'text-orange-700'}`}>
                    {be !== null ? be.toFixed(1) : 'N/A'}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-slate-500">{label}</p>
                </div>
                <p className="text-[11px] text-slate-600">
                  {be !== null
                    ? `Delay to ${delayAge} breaks even at ${be.toFixed(1)}.${be > 85 ? ' Late break-even.' : ''}`
                    : `Delay to ${delayAge} does not break even by 100.`}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 mb-6">
          Portfolio growth: {inputs.ssReinvestRate || 4.5}% | COLA: {inputs.inflationRate}% | Bridge funding: {inputs.ssBridgeNqPercent}% NQ / {100 - inputs.ssBridgeNqPercent}% IRA | Tax bracket: {inputs.ssMarginalTaxRate}%
        </p>

        {/* Reference Matrices */}
        {(() => {
          const allBrackets = [10, 12, 22, 24, 32, 35, 37];
          return ['matrix67', 'matrix70'].map(matrixKey => {
            const matrix = ssBreakevenResults?.[matrixKey];
            if (!matrix) return null;
            const label = matrixKey === 'matrix67' ? '62 vs 67' : '62 vs 70';
            return (
              <div key={matrixKey} className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
                <h5 className="text-xs font-bold text-slate-600 uppercase mb-2">Break-Even Matrix ({label})</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="text-left py-1 font-bold text-slate-500 whitespace-nowrap pr-2">NQ / IRA</th>
                        {allBrackets.map(tax => (
                          <th key={tax} className="text-center py-1 font-bold text-slate-500 whitespace-nowrap px-1">{tax}%</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map(row => {
                        const isActive = row.nqPercent === inputs.ssBridgeNqPercent;
                        return (
                          <tr key={row.nqPercent} className={`border-b border-slate-100 ${isActive ? 'bg-yellow-50 font-bold' : ''}`}>
                            <td className="py-1 text-slate-600 whitespace-nowrap pr-2">{row.nqPercent}% / {row.iraPercent}%</td>
                            {allBrackets.map(tax => {
                              const isCurrent = isActive && tax === inputs.ssMarginalTaxRate;
                              const val = row.breakevens[tax];
                              return (
                                <td key={tax} className={`py-1 text-center px-1 ${isCurrent ? 'bg-yellow-200 rounded font-bold text-slate-800' : 'text-slate-600'}`}>
                                  {val !== null ? val.toFixed(1) : 'N/A'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          });
        })()}
        <p className="text-[10px] text-slate-400">
          Matrices assume {inputs.ssReinvestRate || 4.5}% growth, {inputs.inflationRate}% COLA. Higher IRA % and tax bracket push the break-even age later.
        </p>
      </div>
    </Card>
  </div>
  );
};

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
                  <p className="text-xs text-slate-500">{basePlan.b4Val > 0 ? 'Income & dividends/yield' : 'No allocation'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b4Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b4Val / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}% • {assumptions.b4.return}% return</p>
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
  const optimizerFinalAge = projectionData[projectionData.length - 1]?.age || inputs.expectedDeathAge || 95;
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

  // Use actual projection data for Current Model so it matches the Portfolio Sustainability table
  const currentModelLegacy = monteCarloData?.medianLegacy || projectionData[projectionData.length - 1]?.total || 0;
  const currentModelSuccessRate = monteCarloData?.successRate || 0;

  // Build strategies array - runOptimizedSimulation returns { successRate, medianLegacy, allocation }
  const strategies = [
    {
      key: 'strategy3',
      name: 'Current Model',
      successRate: currentModelSuccessRate,
      medianLegacy: currentModelLegacy,
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
            <span className={`font-bold text-lg ${successRate >= 85 ? 'text-emerald-600' : successRate >= 65 ? 'text-orange-600' : 'text-red-600'}`}>
              {successRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${successRate >= 85 ? 'bg-emerald-500' : successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, successRate)}%` }}
            />
          </div>
        </div>

        {/* Projected Legacy */}
        <div className="mb-4 p-3 bg-slate-100 rounded-lg">
          <p className="text-xs text-slate-500">Projected Legacy (Age {optimizerFinalAge})</p>
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

// ============================================
// Tax Map Tab - Taxable income vs bracket thresholds over time
// ============================================
const TAX_BRACKET_BASE_YEAR = 2026;
const BRACKET_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const BRACKET_LABELS = ['12%', '22%', '24%', '32%', '35%'];

const TaxMapTab = ({ projectionData, inputs, clientInfo, basePlan }) => {
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
              <p className="text-2xl font-bold text-emerald-700">{insights.preRMDYears.length} years</p>
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
              <p className="text-2xl font-bold text-amber-700">{fmt(insights.rothOpportunity22)}</p>
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
                const bracketColor = bracketNum <= 12 ? 'bg-emerald-100 text-emerald-800'
                  : bracketNum <= 22 ? 'bg-amber-100 text-amber-800'
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
                    <td className="p-2 text-right text-emerald-600">{fmt(row.headroom)}</td>
                    <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                    <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                    <td className="p-2 text-right text-amber-700">{row.effectiveRate}%</td>
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

// ============================================
// Liquidation Strategy Tab
// ============================================
const LiquidationTab = ({ liquidationData, inputs, onInputChange, onAccountSplitChange }) => {
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;

  if (!inputs.taxEnabled) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Enable Tax Impact Analysis in Inputs to use the Liquidation Optimizer.</p>
        </div>
      </Card>
    );
  }

  if (!liquidationData) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          <Loader className="w-8 h-8 mx-auto mb-3 text-slate-300 animate-spin" />
          <p className="font-medium">Computing optimized liquidation strategy...</p>
        </div>
      </Card>
    );
  }

  const { summary, optimizedProjection, currentProjection, yearDetails, optimizedSplit, topStrategies, isCurrentOptimal } = liquidationData;

  // Build comparison chart data
  const comparisonData = currentProjection.map((curr, idx) => {
    const opt = optimizedProjection[idx];
    return { age: curr.age, currentTax: curr.totalTax || 0, optimizedTax: opt?.totalTax || 0,
      savings: (curr.totalTax || 0) - (opt?.totalTax || 0), currentBalance: curr.total || 0, optimizedBalance: opt?.total || 0 };
  });
  let cumSavings = 0;
  comparisonData.forEach(d => { cumSavings += d.savings; d.cumulativeSavings = cumSavings; });

  const handleApply = () => {
    if (inputs.accounts && inputs.accounts.length > 0) return; // Can't override when accounts drive percentages
    onAccountSplitChange('traditionalPercent', optimizedSplit.tradPct);
    // The handler auto-distributes the other two, but we need exact values
    // So set all three via onInputChange
    onInputChange({ target: { name: 'traditionalPercent', value: optimizedSplit.tradPct, type: 'number' } });
    onInputChange({ target: { name: 'rothPercent', value: optimizedSplit.rothPct, type: 'number' } });
    onInputChange({ target: { name: 'nqPercent', value: optimizedSplit.nqPct, type: 'number' } });
  };

  return (
    <div className="space-y-6">
      {/* Recommended Split */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" /> Optimal Distribution Split
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Tested {topStrategies.length > 0 ? '441' : '0'} static allocation splits to find the one that maximizes after-tax legacy for heirs.
          {isCurrentOptimal && <span className="text-emerald-600 font-medium ml-1">Your current split is already optimal.</span>}
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-3">Current Split: {summary.currentSplit.tradPct}% Trad / {summary.currentSplit.rothPct}% Roth / {summary.currentSplit.nqPct}% NQ</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Lifetime Taxes</span><span className="font-medium text-red-600">{fmt(summary.currentLifetimeTax)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Heir Tax on Trad</span><span className="font-medium text-red-500">{fmt(summary.currentTotalTaxBurden - summary.currentLifetimeTax)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total Family Tax</span><span className="text-red-700">{fmt(summary.currentTotalTaxBurden)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs space-y-1">
              <div className="flex gap-3">
                <span className="text-orange-600">Trad: {fmt(summary.currentLegacyBreakdown.traditional)}</span>
                <span className="text-emerald-600">Roth: {fmt(summary.currentLegacyBreakdown.roth)}</span>
                <span className="text-purple-600">NQ: {fmt(summary.currentLegacyBreakdown.nq)}</span>
              </div>
              <p className="font-bold text-blue-700 text-sm">After-Tax Legacy: {fmt(summary.currentAfterTaxLegacy)}</p>
            </div>
          </div>
          <div className={`border rounded-lg p-4 ${isCurrentOptimal ? 'border-slate-200' : 'border-emerald-200 bg-emerald-50/30'}`}>
            <p className="text-xs text-emerald-700 uppercase font-semibold mb-3">
              Optimized: {optimizedSplit.tradPct}% Trad / {optimizedSplit.rothPct}% Roth / {optimizedSplit.nqPct}% NQ
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Lifetime Taxes</span><span className="font-medium text-emerald-600">{fmt(summary.optimizedLifetimeTax)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Heir Tax on Trad</span><span className="font-medium text-emerald-500">{fmt(summary.optimizedTotalTaxBurden - summary.optimizedLifetimeTax)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total Family Tax</span><span className="text-emerald-700">{fmt(summary.optimizedTotalTaxBurden)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs space-y-1">
              <div className="flex gap-3">
                <span className="text-orange-600">Trad: {fmt(summary.optimizedLegacyBreakdown.traditional)}</span>
                <span className="text-emerald-600">Roth: {fmt(summary.optimizedLegacyBreakdown.roth)}</span>
                <span className="text-purple-600">NQ: {fmt(summary.optimizedLegacyBreakdown.nq)}</span>
              </div>
              <p className="font-bold text-blue-700 text-sm">After-Tax Legacy: {fmt(summary.optimizedAfterTaxLegacy)}</p>
            </div>
          </div>
        </div>
        {!isCurrentOptimal && !(inputs.accounts && inputs.accounts.length > 0) && (
          <button onClick={handleApply} className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <CheckCircle className="w-4 h-4" /> Apply {optimizedSplit.tradPct}/{optimizedSplit.rothPct}/{optimizedSplit.nqPct} Split
          </button>
        )}
      </Card>

      {/* Improvement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Family Tax Savings</p>
            <p className={`text-2xl font-bold ${summary.totalTaxSavings > 0 ? 'text-emerald-700' : summary.totalTaxSavings < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {summary.totalTaxSavings > 0 ? '' : summary.totalTaxSavings < 0 ? '-' : ''}{fmt(Math.abs(summary.totalTaxSavings))}
            </p>
            <p className="text-xs text-slate-500 mt-1">lifetime + heir tax combined</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">After-Tax Legacy Improvement</p>
            <p className={`text-2xl font-bold ${summary.afterTaxLegacyImprovement > 0 ? 'text-emerald-700' : summary.afterTaxLegacyImprovement < 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {summary.afterTaxLegacyImprovement > 0 ? '+' : ''}{fmt(summary.afterTaxLegacyImprovement)}
            </p>
            <p className="text-xs text-slate-500 mt-1">what heirs actually receive</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Roth % of Legacy</p>
            <div className="flex justify-center gap-4 mt-1">
              <div>
                <p className="text-lg font-bold text-slate-600">{summary.currentLegacy > 0 ? Math.round((summary.currentLegacyBreakdown.roth / summary.currentLegacy) * 100) : 0}%</p>
                <p className="text-[10px] text-slate-400">Current</p>
              </div>
              <div className="text-slate-300">→</div>
              <div>
                <p className="text-lg font-bold text-emerald-700">{summary.optimizedLegacy > 0 ? Math.round((summary.optimizedLegacyBreakdown.roth / summary.optimizedLegacy) * 100) : 0}%</p>
                <p className="text-[10px] text-emerald-500">Optimized</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Strategies Table */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-1 flex items-center gap-2">
          <Target className="w-4 h-4" /> Top 10 Distribution Splits by After-Tax Legacy
        </h3>
        <p className="text-xs text-slate-500 mb-3">Heir tax estimated at {summary.heirTaxRate}% on inherited Traditional accounts (SECURE Act 10-year rule).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-center">#</th>
                <th className="p-2 text-right">Trad %</th>
                <th className="p-2 text-right">Roth %</th>
                <th className="p-2 text-right">NQ %</th>
                <th className="p-2 text-right">Lifetime Tax</th>
                <th className="p-2 text-right">Gross Legacy</th>
                <th className="p-2 text-right">After-Tax Legacy</th>
              </tr>
            </thead>
            <tbody>
              {topStrategies.map((s, idx) => {
                const isBest = s.tradPct === optimizedSplit.tradPct && s.rothPct === optimizedSplit.rothPct && s.nqPct === optimizedSplit.nqPct;
                const isCurrent = s.tradPct === (summary.currentSplit?.tradPct) && s.rothPct === (summary.currentSplit?.rothPct) && s.nqPct === (summary.currentSplit?.nqPct);
                return (
                  <tr key={idx} className={`border-b border-slate-100 ${isBest ? 'bg-emerald-50 font-bold' : 'hover:bg-slate-50'}`}>
                    <td className="p-2 text-center text-slate-400">{idx + 1}{isBest && <span className="text-emerald-600 ml-1">★</span>}{isCurrent && <span className="text-blue-500 ml-1">●</span>}</td>
                    <td className="p-2 text-right text-orange-600">{s.tradPct}%</td>
                    <td className="p-2 text-right text-emerald-600">{s.rothPct}%</td>
                    <td className="p-2 text-right text-purple-600">{s.nqPct}%</td>
                    <td className="p-2 text-right text-red-600">{fmt(s.lifetimeTax)}</td>
                    <td className="p-2 text-right text-slate-600">{fmt(s.grossLegacy)}</td>
                    <td className="p-2 text-right text-blue-700 font-medium">{fmt(s.afterTaxLegacy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tax Comparison Chart */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> Annual Tax: Current vs. Optimized
        </h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(value, name) => [fmt(value), name]} labelFormatter={(l) => `Age ${l}`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="currentTax" fill="#f87171" name="Current Tax" barSize={8} />
              <Bar yAxisId="left" dataKey="optimizedTax" fill="#34d399" name="Optimized Tax" barSize={8} />
              <Line yAxisId="right" dataKey="cumulativeSavings" stroke="#6366f1" strokeWidth={2} name="Cumulative Savings" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Account Balance Trajectories */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" /> Optimized Account Balance Trajectories
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearDetails} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(value, name) => [fmt(value), name]} labelFormatter={(l) => `Age ${l}`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="tradBalance" stackId="bal" fill="#f97316" stroke="#f97316" name="Traditional" fillOpacity={0.6} />
              <Area dataKey="rothBalance" stackId="bal" fill="#34d399" stroke="#34d399" name="Roth" fillOpacity={0.6} />
              <Area dataKey="nqBalance" stackId="bal" fill="#a78bfa" stroke="#a78bfa" name="NQ" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Year-by-Year Detail */}
      <Card>
        <h3 className="font-semibold text-slate-800 text-base mb-3 flex items-center gap-2">
          <TableIcon className="w-4 h-4" /> Year-by-Year Projection ({optimizedSplit.tradPct}/{optimizedSplit.rothPct}/{optimizedSplit.nqPct} split)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2 text-left">Age</th>
                <th className="p-2 text-right">Distribution</th>
                <th className="p-2 text-right">Tax</th>
                <th className="p-2 text-right">Eff. Rate</th>
                <th className="p-2 text-right">RMD</th>
                <th className="p-2 text-right">Trad Bal</th>
                <th className="p-2 text-right">Roth Bal</th>
                <th className="p-2 text-right">NQ Bal</th>
              </tr>
            </thead>
            <tbody>
              {yearDetails.map((row) => (
                <tr key={row.age} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-700">{row.age}</td>
                  <td className="p-2 text-right text-slate-700">{fmt(row.distribution)}</td>
                  <td className="p-2 text-right text-red-600">{fmt(row.totalTax)}</td>
                  <td className="p-2 text-right text-amber-700">{row.effectiveRate}%</td>
                  <td className="p-2 text-right text-orange-600">{row.rmd > 0 ? fmt(row.rmd) : '-'}</td>
                  <td className="p-2 text-right text-orange-500">{fmt(row.tradBalance)}</td>
                  <td className="p-2 text-right text-emerald-500">{fmt(row.rothBalance)}</td>
                  <td className="p-2 text-right text-purple-500">{fmt(row.nqBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ============================================
// Cash Flows Tab - Transposed: metrics on Y-axis, years on X-axis
// ============================================
const CashFlowsTab = ({ projectionData, monteCarloData, inputs, clientInfo }) => {
  const [mcMode, setMcMode] = React.useState('deterministic'); // 'deterministic' | 'optimistic' | 'median' | 'conservative'
  const fmt = (val) => `$${Math.round(val).toLocaleString()}`;
  const fmtShort = (val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${Math.round(val)}`;

  const activeData = (mcMode !== 'deterministic' && monteCarloData?.scenarios?.[mcMode])
    ? monteCarloData.scenarios[mcMode]
    : projectionData;

  const hasEmployment = activeData.some(r => r.employmentIncomeDetail > 0);
  const hasOther = activeData.some(r => r.otherIncomeDetail > 0);
  const hasContributions = activeData.some(r => r.contribution > 0);
  const hasNqData = inputs.taxEnabled && activeData.some(r => r.nqWithdrawal > 0);
  const hasRMD = inputs.taxEnabled && activeData.some(r => r.rmdAmount > 0);
  const hasRMDExcess = hasRMD && activeData.some(r => r.rmdExcess > 0);

  // Build row definitions for the transposed table
  const buildRows = () => {
    const rows = [
      { label: 'Plan Year', cls: 'font-bold text-slate-800 bg-slate-100', getValue: (r) => r.year },
      { label: `${clientInfo.name || 'Client'} Age`, cls: 'font-bold text-slate-700 bg-slate-50', getValue: (r) => r.age },
    ];
    if (clientInfo.isMarried) {
      rows.push({ label: `${clientInfo.partnerName || 'Partner'} Age`, cls: 'text-slate-500 bg-slate-50', getValue: (r) => Math.floor(r.partnerAge) });
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Starting Balance', cls: 'text-slate-700', getValue: (r) => fmt(r.startBalance) },
      { label: 'Growth', cls: '', getValue: (r) => `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`, dynamicCls: (r) => r.growth >= 0 ? 'text-emerald-700' : 'text-red-600' },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Social Security', cls: 'text-blue-700', getValue: (r) => fmt(r.ssIncomeDetail || 0) },
      { label: 'Pension', cls: 'text-blue-700', getValue: (r) => fmt(r.pensionIncomeDetail || 0) },
    );
    if (hasEmployment) rows.push({ label: 'Employment Income', cls: 'text-teal-700', getValue: (r) => r.employmentIncomeDetail > 0 ? fmt(r.employmentIncomeDetail) : '-' });
    if (hasOther) rows.push({ label: 'Other Income', cls: 'text-cyan-700', getValue: (r) => r.otherIncomeDetail > 0 ? fmt(r.otherIncomeDetail) : '-' });
    if (hasContributions) rows.push({ label: 'One-Time Contributions', cls: 'text-purple-700', getValue: (r) => r.contribution > 0 ? `+${fmt(r.contribution)}` : '-' });
    rows.push(
      { label: 'Total Income', cls: 'font-bold text-blue-800 bg-blue-50', getValue: (r) => fmt(r.ssIncome) },
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Total Spending', cls: 'font-bold text-slate-800', getValue: (r) => fmt(r.expenses) },
      { label: 'Portfolio Withdrawal', cls: 'text-orange-700', getValue: (r) => fmt(r.distribution) },
    );
    if (hasRMD) {
      rows.push({ label: 'RMD Floor', cls: 'text-orange-600', getValue: (r) => r.rmdAmount > 0 ? fmt(r.rmdAmount) : '-' });
      if (hasRMDExcess) {
        rows.push({ label: 'RMD Excess → NQ', cls: 'text-teal-600', getValue: (r) => r.rmdExcess > 0 ? `+${fmt(r.rmdExcess)}` : '-' });
      }
    }
    if (inputs.taxEnabled) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Federal Tax', cls: 'text-red-600', getValue: (r) => fmt(r.federalTax || 0) },
        { label: 'State Tax', cls: 'text-red-600', getValue: (r) => fmt(r.stateTax || 0) },
        { label: 'Total Tax', cls: 'font-bold text-red-700 bg-red-50', getValue: (r) => fmt(r.totalTax || 0) },
        { label: 'Effective Rate', cls: 'text-amber-700', getValue: (r) => `${r.effectiveRate || '0'}%` },
      );
    }
    if (hasNqData) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Withdrawal', cls: 'text-blue-600', getValue: (r) => fmt(r.distribution * (r.traditionalPctUsed || 0) / 100) },
        { label: 'Roth Withdrawal', cls: 'text-emerald-600', getValue: (r) => fmt(r.distribution * (r.rothPctUsed || 0) / 100) },
        { label: 'NQ Withdrawal', cls: 'text-amber-600', getValue: (r) => fmt(r.nqWithdrawal || 0) },
        { label: '  Realized Cap Gains', cls: 'text-red-500 pl-4', getValue: (r) => fmt(r.nqTaxableGain || 0) },
        { label: 'Qualified Dividends', cls: 'text-purple-600', getValue: (r) => fmt(r.nqQualifiedDividends || 0) },
        { label: 'Ordinary Dividends', cls: 'text-pink-600', getValue: (r) => fmt(r.nqOrdinaryDividends || 0) },
      );
    }
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Distribution Rate', cls: 'text-red-600', getValue: (r) => `${r.distRate?.toFixed(1) || '0'}%` },
      { label: 'Ending Balance', cls: 'font-bold text-slate-900 bg-emerald-50 text-base', getValue: (r) => fmt(Math.max(0, r.total)) },
    );
    if (inputs.taxEnabled && activeData.some(r => r.traditionalBalanceDetail > 0)) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'Traditional Balance', cls: 'text-blue-600', getValue: (r) => fmt(r.traditionalBalanceDetail || 0) },
        { label: 'Roth Balance', cls: 'text-emerald-600', getValue: (r) => fmt(r.rothBalanceDetail || 0) },
        { label: 'NQ Balance', cls: 'text-amber-600', getValue: (r) => fmt(r.nqBalanceDetail || 0) },
      );
    }
    return rows;
  };

  const allRows = buildRows();

  // 5-year chunks for print
  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < activeData.length; i += chunkSize) {
    chunks.push(activeData.slice(i, i + chunkSize));
  }

  const renderTransposedTable = (cols, fontSize = 'text-xs') => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className={`w-full ${fontSize} border-collapse`}>
        <tbody>
          {allRows.map((rowDef, ri) => (
            <tr key={ri} className={rowDef.isSeparator ? 'h-1' : 'border-b border-slate-100'}>
              <td className={`p-1.5 text-left whitespace-nowrap font-medium sticky left-0 bg-white border-r border-slate-200 min-w-[160px] ${rowDef.cls || ''}`}>
                {rowDef.label}
              </td>
              {cols.map((col, ci) => (
                <td key={ci} className={`p-1.5 text-right whitespace-nowrap ${rowDef.isSeparator ? '' : rowDef.dynamicCls ? rowDef.dynamicCls(col) : rowDef.cls || ''}`}>
                  {rowDef.isSeparator ? '' : rowDef.getValue(col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
              <TableIcon className="w-5 h-5" /> Detailed Retirement Cash Flows
            </h3>
            <p className="text-sm text-slate-500">
              Comprehensive income, withdrawal, tax, and portfolio detail by year.
            </p>
          </div>
          {monteCarloData?.scenarios && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setMcMode('deterministic')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'deterministic' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >Deterministic</button>
              <button onClick={() => setMcMode('optimistic')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'optimistic' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >Optimistic</button>
              <button onClick={() => setMcMode('median')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'median' ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >Median</button>
              <button onClick={() => setMcMode('conservative')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${mcMode === 'conservative' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >Conservative</button>
            </div>
          )}
        </div>
        {mcMode !== 'deterministic' && (
          <p className="text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded">
            <strong>Monte Carlo — {mcMode === 'optimistic' ? '90th Percentile' : mcMode === 'median' ? '50th Percentile (Median)' : '10th Percentile'}:</strong>
            {' '}{mcMode === 'optimistic' ? 'Better than 90% of simulated outcomes.' : mcMode === 'median' ? 'Middle-of-the-road outcome from 1,000 simulations.' : 'Worse than only 10% of simulated outcomes — stress test scenario.'}
          </p>
        )}

        {renderTransposedTable(activeData)}

        {inputs.taxEnabled && (
          <div className="mt-3 p-2 bg-amber-50 text-xs text-amber-800 rounded border border-amber-100">
            <strong>Tax Note:</strong> Estimated taxes based on {inputs.filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'} status, {inputs.traditionalPercent}% Trad / {inputs.rothPercent}% Roth / {inputs.nqPercent}% NQ, {inputs.stateCode && STATE_TAX_DATA[inputs.stateCode] ? `${STATE_TAX_DATA[inputs.stateCode].name} (${STATE_TAX_DATA[inputs.stateCode].rate}%${STATE_TAX_DATA[inputs.stateCode].ssTaxable ? ', taxes SS' : ', SS exempt'})` : `${inputs.stateRate}% state rate`}.{Object.keys(inputs.withdrawalOverrides || {}).length > 0 ? ` ${Object.keys(inputs.withdrawalOverrides).length} custom year override(s) applied.` : ''}
          </div>
        )}
      </Card>

    </div>
  );
};

const SCHEDULING_URL = 'https://oncehub.com/RoddMiller-30';

const PrintFooter = ({ pageNumber, totalPages }) => (
  <div className="border-t border-slate-200 pt-4 mt-6">
    <div className="flex justify-between text-[11px] text-slate-400 mb-2">
      <span>Miller Wealth Management | Confidential</span>
      <span>Page {pageNumber} of {totalPages}</span>
    </div>
    <p className="text-[10px] text-slate-400 text-center leading-tight">
      Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial.
    </p>
  </div>
);

const PrintPageWrapper = ({ pageNumber, totalPages, title, subtitle, children }) => (
  <div className="hidden print:flex flex-col min-h-[10in] break-after-page p-6">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <img src={LOGO_URL} alt="Logo" className="h-14" />
    </div>
    <div className="w-full h-0.5 bg-emerald-600 mb-4"></div>
    <div className="flex-1">
      {children}
    </div>
    <PrintFooter pageNumber={pageNumber} totalPages={totalPages} />
  </div>
);

// Closing page removed - not in user's 8-page requirements

export default ArchitectPage;
