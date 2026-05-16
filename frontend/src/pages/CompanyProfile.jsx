import React, { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import DomainBadge from '../components/DomainBadge';
import FreshnessBar from '../components/FreshnessBar';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft, RefreshCw, Download, Globe, Link2, Mail, Phone,
  MapPin, Calendar, User, Users, Newspaper, TrendingUp, Award,
  Building2, ExternalLink, ShieldCheck, AlertTriangle, GraduationCap, Loader2,
  DollarSign, BarChart2, Activity, Zap, AlertOctagon, FileText
} from 'lucide-react';

const Linkedin = Link2; // lucide-react alias

const NAVY = '#013264', ORANGE = '#F2A22F', SKY = '#00A6E0';

const Section = ({ title, icon: Icon, children, color = NAVY }) => (
  <div className="premium-card p-6 animate-slide-up">
    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: color }} />
    <div className="flex items-center gap-2.5 mb-5 mt-1">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
        <Icon size={16} />
      </div>
      <h2 className="text-sm font-black uppercase tracking-wider text-main">{title}</h2>
    </div>
    {children}
  </div>
);

const Field = ({ label, value, href, icon: Icon }) => {
  if (!value) return null;
  const content = (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      {Icon && <Icon size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-0.5">{label}</p>
        <p className="text-sm font-bold text-main break-words">{value}</p>
      </div>
      {href && <ExternalLink size={12} className="mt-1 shrink-0" style={{ color: 'var(--subtle)' }} />}
    </div>
  );
  if (href) return <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noopener noreferrer" className="block hover:bg-[var(--surface-hover)] rounded-lg px-2 -mx-2 transition-colors">{content}</a>;
  return content;
};

const CompanyProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useContext(AuthContext);
  const { data: company, isLoading, refetch } = useCompany(id);
  const [enriching, setEnriching] = useState(false);

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await api.post(`/companies/${id}/enrich`, {}, { timeout: 180000 });
      await refetch();
    } catch (err) {
      alert('Enrichment failed: ' + (err.response?.data?.message || err.message));
    }
    setEnriching(false);
  };

  const downloadPDF = () => {
    if (!company) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;
    const addLine = (text, size = 10, style = 'normal', color = [13,30,51]) => {
      doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, pageWidth - 30);
      lines.forEach(line => { if (y > 275) { doc.addPage(); y = 15; } doc.text(line, 15, y); y += size * 0.45 + 2; });
    };
    const addSep = () => { doc.setDrawColor(200, 210, 220); doc.line(15, y, pageWidth - 15, y); y += 6; };

    // Header
    doc.setFillColor(1,50,100);
    doc.rect(0, 0, pageWidth, 36, 'F');
    doc.setFillColor(242,162,47);
    doc.rect(0, 36, pageWidth, 2, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
    doc.text('SEPC INTELLIGENCE REPORT', 15, 16);
    doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 15, 24);
    doc.setFontSize(13); doc.text(company.name || '', 15, 32);
    y = 46;

    // Status
    addLine(`STATUS: ${company.isActive !== false ? 'ACTIVE' : 'DEFUNCT / CLOSED'}`, 11, 'bold', company.isActive !== false ? [22,163,74] : [220,38,38]);
    y += 2;

    // Classification
    addLine('CLASSIFICATION', 11, 'bold', [1,50,100]);
    addLine(`Domain: ${company.domain || 'N/A'}`);
    addLine(`Sub-Category: ${company.subCategory || 'N/A'}`);
    if (company.tier) addLine(`Tier: ${company.tier} — ${company.tierJustification || ''}`);
    addSep();

    // Strategic Summary
    if (company.description) { addLine('AI STRATEGIC SUMMARY', 11, 'bold', [1,50,100]); addLine(company.description); addSep(); }
    if (company.aiSummary?.offerings) { addLine('Offerings: ' + company.aiSummary.offerings); }
    if (company.aiSummary?.relevance) { addLine('SEPC Relevance: ' + company.aiSummary.relevance); }
    if (company.aiSummary?.growthSignals) { addLine('Growth Signals: ' + company.aiSummary.growthSignals); }
    if (company.aiSummary?.offerings) addSep();

    // Foundation
    addLine('FOUNDATION DETAILS', 11, 'bold', [1,50,100]);
    if (company.foundedYear) addLine(`Founded: ${company.foundedYear}${company.foundedBy ? ' by ' + company.foundedBy : ''}`);
    if (company.currentCeo) addLine(`CEO: ${company.currentCeo}`);
    if (company.employeeCount) addLine(`Employees: ${company.employeeCount}`);
    addSep();

    // Contact
    addLine('CONTACT CHANNELS', 11, 'bold', [1,50,100]);
    if (company.websiteUrl) addLine(`Website: ${company.websiteUrl}`);
    if (company.linkedinUrl) addLine(`LinkedIn: ${company.linkedinUrl}`);
    if (company.officialEmail) addLine(`Email: ${company.officialEmail}`);
    if (company.phones?.length) addLine(`Phone: ${company.phones.join(', ')}`);
    if (company.headquartersAddress) addLine(`HQ: ${company.headquartersAddress}`);
    addSep();

    // Leadership
    if (company.leadership?.length) {
      addLine('EXECUTIVE LEADERSHIP', 11, 'bold', [1,50,100]);
      company.leadership.forEach(l => {
        addLine(`• ${l.name} — ${l.designation || 'N/A'}`);
        if (l.email) addLine(`  Email: ${l.email}`);
        if (l.phone) addLine(`  Phone: ${l.phone}`);
        if (l.linkedin) addLine(`  LinkedIn: ${l.linkedin}`);
      });
      addSep();
    }

    // News
    if (company.recentNews?.length) {
      const strategicNews = company.recentNews.filter(n => n.newsCategory && n.newsCategory !== 'general');
      if (strategicNews.length) {
        addLine('RECENT NEWS & MARKET SIGNALS', 11, 'bold', [1,50,100]);
        strategicNews.forEach(n => {
          addLine(`• [${n.newsCategory?.toUpperCase()}] ${n.title}${n.source ? ' — ' + n.source : ''}`);
        });
        addSep();
      }
    }

    // Financials
    if (company.revenue || company.stockInfo || company.fundingStatus) {
      addLine('FINANCIAL SIGNALS', 11, 'bold', [1,50,100]);
      if (company.revenue) addLine(`Revenue: ${company.revenue}`);
      if (company.stockInfo) addLine(`Stock: ${company.stockInfo}`);
      if (company.fundingStatus) addLine(`Funding: ${company.fundingStatus}`);
      addSep();
    }

    // NIRF
    if (company.nirfRanking) { addLine('NIRF RANKING', 11, 'bold', [1,50,100]); addLine(`Rank: ${company.nirfRanking}`); addSep(); }

    // Footer
    doc.setFontSize(7); doc.setTextColor(130,150,170);
    doc.text('Services Export Promotion Council · Ministry of Commerce & Industry · Govt. of India', 15, 290);
    doc.text('IntelSync AI · Confidential Intelligence Report', pageWidth - 15, 290, { align: 'right' });

    doc.save(`SEPC_Report_${company.name?.replace(/\s+/g, '_') || 'entity'}.pdf`);
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner /></div>;
  if (!company) return <div className="text-center py-20 text-muted font-bold">Entity not found.</div>;

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6">
      {/* Back nav */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-colors text-muted hover:text-main">
        <ArrowLeft size={14} /> Back to Directory
      </button>

      {/* Header Card */}
      <div className="premium-card overflow-hidden animate-fade-in">

        {/* Scope/Accuracy Banners */}
        {company.isSepcRelevant === false && (
          <div className="px-6 py-3 flex items-start gap-3"
               style={{ background: 'rgba(220,38,38,0.1)', borderBottom: '1px solid rgba(220,38,38,0.25)' }}>
            <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
            <p className="text-xs font-semibold" style={{ color: '#991B1B' }}>
              <span className="font-black text-[10px] uppercase tracking-wider mr-2 bg-red-600 text-white px-1.5 py-0.5 rounded">Out of Scope</span>
              This entity does not fall within the 6 strategic SEPC service domains.
            </p>
          </div>
        )}

        {company.enrichmentWarning && (
          <div className="px-6 py-3 flex items-start gap-3"
               style={{ background: 'rgba(242,162,47,0.1)', borderBottom: '1px solid rgba(242,162,47,0.25)' }}>
            <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: '#F2A22F' }} />
            <p className="text-xs font-semibold" style={{ color: '#b37b00' }}>
              <span className="font-black">Data Accuracy Notice: </span>{company.enrichmentWarning}
            </p>
          </div>
        )}

        {/* Status strip */}
        <div className="h-2" style={{ background: company.isActive !== false

          ? 'linear-gradient(90deg, #16A34A, #22C55E)'
          : 'linear-gradient(90deg, #DC2626, #F87171)' }} />

        <div className="p-6 sm:p-8">
          {/* Active/Defunct flag — FIRST */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {company.isActive !== false
              ? <><ShieldCheck size={18} style={{ color: '#16A34A' }} /><span className="text-sm font-black uppercase tracking-wider" style={{ color: '#16A34A' }}>Active Entity</span></>
              : <><AlertTriangle size={18} style={{ color: '#DC2626' }} /><span className="text-sm font-black uppercase tracking-wider" style={{ color: '#DC2626' }}>Defunct / Closed</span></>
            }
            {/* Risk flags — shown inline with status */}
            {company.riskFlags?.length > 0 && company.riskFlags.map(flag => (
              <span key={flag} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                <AlertOctagon size={10} /> {flag}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-main tracking-tight mb-2">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <DomainBadge domain={company.domain} />
                {company.subCategory && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {company.subCategory}
                  </span>
                )}
                {company.tier && <span className="badge badge-orange">Tier {company.tier}</span>}
                <span className={`badge ${company.enrichmentStatus === 'full' ? 'badge-green' : 'badge-slate'}`}>
                  {company.enrichmentStatus === 'full' ? 'Deep Audit Complete' : company.enrichmentStatus || 'Minimal'}
                </span>
              </div>
              {company.city && (
                <p className="flex items-center gap-1.5 text-sm text-muted font-semibold mt-3">
                  <MapPin size={13} /> {company.city}{company.country ? `, ${company.country}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <button onClick={handleEnrich} disabled={enriching} className="btn-secondary text-sm py-2.5 px-5">
                {enriching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={14} />}
                {enriching ? 'Enriching...' : 'Re-Enrich'}
              </button>
              <button onClick={downloadPDF} className="btn-primary text-sm py-2.5 px-5">
                <Download size={14} /> PDF Report
              </button>
            </div>
          </div>

          {/* Freshness bar */}
          <div className="mt-5 pt-4 flex items-center gap-4" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted">Freshness</span>
            <FreshnessBar score={company.freshnessScore || 0} />
            <span className="text-xs font-black text-main">{company.freshnessScore || 0}%</span>
            {company.enrichedAt && (
              <span className="text-[10px] text-muted font-semibold ml-auto">
                Last audit: {new Date(company.enrichedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Summary */}
        {company.description && (
          <div className="lg:col-span-2">
            <Section title="AI Strategic Summary" icon={TrendingUp} color={ORANGE}>
              <p className="text-sm font-medium text-secondary leading-relaxed mb-4">{company.description}</p>
              {company.aiSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Offerings', val: company.aiSummary.offerings },
                    { label: 'SEPC Relevance', val: company.aiSummary.relevance },
                    { label: 'Growth Signals', val: company.aiSummary.growthSignals },
                    { label: 'Sector Positioning', val: company.aiSummary.sectorPositioning },
                  ].filter(i => i.val).map(({ label, val }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1">{label}</p>
                      <p className="text-xs font-semibold text-secondary">{val}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Foundation */}
        <Section title="Foundation Details" icon={Calendar} color={NAVY}>
          <Field label="Founded" value={company.foundedYear ? `${company.foundedYear}${company.foundedBy ? ' by ' + company.foundedBy : ''}` : null} icon={Calendar} />
          <Field label="Current CEO" value={company.currentCeo} icon={User} href={company.ceoLinkedinUrl} />
          <Field label="Employees" value={company.employeeCount} icon={Users} />
          {company.tierJustification && <Field label="Tier Justification" value={company.tierJustification} icon={Award} />}
        </Section>

        {/* Contact */}
        <Section title="Contact Channels" icon={Globe} color={SKY}>
          <Field label="Website" value={company.websiteUrl} icon={Globe} href={company.websiteUrl} />
          <Field label="LinkedIn" value={company.linkedinUrl} icon={Linkedin} href={company.linkedinUrl} />
          <Field label="Official Email" value={company.officialEmail || (company.emails?.length ? company.emails[0] : null)} icon={Mail} />
          <Field label="Phone" value={company.phones?.length ? company.phones.join(', ') : null} icon={Phone} />
          <Field label="Headquarters" value={company.headquartersAddress || [company.city, company.country].filter(Boolean).join(', ') || null} icon={MapPin} />
        </Section>

        {/* Leadership */}
        {company.leadership?.length > 0 && (
          <div className="lg:col-span-2">
            <Section title="Executive Leadership" icon={Users} color={NAVY}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {company.leadership.map((leader, i) => (
                  <div key={i} className="p-4 rounded-xl transition-all hover:shadow-md"
                       style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-black text-main mb-0.5">{leader.name}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{leader.designation || 'Executive'}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {leader.email && (
                        <a href={`mailto:${leader.email}`} className="flex items-center gap-2 text-[11px] font-semibold text-secondary hover:text-primary transition-colors">
                          <Mail size={11} style={{ color: 'var(--subtle)' }} /> {leader.email}
                        </a>
                      )}
                      {leader.phone && (
                        <p className="flex items-center gap-2 text-[11px] font-semibold text-secondary">
                          <Phone size={11} style={{ color: 'var(--subtle)' }} /> {leader.phone}
                        </p>
                      )}
                      {leader.linkedin && (
                        <a href={leader.linkedin.startsWith('http') ? leader.linkedin : `https://${leader.linkedin}`}
                           target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 text-[11px] font-semibold text-secondary hover:text-primary transition-colors">
                          <Linkedin size={11} style={{ color: 'var(--subtle)' }} /> LinkedIn Profile
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Documents & Reports */}
        {company.documents?.length > 0 && (
          <div className="lg:col-span-2">
            <Section title="Documents & Reports" icon={FileText} color={ORANGE}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.documents.map((doc, idx) => (
                  <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-all border border-transparent hover:border-orange-200"
                     style={{ background: 'var(--surface-2)' }}>
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                      <Download size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-main truncate">{doc.title || 'Official Report / Attachment'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          {doc.docType?.replace('_', ' ') || 'Document'}
                        </span>
                        {doc.year && <span className="text-[9px] font-bold text-muted">{doc.year}</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Email Patterns (Separated for clarity) */}
        {company.activeDiscovery?.potential_emails?.length > 0 && (
          <div className="lg:col-span-2">
            <Section title="Verified Email Patterns" icon={Mail} color={SKY}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {company.activeDiscovery.potential_emails.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs font-black text-main">{item.email}</p>
                    <span className="text-[8px] font-black uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded">High Confidence</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Structured Financial Signals */}
        {company.financialSignals && Object.values(company.financialSignals).some(Boolean) && (
          <div className="lg:col-span-2">
            <Section title="Financial Signals" icon={TrendingUp} color="#7C3AED">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Revenue', val: company.financialSignals.revenue, icon: DollarSign,
                    color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
                  { label: 'Revenue Growth', val: company.financialSignals.revenueGrowth, icon: TrendingUp,
                    color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
                  { label: 'Profit / Loss', val: company.financialSignals.profitLoss, icon: BarChart2,
                    color: company.financialSignals.profitTrend === 'loss' ? '#DC2626' : '#16A34A',
                    bg: company.financialSignals.profitTrend === 'loss' ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' },
                  { label: 'Market Cap', val: company.financialSignals.marketCap, icon: Activity,
                    color: '#013264', bg: 'rgba(1,50,100,0.08)' },
                  { label: 'Stock', val: company.financialSignals.stockTicker
                    ? `${company.financialSignals.stockTicker}${company.financialSignals.stockPrice ? ' · ' + company.financialSignals.stockPrice : ''}`
                    : null, icon: Zap, color: '#F2A22F', bg: 'rgba(242,162,47,0.08)' },
                  { label: 'Funding', val: company.financialSignals.fundingStatus, icon: DollarSign,
                    color: '#00A6E0', bg: 'rgba(0,166,224,0.08)' },
                  { label: 'Last Round', val: company.financialSignals.lastFundingAmount
                    ? `${company.financialSignals.lastFundingAmount}${company.financialSignals.lastFundingDate ? ' · ' + company.financialSignals.lastFundingDate : ''}`
                    : null, icon: TrendingUp, color: '#00A6E0', bg: 'rgba(0,166,224,0.08)' },
                  { label: 'Valuation', val: company.financialSignals.valuation, icon: BarChart2,
                    color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
                ].filter(i => i.val).map(({ label, val, icon: Icon, color, bg }) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: bg, border: `1px solid ${color}20` }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon size={11} style={{ color }} />
                      <p className="text-[8px] font-black uppercase tracking-widest" style={{ color }}>{label}</p>
                    </div>
                    <p className="text-sm font-black text-main leading-tight">{val}</p>
                  </div>
                ))}
              </div>
              {/* Profit trend indicator */}
              {company.financialSignals.profitTrend && company.financialSignals.profitTrend !== 'unknown' && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl"
                     style={{
                       background: company.financialSignals.profitTrend === 'loss' ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)',
                       border: `1px solid ${company.financialSignals.profitTrend === 'loss' ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)'}`
                     }}>
                  {company.financialSignals.profitTrend === 'loss'
                    ? <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                    : <TrendingUp size={14} style={{ color: '#16A34A' }} />
                  }
                  <span className="text-xs font-black uppercase tracking-wider"
                        style={{ color: company.financialSignals.profitTrend === 'loss' ? '#DC2626' : '#16A34A' }}>
                    {company.financialSignals.profitTrend === 'loss' ? 'Reporting Net Loss' :
                     company.financialSignals.profitTrend === 'profit' ? 'Profitable' : 'Breakeven'}
                  </span>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Categorized News */}
        {company.recentNews?.length > 0 && (
          <div className="lg:col-span-2">
            <Section title="News & Market Signals" icon={Newspaper} color={ORANGE}>
              {/* Category filter pills */}
              {(() => {
                const cats = [...new Set(company.recentNews.map(n => n.newsCategory).filter(Boolean))];
                const CAT_STYLE = {
                  risk:       { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626',  border: 'rgba(220,38,38,0.25)' },
                  financial:  { bg: 'rgba(124,58,237,0.1)',  color: '#7C3AED',  border: 'rgba(124,58,237,0.25)' },
                  leadership: { bg: 'rgba(1,50,100,0.1)',    color: '#013264',  border: 'rgba(1,50,100,0.25)' },
                  expansion:  { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A',  border: 'rgba(22,163,74,0.25)' },
                  product:    { bg: 'rgba(0,166,224,0.1)',   color: '#00A6E0',  border: 'rgba(0,166,224,0.25)' },
                  general:    { bg: 'var(--surface-2)',       color: 'var(--muted)', border: 'var(--border)' },
                };
                return (
                  <div className="space-y-3">
                    {company.recentNews.map((news, i) => {
                      const cat = news.newsCategory || 'general';
                      const style = CAT_STYLE[cat] || CAT_STYLE.general;
                      return (
                        <div key={i} className="p-4 rounded-xl transition-all"
                             style={{ background: 'var(--surface-2)', border: `1px solid var(--border)` }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Category tag */}
                              <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-2"
                                    style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                                {cat === 'risk' ? '⚠ ' : cat === 'financial' ? '💰 ' : ''}{cat}
                              </span>
                              {news.url ? (
                                <a href={news.url} target="_blank" rel="noopener noreferrer"
                                   className="block text-sm font-bold text-main hover:text-primary transition-colors leading-snug">
                                  {news.title}
                                </a>
                              ) : (
                                <p className="text-sm font-bold text-main leading-snug">{news.title}</p>
                              )}
                              {news.description && (
                                <p className="text-xs text-muted font-medium mt-1 line-clamp-2">{news.description}</p>
                              )}
                            </div>
                            {news.url && <ExternalLink size={12} className="shrink-0 mt-5" style={{ color: 'var(--subtle)' }} />}
                          </div>
                          <div className="flex items-center gap-3 mt-2.5">
                            {news.source && <span className="text-[9px] font-bold uppercase tracking-widest text-muted">{news.source}</span>}
                            {news.publishedAt && <span className="text-[9px] text-subtle">{news.publishedAt}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Section>
          </div>
        )}

        {/* NIRF — Education only */}
        {company.nirfRanking && (
          <Section title="NIRF Ranking" icon={GraduationCap} color={NAVY}>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white" style={{ background: NAVY }}>
                #{company.nirfRanking}
              </div>
              <div>
                <p className="text-sm font-black text-main">NIRF Rank #{company.nirfRanking}</p>
                <p className="text-xs text-muted font-semibold">National Institutional Ranking Framework</p>
                {company.institutionType && <p className="text-[10px] text-muted mt-0.5">Type: {company.institutionType}</p>}
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

export default CompanyProfile;
