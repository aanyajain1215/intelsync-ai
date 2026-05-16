import React from 'react';

const FreshnessBar = ({ score = 0 }) => {
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--orange)' : 'var(--danger)';
  return (
    <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
      <div className="h-full rounded-full transition-all duration-500"
           style={{ width: `${Math.min(score, 100)}%`, background: color }} />
    </div>
  );
};

export default FreshnessBar;
