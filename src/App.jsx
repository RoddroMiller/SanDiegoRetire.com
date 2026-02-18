import React, { useState, useMemo, useEffect, useCallback } from 'react';

// --- Local Imports ---
import { formatPhoneNumber, calculateAccumulation, calculateBasePlan, runSimulation, calculateSSAnalysis, calculateSSPartnerAnalysis, getAdjustedSS, calculateAlternativeAllocations, runOptimizedSimulation } from './utils';
import { GateScreen, LoginScreen, ClientLoginScreen, AccumulationPage, ArchitectPage, ClientWizard, PlanManagement } from './components';
import { MfaVerifyModal, MfaEnrollModal } from './components/auth/MfaModals';
import { PasswordExpiryModal } from './components/auth/PasswordExpiryModal';
import { useAuth, useScenarios, useAdvisors, useCommandCenter } from './hooks';
import { useSessionTimeout } from './hooks/useSessionTimeout';

// --- Main Application ---

export default function BucketPortfolioBuilder() {
  // --- Auth Hook ---
  const {
    viewMode,
    setViewMode,
    userRole,
    currentUser,
    authError,
    isLoggingIn,
    resetStatus,
    // MFA State
    mfaRequired,
    mfaEnrollRequired,
    mfaError,
    // Password Expiry State (BOSP)
    passwordExpired,
    passwordExpiryEmail,
    // Auth Actions
    handleProspectEntry,
    handleClientLogin,
    handleClientSignup,
    handleAdvisorLogin,
    handlePasswordReset,
    handleLogout,
    // MFA Actions
    startMfaEnrollment,
    completeMfaEnrollment,
    verifyMfaCode,
    cancelMfa,
    // Password Expiry Actions (BOSP)
    handlePasswordExpiryResolved,
    cancelPasswordExpiry
  } = useAuth();

  // Advisor view state (planning vs management)
  const [advisorView, setAdvisorView] = useState('planning');

  // Plan filter state (mine, team, all)
  const [planFilter, setPlanFilter] = useState('mine');

  // --- Command Center Hook (The One Process integration) ---
  // Must be before useScenarios since it provides team data
  const {
    commandCenterStatus,
    saveToCommandCenter,
    isCommandCenterConnected,
    commandCenterClients,
    isLoadingClients,
    userTeams,
    teamMemberEmails,
    hasTeams
  } = useCommandCenter({ currentUser });

  // --- Scenarios Hook ---
  const {
    savedScenarios,
    isLoadingScenarios,
    saveStatus,
    saveScenario,
    saveProgress,
    submitClientScenario,
    loadScenario,
    deleteScenario,
    clearScenarios,
    reassignScenario,
    refreshScenarios,
    assignPlanToClient,
    removeClientAssignment
  } = useScenarios({ currentUser, userRole, planFilter, teamMemberEmails });

  // --- Advisors Hook ---
  const {
    advisors,
    isLoadingAdvisors,
    addAdvisor,
    deleteAdvisor,
    refreshAdvisors
  } = useAdvisors();

  // Auto-register current user as advisor on login
  useEffect(() => {
    if (currentUser?.email && (userRole === 'advisor' || userRole === 'master')) {
      const email = currentUser.email.toLowerCase();
      const alreadyExists = advisors.some(a => a.email?.toLowerCase() === email);
      if (!alreadyExists && advisors.length >= 0 && !isLoadingAdvisors) {
        addAdvisor(currentUser.displayName || email.split('@')[0], email);
      }
    }
  }, [currentUser, userRole, advisors, isLoadingAdvisors]);

  // --- Session Timeout for BOSP compliance (15 min inactivity) ---
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  const handleSessionTimeout = useCallback(() => {
    setShowSessionWarning(false);
    handleLogout(clearScenarios);
  }, [handleLogout, clearScenarios]);

  const isAuthenticated = currentUser && !currentUser.isAnonymous && viewMode === 'app';

  useSessionTimeout(handleSessionTimeout, isAuthenticated);

  // Listen for session warning
  useEffect(() => {
    const handleWarning = () => setShowSessionWarning(true);
    window.addEventListener('sessionWarning', handleWarning);
    return () => window.removeEventListener('sessionWarning', handleWarning);
  }, []);

  // App State
  const [step, setStep] = useState(1);
  const [showSettings, setShowSettings] = useState(true);
  const [activeTab, setActiveTab] = useState('chart');
  const [rebalanceFreq, setRebalanceFreq] = useState(3);
  const [optimizerRebalanceFreq, setOptimizerRebalanceFreq] = useState(0); // 0 = sequential, 1 = annual, 3 = every 3 years
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);

  // SS Recommendation State
  const [targetMaxPortfolioAge, setTargetMaxPortfolioAge] = useState(80);

  // Manual Allocation Override
  const [useManualAllocation, setUseManualAllocation] = useState(false);
  const [useManualForRebalance, setUseManualForRebalance] = useState(false);
  const [manualAllocationMode, setManualAllocationMode] = useState('dollar'); // 'dollar' or 'percentage'
  const [manualAllocations, setManualAllocations] = useState({
    b1: 0, b2: 0, b3: 0, b4: 0, b5: 0
  });
  const [manualPercentages, setManualPercentages] = useState({
    b1: 0, b2: 0, b3: 0, b4: 0, b5: 0
  });

  // VA GIB (Variable Annuity with Guaranteed Income Benefit) Override
  const [vaEnabled, setVaEnabled] = useState(false);
  const [vaInputs, setVaInputs] = useState({
    allocationType: 'percentage',  // 'percentage' or 'fixed'
    allocationPercent: 20,
    allocationFixed: 100000,
    withdrawalRate: 5.0,
    highWaterMark: true,
    incomeStartAge: 65
  });

  // Client Data
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    isMarried: false,
    isRetired: false,
    partnerIsRetired: false,
    currentAge: 55,
    retirementAge: 65,
    partnerAge: 55,
    partnerRetirementAge: 65,
    currentPortfolio: 500000,
    currentSpending: 8000,
    annualSavings: 25000,
    annualIncome: 0,
    partnerAnnualIncome: 0,
    expectedReturn: 7.0,
  });

  // Architect Inputs
  const [inputs, setInputs] = useState({
    totalPortfolio: 0,
    monthlySpending: 0,
    ssPIA: 2500,
    partnerSSPIA: 2500,
    ssStartAge: 67,
    partnerSSStartAge: 67,
    monthlyPension: 0,
    pensionStartAge: 65,
    pensionCOLA: false,
    partnerMonthlyPension: 0,
    partnerPensionStartAge: 65,
    partnerPensionCOLA: false,
    inflationRate: 2.5,
    personalInflationRate: 1.5,
    ssReinvestRate: 4.5,
    additionalIncomes: [],
    cashFlowAdjustments: [],
    // Tax Settings
    taxEnabled: false,
    filingStatus: 'married', // 'single' or 'married'
    stateRate: 4.5, // State tax rate %
    traditionalPercent: 60, // % of portfolio in traditional (pre-tax) accounts
    rothPercent: 25, // % of portfolio in Roth accounts
    nqPercent: 15, // % of portfolio in non-qualified (brokerage) accounts
    nqDividendYield: 2.0, // Annual dividend yield on NQ holdings %
    nqQualifiedDividendPercent: 80, // % of NQ dividends that are qualified
    nqCapitalGainRate: 50, // % of NQ withdrawal that is capital gain (vs cost basis)
    withdrawalOverrides: {} // Per-age overrides: { [age]: { traditionalPercent, rothPercent, nqPercent } }
  });

  // Return Assumptions
  const [assumptions, setAssumptions] = useState({
    b1: { return: 2.0, stdDev: 2.0, name: "Short Term", historical: 2.8 },
    b2: { return: 4.0, stdDev: 5.0, name: "Mid Term", historical: 5.2 },
    b3: { return: 5.5, stdDev: 8.0, name: "Balanced 60/40", historical: 7.5 },
    b4: { return: 6.0, stdDev: 12.0, name: "Inc & Growth", historical: 9.1 },
    b5: { return: 8.0, stdDev: 18.0, name: "Long Term", historical: 10.2 },
  });

  // --- Scenario Action Wrappers ---
  const handleSaveScenario = () => {
    const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    const legacyBalance = legacyEntry?.total || 0;
    saveScenario({ clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance });
  };

  const handleSaveToCommandCenter = async (selectedClientId) => {
    const result = await saveToCommandCenter({
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      // Include computed data for Command Center display
      monteCarloData,
      basePlan
    }, selectedClientId);
    return result;
  };

  const handleClientSubmit = () => {
    const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    const legacyBalance = legacyEntry?.total || 0;
    submitClientScenario({ clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance });
  };

  const handleClientFinish = async () => {
    const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    const legacyBalance = legacyEntry?.total || 0;
    await submitClientScenario(
      { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance },
      { openScheduling: false }
    );
    window.location.reload();
  };

  const handleLoadScenario = (scenario) => {
    loadScenario(scenario, (s) => {
      setClientInfo({ ...s.clientInfo, partnerAnnualIncome: s.clientInfo.partnerAnnualIncome || 0 });
      setInputs({
        ...s.inputs,
        cashFlowAdjustments: s.inputs.cashFlowAdjustments || [],
        // Migration defaults for 3-way account split
        rothPercent: s.inputs.rothPercent ?? (100 - (s.inputs.traditionalPercent || 70)),
        nqPercent: s.inputs.nqPercent ?? 0,
        nqDividendYield: s.inputs.nqDividendYield ?? 2.0,
        nqQualifiedDividendPercent: s.inputs.nqQualifiedDividendPercent ?? 80,
        nqCapitalGainRate: s.inputs.nqCapitalGainRate ?? 50,
        withdrawalOverrides: s.inputs.withdrawalOverrides || {},
      });
      setAssumptions(s.assumptions);
      if (s.targetMaxPortfolioAge) setTargetMaxPortfolioAge(s.targetMaxPortfolioAge);
      if (s.rebalanceFreq !== undefined) setRebalanceFreq(s.rebalanceFreq);
      // Load VA settings if present
      if (s.vaEnabled !== undefined) setVaEnabled(s.vaEnabled);
      if (s.vaInputs) setVaInputs(s.vaInputs);
      setStep(2);
    });
  };

  const handleDeleteScenario = (e, id, skipConfirm = false) => {
    deleteScenario(e, id, skipConfirm);
  };

  const onLogout = () => {
    handleLogout(clearScenarios);
  };

  // --- Manual Allocation Handlers ---
  const handleManualAllocationChange = (bucket, value, mode = manualAllocationMode) => {
    if (mode === 'percentage') {
      // Update percentage and calculate dollar amount
      setManualPercentages(prev => ({ ...prev, [bucket]: value }));
      const dollarValue = (value / 100) * inputs.totalPortfolio;
      setManualAllocations(prev => ({ ...prev, [bucket]: dollarValue }));
    } else {
      // Update dollar amount and calculate percentage
      setManualAllocations(prev => ({ ...prev, [bucket]: value }));
      const percentValue = inputs.totalPortfolio > 0 ? (value / inputs.totalPortfolio) * 100 : 0;
      setManualPercentages(prev => ({ ...prev, [bucket]: percentValue }));
    }
  };

  const handleManualAllocationModeChange = (newMode) => {
    setManualAllocationMode(newMode);
  };

  const handleRecalculateFromFormula = () => {
    // Reset to formula-calculated values
    const dollarAllocations = {
      b1: formulaBasePlan.b1Val,
      b2: formulaBasePlan.b2Val,
      b3: formulaBasePlan.b3Val,
      b4: formulaBasePlan.b4Val,
      b5: formulaBasePlan.b5Val
    };
    setManualAllocations(dollarAllocations);
    // Calculate percentages
    const total = inputs.totalPortfolio || 1;
    setManualPercentages({
      b1: (dollarAllocations.b1 / total) * 100,
      b2: (dollarAllocations.b2 / total) * 100,
      b3: (dollarAllocations.b3 / total) * 100,
      b4: (dollarAllocations.b4 / total) * 100,
      b5: (dollarAllocations.b5 / total) * 100
    });
  };

  const handleToggleManualAllocation = (enabled) => {
    if (enabled && !useManualAllocation) {
      // When enabling manual mode, initialize with current formula values
      const dollarAllocations = {
        b1: formulaBasePlan.b1Val,
        b2: formulaBasePlan.b2Val,
        b3: formulaBasePlan.b3Val,
        b4: formulaBasePlan.b4Val,
        b5: formulaBasePlan.b5Val
      };
      setManualAllocations(dollarAllocations);
      // Calculate percentages
      const total = inputs.totalPortfolio || 1;
      setManualPercentages({
        b1: (dollarAllocations.b1 / total) * 100,
        b2: (dollarAllocations.b2 / total) * 100,
        b3: (dollarAllocations.b3 / total) * 100,
        b4: (dollarAllocations.b4 / total) * 100,
        b5: (dollarAllocations.b5 / total) * 100
      });
    }
    setUseManualAllocation(enabled);
  };

  // --- VA GIB Handlers ---
  const handleVaInputChange = (field, value) => {
    setVaInputs(prev => ({ ...prev, [field]: value }));
  };
  const handleToggleVa = (enabled) => setVaEnabled(enabled);

  // --- Calculations (using imported utilities) ---
  const accumulationData = useMemo(() => calculateAccumulation(clientInfo, inputs.inflationRate, inputs.additionalIncomes), [clientInfo, inputs.inflationRate, inputs.additionalIncomes]);

  // Standard bucket calculations (no VA)
  const formulaBasePlan = useMemo(() => calculateBasePlan(inputs, assumptions, clientInfo), [inputs, assumptions, clientInfo]);

  // VA-adjusted bucket calculations (with VA income factored in)
  const vaAdjustedBasePlan = useMemo(() => {
    if (!vaEnabled) return null;
    return calculateBasePlan(inputs, assumptions, clientInfo, true, vaInputs);
  }, [inputs, assumptions, clientInfo, vaEnabled, vaInputs]);

  // Use manual allocations if enabled, otherwise use formula-calculated values
  const basePlan = useMemo(() => {
    if (useManualAllocation) {
      return {
        ...formulaBasePlan,
        b1Val: manualAllocations.b1,
        b2Val: manualAllocations.b2,
        b3Val: manualAllocations.b3,
        b4Val: manualAllocations.b4,
        b5Val: manualAllocations.b5
      };
    }
    return formulaBasePlan;
  }, [formulaBasePlan, useManualAllocation, manualAllocations]);

  const ssAnalysis = useMemo(() => calculateSSAnalysis({
    inputs,
    clientInfo,
    assumptions,
    targetMaxPortfolioAge
  }), [inputs, clientInfo, targetMaxPortfolioAge, assumptions]);

  const ssPartnerAnalysis = useMemo(() => calculateSSPartnerAnalysis({
    inputs,
    clientInfo,
    assumptions,
    targetMaxPortfolioAge,
    clientSSWinner: ssAnalysis.winner
  }), [inputs, clientInfo, targetMaxPortfolioAge, assumptions, ssAnalysis.winner]);

  // Rebalance targets: use manual percentages when enabled, otherwise null for formula-based
  const rebalanceTargets = useMemo(() => {
    if (useManualAllocation && useManualForRebalance) {
      return manualPercentages;
    }
    return null;
  }, [useManualAllocation, useManualForRebalance, manualPercentages]);

  const projectionData = useMemo(() => runSimulation(basePlan, assumptions, inputs, rebalanceFreq, false, null, rebalanceTargets), [basePlan, assumptions, inputs, rebalanceFreq, rebalanceTargets]);
  const monteCarloData = useMemo(() => runSimulation(basePlan, assumptions, inputs, rebalanceFreq, true, null, rebalanceTargets), [basePlan, assumptions, inputs, rebalanceFreq, rebalanceTargets]);

  // VA GIB Monte Carlo - uses VA-adjusted bucket allocations
  const vaMonteCarloData = useMemo(() => {
    if (!vaEnabled || !vaAdjustedBasePlan) return null;
    return runSimulation(vaAdjustedBasePlan, assumptions, inputs, rebalanceFreq, true, vaInputs, rebalanceTargets);
  }, [vaAdjustedBasePlan, assumptions, inputs, rebalanceFreq, vaEnabled, vaInputs, rebalanceTargets]);

  // Optimizer data - compare six allocation strategies with consistent rebalancing
  const optimizerData = useMemo(() => {
    try {
      const allocations = calculateAlternativeAllocations(inputs, basePlan);
      return {
        strategy1: runOptimizedSimulation(allocations.strategy1, assumptions, inputs, clientInfo, optimizerRebalanceFreq),
        strategy2: runOptimizedSimulation(allocations.strategy2, assumptions, inputs, clientInfo, optimizerRebalanceFreq),
        strategy3: runOptimizedSimulation(allocations.strategy3, assumptions, inputs, clientInfo, optimizerRebalanceFreq),
        strategy4: runOptimizedSimulation(allocations.strategy4, assumptions, inputs, clientInfo, optimizerRebalanceFreq),
        strategy5: runOptimizedSimulation(allocations.strategy5, assumptions, inputs, clientInfo, optimizerRebalanceFreq),
        strategy6: runOptimizedSimulation(allocations.strategy6, assumptions, inputs, clientInfo, optimizerRebalanceFreq)
      };
    } catch (error) {
      console.error('Optimizer calculation error:', error);
      return null;
    }
  }, [inputs, basePlan, assumptions, clientInfo, optimizerRebalanceFreq]);

  // VA-enabled optimizer data
  const vaOptimizerData = useMemo(() => {
    if (!vaEnabled) return null;
    try {
      const allocations = calculateAlternativeAllocations(inputs, basePlan);
      return {
        strategy1: runOptimizedSimulation(allocations.strategy1, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs),
        strategy2: runOptimizedSimulation(allocations.strategy2, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs),
        strategy3: runOptimizedSimulation(allocations.strategy3, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs),
        strategy4: runOptimizedSimulation(allocations.strategy4, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs),
        strategy5: runOptimizedSimulation(allocations.strategy5, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs),
        strategy6: runOptimizedSimulation(allocations.strategy6, assumptions, inputs, clientInfo, optimizerRebalanceFreq, vaInputs)
      };
    } catch (error) {
      console.error('VA Optimizer calculation error:', error);
      return null;
    }
  }, [inputs, basePlan, assumptions, clientInfo, optimizerRebalanceFreq, vaEnabled, vaInputs]);

  // Keep totalPortfolio in sync with accumulation data
  const finalAccumulationBalance = accumulationData.length > 0 ? accumulationData[accumulationData.length - 1].balance : 0;

  useEffect(() => {
    if (finalAccumulationBalance > 0) {
      setInputs(prev => {
        if (prev.totalPortfolio !== finalAccumulationBalance) {
          return { ...prev, totalPortfolio: finalAccumulationBalance };
        }
        return prev;
      });
    }
  }, [finalAccumulationBalance]);

  // Auto-set SS start age to current age for clients over FRA (already collecting)
  useEffect(() => {
    if (clientInfo.currentAge >= 67) {
      setInputs(prev => {
        const updates = {};
        if (prev.ssStartAge !== clientInfo.currentAge) {
          updates.ssStartAge = clientInfo.currentAge;
        }
        if (clientInfo.isMarried && clientInfo.partnerAge >= 67 && prev.partnerSSStartAge !== clientInfo.partnerAge) {
          updates.partnerSSStartAge = clientInfo.partnerAge;
        }
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [clientInfo.currentAge, clientInfo.partnerAge, clientInfo.isMarried]);

  // Sync retirementAge to currentAge when isRetired is checked
  useEffect(() => {
    if (clientInfo.isRetired && clientInfo.retirementAge !== clientInfo.currentAge) {
      setClientInfo(prev => ({ ...prev, retirementAge: prev.currentAge }));
    }
  }, [clientInfo.isRetired, clientInfo.currentAge, clientInfo.retirementAge]);

  // Sync partnerRetirementAge to partnerAge when partnerIsRetired is checked
  useEffect(() => {
    if (clientInfo.partnerIsRetired && clientInfo.partnerRetirementAge !== clientInfo.partnerAge) {
      setClientInfo(prev => ({ ...prev, partnerRetirementAge: prev.partnerAge }));
    }
  }, [clientInfo.partnerIsRetired, clientInfo.partnerAge, clientInfo.partnerRetirementAge]);

  // --- Handlers ---
  const handleClientChange = (e) => {
    const { name, value, type, checked } = e.target;
    setClientInfo(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value) }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Handle string fields that shouldn't be converted to numbers
    const stringFields = ['filingStatus'];
    let val;
    if (type === 'checkbox') {
      val = checked;
    } else if (stringFields.includes(name)) {
      val = value;
    } else {
      val = parseFloat(value) || 0;
    }
    if ((name === 'ssStartAge' || name === 'partnerSSStartAge') && val > 70) val = 70;
    setInputs(prev => ({ ...prev, [name]: val }));
  };

  // Account Split Handler (3-way: Traditional/Roth/NQ)
  const handleAccountSplitChange = (field, newValue) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
    setInputs(prev => {
      const fields = ['traditionalPercent', 'rothPercent', 'nqPercent'];
      const otherFields = fields.filter(f => f !== field);
      const remainder = 100 - clamped;
      const otherSum = prev[otherFields[0]] + prev[otherFields[1]];
      let val1, val2;
      if (otherSum === 0) {
        val1 = Math.round(remainder / 2);
        val2 = remainder - val1;
      } else {
        val1 = Math.round((prev[otherFields[0]] / otherSum) * remainder);
        val2 = remainder - val1;
      }
      return { ...prev, [field]: clamped, [otherFields[0]]: val1, [otherFields[1]]: val2 };
    });
  };

  // Withdrawal Override Handler (per-age overrides)
  const handleWithdrawalOverrideChange = (age, overrideData) => {
    setInputs(prev => {
      if (age === '__reset_all__') {
        return { ...prev, withdrawalOverrides: {} };
      }
      const overrides = { ...prev.withdrawalOverrides };
      if (overrideData === null) {
        delete overrides[age];
      } else {
        overrides[age] = overrideData;
      }
      return { ...prev, withdrawalOverrides: overrides };
    });
  };

  // Additional Income Stream Handlers
  const addAdditionalIncome = () => {
    setInputs(prev => ({
      ...prev,
      additionalIncomes: [
        ...prev.additionalIncomes,
        { id: Date.now(), name: '', amount: 0, startAge: clientInfo.retirementAge, endAge: 100, isOneTime: false, inflationAdjusted: false, owner: 'client' }
      ]
    }));
  };

  const updateAdditionalIncome = (id, field, value) => {
    setInputs(prev => ({
      ...prev,
      additionalIncomes: prev.additionalIncomes.map(income =>
        income.id === id ? { ...income, [field]: value } : income
      )
    }));
  };

  const removeAdditionalIncome = (id) => {
    setInputs(prev => ({
      ...prev,
      additionalIncomes: prev.additionalIncomes.filter(income => income.id !== id)
    }));
  };

  // Cash Flow Adjustment Handlers
  const addCashFlowAdjustment = () => {
    setInputs(prev => ({
      ...prev,
      cashFlowAdjustments: [
        ...(prev.cashFlowAdjustments || []),
        {
          id: Date.now(),
          name: '',
          type: 'reduction',
          amount: 0,
          startAge: clientInfo.retirementAge,
          endAge: 100,
          inflationAdjusted: false,
          owner: 'client'
        }
      ]
    }));
  };

  const updateCashFlowAdjustment = (id, field, value) => {
    setInputs(prev => ({
      ...prev,
      cashFlowAdjustments: (prev.cashFlowAdjustments || []).map(adj =>
        adj.id === id ? { ...adj, [field]: value } : adj
      )
    }));
  };

  const removeCashFlowAdjustment = (id) => {
    setInputs(prev => ({
      ...prev,
      cashFlowAdjustments: (prev.cashFlowAdjustments || []).filter(adj => adj.id !== id)
    }));
  };

  const handleAssumptionChange = (key, field, value) => {
    setAssumptions(prev => ({ ...prev, [key]: { ...prev[key], [field]: parseFloat(value) || 0 } }));
  };

  const applyHistoricalAverages = () => {
    setAssumptions(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k].return = next[k].historical; });
      return next;
    });
  };

  const applyFourPercentRule = () => {
    const clientSS = getAdjustedSS(inputs.ssPIA, inputs.ssStartAge) * 12;
    const partnerSS = clientInfo.isMarried ? getAdjustedSS(inputs.partnerSSPIA, inputs.partnerSSStartAge) * 12 : 0;
    const totalAnnualSS = clientSS + partnerSS;
    const gapYears = Math.max(0, inputs.ssStartAge - clientInfo.retirementAge);
    let adjustedPortfolio = inputs.totalPortfolio;
    if (gapYears > 0) {
      const rate = 0.04;
      const pvFactor = (1 - Math.pow(1 + rate, -gapYears)) / rate * (1 + rate);
      const bridgeCost = totalAnnualSS * pvFactor;
      adjustedPortfolio = Math.max(0, inputs.totalPortfolio - bridgeCost);
    }
    const safeWithdrawal = adjustedPortfolio * 0.04;
    setInputs(prev => ({ ...prev, monthlySpending: Math.round((safeWithdrawal + totalAnnualSS) / 12) }));
  };

  const updateSSStartAge = (age) => {
    setInputs(prev => ({ ...prev, ssStartAge: age }));
  };

  const updatePartnerSSStartAge = (age) => {
    setInputs(prev => ({ ...prev, partnerSSStartAge: age }));
  };

  const proceedToArchitect = () => {
    const finalAccumulation = accumulationData[accumulationData.length - 1].balance;
    const yearsToRetire = Math.max(0, clientInfo.retirementAge - clientInfo.currentAge);
    const futureSpending = clientInfo.currentSpending * Math.pow(1 + (inputs.personalInflationRate / 100), yearsToRetire);

    // Create updated inputs for saving
    const updatedInputs = { ...inputs, totalPortfolio: finalAccumulation, monthlySpending: Math.round(futureSpending) };

    // Save progress silently
    const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    const legacyBalance = legacyEntry?.total || 0;
    saveProgress({ clientInfo, inputs: updatedInputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance }, userRole);

    setInputs(updatedInputs);
    setStep(2);
    window.scrollTo(0, 0);
  };

  // Client wizard save progress (auto-save after each page)
  // Initialize monthlySpending from currentSpending on first transition, then preserve user modifications
  const handleClientSaveProgress = () => {
    const finalAccumulation = accumulationData[accumulationData.length - 1]?.balance || 0;
    const yearsToRetire = Math.max(0, clientInfo.retirementAge - clientInfo.currentAge);
    const futureSpending = clientInfo.currentSpending * Math.pow(1 + (inputs.personalInflationRate / 100), yearsToRetire);

    const updatedInputs = {
      ...inputs,
      totalPortfolio: finalAccumulation,
      // Initialize monthlySpending from currentSpending if it hasn't been set yet
      monthlySpending: inputs.monthlySpending === 0 ? Math.round(futureSpending) : inputs.monthlySpending
    };

    setInputs(updatedInputs);
    const legacyEntry = projectionData.find(p => p.age >= 95) || projectionData[projectionData.length - 1];
    const legacyBalance = legacyEntry?.total || 0;
    saveProgress({ clientInfo, inputs: updatedInputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance }, userRole);
  };

  const generateReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => {
      window.print();
      setIsGeneratingReport(false);
    }, 500);
  };

  // --- Session Warning Modal ---
  const SessionWarningModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm mx-4 text-center">
        <div className="text-amber-500 text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Session Expiring</h3>
        <p className="text-slate-600 mb-4">
          Your session will expire in 60 seconds due to inactivity.
          Click below to stay logged in.
        </p>
        <button
          onClick={() => setShowSessionWarning(false)}
          className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );

  // --- RENDER FLOW ---
  if (viewMode === 'gate') {
    return (
      <GateScreen
        onAdvisorClick={() => setViewMode('login')}
        onClientLoginClick={() => setViewMode('clientLogin')}
        onProspectEntry={handleProspectEntry}
        isLoggingIn={isLoggingIn}
      />
    );
  }

  // MFA Verification Modal (shown during sign-in)
  if (mfaRequired) {
    return (
      <MfaVerifyModal
        onVerify={verifyMfaCode}
        onCancel={cancelMfa}
        error={mfaError}
      />
    );
  }

  // MFA Enrollment Modal (shown when user needs to set up MFA)
  if (mfaEnrollRequired) {
    return (
      <MfaEnrollModal
        onStartEnrollment={startMfaEnrollment}
        onComplete={completeMfaEnrollment}
        onCancel={cancelMfa}
        error={mfaError}
      />
    );
  }

  // Password Expiry Modal (BOSP: 90-day password expiration)
  if (passwordExpired) {
    return (
      <PasswordExpiryModal
        userEmail={passwordExpiryEmail}
        onSuccess={handlePasswordExpiryResolved}
        onCancel={cancelPasswordExpiry}
      />
    );
  }

  if (viewMode === 'login') {
    return (
      <LoginScreen
        onBack={() => setViewMode('gate')}
        onLogin={handleAdvisorLogin}
        onPasswordReset={handlePasswordReset}
        authError={authError}
        resetStatus={resetStatus}
      />
    );
  }

  if (viewMode === 'clientLogin') {
    return (
      <ClientLoginScreen
        onBack={() => setViewMode('gate')}
        onLogin={handleClientLogin}
        onSignup={handleClientSignup}
        onPasswordReset={handlePasswordReset}
        authError={authError}
        resetStatus={resetStatus}
      />
    );
  }

  // Anonymous Client Wizard Flow (prospective clients)
  if (userRole === 'anonymous') {
    return (
      <ClientWizard
        clientInfo={clientInfo}
        onClientChange={handleClientChange}
        inputs={inputs}
        onInputChange={handleInputChange}
        accumulationData={accumulationData}
        projectionData={projectionData}
        monteCarloData={monteCarloData}
        ssAnalysis={ssAnalysis}
        ssPartnerAnalysis={ssPartnerAnalysis}
        onSaveProgress={handleClientSaveProgress}
        onClientSubmit={handleClientSubmit}
        onClientFinish={handleClientFinish}
        saveStatus={saveStatus}
        targetMaxPortfolioAge={targetMaxPortfolioAge}
        onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
        onUpdateSSStartAge={updateSSStartAge}
        onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
        onAddAdditionalIncome={addAdditionalIncome}
        onUpdateAdditionalIncome={updateAdditionalIncome}
        onRemoveAdditionalIncome={removeAdditionalIncome}
        onAddCashFlowAdjustment={addCashFlowAdjustment}
        onUpdateCashFlowAdjustment={updateCashFlowAdjustment}
        onRemoveCashFlowAdjustment={removeCashFlowAdjustment}
      />
    );
  }

  // Registered Client Flow - same view as prospective clients (ClientWizard)
  if (userRole === 'registeredClient') {
    // Auto-load the first assigned plan if available and not already loaded
    if (savedScenarios.length > 0 && !clientInfo.name && !isLoadingScenarios) {
      // Load the first (most recent) assigned plan
      handleLoadScenario(savedScenarios[0]);
    }

    return (
      <ClientWizard
        clientInfo={clientInfo}
        onClientChange={handleClientChange}
        inputs={inputs}
        onInputChange={handleInputChange}
        accumulationData={accumulationData}
        projectionData={projectionData}
        monteCarloData={monteCarloData}
        ssAnalysis={ssAnalysis}
        ssPartnerAnalysis={ssPartnerAnalysis}
        onSaveProgress={handleClientSaveProgress}
        onClientSubmit={handleClientSubmit}
        onClientFinish={handleClientFinish}
        saveStatus={saveStatus}
        targetMaxPortfolioAge={targetMaxPortfolioAge}
        onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
        onUpdateSSStartAge={updateSSStartAge}
        onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
        onAddAdditionalIncome={addAdditionalIncome}
        onUpdateAdditionalIncome={updateAdditionalIncome}
        onRemoveAdditionalIncome={removeAdditionalIncome}
        onAddCashFlowAdjustment={addCashFlowAdjustment}
        onUpdateCashFlowAdjustment={updateCashFlowAdjustment}
        onRemoveCashFlowAdjustment={removeCashFlowAdjustment}
        isRegisteredClient={true}
        onLogout={onLogout}
      />
    );
  }

  // Advisor Flow - Plan Management View
  if (advisorView === 'management') {
    return (
      <>
      {showSessionWarning && <SessionWarningModal />}
      <PlanManagement
        userRole={userRole}
        currentUser={currentUser}
        savedScenarios={savedScenarios}
        isLoadingScenarios={isLoadingScenarios}
        onLoadScenario={(scenario) => {
          handleLoadScenario(scenario);
          setAdvisorView('planning');
        }}
        onDeleteScenario={handleDeleteScenario}
        onReassignScenario={reassignScenario}
        onRefreshScenarios={refreshScenarios}
        onLogout={onLogout}
        onBackToPlanning={() => setAdvisorView('planning')}
        advisors={advisors}
        isLoadingAdvisors={isLoadingAdvisors}
        onAddAdvisor={addAdvisor}
        onDeleteAdvisor={deleteAdvisor}
        onRefreshAdvisors={refreshAdvisors}
        onAssignPlanToClient={assignPlanToClient}
        onRemoveClientAssignment={removeClientAssignment}
        planFilter={planFilter}
        onPlanFilterChange={setPlanFilter}
        hasTeams={hasTeams}
      />
      </>
    );
  }

  // Advisor Flow - Step 1: Accumulation Phase
  if (step === 1) {
    return (
      <>
      {showSessionWarning && <SessionWarningModal />}
      <AccumulationPage
        userRole={userRole}
        onLogout={onLogout}
        savedScenarios={savedScenarios}
        isLoadingScenarios={isLoadingScenarios}
        onLoadScenario={handleLoadScenario}
        onDeleteScenario={handleDeleteScenario}
        clientInfo={clientInfo}
        onClientChange={handleClientChange}
        inputs={inputs}
        onInputChange={handleInputChange}
        accumulationData={accumulationData}
        onProceed={proceedToArchitect}
        onViewManagement={() => setAdvisorView('management')}
        planFilter={planFilter}
        onPlanFilterChange={setPlanFilter}
        hasTeams={hasTeams}
      />
      </>
    );
  }

  // Step 2: Distribution Phase (Architect)
  return (
    <>
    {showSessionWarning && <SessionWarningModal />}
    <ArchitectPage
      userRole={userRole}
      onBackToInputs={() => setStep(1)}
      saveStatus={saveStatus}
      onSaveScenario={handleSaveScenario}
      onClientSubmit={handleClientSubmit}
      onGenerateReport={generateReport}
      isGeneratingReport={isGeneratingReport}
      clientInfo={clientInfo}
      onClientChange={handleClientChange}
      inputs={inputs}
      onInputChange={handleInputChange}
      assumptions={assumptions}
      onAssumptionChange={handleAssumptionChange}
      onApplyHistoricalAverages={applyHistoricalAverages}
      onApplyFourPercentRule={applyFourPercentRule}
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      activeTab={activeTab}
      onSetActiveTab={setActiveTab}
      rebalanceFreq={rebalanceFreq}
      onSetRebalanceFreq={setRebalanceFreq}
      showCashFlowTable={showCashFlowTable}
      onSetShowCashFlowTable={setShowCashFlowTable}
      basePlan={basePlan}
      accumulationData={accumulationData}
      projectionData={projectionData}
      monteCarloData={monteCarloData}
      optimizerData={optimizerData}
      optimizerRebalanceFreq={optimizerRebalanceFreq}
      onSetOptimizerRebalanceFreq={setOptimizerRebalanceFreq}
      ssAnalysis={ssAnalysis}
      ssPartnerAnalysis={ssPartnerAnalysis}
      targetMaxPortfolioAge={targetMaxPortfolioAge}
      onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
      onUpdateSSStartAge={updateSSStartAge}
      onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
      onAddAdditionalIncome={addAdditionalIncome}
      onUpdateAdditionalIncome={updateAdditionalIncome}
      onRemoveAdditionalIncome={removeAdditionalIncome}
      onAddCashFlowAdjustment={addCashFlowAdjustment}
      onUpdateCashFlowAdjustment={updateCashFlowAdjustment}
      onRemoveCashFlowAdjustment={removeCashFlowAdjustment}
      onViewManagement={() => setAdvisorView('management')}
      // Command Center (The One Process) integration
      commandCenterStatus={commandCenterStatus}
      onSaveToCommandCenter={handleSaveToCommandCenter}
      isCommandCenterConnected={isCommandCenterConnected}
      commandCenterClients={commandCenterClients}
      isLoadingClients={isLoadingClients}
      // Manual Allocation Override
      useManualAllocation={useManualAllocation}
      manualAllocationMode={manualAllocationMode}
      manualAllocations={manualAllocations}
      manualPercentages={manualPercentages}
      useManualForRebalance={useManualForRebalance}
      onToggleManualAllocation={handleToggleManualAllocation}
      onToggleManualForRebalance={setUseManualForRebalance}
      onManualAllocationChange={handleManualAllocationChange}
      onManualAllocationModeChange={handleManualAllocationModeChange}
      onRecalculateFromFormula={handleRecalculateFromFormula}
      formulaAllocations={formulaBasePlan}
      // VA GIB Override
      vaEnabled={vaEnabled}
      vaInputs={vaInputs}
      onToggleVa={handleToggleVa}
      onVaInputChange={handleVaInputChange}
      vaMonteCarloData={vaMonteCarloData}
      vaAdjustedBasePlan={vaAdjustedBasePlan}
      vaOptimizerData={vaOptimizerData}
      // 3-Way Account Split
      onAccountSplitChange={handleAccountSplitChange}
      onWithdrawalOverrideChange={handleWithdrawalOverrideChange}
    />
    </>
  );
}
