import React, { useState } from 'react';
import {
  Briefcase, DollarSign, Shield, Info, Plus, Trash2, RefreshCcw,
  TrendingUp, Settings, Table as TableIcon
} from 'lucide-react';

import { estimatePIAFromIncome } from '../../utils';
import { Card, FormattedNumberInput } from '../ui';

/**
 * Inputs Page - Dedicated full-page layout for all retirement planning inputs.
 * Extracted from the ArchitectPage sidebar to give inputs more space.
 */
export const InputsPage = ({
  // Client Data
  clientInfo,
  onClientChange,
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
  // SS Settings
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
  // 3-Way Account Split
  onAccountSplitChange,
  onWithdrawalOverrideChange,
  // Navigation
  onSetActiveTab,
  // Projection data (for withdrawal strategy button)
  projectionData,
}) => {
  // SS Estimator state (local to this page)
  const [showSSEstimator, setShowSSEstimator] = useState(false);
  const [ssEstimateIncome, setSSEstimateIncome] = useState('');
  const [showPartnerSSEstimator, setShowPartnerSSEstimator] = useState(false);
  const [partnerSSEstimateIncome, setPartnerSSEstimateIncome] = useState('');

  // Withdrawal Override modal state
  const [showWithdrawalOverrides, setShowWithdrawalOverrides] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Retirement Inputs</h1>
        <p className="text-sm text-slate-500 mt-1">Configure all planning assumptions and income sources below.</p>
      </div>

      {/* Retirement Inputs Card */}
      <Card className="p-6 border-t-4 border-emerald-500">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 text-lg">
          <Briefcase className="w-5 h-5" /> Retirement Inputs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="text-[12px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors font-medium"
              >
                Set to 4% Rule
              </button>
            </div>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
              Based on ${clientInfo.currentSpending.toLocaleString()} current spend adjusted for inflation over {clientInfo.retirementAge - clientInfo.currentAge} years.
            </div>
            <FormattedNumberInput name="monthlySpending" value={inputs.monthlySpending} onChange={onInputChange} className="w-full mt-1 px-3 py-2 border rounded-md text-sm font-bold text-slate-700" />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="mt-6">
          <button onClick={onToggleSettings} className="text-sm text-emerald-600 underline flex items-center gap-1">
            <Settings className="w-4 h-4" />
            {showSettings ? "Hide Advanced Settings" : "Advanced Settings"}
          </button>
          {showSettings && (
            <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Inflation Rate (%) <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    General inflation rate for income sources like Social Security and pensions.
                  </div>
                  <input type="number" step="0.1" name="inflationRate" value={inputs.inflationRate} onChange={onInputChange} className="w-full px-3 py-2 text-sm border rounded-md" />
                </div>
                <div className="relative group">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Personal Inflation Rate (%) <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Your personal spending inflation, typically lower than general inflation in retirement.
                  </div>
                  <input type="number" step="0.1" name="personalInflationRate" value={inputs.personalInflationRate} onChange={onInputChange} className="w-full px-3 py-2 text-sm border rounded-md" />
                </div>
              </div>

              {/* Tax Settings Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Tax Impact Analysis <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <button
                    type="button"
                    onClick={() => onInputChange({ target: { name: 'taxEnabled', type: 'checkbox', checked: !inputs.taxEnabled } })}
                    className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                      inputs.taxEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {inputs.taxEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {inputs.taxEnabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                          Filing Status <Info className="w-3 h-3 text-slate-400" />
                        </label>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                          Your federal tax filing status.
                        </div>
                        <select
                          name="filingStatus"
                          value={inputs.filingStatus}
                          onChange={onInputChange}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-white"
                        >
                          <option value="married">Married Filing Jointly</option>
                          <option value="single">Single</option>
                        </select>
                      </div>
                      <div className="relative group">
                        <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                          State Tax Rate % <Info className="w-3 h-3 text-slate-400" />
                        </label>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                          Your state income tax rate (0 for states with no income tax).
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          name="stateRate"
                          value={inputs.stateRate}
                          onChange={onInputChange}
                          min="0"
                          max="15"
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                    </div>

                    {/* Account Type Mix */}
                    <div>
                      <label className="text-xs text-slate-400 uppercase font-semibold">Account Type Mix</label>
                      <div className="grid grid-cols-3 gap-3 mt-1">
                        <div className="relative group">
                          <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                            Traditional % <Info className="w-3 h-3 text-slate-400" />
                          </label>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                            Traditional (pre-tax) accounts: 401k, Traditional IRA. Withdrawals taxed as ordinary income.
                          </div>
                          <input
                            type="number" step="5" min="0" max="100"
                            value={inputs.traditionalPercent}
                            onChange={(e) => onAccountSplitChange('traditionalPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border rounded-md"
                          />
                        </div>
                        <div className="relative group">
                          <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                            Roth % <Info className="w-3 h-3 text-slate-400" />
                          </label>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                            Roth accounts: Roth IRA, Roth 401k. Withdrawals are tax-free.
                          </div>
                          <input
                            type="number" step="5" min="0" max="100"
                            value={inputs.rothPercent}
                            onChange={(e) => onAccountSplitChange('rothPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border rounded-md"
                          />
                        </div>
                        <div className="relative group">
                          <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                            NQ % <Info className="w-3 h-3 text-slate-400" />
                          </label>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                            Non-qualified (brokerage). Only capital gains taxed at LTCG rates; dividends taxed annually.
                          </div>
                          <input
                            type="number" step="5" min="0" max="100"
                            value={inputs.nqPercent}
                            onChange={(e) => onAccountSplitChange('nqPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border rounded-md"
                          />
                        </div>
                      </div>
                      <div className={`text-xs mt-1 font-medium ${inputs.traditionalPercent + inputs.rothPercent + inputs.nqPercent === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Sum: {inputs.traditionalPercent + inputs.rothPercent + inputs.nqPercent}%{inputs.traditionalPercent + inputs.rothPercent + inputs.nqPercent !== 100 ? ' (must equal 100%)' : ''}
                      </div>
                    </div>

                    {/* NQ Assumptions (only when NQ > 0) */}
                    {inputs.nqPercent > 0 && (
                      <div>
                        <label className="text-xs text-slate-400 uppercase font-semibold">NQ Assumptions</label>
                        <div className="grid grid-cols-3 gap-3 mt-1">
                          <div className="relative group">
                            <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                              Div Yield % <Info className="w-3 h-3 text-slate-400" />
                            </label>
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                              Annual dividend yield on NQ holdings. Dividends are taxed annually regardless of withdrawal.
                            </div>
                            <input
                              type="number" step="0.25" min="0" max="10"
                              name="nqDividendYield"
                              value={inputs.nqDividendYield}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 text-sm border rounded-md"
                            />
                          </div>
                          <div className="relative group">
                            <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                              Qual Div % <Info className="w-3 h-3 text-slate-400" />
                            </label>
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                              % of NQ dividends that qualify for preferential LTCG tax rates.
                            </div>
                            <input
                              type="number" step="5" min="0" max="100"
                              name="nqQualifiedDividendPercent"
                              value={inputs.nqQualifiedDividendPercent}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 text-sm border rounded-md"
                            />
                          </div>
                          <div className="relative group">
                            <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                              Gain Rate % <Info className="w-3 h-3 text-slate-400" />
                            </label>
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                              Estimated % of NQ withdrawal that is capital gain (vs. cost basis return). Higher = more taxable.
                            </div>
                            <input
                              type="number" step="5" min="0" max="100"
                              name="nqCapitalGainRate"
                              value={inputs.nqCapitalGainRate}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 text-sm border rounded-md"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Withdrawal Strategy Button */}
                    {projectionData && projectionData.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowWithdrawalOverrides(true)}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100 transition-colors font-medium"
                      >
                        <TableIcon className="w-4 h-4" /> Withdrawal Strategy by Year
                        {Object.keys(inputs.withdrawalOverrides || {}).length > 0 && (
                          <span className="bg-amber-200 text-amber-800 text-xs px-2 rounded-full ml-1">
                            {Object.keys(inputs.withdrawalOverrides).length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Social Security Card */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5" /> Social Security
        </h3>
        <div className="flex justify-end mb-4">
          <button
            onClick={() => onSetActiveTab('ss')}
            className="text-sm bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors font-medium"
          >
            Get Recommendation
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Benefit @ FRA <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                Your Social Security benefit at Full Retirement Age (67) from your SSA statement.
              </div>
              <FormattedNumberInput name="ssPIA" value={inputs.ssPIA} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm" />
              <button type="button" onClick={() => setShowSSEstimator(!showSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                {showSSEstimator ? 'Hide estimator' : 'Estimate from income'}
              </button>
            </div>
            <div className="relative group">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Start Age (62-70) <Info className="w-3 h-3 text-slate-400" />
              </label>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                The age you plan to begin collecting Social Security benefits.
              </div>
              <input type="number" name="ssStartAge" value={inputs.ssStartAge} onChange={onInputChange} min={62} max={70} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
          </div>
          {showSSEstimator && (
            <div className="flex items-center gap-2 mt-1">
              <input type="number" placeholder="Annual income" value={ssEstimateIncome} onChange={e => setSSEstimateIncome(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
              <button type="button" onClick={() => {
                const pia = estimatePIAFromIncome(Number(ssEstimateIncome));
                if (pia > 0) onInputChange({ target: { name: 'ssPIA', value: pia } });
              }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                Use
              </button>
            </div>
          )}
          {clientInfo.isMarried && (
            <>
              <div className="border-t border-slate-100 pt-4 mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Partner's Social Security</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Partner Benefit <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Your partner's Social Security benefit at Full Retirement Age.
                  </div>
                  <FormattedNumberInput name="partnerSSPIA" value={inputs.partnerSSPIA} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm" />
                  <button type="button" onClick={() => setShowPartnerSSEstimator(!showPartnerSSEstimator)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
                    {showPartnerSSEstimator ? 'Hide estimator' : 'Estimate from income'}
                  </button>
                </div>
                <div className="relative group">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Start Age (62-70) <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    The age your partner plans to begin collecting Social Security.
                  </div>
                  <input type="number" name="partnerSSStartAge" value={inputs.partnerSSStartAge} onChange={onInputChange} min={62} max={70} className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
              </div>
              {showPartnerSSEstimator && (
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" placeholder="Partner annual income" value={partnerSSEstimateIncome} onChange={e => setPartnerSSEstimateIncome(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
                  <button type="button" onClick={() => {
                    const pia = estimatePIAFromIncome(Number(partnerSSEstimateIncome));
                    if (pia > 0) onInputChange({ target: { name: 'partnerSSPIA', value: pia } });
                  }} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap">
                    Use
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Pension / Other Income Card */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 text-lg">
          <DollarSign className="w-5 h-5" /> Pension / Other Income
        </h3>
        <div className="space-y-5">
          {/* Client Pension */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">{clientInfo.name || 'Client'}'s Pension</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative group">
                <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  Monthly Pension <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Monthly pension or other guaranteed income amount.
                </div>
                <FormattedNumberInput name="monthlyPension" value={inputs.monthlyPension} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div className="relative group">
                <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  Start Age <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  The age your pension payments begin.
                </div>
                <input type="number" name="pensionStartAge" value={inputs.pensionStartAge} onChange={onInputChange} min={55} max={80} className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div className="relative group">
                <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  COLA <Info className="w-3 h-3 text-slate-400" />
                </label>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                  Does the pension have a Cost of Living Adjustment?
                </div>
                <button
                  type="button"
                  onClick={() => onInputChange({ target: { name: 'pensionCOLA', type: 'checkbox', checked: !inputs.pensionCOLA } })}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    inputs.pensionCOLA
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-300 hover:border-emerald-400'
                  }`}
                >
                  {inputs.pensionCOLA ? '✓ Yes' : 'No'}
                </button>
              </div>
            </div>
          </div>

          {/* Partner Pension - only show if married */}
          {clientInfo.isMarried && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">{clientInfo.partnerName || 'Partner'}'s Pension</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative group">
                  <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                    Monthly Pension <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-56 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Partner's monthly pension or other guaranteed income.
                  </div>
                  <FormattedNumberInput name="partnerMonthlyPension" value={inputs.partnerMonthlyPension} onChange={onInputChange} className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div className="relative group">
                  <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                    Start Age <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    The age partner's pension payments begin.
                  </div>
                  <input type="number" name="partnerPensionStartAge" value={inputs.partnerPensionStartAge} onChange={onInputChange} min={55} max={80} className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div className="relative group">
                  <label className="text-xs text-slate-500 uppercase flex items-center gap-1">
                    COLA <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-10">
                    Does partner's pension have a COLA?
                  </div>
                  <button
                    type="button"
                    onClick={() => onInputChange({ target: { name: 'partnerPensionCOLA', type: 'checkbox', checked: !inputs.partnerPensionCOLA } })}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      inputs.partnerPensionCOLA
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {inputs.partnerPensionCOLA ? '✓ Yes' : 'No'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Additional Income & One-Time Events Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5" /> Additional Income & One-Time Events
          </h3>
          <button
            onClick={onAddAdditionalIncome}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-100"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {inputs.additionalIncomes?.length === 0 && (
          <p className="text-sm text-slate-400 italic">
            Rental income, inheritance, real estate sale, etc.
          </p>
        )}

        <div className="space-y-3">
          {inputs.additionalIncomes?.map((income) => (
            <div key={income.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-3 gap-2">
                <select
                  value={income.name}
                  onChange={(e) => {
                    const type = e.target.value;
                    onUpdateAdditionalIncome(income.id, 'name', type);
                    const oneTimeTypes = ['Real Estate Sale', 'Inheritance', 'Business Sale'];
                    const isOneTime = oneTimeTypes.includes(type);
                    onUpdateAdditionalIncome(income.id, 'isOneTime', isOneTime);
                    if (isOneTime) onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                  }}
                  className="text-sm font-medium bg-white border rounded px-2 py-1"
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
                {clientInfo.isMarried && (
                  <select
                    value={income.owner || 'client'}
                    onChange={(e) => onUpdateAdditionalIncome(income.id, 'owner', e.target.value)}
                    className="text-sm font-medium bg-white border rounded px-2 py-1"
                  >
                    <option value="client">{clientInfo.name || 'Client'}</option>
                    <option value="partner">{clientInfo.partnerName || 'Partner'}</option>
                    <option value="joint">Joint</option>
                  </select>
                )}
                <button onClick={() => onRemoveAdditionalIncome(income.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase mb-1">{income.isOneTime ? 'Amount' : 'Monthly'}</label>
                  <FormattedNumberInput
                    value={income.amount}
                    onChange={(e) => onUpdateAdditionalIncome(income.id, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase mb-1">{income.isOneTime ? 'Age' : 'Start'}</label>
                  <input
                    type="number"
                    value={income.startAge}
                    onChange={(e) => {
                      const age = parseInt(e.target.value) || 0;
                      onUpdateAdditionalIncome(income.id, 'startAge', age);
                      if (income.isOneTime) onUpdateAdditionalIncome(income.id, 'endAge', age);
                    }}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                {!income.isOneTime && (
                  <div>
                    <label className="block text-xs text-slate-500 uppercase mb-1">End</label>
                    <input
                      type="number"
                      value={income.endAge}
                      onChange={(e) => onUpdateAdditionalIncome(income.id, 'endAge', parseInt(e.target.value) || 100)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>
                )}
                <div className="flex flex-col justify-end gap-1">
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={income.isOneTime}
                      onChange={(e) => {
                        onUpdateAdditionalIncome(income.id, 'isOneTime', e.target.checked);
                        if (e.target.checked) onUpdateAdditionalIncome(income.id, 'endAge', income.startAge);
                      }}
                      className="w-3 h-3"
                    />
                    One-Time
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={income.inflationAdjusted}
                      onChange={(e) => onUpdateAdditionalIncome(income.id, 'inflationAdjusted', e.target.checked)}
                      className="w-3 h-3"
                    />
                    Inflation Adj
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Spending Adjustments Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5" /> Spending Adjustments
          </h3>
          <button
            onClick={onAddCashFlowAdjustment}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {(!inputs.cashFlowAdjustments || inputs.cashFlowAdjustments.length === 0) && (
          <p className="text-sm text-slate-400 italic">
            Mortgage payoff, reverse mortgage, health insurance, etc.
          </p>
        )}

        <div className="space-y-3">
          {(inputs.cashFlowAdjustments || []).map((adj) => (
            <div key={adj.id} className="p-4 bg-amber-50/50 rounded-lg border border-amber-200">
              <div className="flex justify-between items-center mb-3 gap-2">
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
                      'Grandchild College': { type: 'one-time' },
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
                  className="text-sm font-medium bg-white border rounded px-2 py-1"
                >
                  <option value="">Type...</option>
                  <option value="Mortgage Payoff">Mortgage Payoff</option>
                  <option value="Reverse Mortgage">Reverse Mortgage</option>
                  <option value="Downsizing">Downsizing</option>
                  <option value="Health Insurance (pre-Medicare)">Health Insurance (pre-Medicare)</option>
                  <option value="Long-Term Care Insurance">Long-Term Care Insurance</option>
                  <option value="Grandchild College">Grandchild College</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Major Medical">Major Medical</option>
                  <option value="Home Renovation">Home Renovation</option>
                  <option value="Other">Other</option>
                </select>
                {clientInfo.isMarried && (
                  <select
                    value={adj.owner || 'client'}
                    onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'owner', e.target.value)}
                    className="text-sm font-medium bg-white border rounded px-2 py-1"
                  >
                    <option value="client">{clientInfo.name || 'Client'}</option>
                    <option value="partner">{clientInfo.partnerName || 'Partner'}</option>
                  </select>
                )}
                <button onClick={() => onRemoveCashFlowAdjustment(adj.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 uppercase mb-1">
                    {adj.type === 'one-time' ? 'Amount' : 'Monthly'}
                  </label>
                  <FormattedNumberInput
                    value={adj.amount}
                    onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase mb-1">
                    {adj.type === 'one-time' ? 'Age' : 'Start'}
                  </label>
                  <input
                    type="number"
                    value={adj.startAge}
                    onChange={(e) => {
                      const age = parseInt(e.target.value) || 0;
                      onUpdateCashFlowAdjustment(adj.id, 'startAge', age);
                      if (adj.type === 'one-time') onUpdateCashFlowAdjustment(adj.id, 'endAge', age);
                    }}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                {adj.type !== 'one-time' && (
                  <div>
                    <label className="block text-xs text-slate-500 uppercase mb-1">End</label>
                    <input
                      type="number"
                      value={adj.endAge}
                      onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'endAge', parseInt(e.target.value) || 100)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
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
                    className="text-xs bg-white border rounded px-1 py-1"
                  >
                    <option value="reduction">Reduction</option>
                    <option value="increase">Increase</option>
                    <option value="one-time">One-Time</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={adj.inflationAdjusted}
                      onChange={(e) => onUpdateCashFlowAdjustment(adj.id, 'inflationAdjusted', e.target.checked)}
                      className="w-3 h-3"
                    />
                    Inflation Adj
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Return Assumptions Card */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5" /> Return Assumptions
        </h3>
        <button
          onClick={onApplyHistoricalAverages}
          className="w-full text-sm flex items-center justify-center gap-1 bg-yellow-50 text-yellow-700 py-2 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors mb-4 font-medium"
        >
          <RefreshCcw className="w-4 h-4" /> Use Historical Averages
        </button>
        <div className="space-y-3">
          {Object.entries(assumptions).map(([key, data]) => (
            <div key={key} className="p-4 bg-slate-50 rounded-lg">
              <p className="font-bold text-sm text-slate-700 mb-2">{data.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Return %</label>
                  <input type="number" value={data.return} onChange={(e) => onAssumptionChange(key, 'return', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">StdDev %</label>
                  <input type="number" value={data.stdDev} onChange={(e) => onAssumptionChange(key, 'stdDev', e.target.value)} className="w-full px-3 py-2 text-sm border rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default InputsPage;
