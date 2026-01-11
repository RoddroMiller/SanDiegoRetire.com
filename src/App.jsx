import React, { useState, useMemo } from 'react';

// --- Local Imports ---
import { formatPhoneNumber, calculateAccumulation, calculateBasePlan, runSimulation, calculateSSAnalysis, calculateSSPartnerAnalysis, getAdjustedSS } from './utils';
import { GateScreen, LoginScreen, AccumulationPage, ArchitectPage } from './components';
import { useAuth, useScenarios } from './hooks';

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
    handleClientEntry,
    handleAdvisorLogin,
    handleLogout
  } = useAuth();

  // --- Scenarios Hook ---
  const {
    savedScenarios,
    isLoadingScenarios,
    saveStatus,
    saveScenario,
    submitClientScenario,
    loadScenario,
    deleteScenario,
    clearScenarios
  } = useScenarios({ currentUser, userRole });

  // App State
  const [step, setStep] = useState(1);
  const [showSettings, setShowSettings] = useState(true);
  const [activeTab, setActiveTab] = useState('chart');
  const [rebalanceFreq, setRebalanceFreq] = useState(0);
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
    inflationRate: 3.0,
    personalInflationRate: 1.5,
    ssReinvestRate: 4.5,
    additionalIncomes: []
  });

  // Return Assumptions
  const [assumptions, setAssumptions] = useState({
    b1: { return: 2.0, stdDev: 2.0, name: "Short Term", historical: 2.8 },
    b2: { return: 4.0, stdDev: 5.0, name: "Mid Term", historical: 5.2 },
    b3: { return: 5.5, stdDev: 8.0, name: "Hedged Growth", historical: 7.5 },
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

  const handleDeleteScenario = (e, id) => {
    deleteScenario(e, id);
  };

  const onLogout = () => {
    handleLogout(clearScenarios);
  };

  // --- Calculations (using imported utilities) ---
  const accumulationData = useMemo(() => calculateAccumulation(clientInfo), [clientInfo]);
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
    alert(`Social Security Start Age set to ${age}`);
  };

  const updatePartnerSSStartAge = (age) => {
    setInputs(prev => ({ ...prev, partnerSSStartAge: age }));
    alert(`Partner Social Security Start Age set to ${age}`);
  };

  const proceedToArchitect = () => {
    const finalAccumulation = accumulationData[accumulationData.length - 1].balance;
    const yearsToRetire = Math.max(0, clientInfo.retirementAge - clientInfo.currentAge);
    const futureSpending = clientInfo.currentSpending * Math.pow(1 + (inputs.inflationRate / 100), yearsToRetire);
    setInputs(prev => ({ ...prev, totalPortfolio: finalAccumulation, monthlySpending: Math.round(futureSpending) }));
    setStep(2);
    window.scrollTo(0, 0);
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
        onClientEntry={handleClientEntry}
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

  // Step 1: Accumulation Phase
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
      ssAnalysis={ssAnalysis}
      ssPartnerAnalysis={ssPartnerAnalysis}
      targetMaxPortfolioAge={targetMaxPortfolioAge}
      onSetTargetMaxPortfolioAge={setTargetMaxPortfolioAge}
      onUpdateSSStartAge={updateSSStartAge}
      onUpdatePartnerSSStartAge={updatePartnerSSStartAge}
    />
  );
}
