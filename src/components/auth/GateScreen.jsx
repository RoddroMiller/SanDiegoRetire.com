import React, { useState, useMemo } from 'react';
import { Briefcase, User, Loader, TrendingUp, BarChart3, CheckCircle, DollarSign, Wallet, ShieldCheck, Landmark } from 'lucide-react';
import { AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LOGO_URL } from '../../constants';
import { COLORS } from '../../constants/colors';
import { Disclaimer, PrivacyTermsModal } from '../ui';
import { calculateAccumulation, calculateBasePlan, runSimulation, getAdjustedSS } from '../../utils';

// --- Sample scenario: married couple, both 55, one earner at $120k, spouse doesn't work ---
const SAMPLE_CLIENT = {
  name: 'Sample', email: '', phone: '',
  isMarried: true,
  isRetired: false, partnerIsRetired: false,
  currentAge: 55, retirementAge: 65,
  partnerAge: 55, partnerRetirementAge: 65,
  currentPortfolio: 500000,
  currentSpending: 7500,
  annualSavings: 24000,
  annualIncome: 120000,
  partnerAnnualIncome: 0,
  expectedReturn: 6.0,
};

// Worker PIA at FRA (67) for $120k earner ≈ $3,384
// Spousal benefit = 50% of worker PIA = $1,692
const WORKER_SS_PIA = 3384;
const SPOUSE_SS_PIA = 1692;

const SAMPLE_ASSUMPTIONS = {
  b1: { return: 2.0, stdDev: 2.0, name: "B1 - Short Term", historical: 2.8 },
  b2: { return: 4.0, stdDev: 5.0, name: "B2 - Mid Term", historical: 5.2 },
  b3: { return: 5.5, stdDev: 8.0, name: "B3 - Balanced 60/40", historical: 7.5 },
  b4: { return: 6.0, stdDev: 12.0, name: "B4 - Inc & Growth", historical: 9.1 },
  b5: { return: 8.0, stdDev: 18.0, name: "B5 - Long Term", historical: 10.2 },
};

const SAMPLE_INPUTS_BASE = {
  monthlySpending: 7500,
  ssPIA: WORKER_SS_PIA,
  partnerSSPIA: SPOUSE_SS_PIA,
  ssStartAge: 65,
  partnerSSStartAge: 65,
  monthlyPension: 0, pensionStartAge: 65, pensionCOLA: false,
  partnerMonthlyPension: 0, partnerPensionStartAge: 65, partnerPensionCOLA: false,
  inflationRate: 2.5,
  personalInflationRate: 1.5,
  ssReinvestRate: 4.5,
  additionalIncomes: [],
  cashFlowAdjustments: [],
  taxEnabled: false,
  filingStatus: 'married',
  stateRate: 4.5,
  traditionalPercent: 60, rothPercent: 25, nqPercent: 15,
  nqDividendYield: 2.0, nqQualifiedDividendPercent: 80, nqCapitalGainRate: 50,
  withdrawalOverrides: {},
  ssBridgeNqPercent: 50,
  ssMarginalTaxRate: 22,
};

const formatDollar = (v) => `$${(v / 1000).toFixed(0)}k`;
const formatDollarFull = (v) => `$${Math.round(v).toLocaleString()}`;
const formatDollarM = (v) => `$${(v / 1000000).toFixed(1)}M`;

export const GateScreen = ({ onAdvisorClick, onClientLoginClick, onProspectEntry, isLoggingIn }) => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Run the real models with sample scenario inputs
  const sample = useMemo(() => {
    const accData = calculateAccumulation(SAMPLE_CLIENT, SAMPLE_INPUTS_BASE.inflationRate, []);
    const retirementBalance = accData[accData.length - 1].balance;

    // Inflate today's $7,500/mo spending to retirement date using personalInflationRate
    const yearsToRetire = SAMPLE_CLIENT.retirementAge - SAMPLE_CLIENT.currentAge;
    const futureSpending = Math.round(SAMPLE_CLIENT.currentSpending * Math.pow(1 + (SAMPLE_INPUTS_BASE.personalInflationRate / 100), yearsToRetire));

    const inputs = { ...SAMPLE_INPUTS_BASE, totalPortfolio: retirementBalance, monthlySpending: futureSpending };
    const basePlan = calculateBasePlan(inputs, SAMPLE_ASSUMPTIONS, SAMPLE_CLIENT);
    const projData = runSimulation(basePlan, SAMPLE_ASSUMPTIONS, inputs, 3, false);
    const mcData = runSimulation(basePlan, SAMPLE_ASSUMPTIONS, inputs, 3, true);

    // SS amounts for display
    const workerSS = Math.round(getAdjustedSS(WORKER_SS_PIA, 65));
    const spouseSS = Math.round(getAdjustedSS(SPOUSE_SS_PIA, 65));
    const combinedSS = workerSS + spouseSS;
    const netWithdrawal = futureSpending - combinedSS;

    // Build projection chart at target ages, using last sim entry for age 95 if needed
    const targetAges = [65, 70, 75, 80, 85, 90, 95];
    const lastEntry = projData[projData.length - 1];
    const projChart = targetAges.map(age => {
      const match = projData.find(p => p.age === age);
      if (match) return match;
      if (age === 95 && lastEntry) return { ...lastEntry, age: 95 };
      if (age === 65) return { age: 65, total: retirementBalance, benchmark: retirementBalance };
      return null;
    }).filter(Boolean);

    const legacyEntry = projData.find(p => p.age >= 95) || lastEntry;

    return {
      accData,
      projChart,
      retirementBalance,
      futureSpending,
      successRate: Math.round(mcData.successRate),
      legacy: legacyEntry?.total || 0,
      workerSS,
      spouseSS,
      combinedSS,
      netWithdrawal,
    };
  }, []);

  const handleProspectClick = () => setShowPrivacyModal(true);
  const handleAcceptTerms = () => { setShowPrivacyModal(false); onProspectEntry(); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl max-w-4xl w-full text-center">
        {/* Logo */}
        <img src={LOGO_URL} alt="Logo" className="w-full h-auto mx-auto mb-4 sm:mb-6" />

        {/* Hero Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
          Are you on track for retirement?
        </h1>
        <p className="text-base sm:text-lg text-slate-500 mb-6 sm:mb-8 max-w-2xl mx-auto">
          Build a personalized retirement plan in minutes — see how your savings grow and how long they'll last.
        </p>

        {/* Two Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Page 1 Preview — Accumulation */}
          <div className="border border-slate-200 rounded-xl p-4 sm:p-5 text-left">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Step 1</p>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3">Enter Your Details</h3>
            <div className="h-36 sm:h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sample.accData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gateAccGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.areaFill} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.areaFill} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatDollar} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(v) => [formatDollarFull(v), 'Balance']}
                    labelFormatter={(l) => `Age ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="balance" stroke={COLORS.areaFill} fill="url(#gateAccGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-3 text-xs text-slate-500 px-1">
              <span>Start: <span className="font-semibold text-slate-700">$500k</span></span>
              <span>At Retirement: <span className="font-semibold text-slate-700">{formatDollar(sample.retirementBalance)}</span></span>
            </div>
          </div>

          {/* Page 2 Preview — Projections */}
          <div className="border border-slate-200 rounded-xl p-4 sm:p-5 text-left">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Step 2</p>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3">See Your Projections</h3>
            <div className="h-36 sm:h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sample.projChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatDollar} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(v, name) => [formatDollarFull(v), name === 'total' ? 'Bucket Strategy' : 'Traditional']}
                    labelFormatter={(l) => `Age ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="total" fill={COLORS.areaFill} opacity={0.7} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="benchmark" stroke={COLORS.benchmark} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-700">{sample.successRate}% Success Rate</span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Retirement Portfolio', value: formatDollarM(sample.retirementBalance), icon: DollarSign, color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Monthly Spending', value: `$${sample.futureSpending.toLocaleString()}`, icon: Wallet, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Success Probability', value: `${sample.successRate}%`, icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Legacy at Age 95', value: formatDollarM(sample.legacy), icon: Landmark, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 sm:p-4 text-center`}>
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
              <p className={`text-lg sm:text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Get Started Button */}
        <div className="max-w-sm mx-auto mb-6 sm:mb-8">
          <button
            onClick={handleProspectClick}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 p-3.5 sm:p-4 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all font-bold shadow-lg disabled:opacity-50 text-base sm:text-lg"
          >
            {isLoggingIn ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <User className="w-5 h-5" />
            )}
            {isLoggingIn ? 'Loading...' : 'Get Started'}
          </button>
        </div>

        {/* Sample Scenario Details */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 mb-6 sm:mb-8 max-w-2xl mx-auto text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Sample Scenario</p>
          <p className="text-sm sm:text-base text-slate-700">
            A married couple, both <span className="font-semibold">age 55</span>, with{' '}
            <span className="font-semibold">$500k saved</span>, contributing{' '}
            <span className="font-semibold">$24k/year</span>, planning to retire at{' '}
            <span className="font-semibold">65</span>. One spouse earns{' '}
            <span className="font-semibold">$120k/year</span>; the other does not work.{' '}
            Currently spending <span className="font-semibold">$7,500/month</span>, which inflates to{' '}
            <span className="font-semibold">${sample.futureSpending.toLocaleString()}/month</span> by retirement.{' '}
            Combined Social Security at 65 — worker{' '}
            <span className="font-semibold">~${sample.workerSS.toLocaleString()}/mo</span> + spousal 50% benefit{' '}
            <span className="font-semibold">~${sample.spouseSS.toLocaleString()}/mo</span> — covers{' '}
            <span className="font-semibold">${sample.combinedSS.toLocaleString()}/month</span>, so only{' '}
            <span className="font-semibold">${sample.netWithdrawal.toLocaleString()}/month</span> needs to come from savings.
          </p>
        </div>

        {/* Advisor Login */}
        <div className="max-w-sm mx-auto">
          <button
            onClick={onAdvisorClick}
            className="w-full flex items-center justify-center gap-2 p-3 bg-white text-emerald-800 rounded-xl hover:bg-emerald-50 transition-all font-semibold text-sm"
          >
            <Briefcase className="w-4 h-4" /> Advisor Login
          </button>
        </div>

        <Disclaimer className="text-left mt-6" />

        <PrivacyTermsModal
          isOpen={showPrivacyModal}
          onAccept={handleAcceptTerms}
          onClose={() => setShowPrivacyModal(false)}
        />
      </div>
    </div>
  );
};

export default GateScreen;
