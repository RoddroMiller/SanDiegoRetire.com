import React, { useState, useEffect } from 'react';
import { Lock, Shield, AlertCircle, X } from 'lucide-react';

/**
 * MFA Verification Modal - shown during sign-in when MFA is required
 */
export const MfaVerifyModal = ({ onVerify, onCancel, error }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsSubmitting(true);
    await onVerify(code);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Enter the 6-digit code from your Google Authenticator app
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-3xl tracking-[0.5em] font-mono p-4 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || isSubmitting}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * MFA Enrollment Modal - shown when user needs to set up MFA
 */
export const MfaEnrollModal = ({ onStartEnrollment, onComplete, onCancel, error }) => {
  const [step, setStep] = useState(1);
  const [qrData, setQrData] = useState(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Start enrollment when modal opens
    const initEnrollment = async () => {
      setIsLoading(true);
      const data = await onStartEnrollment();
      if (data) {
        setQrData(data);
      }
      setIsLoading(false);
    };
    initEnrollment();
  }, [onStartEnrollment]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsSubmitting(true);
    const success = await onComplete(code);
    if (!success) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Set Up Two-Factor Authentication
        </h2>

        {/* Compliance Notice */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            <strong>Required:</strong> Per LPL security policy, all users must enable two-factor authentication.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <>
            <ol className="text-slate-600 text-sm space-y-2 mb-6 list-decimal list-inside">
              <li>Download <strong>Google Authenticator</strong> on your phone</li>
              <li>Tap the <strong>+</strong> button in the app</li>
              <li>Select <strong>"Scan QR code"</strong></li>
              <li>Scan the code below</li>
            </ol>

            <div className="bg-slate-50 rounded-lg p-4 mb-4 flex items-center justify-center min-h-[200px]">
              {isLoading ? (
                <div className="text-slate-400">Loading QR code...</div>
              ) : qrData ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrUrl)}`}
                  alt="QR Code for Google Authenticator"
                  className="rounded-lg"
                />
              ) : (
                <div className="text-red-500">Failed to generate QR code</div>
              )}
            </div>

            {qrData && (
              <div className="text-center mb-4">
                <p className="text-slate-400 text-xs mb-1">Can't scan? Enter this code manually:</p>
                <code className="bg-slate-100 px-3 py-1 rounded text-sm tracking-wider">
                  {qrData.secretKey}
                </code>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!qrData}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              I've Scanned the Code
            </button>
          </>
        ) : (
          <>
            <p className="text-slate-500 text-sm mb-6 text-center">
              Enter the 6-digit code shown in Google Authenticator to verify setup:
            </p>

            <form onSubmit={handleVerify}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-3xl tracking-[0.5em] font-mono p-4 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <button
                type="submit"
                disabled={code.length !== 6 || isSubmitting}
                className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Verifying...' : 'Complete Setup'}
              </button>
            </form>

            <button
              onClick={() => setStep(1)}
              className="w-full mt-2 py-2 text-slate-500 hover:text-slate-700 text-sm"
            >
              Back to QR Code
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default { MfaVerifyModal, MfaEnrollModal };
