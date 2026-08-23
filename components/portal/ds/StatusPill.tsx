'use client';

import React from 'react';
import { clsx } from 'clsx';
import { statusToneClasses, type StatusTone } from '@/lib/portal/theme';

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusPill({ label, tone = 'neutral', className }: StatusPillProps) {
  return <span className={clsx(statusToneClasses(tone), className)}>{label}</span>;
}
