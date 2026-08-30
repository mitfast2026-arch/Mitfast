import React from 'react';

type AdminToolbarProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export default function AdminToolbar({ children, trailing, className = '' }: AdminToolbarProps) {
  return (
    <div
      className={`saas-panel p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 ${className}`}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
