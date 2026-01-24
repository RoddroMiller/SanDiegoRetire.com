import React, { useState } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Disclaimer } from '../ui';
import { validatePassword, getPasswordRequirements } from '../../utils/passwordValidation';

export const LoginScreen = ({ onBack, onLogin, authError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (isSignupMode) {
      // Validate password meets BOSP requirements
      const validation = validatePassword(password);
      if (!validation.valid) {
        setPasswordError(validation.errors.join('. '));
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
      onLogin(email, password, true); // true = signup
    } else {
      onLogin(email, password, false); // false = login
    }
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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">
          {isSignupMode ? 'Create Advisor Account' : 'Advisor Login'}
        </h2>

        {(authError || passwordError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
            {passwordError || authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          {isSignupMode && (
            <>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{getPasswordRequirements()}</span>
              </div>
            </>
          )}
          <button
            type="submit"
            className="w-full bg-emerald-700 text-white p-3 rounded-lg font-bold hover:bg-emerald-800 transition-all"
          >
            {isSignupMode ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignupMode(!isSignupMode);
              setPasswordError('');
              setConfirmPassword('');
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {isSignupMode ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
};

export default LoginScreen;
