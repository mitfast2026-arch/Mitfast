import React from 'react';

export default function GlassPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`glass-panel ${className}`}>{children}</div>;
}
