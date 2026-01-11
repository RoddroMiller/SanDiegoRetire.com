import React from 'react';

export const StatBox = ({ label, value, subtext, icon: Icon, colorClass }) => (
  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-start space-x-4">
    <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

export default StatBox;
