import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, Area, AreaChart, LineChart
} from 'recharts';
import {
  Calculator, DollarSign, TrendingUp, Shield, Clock, AlertCircle, Settings,
  ChevronDown, ChevronUp, Activity, BarChart2, Briefcase, Download, Lock,
  RefreshCw, Percent, Plus, Trash2, History, User, Users, FileText, ArrowRight,
  Info, CheckCircle, RefreshCcw, MousePointerClick, Save, FolderOpen, Loader,
  LogIn, LogOut, UserCheck, Send, Table as TableIcon
} from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { Card, StatBox, AllocationRow, FormattedNumberInput } from '../ui';

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
  onUpdatePartnerSSStartAge
}) => {
  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-800 ${isGeneratingReport ? 'print-mode' : 'p-4 sm:p-6 lg:p-8'}`}>

      {/* REPORT HEADER (Print Only) */}
      <div className="hidden print:flex flex-col h-screen break-after-page items-center justify-center text-center p-12">
        <img src={LOGO_URL} alt="Logo" className="h-32 mb-8" />
        <h1 className="text-5xl font-bold text-slate-900 mb-4">Retirement Illustration Strategy</h1>
        <p className="text-2xl text-slate-500 mb-12">Prepared for {clientInfo.name || "Valued Client"}</p>
        <div className="text-left border-t pt-8 w-full max-w-md mx-auto space-y-2 text-slate-600">
          <p><strong>Email:</strong> {clientInfo.email}</p>
          <p><strong>Phone:</strong> {clientInfo.phone}</p>
          <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-12 w-auto object-contain" />
            <h1 className="text-3xl font-bold text-slate-900">Portfolio Architect</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-1">Distribution Phase Strategy</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBackToInputs} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">
            Back to Inputs
          </button>
          {userRole !== 'client' && (
            <button
              onClick={onSaveScenario}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-sm transition-all font-medium ${saveStatus === 'success' ? 'bg-green-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
            >
              {saveStatus === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : saveStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saveStatus === 'success' ? 'Saved' : 'Save'}
            </button>
          )}
          {userRole === 'client' && (
            <button
              onClick={onClientSubmit}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-sm transition-all font-medium ${saveStatus === 'success' ? 'bg-green-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
            >
              {saveStatus === 'saving' ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {saveStatus === 'success' ? 'Opening...' : 'Talk to an advisor about my plan'}
            </button>
          )}
          {userRole !== 'client' && (
            <button onClick={onGenerateReport} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 shadow-sm transition-all font-medium">
              <FileText className="w-4 h-4" /> PDF Report
            </button>
          )}
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
          <img src={LOGO_URL} alt="Logo" className="h-8" />
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
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Starting Portfolio</label>
                <div className="text-xs text-slate-400 mb-1">(From Accumulation Phase)</div>
                <FormattedNumberInput name="totalPortfolio" value={inputs.totalPortfolio} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm font-bold text-emerald-700 bg-emerald-50" />
              </div>

              <div className="relative group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Monthly Spending Need <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <button
                    onClick={onApplyFourPercentRule}
                    className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-200"
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
                  <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Inflation Rate (%)</label>
                    <input type="number" step="0.1" name="inflationRate" value={inputs.inflationRate} onChange={onInputChange} className="w-full mb-2 px-2 py-1 text-xs border rounded" />
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Personal Inflation Rate (%)</label>
                    <input type="number" step="0.1" name="personalInflationRate" value={inputs.personalInflationRate} onChange={onInputChange} className="w-full px-2 py-1 text-xs border rounded" />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1"><Shield className="w-3 h-3" /> Social Security</h4>
                  <button
                    onClick={() => onSetActiveTab('ss')}
                    className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    Get Recommendation
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase">Benefit @ FRA</label>
                      <FormattedNumberInput name="ssPIA" value={inputs.ssPIA} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase">Start Age (62-70)</label>
                      <input type="number" name="ssStartAge" value={inputs.ssStartAge} onChange={onInputChange} min={62} max={70} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                  </div>
                  {clientInfo.isMarried && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase">Partner Benefit</label>
                        <FormattedNumberInput name="partnerSSPIA" value={inputs.partnerSSPIA} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase">Start Age (62-70)</label>
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
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase">Monthly Amount</label>
                      <FormattedNumberInput name="monthlyPension" value={inputs.monthlyPension} onChange={onInputChange} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase">Start Age</label>
                      <input type="number" name="pensionStartAge" value={inputs.pensionStartAge} onChange={onInputChange} min={55} max={80} className="w-full px-2 py-1 border rounded-md text-sm" />
                    </div>
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
              value={`$${(inputs.totalPortfolio / 1000000).toFixed(2)}M`}
              subtext="Accumulation + Contributions"
              icon={Briefcase}
              colorClass="bg-gray-800 text-white"
            />
            <StatBox
              label="Monthly Need"
              value={`$${inputs.monthlySpending.toLocaleString()}`}
              subtext="Inflation Adjusted"
              icon={AlertCircle}
              colorClass="bg-yellow-500 text-white"
            />
            <StatBox
              label="Success Probability"
              value={`${monteCarloData?.successRate.toFixed(1)}%`}
              subtext="Positive balance at 30yrs"
              icon={Activity}
              colorClass={monteCarloData?.successRate > 80 ? "bg-emerald-600 text-white" : "bg-orange-500 text-white"}
            />
            <StatBox
              label="Legacy Balance (30yr)"
              value={`$${((projectionData[projectionData.length - 1]?.total || 0) / 1000000).toFixed(2)}M`}
              subtext="Projected Ending Value"
              icon={Shield}
              colorClass="bg-emerald-800 text-white"
            />
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 print:hidden">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              <button
                onClick={() => onSetActiveTab('chart')}
                className={`${activeTab === 'chart' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <BarChart2 className="w-4 h-4" /> Allocation & Plan
              </button>
              <button
                onClick={() => onSetActiveTab('montecarlo')}
                className={`${activeTab === 'montecarlo' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Activity className="w-4 h-4" /> Monte Carlo
              </button>
              <button
                onClick={() => onSetActiveTab('ss')}
                className={`${activeTab === 'ss' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Shield className="w-4 h-4" /> SS Optimization
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
      <img src={LOGO_URL} alt="Logo" className="h-8" />
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
                  { name: 'Hedged', value: basePlan.b3Val, color: COLORS.hedged },
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
            color={COLORS.hedged} name="3. Hedged Growth"
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
                <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val.toFixed(1)}%`} domain={[0, 'auto']} />
                <Tooltip
                  formatter={(val, name) => {
                    if (name === 'Distribution Rate') return `${val.toFixed(2)}%`;
                    if (name === 'Balanced 60/40') return `$${val.toLocaleString()}`;
                    return `$${val.toLocaleString()}`;
                  }}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend />
                <Area type="monotone" dataKey="total" name="Portfolio Balance" fill={COLORS.areaFill} stroke={COLORS.areaFill} fillOpacity={0.8} />
                <Line type="monotone" dataKey="benchmark" name="Balanced 60/40" stroke={COLORS.benchmark} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="distRate" name="Distribution Rate" stroke={COLORS.distRate} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 text-xs text-yellow-800 rounded border border-yellow-100 flex items-start gap-2">
            <Activity className="w-4 h-4 mt-0.5" />
            <p>
              <strong>Distribution Rate (Red Line):</strong> Shows annual withdrawal as % of portfolio. Rising rate indicates depletion risk. <br />
              <strong>Balanced 60/40 (Gold Line):</strong> Benchmark comparison using Hedged Growth returns.
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
            <YAxis tickFormatter={(val) => `$${val / 1000}k`} />
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
          <div className="bg-slate-800 text-white p-6 rounded-xl mb-6 flex items-center gap-4">
            <Users className="w-10 h-10 text-yellow-500" />
            <div>
              <h4 className="text-lg font-bold">Partner Recommendation</h4>
              <p className="text-gray-400 text-sm mt-1">
                Claim at Age <strong className="text-yellow-500 text-lg">{ssPartnerAnalysis.winner.age}</strong> to maximize portfolio balance at age {targetMaxPortfolioAge}.
              </p>
            </div>
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
      <img src={LOGO_URL} alt="Logo" className="h-8" />
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
