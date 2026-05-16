import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Lock, Briefcase, ArrowRight, Loader2, Shield } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const ORANGE = '#F2A22F';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', designation: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side domain check
    if (!form.email.toLowerCase().endsWith('@sepc.in')) {
      setError('Registration is restricted to official SEPC email addresses (@sepc.in).');
      return;
    }

    setLoading(true);
    try {
      await register({ ...form, role: 'staff' });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #011E3E 0%, #013264 60%, #02438A 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #F2A22F, #00A6E0)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #F2A22F, #D4871A)' }}>
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <p className="text-white font-black text-base">IntelSync AI</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Powered by SEPC</p>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">Join the Intelligence Network</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Register to access company intelligence reports across SEPC's 6 strategic service domains.
          </p>
        </div>
        <p className="text-[9px] uppercase tracking-[0.2em] font-bold relative z-10" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Services Export Promotion Council · Govt. of India
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 animate-fade-in">
        <div className="w-full max-w-md">
          <div className="hidden lg:flex justify-end mb-6"><ThemeToggle /></div>
          <div className="h-1 w-12 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${ORANGE}, #00A6E0)` }} />
          <h1 className="text-3xl font-black mb-1" style={{ color: 'var(--text)' }}>Create Account</h1>
          <p className="text-sm font-medium mb-8" style={{ color: 'var(--muted)' }}>Register as a staff member to access the intelligence platform.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm font-bold"
                   style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{error}</div>
            )}
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="text" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" className="input-field pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@sepc.in" className="input-field pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="password" required value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" className="input-field pl-10" minLength={6} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--muted)' }}>Designation (Optional)</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
                <input type="text" value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="e.g. Analyst" className="input-field pl-10" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2 rounded-lg text-sm group">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>Create Account</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Already have an account?</span>
            <Link to="/login" className="text-sm font-black uppercase tracking-wider" style={{ color: '#013264' }}>Sign In →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
