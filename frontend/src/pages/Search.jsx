import React, { useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCompanies } from '../hooks/useCompanies';
import CompanyCard from '../components/CompanyCard';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import EnrichmentModal from '../components/EnrichmentModal';
import { Search as SearchIcon, Plus, SlidersHorizontal, ChevronDown, AlertCircle, X, Sparkles } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const SECTORS = ['All', 'Media and Entertainment', 'Education', 'Healthcare', 'Tourism', 'Financial services', 'Consultancy services'];

const Select = ({ label, value, options, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</label>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl py-2.5 px-3.5 pr-8 text-sm font-bold appearance-none outline-none transition-all cursor-pointer"
        style={{ backgroundColor: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
        {options.map(opt => (
          <option key={typeof opt === 'string' ? opt : opt.v} value={typeof opt === 'string' ? opt : opt.v}>
            {typeof opt === 'string' ? opt : opt.l}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" size={14} />
    </div>
  </div>
);

const SearchPage = () => {
  const { isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [discoveryName, setDiscoveryName] = useState('');

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    domain: 'All', isActive: 'All', tier: 'All', enrichmentStatus: 'All',
    page: 1, limit: 15
  });
  const [searchInput, setSearchInput] = useState(filters.q);

  React.useEffect(() => {
    const t = setTimeout(() => setFilters(prev => ({ ...prev, q: searchInput, page: 1 })), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useCompanies(filters);
  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val, page: 1 }));

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-slide-up pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-main tracking-tight">Entity Directory</h1>
          <p className="text-muted font-semibold mt-1 text-sm">Search and filter the SEPC strategic intelligence registry.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setDiscoveryName(''); setIsModalOpen(true); }} className="btn-primary whitespace-nowrap">
            <Plus size={16} /> Add Entity
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="premium-card p-1.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle" />
            <input type="text" placeholder="Search by name, sector, or location..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-transparent border-none outline-none text-sm font-bold text-main placeholder:text-subtle" />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg btn-ghost">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="w-px h-7" style={{ backgroundColor: 'var(--border)' }} />
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-black rounded-xl transition-all whitespace-nowrap ${showFilters ? 'text-primary' : 'text-muted'}`}
            style={showFilters ? { backgroundColor: 'var(--primary-light)' } : {}}>
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="premium-card p-5 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <Select label="Sector" value={filters.domain} options={SECTORS} onChange={v => setFilter('domain', v)} />
          <Select label="Status" value={filters.isActive} options={[{l:'All Statuses',v:'All'},{l:'Active',v:'true'},{l:'Defunct',v:'false'}]} onChange={v => setFilter('isActive', v)} />
          <Select label="Tier" value={filters.tier} options={[{l:'All Tiers',v:'All'},{l:'Tier 1',v:'1'},{l:'Tier 2',v:'2'},{l:'Tier 3',v:'3'}]} onChange={v => setFilter('tier', v)} />
          <Select label="Audit Depth" value={filters.enrichmentStatus} options={[{l:'All',v:'All'},{l:'Deep Audit',v:'full'},{l:'Partial',v:'partial'},{l:'Minimal',v:'minimal'}]} onChange={v => setFilter('enrichmentStatus', v)} />
        </div>
      )}

      <p className="text-sm font-bold text-muted px-1">
        Showing <span className="text-main font-black">{data?.total ?? 0}</span> results
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner /></div>
      ) : isError ? (
        <div className="premium-card p-16 text-center">
          <AlertCircle size={36} className="mx-auto mb-4 text-danger" />
          <h3 className="text-lg font-black text-main">Failed to load directory</h3>
          <p className="text-muted mt-2 mb-6 text-sm">Error contacting the intelligence server.</p>
          <button onClick={() => refetch()} className="btn-secondary">Try Again</button>
        </div>
      ) : !data?.companies?.length ? (
        <div className="space-y-4">
          {/* Smart discover prompt — only when searching by name */}
          {searchInput.trim() && filters.domain === 'All' && filters.isActive === 'All' && filters.tier === 'All' ? (
            <div className="premium-card p-8 text-center animate-slide-up">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                   style={{ background: 'linear-gradient(90deg, #013264, #F2A22F)' }} />
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5 mt-2"
                   style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-black text-main mb-1">
                "{searchInput}" not found in registry
              </h3>
              <p className="text-muted text-sm font-medium mb-6 max-w-sm mx-auto">
                This company isn't in the SEPC database yet. Discover it — the AI pipeline will
                enrich and add it automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => { setDiscoveryName(searchInput.trim()); setIsModalOpen(true); }}
                  className="btn-primary gap-2">
                  <Sparkles size={15} /> Discover &amp; Enrich "{searchInput}"
                </button>
                <button
                  onClick={() => { setSearchInput(''); setFilters(prev => ({...prev, q:'', domain:'All', isActive:'All'})); }}
                  className="btn-secondary">
                  Clear Search
                </button>
              </div>
            </div>
          ) : (
            <div className="premium-card p-20 text-center">
              <SearchIcon size={22} className="mx-auto mb-4 text-muted" />
              <h3 className="text-base font-black text-main">No entities found</h3>
              <p className="text-muted text-sm mt-2 mb-6">Try adjusting your search or filters.</p>
              <button onClick={() => { setSearchInput(''); setFilters(prev => ({...prev, q:'', domain:'All', isActive:'All'})); }} className="btn-secondary">Clear Filters</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.companies.map((company, i) => (
              <div key={company?._id || i} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                <CompanyCard company={company} />
              </div>
            ))}
          </div>
          {data.pages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination page={data.page || 1} pages={data.pages || 1}
                onPageChange={page => { setFilters(prev => ({...prev, page})); window.scrollTo({top:0,behavior:'smooth'}); }} />
            </div>
          )}
        </div>
      )}

      <EnrichmentModal
        isOpen={isModalOpen}
        initialName={discoveryName}
        onClose={() => { setIsModalOpen(false); setDiscoveryName(''); refetch(); }}
      />
    </div>
  );
};

export default SearchPage;
