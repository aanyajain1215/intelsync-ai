import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Cpu, Database, ShieldCheck, Globe, BarChart3, Building2, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';

const NAVY = '#013264';
const ORANGE = '#F2A22F';
const SKY = '#00A6E0';

const LandingPage = () => (
  <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', fontFamily: 'Montserrat, sans-serif' }}>
    <Navbar />

    {/* HERO */}
    <section className="relative overflow-hidden"
             style={{ background: `linear-gradient(160deg, #011E3E 0%, ${NAVY} 55%, #02438A 100%)`, paddingTop: '7rem', paddingBottom: '5rem' }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${ORANGE}, ${SKY})` }} />
      <div className="absolute inset-0 mesh-grid opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,166,224,0.15) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded mb-6"
               style={{ background: 'rgba(242,162,47,0.15)', border: '1px solid rgba(242,162,47,0.3)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ORANGE }} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: ORANGE }}>
              Services Export Promotion Council · Govt. of India
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6" style={{ color: '#ffffff' }}>
            Market Intelligence<br />
            <span style={{ color: ORANGE }}>Synchronized</span>{' '}
            <span style={{ color: SKY }}>by AI</span>
          </h1>

          <p className="text-base sm:text-lg font-medium mb-10 max-w-xl leading-relaxed"
             style={{ color: 'rgba(255,255,255,0.6)' }}>
            The definitive intelligence platform for India's 6 strategic service export sectors.
            AI-powered audits, verified leads, and real-time market signals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/register" className="btn-accent flex items-center justify-center gap-2 py-3.5 px-8 rounded-lg group text-sm">
              Get Started <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 py-3.5 px-8 rounded-lg text-sm font-black transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
              Sign In →
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* STATS */}
    <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { v: '6', l: 'SEPC Strategic Pillars' },
            { v: 'AI-First', l: 'Intelligence Engine' },
            { v: '3-Tier', l: 'Classification System' },
            { v: 'Govt.', l: 'Backed Initiative' },
          ].map(({ v, l }) => (
            <div key={l} className="text-center">
              <div className="text-2xl sm:text-3xl font-black mb-1" style={{ color: NAVY }}>{v}</div>
              <div className="text-[9px] uppercase tracking-widest font-bold text-muted">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* SECTORS */}
    <section className="py-20" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-12">
          <div className="h-1 w-12 rounded-full mx-auto mb-5" style={{ background: `linear-gradient(90deg, ${ORANGE}, ${SKY})` }} />
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text)' }}>6 SEPC Strategic Sectors</h2>
          <p className="text-sm text-muted font-medium max-w-xl mx-auto">Comprehensive intelligence coverage across India's key service export pillars</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { name: 'Media & Entertainment', color: '#EF4444', subs: 'Animation & VFX · Film · Gaming' },
            { name: 'Education', color: NAVY, subs: 'K-12 · EdTech · Institutions · Research' },
            { name: 'Healthcare', color: '#16A34A', subs: 'Hospitals · HealthTech · Wellness' },
            { name: 'Tourism', color: ORANGE, subs: 'Hotels · Eco · Spiritual · Adventure' },
            { name: 'Financial Services', color: '#7C3AED', subs: 'FinTech · Forex · Wealth Mgmt' },
            { name: 'Consultancy Services', color: SKY, subs: 'Corporate Comm · MDs/CEOs · Firms' },
          ].map(({ name, color, subs }) => (
            <div key={name} className="premium-card p-6 group cursor-pointer" style={{ borderTop: `4px solid ${color}` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${color}15`, color }}>
                <Building2 size={18} />
              </div>
              <h3 className="font-black text-sm mb-1.5" style={{ color: 'var(--text)' }}>{name}</h3>
              <p className="text-[10px] font-semibold text-muted leading-relaxed">{subs}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FEATURES */}
    <section style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '5rem 0' }}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-12">
          <div className="h-1 w-12 rounded-full mx-auto mb-5" style={{ background: `linear-gradient(90deg, ${NAVY}, ${ORANGE})` }} />
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: 'var(--text)' }}>Built for Intelligence</h2>
          <p className="text-sm text-muted font-medium">Advanced tools for analysts, government officials, and business leaders.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'AI Deep Audit', desc: 'Multi-phase enrichment using LLMs — financial data, leadership, contacts.', icon: Cpu, color: NAVY },
            { title: 'Tier Classification', desc: '3-tier revenue-based classification with justification.', icon: BarChart3, color: ORANGE },
            { title: 'Lead Verification', desc: 'LinkedIn URLs verified, designations sourced, contacts validated.', icon: ShieldCheck, color: '#16A34A' },
            { title: 'Global Entity Search', desc: 'Instant search with domain, tier, and audit-depth filters.', icon: Search, color: SKY },
            { title: 'PDF Intelligence Report', desc: 'One-click professional report generation.', icon: Database, color: '#7C3AED' },
            { title: 'Freshness Engine', desc: 'Manual re-enrichment of stalest records with change alerts.', icon: Globe, color: '#F59E0B' },
          ].map(({ title, desc, icon: Icon, color }) => (
            <div key={title} className="premium-card p-6 group">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}12`, color }}>
                <Icon size={20} />
              </div>
              <h3 className="font-black text-sm mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-[11px] font-medium text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 relative overflow-hidden" style={{ background: `linear-gradient(135deg, #011E3E 0%, ${NAVY} 60%, #02438A 100%)` }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${ORANGE}, ${SKY})` }} />
      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to drive India's service exports forward?</h2>
        <p className="text-sm font-medium mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Join the SEPC intelligence ecosystem and access real-time market data for all 6 strategic pillars.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="btn-accent py-3.5 px-8 rounded-lg text-sm flex items-center gap-2 justify-center">
            Request Access <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="py-3.5 px-8 rounded-lg text-sm font-black flex items-center gap-2 justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
            Sign In
          </Link>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer style={{ background: '#011E3E', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '2.5rem 0' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#F2A22F,#D4871A)' }}>
              <Shield className="text-white" size={18} />
            </div>
            <div>
              <p className="font-black text-sm text-white">IntelSync AI</p>
              <p className="text-[8px] uppercase tracking-widest font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>SEPC Intelligence Platform</p>
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 Services Export Promotion Council · Ministry of Commerce &amp; Industry · Govt. of India
          </p>
        </div>
      </div>
    </footer>
  </div>
);

export default LandingPage;
