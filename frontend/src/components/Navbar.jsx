import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const NAVY = '#013264';

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 glass"
       style={{ borderBottom: '1px solid var(--border)' }}>
    <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 text-decoration-none">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #F2A22F, #D4871A)' }}>
          <Shield className="text-white" size={18} />
        </div>
        <div>
          <span className="font-black text-sm" style={{ color: 'var(--text)' }}>IntelSync AI</span>
          <span className="text-[8px] font-bold uppercase tracking-widest ml-2" style={{ color: 'var(--muted)' }}>SEPC</span>
        </div>
      </Link>
      <div className="flex items-center gap-6">
        <a href="https://www.servicesepc.org/" target="_blank" rel="noopener noreferrer" 
           className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors">
          Official SEPC Site
        </a>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="text-xs font-black uppercase tracking-wider transition-colors"
                style={{ color: NAVY }}>Sign In</Link>
          <Link to="/register" className="btn-accent text-xs py-2 px-5 rounded-lg">Get Started</Link>
        </div>
      </div>
    </div>
  </nav>
);

export default Navbar;
