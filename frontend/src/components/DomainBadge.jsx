import React from 'react';

const DOMAIN_STYLES = {
  'Media and Entertainment': { bg: 'rgba(239,68,68,0.08)', color: '#EF4444', border: 'rgba(239,68,68,0.2)' },
  'Education':               { bg: 'rgba(1,50,100,0.08)',  color: '#013264', border: 'rgba(1,50,100,0.2)' },
  'Healthcare':              { bg: 'rgba(22,163,74,0.08)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' },
  'Tourism':                 { bg: 'rgba(242,162,47,0.08)',color: '#F2A22F', border: 'rgba(242,162,47,0.2)' },
  'Financial services':      { bg: 'rgba(124,58,237,0.08)',color: '#7C3AED', border: 'rgba(124,58,237,0.2)' },
  'Consultancy services':    { bg: 'rgba(0,166,224,0.08)', color: '#00A6E0', border: 'rgba(0,166,224,0.2)' },
};

const DomainBadge = ({ domain }) => {
  const style = DOMAIN_STYLES[domain] || { bg: 'var(--surface-2)', color: 'var(--muted)', border: 'var(--border)' };
  return (
    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {domain || 'Unclassified'}
    </span>
  );
};

export default DomainBadge;
