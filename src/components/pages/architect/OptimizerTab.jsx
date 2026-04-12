import React, { useState } from 'react';
import {
  RefreshCw, Target, Shield, FileText, Download, AlertCircle,
  CheckCircle, Loader
} from 'lucide-react';

import { COLORS } from '../../../constants';
import { generateAndDownloadIPS } from '../../../utils';
import { Card } from '../../ui';

export const OptimizerTab = ({ optimizerData, inputs, basePlan, monteCarloData, projectionData, optimizerRebalanceFreq, onSetOptimizerRebalanceFreq, clientInfo, assumptions, vaEnabled, vaInputs, vaOptimizerData }) => {
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
        <Loader className="w-8 h-8 animate-spin text-mwm-green" />
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
      name: 'Tactical Balanced',
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
              ? 'ring-2 ' + (isBest ? 'ring-mwm-green bg-mwm-green/10' : 'ring-blue-500 bg-blue-50')
              : 'hover:shadow-md'
        }`}
        onClick={() => onSelect(strategy)}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              {strategy.name}
              {isBest && <span className="text-xs bg-mwm-green text-white px-2 py-0.5 rounded">Best</span>}
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
            <span className={`font-bold text-lg ${successRate >= 85 ? 'text-mwm-green' : successRate >= 65 ? 'text-orange-600' : 'text-red-600'}`}>
              {successRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${successRate >= 85 ? 'bg-mwm-green' : successRate >= 65 ? 'bg-orange-500' : 'bg-red-500'}`}
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
                    ? 'bg-mwm-green text-white shadow-md'
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
          <Target className="w-6 h-6 text-mwm-green" /> Allocation Strategy Comparison
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
          <p className="text-xs text-mwm-gold mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Client name is required to generate the Investment Policy Statement.
          </p>
        )}
      </Card>

      {/* Recommendation Box */}
      <Card className="p-5 bg-gradient-to-r from-mwm-green/10 to-teal-50 border-mwm-green/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-mwm-green/20 rounded-full">
            <CheckCircle className="w-6 h-6 text-mwm-green" />
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
          <div className="border-l-4 border-mwm-green pl-4">
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
            <h5 className="font-medium text-slate-800">Tactical Balanced</h5>
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
