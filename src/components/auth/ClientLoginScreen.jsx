import React, { useState } from 'react';
import { ArrowRight, Mail, Loader, CheckCircle } from 'lucide-react';
import { Disclaimer } from '../ui';

export const ClientLoginScreen = ({ onBack, onLogin, onSignup, onPasswordReset, authError, resetStatus }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (isSignupMode) {
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        return;
      }
      onSignup(email, password);
    } else {
      onLogin(email, password);
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    onPasswordReset(resetEmail);
  };

  // Password Reset Form
  if (showResetForm) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
          <button
            onClick={() => setShowResetForm(false)}
            className="mb-4 sm:mb-6 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to Login
          </button>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Reset Password</h2>
          <p className="text-sm text-slate-500 mb-4 sm:mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {resetStatus === 'sent' ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-700 font-medium mb-2">Email Sent!</p>
              <p className="text-sm text-emerald-600">
                Check your inbox for a password reset link. It may take a few minutes to arrive.
              </p>
              <button
                onClick={() => setShowResetForm(false)}
                className="mt-4 text-sm text-emerald-700 hover:text-emerald-800 underline"
              >
                Return to login
              </button>
            </div>
          ) : (
            <>
              {authError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200">
                  {authError}
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetStatus === 'sending'}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resetStatus === 'sending' ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}
          <Disclaimer />
        </div>
      </div>
    );
  }

  // Login/Signup Form
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-4 sm:mb-6 text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <ArrowRight className="w-3 h-3 rotate-180" /> Back
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
          {isSignupMode ? 'Create Account' : 'Client Login'}
        </h2>
        <p className="text-sm text-slate-500 mb-4 sm:mb-6">
          {isSignupMode
            ? 'Sign up with the email your advisor used to assign your plan.'
            : 'Access your assigned retirement plan.'}
        </p>

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
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {isSignupMode && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            {isSignupMode ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {!isSignupMode && (
            <button
              onClick={() => setShowResetForm(true)}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline block w-full"
            >
              Forgot Password?
            </button>
          )}
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

        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
          <p className="font-medium text-slate-600 mb-1">
            {isSignupMode ? 'Important:' : 'First time here?'}
          </p>
          <p>
            {isSignupMode
              ? 'Use the same email address that your advisor used when assigning your plan.'
              : 'Your advisor assigned a plan to your email. Sign up with that email to access it.'}
          </p>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
};

export default ClientLoginScreen;
