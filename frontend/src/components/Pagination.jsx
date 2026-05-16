import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ page, pages, onPageChange }) => {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
        className="p-2 rounded-lg transition-all disabled:opacity-30"
        style={{ color: 'var(--muted)' }}>
        <ChevronLeft size={18} />
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        let pageNum;
        if (pages <= 7) {
          pageNum = i + 1;
        } else if (page <= 4) {
          pageNum = i + 1;
        } else if (page >= pages - 3) {
          pageNum = pages - 6 + i;
        } else {
          pageNum = page - 3 + i;
        }
        return (
          <button key={pageNum} onClick={() => onPageChange(pageNum)}
            className="w-9 h-9 rounded-lg text-xs font-black transition-all"
            style={pageNum === page
              ? { background: 'var(--primary)', color: '#fff' }
              : { color: 'var(--muted)' }
            }>
            {pageNum}
          </button>
        );
      })}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
        className="p-2 rounded-lg transition-all disabled:opacity-30"
        style={{ color: 'var(--muted)' }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default Pagination;
