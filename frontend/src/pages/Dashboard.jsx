import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '../hooks/useAnalytics';
import { useCompanies } from '../hooks/useCompanies';
import LoadingSpinner from '../components/LoadingSpinner';
import DomainBadge from '../components/DomainBadge';
import FreshnessBar from '../components/FreshnessBar';
import {
  Activity, Database, Search as SearchIcon, ArrowRight, ArrowUpRight,
  ShieldCheck, Tv2, GraduationCap, HeartPulse, Plane,
  Landmark, Briefcase, Globe2
} from 'lucide-react';

const NAVY = '#013264', ORANGE = '#F2A22F', SKY = '#00A6E0';

const SEPC_DOMAINS = ['Media and Entertainment', 'Education', 'Healthcare', 'Tourism', 'Financial services', 'Consultancy services'];

const DOMAIN_META = {
  'Media and Entertainment': { icon: Tv2, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', subs: ['Animation & VFX', 'Film & Distributors', 'Gaming'] },
  'Education': { icon: GraduationCap, color: NAVY, bg: 'rgba(1,50,100,0.08)', subs: ['K-12 / Colleges', 'EdTech', 'Attachés', 'Researchers'] },
  'Healthcare': { icon: HeartPulse, color: '#16A34A', bg: 'rgba(22,163,74,0.08)', subs: ['Hospitals', 'AI HealthTech', 'Nursing & Mgmt', 'Wellness'] },
  'Tourism': { icon: Plane, color: ORANGE, bg: 'rgba(242,162,47,0.08)', subs: ['Hotels', 'Tour Operators', 'Adventure', 'Eco', 'Spiritual'] },
  'Financial services': { icon: Landmark, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', subs: ['FinTech', 'Forex (Banks)', 'Wealth Mgmt'] },
  'Consultancy services': { icon: Briefcase, color: SKY, bg: 'rgba(0,166,224,0.08)', subs: ['Corporate Comm', 'Consultancy Firms', 'MDs/CEOs'] },
};

const StatCard = ({ label, value, icon: Icon, color, delay }) => (
  <div className="stat-card p-5 animate-slide-up" style={{ animationDelay: delay }}>
    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: color }} />
    <div className="flex items-center gap-3 mb-4 mt-1">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
        <Icon size={18} />
      </div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</p>
    </div>
    <div className="text-3xl font-black text-main" style={{ letterSpacing: '-0.02em' }}>
      {value?.toLocaleString() ?? '—'}
    </div>
  </div>
);

const SectorCard = ({ domain, count = 0, total = 1, meta, delay }) => {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const Icon = meta.icon;
  return (
    <div className="sector-card p-5 animate-slide-up" style={{ animationDelay: delay }}>
      <div className="sector-card-accent" style={{ background: meta.color }} />
      <div className="flex items-start gap-3 mb-4 mt-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg, color: meta.color }}>
          <Icon size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-main leading-tight">{domain}</p>
          <p className="text-[9px] font-bold text-muted uppercase tracking-widest mt-0.5">
            {count.toLocaleString()} entities · {pct}%
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {meta.subs.map(s => (
          <span key={s} className="text-[9px] font-bold px-2 py-0.5 rounded"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}25` }}>{s}</span>
        ))}
      </div>
      <div className="h-1 rounded-full" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useAnalytics();
  const { data: recentData, isLoading: recentLoading } = useCompanies({ limit: 5, page: 1, sort: 'recentlyAudited' });
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
  };

  if (statsLoading || recentLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <LoadingSpinner />
      <p className="text-sm font-bold animate-pulse text-shimmer">Syncing Intelligence Data...</p>
    </div>
  );

  const domainCountMap = {};
  (stats?.domainBreakdown || []).forEach(item => { if (item.domain) domainCountMap[item.domain] = item.count || 0; });
  const total = stats?.totalCompanies || 1;

  const statCards = [
    { label: 'Total Entities', value: stats?.totalCompanies, icon: Database, color: NAVY },
    { label: 'Active Entities', value: stats?.activeCompanies, icon: Activity, color: '#16A34A' },
    { label: 'Deep Audited', value: stats?.fullyEnriched, icon: ShieldCheck, color: ORANGE },
    { label: 'Inactive / Defunct', value: stats?.inactiveCompanies, icon: Globe2, color: '#DC2626' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Hero Header */}
      <div className="hero-gradient mesh-grid rounded-2xl p-7 sm:p-10 relative overflow-hidden animate-fade-in">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded mb-3"
                 style={{ background: 'rgba(242,162,47,0.15)', border: '1px solid rgba(242,162,47,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ORANGE }} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: ORANGE }}>
                Services Export Promotion Council
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-main tracking-tight mb-1">Intelligence Overview</h1>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              Dynamic Market Intelligence &amp; Lead Verification System
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((item, i) => <StatCard key={i} {...item} delay={`${i * 60}ms`} />)}
      </div>

      {/* 6 Sectors */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="h-1 w-10 rounded-full mb-2" style={{ background: `linear-gradient(90deg, ${NAVY}, ${ORANGE})` }} />
            <h2 className="text-lg font-black text-main">SEPC Target Sectors</h2>
            <p className="text-xs text-muted font-semibold mt-0.5">6 strategic pillars · entity coverage &amp; sub-sectors</p>
          </div>
          <button onClick={() => navigate('/dashboard/search')}
            className="group flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-all" style={{ color: NAVY }}>
            Browse All <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {SEPC_DOMAINS.map((domain, i) => (
            <SectorCard key={domain} domain={domain} count={domainCountMap[domain] || 0}
                        total={total} meta={DOMAIN_META[domain]} delay={`${i * 55}ms`} />
          ))}
        </div>
      </div>

      {/* Recent Audits */}
      <div className="premium-card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${NAVY}, ${SKY})` }} />
        <div className="flex items-center justify-between mb-6 mt-1">
          <div>
            <h2 className="text-base font-black text-main">Recent Audits</h2>
            <p className="text-xs text-muted font-semibold mt-0.5">Latest enriched entities</p>
          </div>
          <button onClick={() => navigate('/dashboard/search')}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest" style={{ color: NAVY }}>
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Entity', 'Sector', 'Status', 'Audit', 'Health'].map(h => (
                  <th key={h} className="pb-3 text-[9px] uppercase tracking-widest font-black text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentData?.companies?.map(company => (
                <tr key={company._id} className="group cursor-pointer transition-all"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => navigate(`/dashboard/companies/${company._id}`)}>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-main group-hover:text-primary transition-colors truncate max-w-[180px]">{company.name}</div>
                      <ArrowUpRight size={11} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </td>
                  <td className="py-3.5 pr-4"><DomainBadge domain={company.domain} /></td>
                  <td className="py-3.5 pr-4">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${company.isActive !== false ? 'text-success' : 'text-danger'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${company.isActive !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                      {company.isActive !== false ? 'Active' : 'Defunct'}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`badge ${company.enrichmentStatus === 'full' ? 'badge-green' : 'badge-slate'}`}>
                      {company.enrichmentStatus === 'full' ? 'Deep' : company.enrichmentStatus || 'Minimal'}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <FreshnessBar score={company.freshnessScore || 0} />
                      <span className="text-xs font-black text-muted w-8">{company.freshnessScore || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
