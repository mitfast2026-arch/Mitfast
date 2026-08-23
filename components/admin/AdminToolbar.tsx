import React from 'react';

type AdminToolbarProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export default function AdminToolbar({ children, trailing, className = '' }: AdminToolbarProps) {
  return (
    <div
      className={`saas-panel p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
