import React from 'react';
import { Shield, FileText, X } from 'lucide-react';

export const PrivacyTermsModal = ({ isOpen, onAccept, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Privacy & Terms</h2>
              <p className="text-slate-400 text-xs sm:text-sm">Please review before continuing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Privacy Policy Section */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-3">
              <Shield className="w-5 h-5 text-emerald-600" /> Privacy Disclosure
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-3">
              <p>
                By using this retirement planning tool, you acknowledge that the information you provide
                will be collected and used to generate personalized retirement projections and recommendations.
              </p>
              <p>
                <strong>Information We Collect:</strong> Personal contact information (name, email, phone),
                financial data (portfolio values, income, spending), and retirement planning preferences.
              </p>
              <p>
                <strong>How We Use Your Information:</strong> Your data is used solely to provide retirement
                planning analysis and to facilitate communication with a financial advisor if you choose to
                request a consultation. We do not sell your personal information to third parties.
              </p>
              <p>
                <strong>Data Security:</strong> We employ industry-standard security measures to protect your
                information. However, no method of electronic transmission or storage is 100% secure.
              </p>
              <p>
                <strong>Your Rights:</strong> You may request to view, update, or delete your personal
                information at any time by contacting us.
              </p>
            </div>
          </div>

          {/* Terms of Use Section */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-3">
              <FileText className="w-5 h-5 text-emerald-600" /> Terms of Use
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-3">
              <p>
                This retirement planning tool is provided for educational and illustrative purposes only.
                The projections and analysis generated are hypothetical and based on the information you provide
                and assumptions that may not reflect actual market conditions.
              </p>
              <p>
                <strong>Not Financial Advice:</strong> The information presented does not constitute investment
                advice, tax advice, or a recommendation to purchase or sell any securities. You should consult
                with qualified professionals before making any financial decisions.
              </p>
              <p>
                <strong>No Guarantees:</strong> Past performance is not indicative of future results. The
                projections shown are hypothetical and do not guarantee any specific outcome. Actual results
                may vary significantly from the projections presented.
              </p>
              <p>
                <strong>Accuracy of Information:</strong> You are responsible for the accuracy of the information
                you provide. The quality of the analysis depends on the completeness and accuracy of your inputs.
              </p>
              <p>
                <strong>Limitation of Liability:</strong> Miller Wealth Management and its affiliates shall not
                be liable for any losses or damages resulting from your use of this tool or reliance on the
                projections provided.
              </p>
            </div>
          </div>

          {/* Regulatory Disclosure */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-800">
              Securities offered through LPL Financial, Member FINRA/SIPC. Investment advice offered through
              Miller Wealth Management, a Registered Investment Advisor and separate entity from LPL Financial.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 p-4 sm:p-6">
          <p className="text-xs text-slate-500 mb-4 text-center">
            By clicking "I Accept", you acknowledge that you have read and agree to the Privacy Disclosure
            and Terms of Use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              I Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyTermsModal;
