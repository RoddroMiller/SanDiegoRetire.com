import React from 'react';
import { History } from 'lucide-react';

export const AllocationRow = ({
  color,
  name,
  amount,
  percent,
  returnRate,
  historicalReturn,
  stdDev,
  description
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
    <div className="flex items-start space-x-3 mb-2 sm:mb-0">
      <div className="w-4 h-4 rounded-full mt-1" style={{ backgroundColor: color }}></div>
      <div>
        <h4 className="font-semibold text-slate-800">{name}</h4>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
          <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">
            Target: {returnRate}%
          </span>
          {historicalReturn && (
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
              <History className="w-3 h-3" /> Hist: {historicalReturn}%
            </span>
          )}
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Risk (σ): {stdDev}%</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-md">{description}</p>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-lg text-slate-800">
        ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
      <div className="text-sm text-slate-500">{percent}% of Portfolio</div>
    </div>
  </div>
);

export default AllocationRow;
