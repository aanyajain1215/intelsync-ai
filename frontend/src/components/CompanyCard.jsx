import React from 'react';
import { useNavigate } from 'react-router-dom';
import DomainBadge from './DomainBadge';
import FreshnessBar from './FreshnessBar';
import { ArrowUpRight, MapPin, Globe } from 'lucide-react';

const CompanyCard = ({ company }) => {
  const navigate = useNavigate();

  return (
    <div className="premium-card p-5 cursor-pointer group"
         onClick={() => navigate(`/dashboard/companies/${company._id}`)}>
      {/* Active/Defunct indicator strip */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
           style={{ background: company.isActive !== false
             ? 'linear-gradient(90deg, #16A34A, #22C55E)'
             : 'linear-gradient(90deg, #DC2626, #F87171)' }} />

      <div className="flex items-start justify-between gap-3 mt-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${company.isActive !== false ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: company.isActive !== false ? 'var(--success)' : 'var(--danger)' }}>
              {company.isActive !== false ? 'Active' : 'Defunct'}
            </span>
          </div>
          <h3 className="text-sm font-black text-main truncate group-hover:text-primary transition-colors">
            {company.name}
          </h3>
          {company.city && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted font-medium">
              <MapPin size={10} /> {company.city}{company.country ? `, ${company.country}` : ''}
            </div>
          )}
        </div>
        <ArrowUpRight size={14} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <DomainBadge domain={company.domain} />
        {company.subCategory && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {company.subCategory}
          </span>
        )}
        {company.tier && (
          <span className="badge badge-navy">Tier {company.tier}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span className={`badge ${company.enrichmentStatus === 'full' ? 'badge-green' : 'badge-slate'}`}>
          {company.enrichmentStatus === 'full' ? 'Deep Audit' : company.enrichmentStatus || 'Minimal'}
        </span>
        <div className="flex items-center gap-2">
          <FreshnessBar score={company.freshnessScore || 0} />
          <span className="text-[10px] font-black text-muted">{company.freshnessScore || 0}%</span>
        </div>
      </div>
    </div>
  );
};

export default CompanyCard;
