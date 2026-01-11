import React from 'react';
import { Briefcase, User, Loader } from 'lucide-react';
import { LOGO_URL } from '../../constants';

export const GateScreen = ({ onAdvisorClick, onClientEntry, isLoggingIn }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center">
      <img src={LOGO_URL} alt="Logo" className="h-24 mx-auto mb-8" />
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome</h1>
      <p className="text-slate-500 mb-8">Please select your role to continue.</p>

      <div className="space-y-4">
        <button
          onClick={onAdvisorClick}
          className="w-full flex items-center justify-center gap-3 p-4 border-2 border-emerald-600 bg-white text-emerald-800 rounded-xl hover:bg-emerald-50 transition-all font-bold"
        >
          <Briefcase className="w-6 h-6" /> I am an Advisor
        </button>
        <button
          onClick={onClientEntry}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 p-4 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-lg disabled:opacity-50"
        >
          {isLoggingIn ? (
            <Loader className="w-6 h-6 animate-spin" />
          ) : (
            <User className="w-6 h-6" />
          )}
          {isLoggingIn ? "Loading..." : "Client / Prospective Client"}
        </button>
      </div>
    </div>
  </div>
);

export default GateScreen;
