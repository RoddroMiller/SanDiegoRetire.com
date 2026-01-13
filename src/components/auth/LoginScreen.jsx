import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Disclaimer } from '../ui';

export const LoginScreen = ({ onBack, onLogin, authError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password, false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-4 sm:mb-6 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <ArrowRight className="w-3 h-3 rotate-180" /> Back
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">Advisor Login</h2>

        {authError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="w-full bg-emerald-700 text-white p-3 rounded-lg font-bold hover:bg-emerald-800 transition-all"
          >
            Log In
          </button>
        </form>
        <Disclaimer />
      </div>
    </div>
  );
};

export default LoginScreen;
