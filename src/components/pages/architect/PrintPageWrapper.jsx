import React from 'react';

import { LOGO_URL } from '../../../constants';

const PrintFooter = ({ pageNumber, totalPages }) => (
  <div className="border-t border-slate-200 pt-4 mt-6">
    <div className="flex justify-between text-[11px] text-slate-400 mb-2">
      <span>Miller Wealth Management | Confidential</span>
      <span>Page {pageNumber} of {totalPages}</span>
    </div>
    <p className="text-[10px] text-slate-400 text-center leading-tight">
      Securities offered through LPL Financial, Member FINRA/SIPC. Investment Advice offered through Miller Wealth Management, a Registered Investment Advisor. Miller Wealth Management is a separate entity from LPL Financial.
    </p>
  </div>
);

const PrintPageWrapper = ({ pageNumber, totalPages, title, subtitle, children }) => (
  <div className="hidden print:flex flex-col min-h-[10in] break-after-page p-6">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <img src={LOGO_URL} alt="Logo" className="h-14" />
    </div>
    <div className="w-full h-0.5 bg-mwm-green mb-4"></div>
    <div className="flex-1">
      {children}
    </div>
    <PrintFooter pageNumber={pageNumber} totalPages={totalPages} />
  </div>
);

export { PrintPageWrapper, PrintFooter };
