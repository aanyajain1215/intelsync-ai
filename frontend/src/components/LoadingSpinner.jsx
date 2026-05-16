import React from 'react';

const LoadingSpinner = () => (
  <div className="w-10 h-10 border-4 rounded-full animate-spin"
       style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
);

export default LoadingSpinner;
