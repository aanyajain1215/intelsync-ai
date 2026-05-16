import React from 'react';

const DataTable = ({ columns, data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left min-w-[600px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          {columns.map(col => (
            <th key={col.key} className="pb-3 pt-4 px-4 text-[9px] uppercase tracking-widest font-black text-muted">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row._id || i} className="transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map(col => (
              <td key={col.key} className="py-3 px-4 text-sm">
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {data.length === 0 && (
      <div className="text-center py-12 text-muted text-sm font-bold">No records found</div>
    )}
  </div>
);

export default DataTable;
