import React from 'react';

type AdminSplitViewProps = {
  list: React.ReactNode;
  detail: React.ReactNode;
  listCols?: number;
  detailCols?: number;
  minHeight?: string;
};

export default function AdminSplitView({
  list,
  detail,
  listCols = 5,
  detailCols = 7,
  minHeight = 'calc(100vh - 14rem)',
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
    <div
      className="grid grid-cols-1 lg:grid-cols-12 gap-5"
      style={{ minHeight }}
    >
      <div className={`${listClass} flex flex-col min-h-0`}>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[280px] lg:min-h-0">{list}</div>
      </div>
      <div className={`${detailClass} flex flex-col min-h-0`}>
        <div className="flex-1 overflow-y-auto min-h-0">{detail}</div>
      </div>
    </div>
  );
}
