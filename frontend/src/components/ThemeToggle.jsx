import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle}
      className="p-2 rounded-lg transition-all hover:bg-[var(--surface-hover)]"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun size={18} style={{ color: 'var(--orange)' }} /> : <Moon size={18} style={{ color: 'var(--muted)' }} />}
    </button>
  );
};

export default ThemeToggle;
