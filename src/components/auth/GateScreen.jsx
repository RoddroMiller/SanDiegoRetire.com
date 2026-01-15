import React, { useState } from 'react';
import { Briefcase, User, Loader } from 'lucide-react';
import { LOGO_URL } from '../../constants';
import { Disclaimer, PrivacyTermsModal } from '../ui';

export const GateScreen = ({ onAdvisorClick, onClientEntry, isLoggingIn }) => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleClientClick = () => {
    setShowPrivacyModal(true);
  };

  const handleAcceptTerms = () => {
    setShowPrivacyModal(false);
    onClientEntry();
  };

  return (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
    <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl max-w-md w-full text-center">
      <img src={LOGO_URL} alt="Logo" className="h-24 sm:h-36 mx-auto mb-6 sm:mb-8" />
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Welcome</h1>
      <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8">Please select your role to continue.</p>

      <div className="space-y-3 sm:space-y-4">
        <button
          onClick={onAdvisorClick}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 border-emerald-600 bg-white text-emerald-800 rounded-xl hover:bg-emerald-50 transition-all font-bold text-sm sm:text-base"
        >
          <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" /> I am an Advisor
        </button>
        <button
          onClick={handleClientClick}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-lg disabled:opacity-50 text-sm sm:text-base"
        >
          {isLoggingIn ? (
            <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          ) : (
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
          {isLoggingIn ? "Loading..." : "Client / Prospective Client"}
        </button>
      </div>
      <Disclaimer className="text-left" />

      <PrivacyTermsModal
        isOpen={showPrivacyModal}
        onAccept={handleAcceptTerms}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  </div>
  );
};

export default GateScreen;
