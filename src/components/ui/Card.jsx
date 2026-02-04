import React from 'react';

export const Card = ({ children, className = "", ...props }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
