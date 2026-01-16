import React, { useState } from 'react';
import { Briefcase, User, UserCircle, Loader } from 'lucide-react';
import { LOGO_URL } from '../../constants';
import { Disclaimer, PrivacyTermsModal } from '../ui';

export const GateScreen = ({ onAdvisorClick, onClientLoginClick, onProspectEntry, isLoggingIn }) => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleProspectClick = () => {
    setShowPrivacyModal(true);
  };

  const handleAcceptTerms = () => {
    setShowPrivacyModal(false);
    onProspectEntry();
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
          onClick={onClientLoginClick}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg text-sm sm:text-base"
        >
          <UserCircle className="w-5 h-5 sm:w-6 sm:h-6" /> I am a Client
        </button>
        <button
          onClick={handleProspectClick}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all font-bold shadow-lg disabled:opacity-50 text-sm sm:text-base"
        >
          {isLoggingIn ? (
            <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          ) : (
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
          {isLoggingIn ? "Loading..." : "Prospective Client (Guest)"}
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-4">
        Existing clients: Log in to view your assigned plan.<br/>
        New visitors: Continue as guest to explore the tool.
      </p>
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
