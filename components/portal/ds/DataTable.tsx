'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type MenuPosition = { top: number; left: number };

function RowActionsMenu({
  actions,
  position,
  onClose,
}: {
  actions: { label: string; onClick: () => void; danger?: boolean }[];
  position: MenuPosition;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[80] min-w-[140px] rounded-2xl border border-portal-border bg-portal-panel py-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="menu"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          className={clsx(
            'w-full text-left px-3 py-2 text-sm hover:bg-portal-hover',
            action.danger ? 'text-portal-danger' : 'text-portal-text'
          )}
          onClick={() => {
            onClose();
            action.onClick();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

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
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const totalCount = total ?? rows.length;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds?.has(r.id));

  function openMenuFor(rowId: string, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 140;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
    setMenuPosition({ top, left });
    setOpenMenuId(rowId);
  }

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPosition(null);
  }

  if (rows.length === 0) {
    return (
      <div className={clsx('saas-table-container', className)}>
        <EmptyState label={emptyLabel} />
      </div>
    );
  }

  const pagination = onPageChange ? (
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
  ) : null;

  const openRow = openMenuId ? rows.find((r) => r.id === openMenuId) : null;
  const openActions = openRow && rowActions ? rowActions(openRow) : null;

  return (
    <div className={clsx('saas-table-container', className)}>
      {/* Mobile card/list */}
      <div className="md:hidden divide-y divide-portal-border">
        {selectable ? (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-portal-border">
            <input
              type="checkbox"
              checked={!!allSelected}
              onChange={(e) => onToggleAll?.(e.target.checked)}
              aria-label="Select all rows"
              className="rounded border-portal-border bg-portal-inset"
            />
            <span className="text-xs text-portal-muted">Select all</span>
          </div>
        ) : null}
        {rows.map((row) => {
          const primary = columns[0];
          const secondary = columns.slice(1);
          const actions = rowActions?.(row) ?? [];
          return (
            <div
              key={row.id}
              className={clsx('px-4 py-3 space-y-2', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row)}
            >
              <div className="flex items-start gap-3">
                {selectable ? (
                  <input
                    type="checkbox"
                    checked={!!selectedIds?.has(row.id)}
                    onChange={() => onToggleRow?.(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select row ${row.id}`}
                    className="mt-1 rounded border-portal-border bg-portal-inset"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {primary ? (
                    <div className="text-sm font-medium text-portal-text">{primary.render(row)}</div>
                  ) : null}
                  {secondary.map((col) => (
                    <div key={col.key} className="flex gap-2 text-xs text-portal-muted">
                      <span className="shrink-0 text-portal-muted/80">{col.header}:</span>
                      <span className="min-w-0 text-portal-text">{col.render(row)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {actions.length > 0 ? (
                <div
                  className="flex flex-wrap gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className={clsx(
                        'saas-btn-secondary text-xs py-1.5 px-2.5',
                        action.danger && 'text-portal-danger'
                      )}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <table className="saas-table hidden md:table">
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
                    aria-expanded={openMenuId === row.id}
                    onClick={(e) => {
                      if (openMenuId === row.id) {
                        closeMenu();
                      } else {
                        openMenuFor(row.id, e.currentTarget);
                      }
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {openMenuId && openActions && menuPosition ? (
        <RowActionsMenu
          actions={openActions}
          position={menuPosition}
          onClose={closeMenu}
        />
      ) : null}

      {pagination}
    </div>
  );
}
