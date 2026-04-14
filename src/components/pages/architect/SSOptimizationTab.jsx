import React, { useState } from 'react';
import { Shield, Loader, Calculator, CheckCircle } from 'lucide-react';
import { getAdjustedSS, getImpliedPIA, applyDeemedFiling, calculateBasePlan, runSimulation } from '../../../utils';
import { Card } from '../../ui';

export const SSOptimizationTab = ({ clientInfo, inputs, assumptions, basePlan, rebalanceFreq, rebalanceTargets, useManualAllocation, manualAllocations, ssAnalysis, ssBreakevenResults, clientOutcomes, clientWinner, partnerOutcomes, partnerWinner, targetMaxPortfolioAge, onSetTargetMaxPortfolioAge, onUpdateSSStartAge, onUpdatePartnerSSStartAge, onInputChange, matrixData, isRunningMatrix, onSetMatrixData, onSetIsRunningMatrix }) => {
  const [showBenefitDetails, setShowBenefitDetails] = useState(false);

  const clientLocked = inputs.ssCurrentlyReceiving;
  const partnerLocked = inputs.partnerSSCurrentlyReceiving;

  const runMatrixOptimization = () => {
    onSetIsRunningMatrix(true);
    setTimeout(() => {
      // If already receiving, lock to current claiming age — that decision is made
      const clientAges = clientLocked ? [inputs.ssStartAge] : [62, 63, 64, 65, 66, 67, 68, 69, 70];
      const partnerAges = partnerLocked ? [inputs.partnerSSStartAge] : [62, 63, 64, 65, 66, 67, 68, 69, 70];
      const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70]; // full range for display grid
      const matrix = [];
      let winner = { clientAge: clientAges[0], partnerAge: partnerAges[0], balance: -1 };

      for (const cAge of clientAges) {
        for (const pAge of partnerAges) {
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
        <div className="bg-mwm-gold/10 p-3 rounded-lg border border-mwm-gold/40">
          <label className="block text-[12px] font-bold text-mwm-gold/80 uppercase mb-1">
            At what age do you want your portfolio value maximized?
          </label>
          <select
            value={targetMaxPortfolioAge}
            onChange={(e) => onSetTargetMaxPortfolioAge(parseInt(e.target.value))}
            className="w-full text-sm font-bold p-1 rounded border border-mwm-gold/60 bg-white text-slate-800"
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
                  <span className="text-sm font-bold text-mwm-green/80">{fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
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
                                ? <span>{fmt(p.pia)}/mo <span className="text-mwm-gold">(implied from {fmt(p.inputPIA)} @ age {p.claimAge})</span></span>
                                : `${fmt(p.pia)}/mo`}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">Claiming age</td>
                            <td className="py-0.5 text-right font-bold text-slate-700">
                              {p.claimAge}
                              {p.yearsEarly > 0 && <span className="text-red-500 ml-1">({p.yearsEarly}yr early)</span>}
                              {p.yearsLate > 0 && <span className="text-mwm-green ml-1">({p.yearsLate}yr delayed)</span>}
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
                              <td className="py-0.5 text-mwm-green">Delayed retirement credits</td>
                              <td className="py-0.5 text-right font-bold text-mwm-green">+{pct(p.bonusPct)}</td>
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
                            <td className="py-1 text-right font-bold text-mwm-green/80 text-sm">{fmt(p.afterDeemed)}/mo</td>
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
                    <span className="text-sm font-bold text-mwm-green/80">{fmt(totalMonthly)}/mo ({fmt(totalMonthly * 12)}/yr)</span>
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
                {clientLocked && partnerLocked
                  ? 'Both spouses are already receiving benefits — claiming ages are locked.'
                  : clientLocked
                  ? `${clientInfo.name || 'Primary'} is already receiving (locked at age ${inputs.ssStartAge}). Optimizing ${clientInfo.partnerName || 'Spouse'} claiming age.`
                  : partnerLocked
                  ? `${clientInfo.partnerName || 'Spouse'} is already receiving (locked at age ${inputs.partnerSSStartAge}). Optimizing ${clientInfo.name || 'Primary'} claiming age.`
                  : `81 scenarios — Primary claiming age (columns) vs. Spouse claiming age (rows). Portfolio balance at age ${targetMaxPortfolioAge}.`}
              </p>
            </div>
            <button
              onClick={runMatrixOptimization}
              disabled={isRunningMatrix || (clientLocked && partnerLocked)}
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
                  <CheckCircle className="w-8 h-8 text-mwm-green" />
                  <div>
                    <p className="text-sm font-bold">
                      Optimal: Primary Age <span className="text-mwm-green text-lg">{matrixData.winner.clientAge}</span> + Spouse Age <span className="text-mwm-green text-lg">{matrixData.winner.partnerAge}</span>
                    </p>
                    <p className="text-gray-400 text-xs">
                      Portfolio at {targetMaxPortfolioAge}: <strong className="text-mwm-green">${Math.round(matrixData.winner.balance).toLocaleString()}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={applyMatrixWinner}
                  className="px-4 py-2 bg-mwm-green hover:bg-mwm-green/80 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-sm"
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
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-slate-700">{clientInfo.name || 'Primary'} →</span>
                          <span className="text-slate-400 text-[8px]">columns</span>
                          <div className="w-full border-t border-slate-300 my-0.5" />
                          <span className="text-slate-700">↓ {clientInfo.partnerName || 'Spouse'}</span>
                          <span className="text-slate-400 text-[8px]">rows</span>
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
                            bgColor = 'bg-mwm-green/30 ring-2 ring-mwm-green';
                          } else if (isSelected) {
                            bgColor = 'bg-blue-100 ring-2 ring-blue-500';
                          } else if (pct >= 0.85) {
                            bgColor = 'bg-mwm-green/20';
                          } else if (pct >= 0.6) {
                            bgColor = 'bg-mwm-green/10';
                          } else if (pct >= 0.35) {
                            bgColor = 'bg-mwm-gold/10';
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
                              <p className={`font-bold text-[11px] ${isOptimal ? 'text-mwm-emerald' : isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                                ${(balance / 1000000).toFixed(2)}M
                              </p>
                              {isOptimal && <p className="text-[8px] font-bold text-mwm-green/80 uppercase">Best</p>}
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
              <p className="text-sm text-slate-500 font-medium">
                {clientLocked && partnerLocked
                  ? 'Both spouses are already receiving — no optimization available.'
                  : 'Click "Run Optimization" to calculate claiming age combinations'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {clientLocked && partnerLocked ? '' :
                  clientLocked ? `Optimizing ${clientInfo.partnerName || 'Spouse'} ages 62-70 (${clientInfo.name || 'Primary'} locked at ${inputs.ssStartAge})` :
                  partnerLocked ? `Optimizing ${clientInfo.name || 'Primary'} ages 62-70 (${clientInfo.partnerName || 'Spouse'} locked at ${inputs.partnerSSStartAge})` :
                  'Primary ages 62-70 vs. Spouse ages 62-70'}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Single client — keep original linear display */
        <div className="mb-12">
          {clientLocked ? (
            <div className="bg-slate-100 p-6 rounded-xl mb-6 flex items-center gap-4 border border-slate-300">
              <Shield className="w-10 h-10 text-slate-400" />
              <div>
                <h4 className="text-lg font-bold text-slate-700">Benefits Already in Effect</h4>
                <p className="text-slate-500 text-sm mt-1">
                  {clientInfo.name || 'Client'} is already receiving Social Security at age <strong className="text-slate-800">{inputs.ssStartAge}</strong> — claiming age is locked.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-black text-white p-6 rounded-xl mb-6 flex items-center gap-4">
                <CheckCircle className="w-10 h-10 text-mwm-green" />
                <div>
                  <h4 className="text-lg font-bold">Claiming Recommendation</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    Claim at Age <strong className="text-mwm-green text-lg">{clientWinner.age}</strong> to maximize portfolio balance at age {targetMaxPortfolioAge}.
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
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all relative ${isWinner ? 'border-mwm-green bg-mwm-green/10' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-mwm-green/40'}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {isSelected && (
                        <span className="bg-blue-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">Selected</span>
                      )}
                      {isWinner && !isSelected && (
                        <span className="bg-mwm-green text-white text-[9px] font-bold px-1 py-0.5 rounded">Best</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-500">Age {outcome.age}</p>
                    <p className={`text-sm font-bold ${isWinner ? 'text-mwm-green/80' : isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                      ${Math.round(outcome.balance).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">@ Age {targetMaxPortfolioAge}</p>
                  </div>
                  );
                })}
              </div>
            </>
          )}
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
              <div key={key} className={`p-3 rounded-lg flex items-center gap-3 ${be === null ? 'bg-red-50 border border-red-200' : be <= 80 ? 'bg-mwm-green/10 border border-mwm-green/30' : be <= 85 ? 'bg-mwm-gold/10 border border-mwm-gold/40' : 'bg-orange-50 border border-orange-200'}`}>
                <div className="text-center min-w-[60px]">
                  <p className={`text-xl font-bold ${be === null ? 'text-red-600' : be <= 80 ? 'text-mwm-green/80' : be <= 85 ? 'text-mwm-gold/80' : 'text-orange-700'}`}>
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
                          <tr key={row.nqPercent} className={`border-b border-slate-100 ${isActive ? 'bg-mwm-gold/10 font-bold' : ''}`}>
                            <td className="py-1 text-slate-600 whitespace-nowrap pr-2">{row.nqPercent}% / {row.iraPercent}%</td>
                            {allBrackets.map(tax => {
                              const isCurrent = isActive && tax === inputs.ssMarginalTaxRate;
                              const val = row.breakevens[tax];
                              return (
                                <td key={tax} className={`py-1 text-center px-1 ${isCurrent ? 'bg-mwm-gold/40 rounded font-bold text-slate-800' : 'text-slate-600'}`}>
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
