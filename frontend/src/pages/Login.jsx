import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Loader2, Shield } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const NAVY = '#013264';
const ORANGE = '#F2A22F';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #011E3E 0%, #013264 60%, #02438A 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #F2A22F, #00A6E0)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(0,166,224,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #F2A22F, #D4871A)' }}>
              <Shield className="text-white" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-black text-base tracking-tight">IntelSync AI</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Powered by SEPC</p>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">India's Service Export Intelligence Platform</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Dynamic Market Intelligence &amp; Lead Verification System for the 6 strategic pillars of Indian service exports.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-10">
            {[{ v: '6', l: 'SEPC Pillars' }, { v: 'AI', l: 'Powered Audit' }, { v: '3-Tier', l: 'Classification' }, { v: '100%', l: 'Verified Data' }].map(({ v, l }) => (
              <div key={l} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xl font-black text-white">{v}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Services Export Promotion Council · Ministry of Commerce &amp; Industry · Govt. of India
          </p>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 animate-fade-in">
        <div className="w-full max-w-md">
          <div className="hidden lg:flex justify-end mb-6"><ThemeToggle /></div>
          <div className="h-1 w-12 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${ORANGE}, #00A6E0)` }} />
          <h1 className="text-3xl font-black mb-1" style={{ color: 'var(--text)' }}>Welcome Back</h1>
          <p className="text-sm font-medium mb-8" style={{ color: 'var(--muted)' }}>Sign in to access the SEPC intelligence dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm font-bold"
                   style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }}>{error}</div>
            )}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@sepc.in" className="input-field pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input-field pl-10" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2 rounded-lg text-sm group">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>Sign In to Portal</span><ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>New to the platform?</span>
            <Link to="/register" className="text-sm font-black uppercase tracking-wider" style={{ color: NAVY }}>Register →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
