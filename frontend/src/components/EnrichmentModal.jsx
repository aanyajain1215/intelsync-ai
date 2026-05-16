import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Globe, X, Database, ArrowRight, CheckCircle2, ArrowUpRight, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const NAVY = '#013264', ORANGE = '#F2A22F';

const EnrichmentModal = ({ isOpen, onClose, initialName = '' }) => {
  const [activeTab, setActiveTab] = useState('enrich'); // 'enrich' or 'ingest'
  const [name, setName] = useState(initialName);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [existingCompany, setExistingCompany] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setWebsiteUrl('');
      setRawText('');
      setError(null);
      setStep(0);
      setExistingCompany(null);
      setLoading(false);
      setActiveTab('enrich');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const steps = [
    "Initializing connection...",
    "Scanning global registries...",
    "Verifying leadership data...",
    "Finalizing profile..."
  ];

  const handleIngest = async (e) => {
    e.preventDefault();
    if (loading || !rawText.trim()) return;
    setLoading(true); setError(null); setStep(1);

    try {
      const res = await api.post('/companies/ingest', { rawText });
      if (res.data.success) {
        setStep(4);
        const companyId = res.data.data._id;
        setTimeout(() => { onClose(); navigate(`/dashboard/companies/${companyId}`); }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Ingestion failed');
      setLoading(false);
      setStep(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(null); setExistingCompany(null); setStep(1);

    try {
      let companyId;
      try {
        const res = await api.post('/companies', { name: name.trim(), websiteUrl: websiteUrl.trim(), enrichmentStatus: 'minimal' });
        companyId = res.data.data._id;
      } catch (createErr) {
        if (createErr.response?.status === 409 && createErr.response?.data?.data?._id) {
          setExistingCompany(createErr.response.data.data);
          setLoading(false);
          setStep(0);
          return;
        }
        throw createErr;
      }

      const timer = setInterval(() => {
        setStep(prev => { if (prev < 3) return prev + 1; clearInterval(timer); return prev; });
      }, 2000);

      try {
        const enrichRes = await api.post(`/companies/${companyId}/enrich`, {}, { timeout: 300000 });
        clearInterval(timer);
        if (enrichRes.data.success) {
          setStep(4);
          setTimeout(() => { onClose(); navigate(`/dashboard/companies/${companyId}`); }, 800);
        } else {
          throw new Error('Enrichment pipeline returned failure.');
        }
      } catch (enrichErr) {
        clearInterval(timer);
        setStep(4);
        setTimeout(() => { onClose(); navigate(`/dashboard/companies/${companyId}`); }, 1200);
      }

    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setLoading(false);
      setStep(0);
    }
  };

  const handleGoToExisting = () => {
    onClose();
    navigate(`/dashboard/companies/${existingCompany._id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
           onClick={!loading ? onClose : undefined} />

      <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
           style={{ background: 'var(--surface)' }}>

        {/* Header */}
        <div className="px-8 py-6 flex justify-between items-center"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-main">Add to Intelligence Registry</h3>
              <p className="text-xs text-muted font-medium">Verified SEPC Discovery</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--muted)' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Tabs */}
        {!loading && !existingCompany && (
          <div className="flex px-8 mt-4 gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setActiveTab('enrich')} 
              className={`pb-3 text-sm font-black transition-all border-b-2 ${activeTab === 'enrich' ? 'text-primary border-primary' : 'text-muted border-transparent'}`}>
              Auto-Discovery
            </button>
            <button onClick={() => setActiveTab('ingest')}
              className={`pb-3 text-sm font-black transition-all border-b-2 ${activeTab === 'ingest' ? 'text-primary border-primary' : 'text-muted border-transparent'}`}>
              Smart Lead Ingest (Apollo/LinkedIn)
            </button>
          </div>
        )}

        <div className="p-8">
          {existingCompany ? (
            <div className="space-y-5 py-2">
              <div className="flex items-start gap-3 p-4 rounded-xl"
                   style={{ background: 'rgba(242,162,47,0.08)', border: '1px solid rgba(242,162,47,0.25)' }}>
                <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: ORANGE }} />
                <div>
                  <p className="text-sm font-black" style={{ color: ORANGE }}>Already in Registry</p>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    <span className="font-black text-main">{existingCompany.name}</span> is already in the
                    SEPC database. Use the Re-Enrich button on its profile to refresh data.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl flex items-center justify-between gap-4"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-main truncate">{existingCompany.name}</p>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">
                    {existingCompany.domain || 'Unclassified'} ·{' '}
                    {existingCompany.enrichmentStatus === 'full' ? 'Deep Audit' : existingCompany.enrichmentStatus || 'Minimal'}
                  </p>
                </div>
                <button onClick={handleGoToExisting} className="btn-primary text-xs py-2 px-4 shrink-0">
                  View Profile <ArrowUpRight size={13} />
                </button>
              </div>

              <button onClick={onClose} className="btn-secondary w-full">Close</button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 rounded-xl text-sm font-semibold flex items-center gap-3"
                     style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                  <X size={16} /> {error}
                </div>
              )}

              {!loading ? (
                activeTab === 'enrich' ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider ml-1"
                             style={{ color: 'var(--muted)' }}>Company / Legal Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2"
                                   size={18} style={{ color: 'var(--subtle)' }} />
                        <input type="text" required value={name}
                               onChange={e => setName(e.target.value)}
                               className="input-field pl-12"
                               placeholder="e.g. Tata Consultancy Services"
                               autoFocus />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider ml-1"
                             style={{ color: 'var(--muted)' }}>Website (Optional)</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2"
                               size={18} style={{ color: 'var(--subtle)' }} />
                        <input type="text" value={websiteUrl}
                               onChange={e => setWebsiteUrl(e.target.value)}
                               className="input-field pl-12"
                               placeholder="tcs.com" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                      <button type="submit" disabled={!name.trim()} className="btn-primary flex-[2]">
                        Discover & Enrich <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleIngest} className="space-y-6 animate-fade-in">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider ml-1"
                             style={{ color: 'var(--muted)' }}>Paste Apollo / LinkedIn Lead Text</label>
                      <textarea
                        required
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        className="input-field min-h-[160px] py-3 text-xs leading-relaxed font-medium"
                        placeholder="Paste the raw text from Apollo profile or LinkedIn page here..."
                      />
                      <p className="text-[10px] text-muted font-bold mt-1">
                        AI will automatically extract Company, CEO, Email, and Website.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                      <button type="submit" disabled={rawText.length < 50} className="btn-primary flex-[2]">
                        AI Parse & Save Lead <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                )
              ) : (
                <div className="py-8 space-y-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 border-4 rounded-full animate-spin mb-6"
                         style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
                    <h4 className="text-sm font-bold text-main">{activeTab === 'ingest' ? 'AI Parsing lead data...' : steps[Math.min(step - 1, 3)]}</h4>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrichmentModal;
