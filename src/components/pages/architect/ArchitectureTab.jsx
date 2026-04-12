import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Layers, BarChart2, TrendingUp } from 'lucide-react';

import { COLORS } from '../../../constants';
import { Card } from '../../ui';

// Architecture Tab - Detailed portfolio breakdown with pie chart and bucket distributions
export const ArchitectureTab = ({ inputs, basePlan, assumptions, projectionData }) => {
  // Prepare withdrawal data for the chart
  const withdrawalData = projectionData.map(row => ({
    year: row.year,
    age: row.age,
    'B1 Liquidity': row.w1 || 0,
    'B2 Bridge': row.w2 || 0,
    'B3 Tactical Balanced': row.w3 || 0,
    'B4 Income & Growth': row.w4 || 0,
    'B5 Permanent Equity': row.w5 || 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 mt-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie Chart - Target Allocation */}
        <Card className="p-6">
          <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-mwm-green" /> Target Allocation
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Liquidity (B1)', value: basePlan.b1Val, color: COLORS.shortTerm },
                    { name: 'Bridge (B2)', value: basePlan.b2Val, color: COLORS.midTerm },
                    { name: 'Tactical Balanced (B3)', value: basePlan.b3Val, color: COLORS.hedged },
                    { name: 'Income & Growth (B4)', value: basePlan.b4Val, color: COLORS.income },
                    { name: 'Permanent Equity (B5)', value: Math.max(0, basePlan.b5Val), color: COLORS.longTerm },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
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
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-slate-800">${inputs.totalPortfolio.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Total Portfolio at Retirement</p>
          </div>
        </Card>

        {/* Bucket Details Table */}
        <Card className="p-6 print:break-before-page">
          <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-mwm-green" /> Bucket Strategy Details
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.shortTerm}20`, borderLeft: `4px solid ${COLORS.shortTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 1: Liquidity</p>
                  <p className="text-xs text-slate-500">Years 1-3 • Immediate liquidity</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b1Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b1Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b1.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.midTerm}20`, borderLeft: `4px solid ${COLORS.midTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 2: Bridge</p>
                  <p className="text-xs text-slate-500">Years 4-6 • Conservative growth</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b2Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b2Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b2.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.hedged}20`, borderLeft: `4px solid ${COLORS.hedged}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 3: Tactical Balanced</p>
                  <p className="text-xs text-slate-500">Years 7-14 • Moderate risk</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b3Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b3Val / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b3.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.income}20`, borderLeft: `4px solid ${COLORS.income}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 4: Income & Growth</p>
                  <p className="text-xs text-slate-500">{basePlan.b4Val > 0 ? 'Income & dividends/yield' : 'No allocation'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${basePlan.b4Val.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((basePlan.b4Val / (inputs.totalPortfolio || 1)) * 100).toFixed(1)}% • {assumptions.b4.return}% return</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS.longTerm}20`, borderLeft: `4px solid ${COLORS.longTerm}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">Bucket 5: Permanent Equity</p>
                  <p className="text-xs text-slate-500">Years 15+ • Growth engine</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${Math.max(0, basePlan.b5Val).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{((Math.max(0, basePlan.b5Val) / inputs.totalPortfolio) * 100).toFixed(1)}% • {assumptions.b5.return}% return</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Withdrawals by Bucket Chart */}
      <Card className="p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-mwm-green" /> Withdrawals by Bucket
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={withdrawalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(val) => val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${(val / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} labelFormatter={(l) => `Year ${l}`} />
              <Legend />
              <Bar dataKey="B1 Liquidity" stackId="1" fill={COLORS.shortTerm} />
              <Bar dataKey="B2 Bridge" stackId="1" fill={COLORS.midTerm} />
              <Bar dataKey="B3 Tactical Balanced" stackId="1" fill={COLORS.hedged} />
              <Bar dataKey="B4 Income & Growth" stackId="1" fill={COLORS.income} />
              <Bar dataKey="B5 Permanent Equity" stackId="1" fill={COLORS.longTerm} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          This chart shows which bucket withdrawals come from each year. Sequential distribution takes from B1 first, then B2, B3, B4, and finally B5.
        </p>
      </Card>
    </div>
  );
};
