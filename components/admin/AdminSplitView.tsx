import React from 'react';
import { clsx } from 'clsx';

type AdminSplitViewProps = {
  list: React.ReactNode;
  detail: React.ReactNode;
  listCols?: number;
  detailCols?: number;
  className?: string;
};

export default function AdminSplitView({
  list,
  detail,
  listCols = 5,
  detailCols = 7,
  className,
}: AdminSplitViewProps) {
  const listClass =
    listCols === 4
      ? 'lg:col-span-4'
      : listCols === 5
        ? 'lg:col-span-5'
        : 'lg:col-span-4';
  const detailClass =
    detailCols === 8
      ? 'lg:col-span-8'
      : detailCols === 7
        ? 'lg:col-span-7'
        : 'lg:col-span-8';

  return (
    <div className={clsx('grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0', className)}>
      <div className={clsx(listClass, 'min-w-0 space-y-2')}>{list}</div>
      <div className={clsx(detailClass, 'min-w-0 lg:sticky lg:top-3 self-start')}>{detail}</div>
    </div>
  );
}
