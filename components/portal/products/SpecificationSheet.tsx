'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import type { SpecRow } from '@/app/admin/products/types';

type SpecificationSheetProps = {
  rows: SpecRow[];
  onChange: (rows: SpecRow[]) => void;
  disabled?: boolean;
};

export default function SpecificationSheet({ rows, onChange, disabled }: SpecificationSheetProps) {
  function addRow() {
    onChange([...rows, { id: `new-${Date.now()}`, spec_name: '', spec_value: '' }]);
  }

  function updateRow(id: string, field: 'spec_name' | 'spec_value', value: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-portal-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-3 py-1.5 bg-portal-inset text-[10px] font-medium uppercase tracking-wide text-portal-muted">
          <span>Name</span>
          <span>Value</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="px-3 py-3 text-xs text-portal-muted text-center">No specifications yet.</div>
        ) : (
          <div className="divide-y divide-portal-border">
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-3 py-2 items-center">
                <input
                  type="text"
                  disabled={disabled}
                  value={row.spec_name}
                  onChange={(e) => updateRow(row.id, 'spec_name', e.target.value)}
                  placeholder="Material"
                  className="saas-input text-xs py-1.5"
                />
                <input
                  type="text"
                  disabled={disabled}
                  value={row.spec_value}
                  onChange={(e) => updateRow(row.id, 'spec_value', e.target.value)}
                  placeholder="Titanium"
                  className="saas-input text-xs py-1.5"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="p-1 rounded text-portal-muted hover:text-portal-danger"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 w-full justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Add specification
        </button>
      )}
    </div>
  );
}
