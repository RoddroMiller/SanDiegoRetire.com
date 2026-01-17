import React, { useState, useMemo, useEffect } from 'react';

// --- Local Imports ---
import { formatPhoneNumber, calculateAccumulation, calculateBasePlan, runSimulation, calculateSSAnalysis, calculateSSPartnerAnalysis, getAdjustedSS, calculateAlternativeAllocations, runOptimizedSimulation } from './utils';
import { GateScreen, LoginScreen, ClientLoginScreen, AccumulationPage, ArchitectPage, ClientWizard, PlanManagement } from './components';
import { useAuth, useScenarios, useAdvisors } from './hooks';

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
    handleProspectEntry,
    handleClientLogin,
    handleClientSignup,
    handleAdvisorLogin,
    handlePasswordReset,
    handleLogout
  } = useAuth();

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
  } = useScenarios({ currentUser, userRole });

  // Advisor view state (planning vs management)
  const [advisorView, setAdvisorView] = useState('planning');

  // --- Advisors Hook ---
  const {
    advisors,
    isLoadingAdvisors,
    addAdvisor,
    deleteAdvisor,
    refreshAdvisors
  } = useAdvisors();

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
    additionalIncomes: []
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
    saveScenario({ clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq });
  };

  const handleClientSubmit = () => {
    submitClientScenario({ clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq });
  };

  const handleLoadScenario = (scenario) => {
    loadScenario(scenario, (s) => {
      setClientInfo(s.clientInfo);
      setInputs(s.inputs);
      setAssumptions(s.assumptions);
      if (s.targetMaxPortfolioAge) setTargetMaxPortfolioAge(s.targetMaxPortfolioAge);
      if (s.rebalanceFreq !== undefined) setRebalanceFreq(s.rebalanceFreq);
      setStep(2);
    });
  };

  const handleDeleteScenario = (e, id, skipConfirm = false) => {
    deleteScenario(e, id, skipConfirm);
  };

  const onLogout = () => {
    handleLogout(clearScenarios);
  };

  // --- Calculations (using imported utilities) ---
  const accumulationData = useMemo(() => calculateAccumulation(clientInfo, inputs.inflationRate, inputs.additionalIncomes), [clientInfo, inputs.inflationRate, inputs.additionalIncomes]);
  const basePlan = useMemo(() => calculateBasePlan(inputs, assumptions, clientInfo), [inputs, assumptions, clientInfo]);

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

  const projectionData = useMemo(() => runSimulation(basePlan, assumptions, inputs, rebalanceFreq, false), [basePlan, assumptions, inputs, rebalanceFreq]);
  const monteCarloData = useMemo(() => runSimulation(basePlan, assumptions, inputs, rebalanceFreq, true), [basePlan, assumptions, inputs, rebalanceFreq]);

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
    let val = type === 'checkbox' ? checked : (parseFloat(value) || 0);
    if ((name === 'ssStartAge' || name === 'partnerSSStartAge') && val > 70) val = 70;
    setInputs(prev => ({ ...prev, [name]: val }));
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
    saveProgress({ clientInfo, inputs: updatedInputs, assumptions, targetMaxPortfolioAge, rebalanceFreq }, userRole);

    setInputs(updatedInputs);
    setStep(2);
    window.scrollTo(0, 0);
  };

  // Client wizard save progress (auto-save after each page)
  const handleClientSaveProgress = () => {
    const finalAccumulation = accumulationData[accumulationData.length - 1]?.balance || 0;
    const yearsToRetire = Math.max(0, clientInfo.retirementAge - clientInfo.currentAge);
    const futureSpending = clientInfo.currentSpending * Math.pow(1 + (inputs.personalInflationRate / 100), yearsToRetire);

    const updatedInputs = {
      ...inputs,
      totalPortfolio: finalAccumulation,
      monthlySpending: Math.round(futureSpending)
    };

    setInputs(updatedInputs);
    saveProgress({ clientInfo, inputs: updatedInputs, assumptions, targetMaxPortfolioAge, rebalanceFreq }, userRole);
  };

  const generateReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => {
      window.print();
      setIsGeneratingReport(false);
    }, 500);
  };

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

  if (viewMode === 'login') {
    return (
      <LoginScreen
        onBack={() => setViewMode('gate')}
        onLogin={handleAdvisorLogin}
        authError={authError}
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
        saveStatus={saveStatus}
        targetMaxPortfolioAge={targetMaxPortfolioAge}
        onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
        onUpdateSSStartAge={updateSSStartAge}
        onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
        onAddAdditionalIncome={addAdditionalIncome}
        onUpdateAdditionalIncome={updateAdditionalIncome}
        onRemoveAdditionalIncome={removeAdditionalIncome}
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
        saveStatus={saveStatus}
        targetMaxPortfolioAge={targetMaxPortfolioAge}
        onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
        onUpdateSSStartAge={updateSSStartAge}
        onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
        onAddAdditionalIncome={addAdditionalIncome}
        onUpdateAdditionalIncome={updateAdditionalIncome}
        onRemoveAdditionalIncome={removeAdditionalIncome}
        isRegisteredClient={true}
        onLogout={onLogout}
      />
    );
  }

  // Advisor Flow - Plan Management View
  if (advisorView === 'management') {
    return (
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
      />
    );
  }

  // Advisor Flow - Step 1: Accumulation Phase
  if (step === 1) {
    return (
      <AccumulationPage
        userRole={userRole}
        onLogout={onLogout}
        savedScenarios={savedScenarios}
        isLoadingScenarios={isLoadingScenarios}
        onLoadScenario={handleLoadScenario}
        onDeleteScenario={handleDeleteScenario}
        clientInfo={clientInfo}
        onClientChange={handleClientChange}
        accumulationData={accumulationData}
        onProceed={proceedToArchitect}
        onViewManagement={() => setAdvisorView('management')}
      />
    );
  }

  // Step 2: Distribution Phase (Architect)
  return (
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
      onViewManagement={() => setAdvisorView('management')}
    />
  );
}
