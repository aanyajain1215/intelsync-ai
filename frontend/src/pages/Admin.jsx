import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import DataTable from '../components/DataTable';
import DomainBadge from '../components/DomainBadge';
import api from '../services/api';
import {
  Database, ShieldCheck, Cpu, Plus, Trash2, RefreshCw, Download,
  AlertCircle, CheckCircle2, Users, ArrowRight, Loader2, X
} from 'lucide-react';

const NAVY = '#013264', ORANGE = '#F2A22F';

const Tab = ({ active, label, icon: Icon, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-wider transition-all rounded-t-lg relative"
    style={active ? { color: NAVY, borderBottom: `3px solid ${ORANGE}` } : { color: 'var(--muted)' }}>
    <Icon size={16} /> {label}
  </button>
);

const Admin = () => {
  const { isAdmin } = useContext(AuthContext);
  const [tab, setTab] = useState('entities');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freshnessLoading, setFreshnessLoading] = useState(false);
  const [freshnessResults, setFreshnessResults] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, userRes, alertRes] = await Promise.all([
        api.get('/companies?limit=100'),
        isAdmin ? api.get('/users') : Promise.resolve({ data: { data: [] } }),
        api.get('/alerts?limit=50'),
      ]);
      setCompanies(compRes.data.data.companies || []);
      setUsers(userRes.data.data || []);
      setAlerts(alertRes.data.data.alerts || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDeleteCompany = async (id, name) => {
    if (!window.confirm(`Delete "${name}" from the registry?`)) return;
    await api.delete(`/companies/${id}`);
    setCompanies(c => c.filter(x => x._id !== id));
  };

  const handleDeleteUser = async (id, email) => {
    if (!window.confirm(`Remove user "${email}"?`)) return;
    await api.delete(`/users/${id}`);
    setUsers(u => u.filter(x => x._id !== id));
  };

  const handleResolveAlert = async (id) => {
    await api.patch(`/alerts/${id}/resolve`);
    setAlerts(a => a.map(x => x._id === id ? { ...x, status: 'resolved' } : x));
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/companies/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'SEPC_Companies_Export.csv';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  const handleFreshnessRun = async () => {
    setFreshnessLoading(true);
    setFreshnessResults(null);
    try {
      const res = await api.post('/freshness/run', {}, { timeout: 600000 });
      setFreshnessResults(res.data);
      loadData();
    } catch (err) {
      setFreshnessResults({ success: false, message: err.response?.data?.message || err.message });
    }
    setFreshnessLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-main tracking-tight">Admin Control Panel</h1>
        <p className="text-muted font-semibold mt-1 text-sm">Manage entities, users, and AI pipeline operations.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
        <Tab active={tab === 'entities'} label="Entity Records" icon={Database} onClick={() => setTab('entities')} />
        <Tab active={tab === 'users'} label="Access Control" icon={Users} onClick={() => setTab('users')} />
        <Tab active={tab === 'pipeline'} label="AI Pipeline" icon={Cpu} onClick={() => setTab('pipeline')} />
      </div>

      {/* ENTITY RECORDS */}
      {tab === 'entities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-muted">{companies.length} entities in registry</p>
            <button onClick={handleExportCSV} className="btn-secondary text-xs py-2 px-4">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="premium-card overflow-hidden">
            <DataTable
              columns={[
                { key: 'name', header: 'Entity', render: row => <span className="font-black text-sm text-main">{row.name}</span> },
                { key: 'domain', header: 'Sector', render: row => <DomainBadge domain={row.domain} /> },
                { key: 'isActive', header: 'Status', render: row => (
                  <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${row.isActive !== false ? 'text-success' : 'text-danger'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.isActive !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                    {row.isActive !== false ? 'Active' : 'Defunct'}
                  </span>
                )},
                { key: 'enrichmentStatus', header: 'Audit', render: row => (
                  <span className={`badge ${row.enrichmentStatus === 'full' ? 'badge-green' : 'badge-slate'}`}>{row.enrichmentStatus || 'minimal'}</span>
                )},
                ...(isAdmin ? [{ key: 'actions', header: '', render: row => (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCompany(row._id, row.name); }}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                )}] : []),
              ]}
              data={companies}
            />
          </div>
        </div>
      )}

      {/* ACCESS CONTROL */}
      {tab === 'users' && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-muted">{users.length} registered users</p>
          <div className="premium-card overflow-hidden">
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: row => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: row.role === 'admin' ? '#DC2626' : NAVY }}>
                      {row.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-black text-sm text-main">{row.name}</p>
                      <p className="text-[10px] text-muted">{row.email}</p>
                    </div>
                  </div>
                )},
                { key: 'role', header: 'Role', render: row => (
                  <span className={`badge ${row.role === 'admin' ? 'badge-red' : 'badge-navy'}`}>{row.role}</span>
                )},
                { key: 'designation', header: 'Designation', render: row => <span className="text-sm text-secondary">{row.designation || '—'}</span> },
                { key: 'createdAt', header: 'Joined', render: row => <span className="text-xs text-muted">{new Date(row.createdAt).toLocaleDateString('en-IN')}</span> },
                ...(isAdmin ? [{ key: 'actions', header: '', render: row => (
                  <button onClick={() => handleDeleteUser(row._id, row.email)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                )}] : []),
              ]}
              data={users}
            />
          </div>
        </div>
      )}

      {/* AI PIPELINE */}
      {tab === 'pipeline' && (
        <div className="space-y-6">
          {/* Freshness Engine */}
          <div className="premium-card p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${NAVY}, ${ORANGE})` }} />
            <div className="flex items-start justify-between gap-4 mt-1">
              <div>
                <h3 className="text-base font-black text-main mb-1">Freshness Engine</h3>
                <p className="text-xs text-muted font-semibold">Re-enrich the 10 stalest records in the registry. Alerts will be generated for any detected changes.</p>
              </div>
              <button onClick={handleFreshnessRun} disabled={freshnessLoading}
                className="btn-primary text-xs py-2.5 px-6 shrink-0">
                {freshnessLoading ? <><Loader2 size={14} className="animate-spin" /> Running...</> : <><RefreshCw size={14} /> Run Freshness Check</>}
              </button>
            </div>

            {freshnessResults && (
              <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-bold mb-3" style={{ color: freshnessResults.success ? 'var(--success)' : 'var(--danger)' }}>
                  {freshnessResults.success ? '✅ ' : '❌ '}{freshnessResults.message}
                </p>
                {freshnessResults.results?.length > 0 && (
                  <div className="space-y-2">
                    {freshnessResults.results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <span className="text-sm font-bold text-main">{r.name}</span>
                        <div className="flex items-center gap-2">
                          {r.changes?.map(c => (
                            <span key={c} className={`badge ${c === 'NO_CHANGE' ? 'badge-slate' : c === 'DEFUNCT' ? 'badge-red' : 'badge-orange'}`}>{c}</span>
                          ))}
                          <span className={`badge ${r.status === 'refreshed' ? 'badge-green' : 'badge-red'}`}>{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="premium-card p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: '#DC2626' }} />
            <h3 className="text-base font-black text-main mb-1 mt-1">Flagged Alerts</h3>
            <p className="text-xs text-muted font-semibold mb-4">Alerts generated by the freshness engine and enrichment pipeline.</p>

            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
                <p className="text-sm font-bold text-main">All Clear</p>
                <p className="text-xs text-muted mt-1">No active alerts. Run the freshness engine to check for updates.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert._id} className="flex items-center justify-between py-3 px-4 rounded-xl transition-all"
                       style={{ background: alert.status === 'resolved' ? 'var(--surface-2)' : 'var(--danger-light)', border: '1px solid var(--border)', opacity: alert.status === 'resolved' ? 0.6 : 1 }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <AlertCircle size={16} style={{ color: alert.severity === 'critical' ? 'var(--danger)' : 'var(--orange)' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-main truncate">{alert.message}</p>
                        <p className="text-[10px] text-muted font-semibold">{alert.companyName} · {new Date(alert.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                    {alert.status === 'unresolved' && (
                      <button onClick={() => handleResolveAlert(alert._id)}
                        className="btn-ghost text-[10px] font-black uppercase tracking-wider shrink-0">
                        <CheckCircle2 size={13} /> Resolve
                      </button>
                    )}
                    {alert.status === 'resolved' && <span className="badge badge-green shrink-0">Resolved</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
