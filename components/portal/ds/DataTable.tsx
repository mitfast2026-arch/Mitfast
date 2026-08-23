'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { EmptyState } from './EmptyState';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

type DataTableProps<T extends { id: string }> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  rowActions?: (row: T) => { label: string; onClick: () => void; danger?: boolean }[];
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  emptyLabel?: string;
  className?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  rowActions,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  emptyLabel = 'No items to show',
  className,
  onRowClick,
}: DataTableProps<T>) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const totalCount = total ?? rows.length;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds?.has(r.id));

  if (rows.length === 0) {
    return (
      <div className={clsx('saas-table-container', className)}>
        <EmptyState label={emptyLabel} />
      </div>
    );
  }

  return (
    <div className={clsx('saas-table-container', className)}>
      <table className="saas-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={!!allSelected}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  aria-label="Select all rows"
                  className="rounded border-portal-border bg-portal-inset"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.header}
              </th>
            ))}
            {rowActions ? <th className="w-12"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={onRowClick ? 'cursor-pointer' : undefined}
              onClick={() => onRowClick?.(row)}
            >
              {selectable ? (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!selectedIds?.has(row.id)}
                    onChange={() => onToggleRow?.(row.id)}
                    aria-label={`Select row ${row.id}`}
                    className="rounded border-portal-border bg-portal-inset"
                  />
                </td>
              ) : null}
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
              {rowActions ? (
                <td className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="saas-btn-ghost h-8 w-8"
                    aria-label="Row actions"
                    onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === row.id ? (
                    <div className="absolute right-2 top-10 z-20 min-w-[140px] rounded-2xl border border-portal-border bg-portal-panel py-1 shadow-lg">
                      {rowActions(row).map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-portal-hover',
                            action.danger ? 'text-portal-danger' : 'text-portal-text'
                          )}
                          onClick={() => {
                            setOpenMenuId(null);
                            action.onClick();
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {onPageChange ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-portal-border text-sm text-portal-muted">
          <span>
            {from}–{to} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="saas-btn-ghost h-8 w-8"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="saas-btn-ghost h-8 w-8"
              aria-label="Next page"
              disabled={to >= totalCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
