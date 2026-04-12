import React from 'react';
import { TrendingUp, Clock, PiggyBank, DollarSign, Activity } from 'lucide-react';

import { getAdjustedSS } from '../../../utils';
import { Card } from '../../ui';

// Improve Outcome Tab - Advisory Only
export const ImproveOutcomeTab = ({ clientInfo, inputs, monteCarloData, projectionData, onInputChange }) => {
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
        <Card className="p-6 border-t-4 border-mwm-gold">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-mwm-gold" /> Planning Guidance
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

            <div className="p-4 rounded-lg bg-mwm-green/10 border border-mwm-green/30">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-5 h-5 text-mwm-green" />
                <h4 className="font-bold text-mwm-emerald">Increase Savings</h4>
              </div>
              <p className="text-sm text-mwm-green/80">
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
      <Card className="p-6 border-t-4 border-mwm-green">
        <div className="text-center">
          <Activity className="w-12 h-12 text-mwm-green mx-auto mb-4" />
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
