import React from 'react';
import { LogOut, BarChart2, PieChart, FolderOpen, Settings } from 'lucide-react';
import { LOGO_URL } from '../../constants';

const tabs = [
  { key: 'accumulation', label: 'Accumulation', icon: BarChart2 },
  { key: 'inputs', label: 'Inputs', icon: Settings },
  { key: 'architect', label: 'Architect', icon: PieChart },
  { key: 'management', label: 'Plans', icon: FolderOpen },
];

export const AdvisorNavBar = ({ activeView, onNavigate, userRole, onLogout }) => {
  return (
    <nav className="bg-white border-b border-slate-200 print:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Logo */}
          <div className="flex-shrink-0">
            <img src={LOGO_URL} alt="Logo" className="h-8 sm:h-10 w-auto object-contain" />
          </div>

          {/* Center: Nav Tabs */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {tabs.map(({ key, label, icon: Icon }) => {
              const isActive = activeView === key;
              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  className={`relative flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Role Badge + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              userRole === 'master'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {userRole === 'master' ? 'Master' : 'Advisor'}
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs sm:text-sm"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AdvisorNavBar;
