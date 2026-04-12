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
import {
  AllocationTab, WithdrawalOverrideModal, MonteCarloTab, SSOptimizationTab,
  ImproveOutcomeTab, ArchitectureTab, OptimizerTab, TaxMapTab,
  LiquidationTab, CashFlowsTab, PrintPageWrapper
} from './architect';

const SCHEDULING_URL = 'https://oncehub.com/RoddMiller-30';

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
  printOptions,
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
  // Print data source: use Monte Carlo median when print mode is montecarlo
  const printData = useMemo(() => {
    if (printOptions?.mode === 'montecarlo' && monteCarloData?.scenarios?.median) {
      return monteCarloData.scenarios.median;
    }
    return projectionData;
  }, [printOptions, monteCarloData, projectionData]);

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

  // --- Cash Flow print page data (uses printData which respects print mode) ---
  const cashFlowPrintData = useMemo(() => {
    const fmt = (val) => `$${Math.round(val).toLocaleString()}`;
    const hasEmployment = printData.some(r => r.employmentIncomeDetail > 0);
    const hasOther = printData.some(r => r.otherIncomeDetail > 0);
    const hasContributions = printData.some(r => r.contribution > 0);
    const hasSurplus = printData.some(r => (r.surplus || 0) > 0);
    const hasNqData = inputs.taxEnabled && printData.some(r => r.nqWithdrawal > 0);
    const hasRMD = inputs.taxEnabled && printData.some(r => r.rmdAmount > 0);
    const hasRMDExcess = hasRMD && printData.some(r => r.rmdExcess > 0);

    const rows = [
      { label: 'Plan Year', cls: 'font-bold text-slate-800 bg-slate-100', getValue: (r) => r.year },
      { label: `${clientInfo.name || 'Client'} Age`, cls: 'font-bold text-slate-700 bg-slate-50', getValue: (r) => r.age },
    ];
    if (clientInfo.isMarried) {
      rows.push({ label: `${clientInfo.partnerName || 'Partner'} Age`, cls: 'text-slate-500 bg-slate-50', getValue: (r) => Math.floor(r.partnerAge) });
    }
    // --- STARTING BALANCE & GROWTH ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Starting Balance', cls: 'font-bold text-slate-700', getValue: (r) => fmt(r.startBalance) },
      { label: 'Portfolio Growth', cls: '', getValue: (r) => `${r.growth >= 0 ? '+' : ''}${fmt(r.growth)}`, dynamicCls: (r) => r.growth >= 0 ? 'text-mwm-green/80' : 'text-red-600' },
    );
    // --- INCOME ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Social Security', cls: 'text-blue-700', getValue: (r) => fmt(r.ssIncomeDetail || 0) },
      { label: 'Pension', cls: 'text-blue-700', getValue: (r) => fmt(r.pensionIncomeDetail || 0) },
    );
    if (hasEmployment) rows.push({ label: 'Employment Income', cls: 'text-teal-700', getValue: (r) => r.employmentIncomeDetail > 0 ? fmt(r.employmentIncomeDetail) : '-' });
    if (hasOther) rows.push({ label: 'Other Income', cls: 'text-cyan-700', getValue: (r) => r.otherIncomeDetail > 0 ? fmt(r.otherIncomeDetail) : '-' });
    if (hasContributions) rows.push({ label: 'One-Time Contributions', cls: 'text-purple-700', getValue: (r) => r.contribution > 0 ? `+${fmt(r.contribution)}` : '-' });
    rows.push(
      { label: 'Total Income', cls: 'font-bold text-blue-800 bg-blue-50', getValue: (r) => fmt(r.ssIncome) },
    );
    // --- EXPENSES ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Living Expenses', cls: 'text-slate-700', getValue: (r) => fmt(r.livingExpenses || r.expenses) },
    );
    if (inputs.taxEnabled) {
      rows.push(
        { label: 'Federal Tax', cls: 'text-red-600', getValue: (r) => fmt(r.federalTax || 0) },
        { label: 'State Tax', cls: 'text-red-600', getValue: (r) => fmt(r.stateTax || 0) },
      );
    }
    rows.push(
      { label: 'Total Expenses', cls: 'font-bold text-slate-800 bg-slate-50', getValue: (r) => fmt(r.expenses) },
    );
    if (inputs.taxEnabled) {
      rows.push(
        { label: 'Effective Tax Rate', cls: 'text-mwm-gold/80', getValue: (r) => `${r.effectiveRate || '0'}%` },
      );
    }
    // --- RMD ---
    if (hasRMD) {
      rows.push(
        { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
        { label: 'RMD Floor', cls: 'text-orange-600', getValue: (r) => r.rmdAmount > 0 ? fmt(r.rmdAmount) : '-' },
      );
      if (hasRMDExcess) {
        rows.push({ label: 'RMD Excess → NQ', cls: 'text-teal-600', getValue: (r) => r.rmdExcess > 0 ? `+${fmt(r.rmdExcess)}` : '-' });
      }
    }
    // --- PORTFOLIO CONTRIBUTION / DISTRIBUTION ---
    rows.push({ label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true });
    if (hasSurplus) {
      rows.push({ label: 'Contribution → Perm. Equity', cls: 'font-bold text-mwm-green', getValue: (r) => (r.surplus || 0) > 0 ? `+${fmt(r.surplus)}` : '-' });
    }
    rows.push(
      { label: 'Portfolio Distribution', cls: 'text-orange-700', getValue: (r) => r.distribution > 0 ? fmt(r.distribution) : '-' },
    );
    // --- ENDING BALANCE ---
    rows.push(
      { label: '', cls: 'bg-slate-200', getValue: () => '', isSeparator: true },
      { label: 'Ending Balance', cls: 'font-bold text-slate-900 bg-mwm-green/10 text-base', getValue: (r) => fmt(Math.max(0, r.total)) },
      { label: 'Distribution Rate', cls: '', getValue: (r) => {
        if ((r.surplus || 0) > 0 && r.distribution === 0) return 'n/a';
        return `${r.distRate?.toFixed(1) || '0'}%`;
      }, dynamicCls: (r) => (r.surplus || 0) > 0 && r.distribution === 0 ? 'text-mwm-green' : 'text-red-600' },
    );

    const chunks = [];
    for (let i = 0; i < printData.length; i += 5) {
      chunks.push(printData.slice(i, i + 5));
    }

    return { rows, chunks };
  }, [printData, inputs, clientInfo]);

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
        <div className="w-32 h-1.5 bg-mwm-green mx-auto mb-10"></div>
        <p className="text-3xl text-slate-600 mb-3">Prepared for</p>
        <p className="text-4xl font-bold text-mwm-green/80 mb-16">{clientInfo.name || "Valued Client"}</p>
        <div className="text-left border-t border-slate-200 pt-10 w-full max-w-lg mx-auto space-y-4 text-lg text-slate-600">
          <p><strong>Email:</strong> {clientInfo.email || 'Not provided'}</p>
          <p><strong>Phone:</strong> {clientInfo.phone || 'Not provided'}</p>
          <p><strong>Prepared:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Projection:</strong> {printOptions?.mode === 'montecarlo' ? 'Monte Carlo (Median of 1,000 Simulations)' : 'Deterministic (Fixed Return Assumptions)'}</p>
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
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg shadow-sm transition-all font-medium text-xs sm:text-sm ${saveStatus === 'success' ? 'bg-green-600' : 'bg-mwm-green/80 hover:bg-mwm-emerald'}`}
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
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg shadow-sm transition-all font-medium text-xs sm:text-sm ${saveStatus === 'success' ? 'bg-green-600' : 'bg-mwm-green/80 hover:bg-mwm-emerald'}`}
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

      {/* PRINT PAGE 2: Phase 1 - Accumulation (excluded when client is retired or user opts out) */}
      {!printOptions?.excludeAccumulation && <PrintPageWrapper pageNumber={2} totalPages={totalPrintPages} title="Phase 1 - Accumulation" subtitle="Building your retirement portfolio">
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
                <th className="px-1 py-0.5 text-right text-mwm-green">Savings</th>
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
                      <td className="px-1 py-0.5 text-right text-mwm-green">{savings > 0 ? `+$${savings.toLocaleString()}` : '-'}</td>
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

        <div className="bg-mwm-green/10 p-3 rounded-lg border border-mwm-green/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-mwm-emerald font-bold text-[13px]">Projected Portfolio at Retirement (Age {clientInfo.retirementAge})</p>
              <p className="text-xs text-mwm-green">Based on {clientInfo.expectedReturn}% expected return</p>
            </div>
            <p className="text-2xl font-bold text-mwm-green/80">${inputs.totalPortfolio.toLocaleString()}</p>
          </div>
        </div>
      </PrintPageWrapper>}

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
              colorClass={`bg-gray-800 text-white ${adjustedProjections.hasChanges && (selectedImprovements.delay || selectedImprovements.savings) ? 'ring-2 ring-mwm-green/60' : ''}`}
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
              colorClass={`bg-mwm-gold text-white ${adjustedProjections.hasChanges && selectedImprovements.spending ? 'ring-2 ring-mwm-green/60' : ''}`}
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
              colorClass={`${(() => { const sr = adjustedProjections.hasChanges ? adjustedProjections.successRate : monteCarloData?.successRate; return sr >= 85 ? "bg-mwm-green" : sr >= 65 ? "bg-orange-500" : "bg-red-600"; })()} text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-mwm-gold/60' : ''}`}
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
              colorClass={`bg-mwm-emerald text-white ${adjustedProjections.hasChanges ? 'ring-2 ring-mwm-gold/60' : ''}`}
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
              <div className="p-4 bg-mwm-green/10 rounded-lg border border-mwm-green/30">
                <div className="flex items-center gap-3">
                  <PiggyBank className="w-5 h-5 text-mwm-green" />
                  <div className="flex-1">
                    <h4 className="font-bold text-mwm-emerald text-sm">Annual Savings</h4>
                  </div>
                  <FormattedNumberInput
                    name="annualSavings"
                    value={clientInfo.annualSavings}
                    onChange={onClientChange}
                    className="p-2 border border-mwm-green/40 rounded-lg w-28 text-center font-bold text-mwm-emerald bg-white"
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
                className={`${activeTab === 'chart' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <BarChart2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Allocation &</span> Plan
              </button>
              <button
                onClick={() => onSetActiveTab('montecarlo')}
                className={`${activeTab === 'montecarlo' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" /> Monte Carlo
              </button>
              <button
                onClick={() => onSetActiveTab('ss')}
                className={`${activeTab === 'ss' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> SS <span className="hidden sm:inline">Optimization</span>
              </button>
              <button
                onClick={() => onSetActiveTab('improve')}
                className={`${activeTab === 'improve' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> Improve
              </button>
              <button
                onClick={() => onSetActiveTab('architecture')}
                className={`${activeTab === 'architecture' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Layers className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Architecture</span><span className="sm:hidden">Arch</span>
              </button>
              <button
                onClick={() => onSetActiveTab('optimizer')}
                className={`${activeTab === 'optimizer' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <Target className="w-3 h-3 sm:w-4 sm:h-4" /> Optimizer
              </button>
              <button
                onClick={() => onSetActiveTab('taxmap')}
                className={`${activeTab === 'taxmap' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
              >
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" /> Tax Map
              </button>
              <button
                onClick={() => onSetActiveTab('cashflows')}
                className={`${activeTab === 'cashflows' ? 'border-mwm-green text-mwm-green/80' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2`}
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
            <p className="text-xs font-bold text-slate-600">B1 - Liquidity</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b1Val >= 1000000 ? `$${(basePlan.b1Val / 1000000).toFixed(2)}M` : `$${(basePlan.b1Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 1-3</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.midTerm}20`, borderTop: `4px solid ${COLORS.midTerm}` }}>
            <p className="text-xs font-bold text-slate-600">B2 - Bridge</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b2Val >= 1000000 ? `$${(basePlan.b2Val / 1000000).toFixed(2)}M` : `$${(basePlan.b2Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 4-6</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.hedged}20`, borderTop: `4px solid ${COLORS.hedged}` }}>
            <p className="text-xs font-bold text-slate-600">B3 - Tactical Balanced</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b3Val >= 1000000 ? `$${(basePlan.b3Val / 1000000).toFixed(2)}M` : `$${(basePlan.b3Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">Years 7-15</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.income}20`, borderTop: `4px solid ${COLORS.income}` }}>
            <p className="text-xs font-bold text-slate-600">B4 - Income & Growth</p>
            <p className="text-xl font-bold text-slate-800">{basePlan.b4Val >= 1000000 ? `$${(basePlan.b4Val / 1000000).toFixed(2)}M` : `$${(basePlan.b4Val / 1000).toFixed(0)}k`}</p>
            <p className="text-xs text-slate-500">{((basePlan.b4Val / inputs.totalPortfolio) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">10% Fixed</p>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${COLORS.longTerm}20`, borderTop: `4px solid ${COLORS.longTerm}` }}>
            <p className="text-xs font-bold text-slate-600">B5 - Permanent Equity</p>
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
                <td className="p-3 font-medium">B1 - Liquidity</td>
                <td className="p-3 text-center">{assumptions.b1.return}%</td>
                <td className="p-3 text-center">{assumptions.b1.stdDev}%</td>
                <td className="p-3">Cash, Money Market, Short-term Bonds</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-3 font-medium">B2 - Bridge</td>
                <td className="p-3 text-center">{assumptions.b2.return}%</td>
                <td className="p-3 text-center">{assumptions.b2.stdDev}%</td>
                <td className="p-3">Intermediate Bonds, Conservative Allocation</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">B3 - Tactical Balanced</td>
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
                <td className="p-3 font-medium">B5 - Permanent Equity</td>
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
          { label: 'B1 - Liquidity', val: basePlan.b1Val, years: 'Years 1-3', color: COLORS.shortTerm, rate: `${fmtMoney(basePlan.b1Val / 3)}/yr`, end: '$0 @ Year 3', income: phase1Income },
          { label: 'B2 - Bridge', val: basePlan.b2Val, years: 'Years 4-6', color: COLORS.midTerm, rate: `${fmtMoney(basePlan.b2Val / 3)}/yr`, end: '$0 @ Year 6', income: phase2Income },
          { label: 'B3 - Tactical Balanced', val: basePlan.b3Val, years: 'Years 7-15', color: COLORS.hedged, rate: `${fmtMoney(basePlan.b3Val / 9)}/yr`, end: '$0 @ Year 15', income: phase3Income },
          { label: 'B4 - Income & Growth', val: basePlan.b4Val, years: 'Years 16-20', color: COLORS.income, rate: `${fmtMoney(basePlan.b4Val / 5)}/yr`, end: '$0 @ Year 20', income: phase4Income },
          { label: 'B5 - Permanent Equity', val: basePlan.b5Val, years: 'Year 21+', color: COLORS.longTerm, rate: '20 Years to grow', end: `${fmtMoney(projectionData[19]?.b5 || basePlan.b5Val * 2)} @ Yr 20`, income: phase5Income, isGrowth: true },
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
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.shortTerm }}></span> Liquidity</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.midTerm }}></span> Bridge</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.hedged }}></span> Tactical Balanced</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.income }}></span> Income & Growth</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.longTerm }}></span> Permanent Equity</span>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Success Probability (Age {finalProjectionAge})</p>
                <div className={`text-3xl font-bold ${monteCarloData.successRate >= 85 ? 'text-mwm-green' : monteCarloData.successRate >= 65 ? 'text-orange-600' : 'text-red-600'}`}>
                  {monteCarloData.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Based on 1,000 Monte Carlo simulations</p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${monteCarloData.successRate >= 85 ? 'bg-mwm-green' : monteCarloData.successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'}`}
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
                  <span className={`font-semibold ${legacyAt95 >= inputs.totalPortfolio ? 'text-mwm-green' : 'text-red-600'}`}>
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
      <PrintPageWrapper pageNumber={5} totalPages={totalPrintPages} title="Portfolio Sustainability" subtitle={
        (printOptions?.mode === 'montecarlo'
          ? `Monte Carlo simulation — ${(monteCarloData?.successRate || 0).toFixed(0)}% success rate (1,000 scenarios)`
          : 'Deterministic projection') +
        (inputs.taxEnabled ? ' with estimated taxes' : '')
      }>
        {/* Chart */}
        <div className="border border-slate-200 rounded-lg p-3 mb-4">
          {printOptions?.mode === 'montecarlo' && monteCarloData?.data ? (
            /* Monte Carlo fan chart: 90th, 50th, 10th percentile bands */
            <ComposedChart width={670} height={240} data={monteCarloData.data.map((mc, idx) => ({
              year: idx + 1,
              p90: Math.round(mc.p90),
              median: Math.round(mc.median),
              p10: Math.round(mc.p10),
              total: Math.round(mc.median),
            }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="p90" name="90th Percentile" fill="#d1fae5" stroke="#10b981" fillOpacity={0.4} />
              <Area type="monotone" dataKey="median" name="50th Percentile (Median)" fill="#bfdbfe" stroke="#3b82f6" fillOpacity={0.5} />
              <Area type="monotone" dataKey="p10" name="10th Percentile" fill="#fee2e2" stroke="#ef4444" fillOpacity={0.4} />
              <Line type="monotone" dataKey="total" name="Deterministic" stroke={COLORS.areaFill} strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </ComposedChart>
          ) : (
            /* Deterministic single-line chart */
            <ComposedChart width={670} height={240} data={printData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={(val) => val >= 2000000 ? `$${Math.round(val / 1000000)}M` : `$${Math.round(val / 1000)}k`} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="total" name="Bucket Strategy" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
              {inputs.showBenchmark && <Line type="monotone" dataKey="benchmark" name="Passive 60/40" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />}
              <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
            </ComposedChart>
          )}
        </div>

        {/* Cash Flow Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-[10px] text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold">
                <th className="p-1 text-left">Age</th>
                <th className="p-1">Start Bal.</th>
                <th className="p-1 text-mwm-green">Growth</th>
                <th className="p-1 text-blue-600">Income</th>
                <th className="p-1 text-orange-600">Withdrawal</th>
                {inputs.taxEnabled && <th className="p-1 text-red-600">Est. Tax</th>}
                <th className="p-1 text-slate-800">{inputs.taxEnabled ? 'Gross Spend' : 'Spending'}</th>
                {inputs.taxEnabled && <th className="p-1 text-slate-600">Net Spend</th>}
                <th className="p-1 text-slate-900">End Bal.</th>
              </tr>
            </thead>
            <tbody>
              {printData
                .filter((row, i) => {
                  const yearNum = i + 1; // 1-indexed year
                  return yearNum <= 20 || yearNum % 5 === 0;
                })
                .map((row, i) => (
                <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-1 text-left font-bold text-slate-700">{row.age}</td>
                  <td className="p-1 text-slate-500">${row.startBalance.toLocaleString()}</td>
                  <td className={`p-1 ${row.growth >= 0 ? 'text-mwm-green' : 'text-red-600'}`}>{row.growth >= 0 ? `+$${row.growth.toLocaleString()}` : `($${Math.abs(row.growth).toLocaleString()})`}</td>
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
          <div className="mt-2 p-1.5 bg-mwm-gold/10 text-[9px] text-mwm-gold/80 rounded border border-mwm-gold/20">
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
                  {claimAge}{yearsEarly > 0 && <span className="text-red-500"> ({yearsEarly}yr early)</span>}{yearsLate > 0 && <span className="text-mwm-green"> ({yearsLate}yr late)</span>}
                </span>
                {!receiving && reduction > 0 && <><span className="text-red-500">Early reduction</span><span className="text-right text-red-500">-{pct(reduction)}</span></>}
                {!receiving && bonus > 0 && <><span className="text-mwm-green">Delayed credits</span><span className="text-right text-mwm-green">+{pct(bonus)}</span></>}
                <span className="text-slate-500">Own benefit</span><span className="text-right font-medium">{fmt(ownBenefit)}/mo</span>
                {clientInfo.isMarried && spousalExcess > 0 && <><span className="text-blue-600">Spousal excess</span><span className="text-right text-blue-600">+{fmt(afterDeemed - ownBenefit)}/mo</span></>}
                <span className="text-slate-700 font-bold border-t border-slate-200 pt-0.5">Total benefit</span>
                <span className="text-right font-bold text-mwm-green/80 border-t border-slate-200 pt-0.5">{fmt(afterDeemed)}/mo</span>
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
                  <span className="text-[10px] font-bold text-mwm-green/80">Combined: {fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
                </div>
              )}

              {/* Claiming Age Matrix */}
              {clientInfo.isMarried && ssMatrixData ? (
                <>
                  <div className="bg-black text-white p-2 rounded-lg mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-mwm-green flex-shrink-0" />
                    <p className="text-[11px] font-bold">
                      Optimal: Primary <span className="text-mwm-green">{ssMatrixData.winner.clientAge}</span> + Spouse <span className="text-mwm-green">{ssMatrixData.winner.partnerAge}</span>
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
                                const bg = isOpt ? 'bg-mwm-green/30 font-bold' : isSel ? 'bg-blue-100' : p >= 0.85 ? 'bg-mwm-green/20' : p >= 0.6 ? 'bg-mwm-green/10' : p >= 0.35 ? 'bg-mwm-gold/10' : p >= 0.15 ? 'bg-orange-50' : 'bg-red-50';
                                return (
                                  <td key={cAge} className={`p-1 border border-slate-200 text-center ${bg}`}>
                                    ${(bal / 1000000).toFixed(2)}M
                                    {isOpt && <span className="block text-[7px] text-mwm-green/80">BEST</span>}
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
                    <CheckCircle className="w-5 h-5 text-mwm-green flex-shrink-0" />
                    <p className="text-[11px]"><span className="text-slate-400">Recommendation:</span> Claim at Age <span className="text-mwm-green font-bold">{ssWinnerForDisplay.age}</span> to maximize portfolio at age {targetMaxPortfolioAge}</p>
                  </div>
                  <div className="grid grid-cols-9 gap-1 mb-2">
                    {ssOutcomesForDisplay.map((o) => (
                      <div key={o.age} className={`p-1 rounded border text-center ${o.age === ssWinnerForDisplay.age ? 'border-mwm-green bg-mwm-green/10' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="text-[9px] font-bold text-slate-500">{o.age}</p>
                        <p className={`text-[10px] font-bold ${o.age === ssWinnerForDisplay.age ? 'text-mwm-green/80' : 'text-slate-700'}`}>
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

      {/* PRINT PAGE: Monte Carlo Simulation (hidden when Monte Carlo is already the print mode) */}
      {printOptions?.mode !== 'montecarlo' && <PrintPageWrapper pageNumber={7 + cashFlowPageCount} totalPages={totalPrintPages} title="Monte Carlo Simulation" subtitle="Probability analysis based on 1,000 market scenarios">
        {/* Success Rate */}
        <div className={`${monteCarloData.successRate >= 85 ? 'bg-mwm-green' : monteCarloData.successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'} text-white p-6 rounded-lg mb-4`}>
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
      </PrintPageWrapper>}

      {/* PRINT PAGE: Strategy Comparison (optional) */}
      {!printOptions?.excludeStrategyComparison && <PrintPageWrapper pageNumber={8 + cashFlowPageCount} totalPages={totalPrintPages} title="Strategy Comparison" subtitle="Alternative allocation strategies analyzed">
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
              <tr className="border-b bg-mwm-green/10">
                <td className="p-1.5 font-bold">Current Model</td>
                <td className="p-1.5 text-center">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((basePlan.b4Val / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(1)}%</td>
                <td className="p-1.5 text-center font-bold text-mwm-green/80">{(monteCarloData?.successRate || 0).toFixed(1)}%</td>
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
                <td className="p-1.5 font-medium">Tactical Balanced</td>
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
              <p><strong>Tactical Balanced:</strong> Traditional single-bucket approach without time segmentation.</p>
              <p><strong>Aggressive Growth:</strong> Maximizes long-term growth with 70% in B5, minimal short-term reserves.</p>
              <p><strong>Barbell:</strong> Cash for near-term, maximum equity for long-term growth.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-slate-100 p-3 rounded-lg text-[13px] text-slate-500">
          <p><strong>Note:</strong> Success rates are based on 1,000-iteration Monte Carlo simulations. Legacy values represent median outcomes. Actual results will vary based on market conditions and personal circumstances.</p>
        </div>
      </PrintPageWrapper>}

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
                  <li>B1 (Liquidity): {assumptions.b1.return}% return, {assumptions.b1.stdDev}% std dev</li>
                  <li>B2 (Bridge): {assumptions.b2.return}% return, {assumptions.b2.stdDev}% std dev</li>
                  <li>B3 (Tactical Balanced): {assumptions.b3.return}% return, {assumptions.b3.stdDev}% std dev</li>
                  <li>B4 (Income & Growth): {assumptions.b4.return}% return, {assumptions.b4.stdDev}% std dev</li>
                  <li>B5 (Permanent Equity): {assumptions.b5.return}% return, {assumptions.b5.stdDev}% std dev</li>
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
          <div className="w-24 h-1 bg-mwm-green mx-auto mb-3"></div>
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
                <div className="w-6 h-6 rounded-full bg-mwm-green text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
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

export default ArchitectPage;

// NOTE: Sub-components (AllocationTab, MonteCarloTab, SSOptimizationTab, etc.)
// have been extracted to ./architect/ directory
