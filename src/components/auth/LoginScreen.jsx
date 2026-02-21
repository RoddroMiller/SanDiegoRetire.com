import React, { useState } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { Disclaimer } from '../ui';
import { LOGO_URL } from '../../constants';
import { validatePassword, getPasswordRequirements } from '../../utils/passwordValidation';

export const LoginScreen = ({ onBack, onLogin, onPasswordReset, authError, resetStatus }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
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

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (email && onPasswordReset) {
      onPasswordReset(email);
    }
  };

  // Password Reset Success View
  if (isResetMode && resetStatus === 'sent') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
          <div className="text-center">
            <img src={LOGO_URL} alt="Logo" className="h-16 sm:h-20 mx-auto mb-4" />
            <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
              Check Your Email
            </h2>
            <p className="text-slate-600 text-sm mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Important:</strong> For seamless access across Miller Wealth tools,
                  use the same password for both Portfolio Architect and The One Process.
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsResetMode(false);
                setEmail('');
              }}
              className="w-full bg-emerald-700 text-white p-3 rounded-lg font-bold hover:bg-emerald-800 transition-all"
            >
              Return to Login
            </button>
          </div>
          <Disclaimer />
        </div>
      </div>
    );
  }

  // Password Reset Form View
  if (isResetMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
          <img src={LOGO_URL} alt="Logo" className="h-16 sm:h-20 mx-auto mb-4" />
          <button
            onClick={() => {
              setIsResetMode(false);
              setPasswordError('');
            }}
            className="mb-4 sm:mb-6 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to Login
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              Reset Password
            </h2>
          </div>

          <p className="text-slate-600 text-sm mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <strong>Tip:</strong> Use the same password for Portfolio Architect and
                The One Process to keep your credentials synchronized across Miller Wealth tools.
              </div>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleResetSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <button
              type="submit"
              disabled={resetStatus === 'sending'}
              className="w-full bg-emerald-700 text-white p-3 rounded-lg font-bold hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetStatus === 'sending' ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <Disclaimer />
        </div>
      </div>
    );
  }

  // Main Login/Signup View
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
        <img src={LOGO_URL} alt="Logo" className="h-16 sm:h-20 mx-auto mb-4" />
        <button
          onClick={onBack}
          className="mb-4 sm:mb-6 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <ArrowRight className="w-3 h-3 rotate-180" /> Back
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">
          {isSignupMode ? 'Create Advisor Account' : 'Advisor Login'}
        </h2>

        {isSignupMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <strong>Tip:</strong> Use the same email and password as your The One Process
                account to keep credentials synchronized across Miller Wealth tools.
              </div>
            </div>
          </div>
        )}

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

        {!isSignupMode && (
          <div className="mt-3 text-center">
            <button
              onClick={() => {
                setIsResetMode(true);
                setPasswordError('');
              }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Forgot password?
            </button>
          </div>
        )}

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
