import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { LayoutDashboard, Search, ShieldCheck, LogOut, Shield, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const { user, isAdmin, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/dashboard/search', icon: Search, label: 'Entity Directory' },
    ...(isAdmin ? [{ to: '/dashboard/admin', icon: ShieldCheck, label: 'Admin Control' }] : []),
  ];

  return (
    <aside className="sidebar w-64 shrink-0 flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 pb-6" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #F2A22F, #D4871A)' }}>
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-tight">IntelSync AI</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.15em]"
               style={{ color: 'var(--sidebar-muted)' }}>SEPC Lead Verification</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-3 px-2"
           style={{ color: 'var(--sidebar-muted)' }}>Navigation</p>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            <item.icon size={16} className="mr-3 shrink-0" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={12} style={{ opacity: 0.3 }} />
          </NavLink>
        ))}
      </nav>

      {/* User & Theme */}
      <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                style={{
                  background: isAdmin ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.08)',
                  color: isAdmin ? '#F87171' : 'var(--sidebar-muted)',
                  border: isAdmin ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.1)'
                }}>
            {user?.role || 'staff'}
          </span>
        </div>
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
               style={{ background: 'var(--navy-mid)' }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[9px] truncate" style={{ color: 'var(--sidebar-muted)' }}>{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
          style={{ color: 'var(--sidebar-text)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
