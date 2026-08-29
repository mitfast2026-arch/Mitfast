import React from 'react';
import { clsx } from 'clsx';

type AdminSplitViewProps = {
  list: React.ReactNode;
  detail: React.ReactNode;
  listCols?: number;
  detailCols?: number;
  className?: string;
  /** Independent column scrolling within the viewport (admin work queues). */
  scrollable?: boolean;
  /**
   * On viewports below `lg`, show only the detail pane (hide list) so actions
   * are not trapped in a half-height column. Pair with a mobile back control in detail.
   */
  mobileDetailOpen?: boolean;
};

export default function AdminSplitView({
  list,
  detail,
  listCols = 5,
  detailCols = 7,
  className,
  scrollable = false,
  mobileDetailOpen = false,
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

  if (scrollable) {
    return (
      <div
        className={clsx(
          'grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0',
          'lg:h-[calc(100dvh-13.5rem)] lg:min-h-[28rem]',
          className
        )}
      >
        <div
          className={clsx(
            listClass,
            'min-w-0 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5',
            mobileDetailOpen
              ? 'hidden lg:block lg:max-h-none'
              : 'max-h-[min(70vh,calc(100dvh-14rem))] lg:max-h-none'
          )}
        >
          {list}
        </div>
        <div
          className={clsx(
            detailClass,
            'min-w-0 min-h-0 overflow-y-auto overscroll-contain',
            mobileDetailOpen
              ? 'max-h-[calc(100dvh-12rem)] lg:max-h-none'
              : 'hidden lg:block lg:max-h-none'
          )}
        >
          {detail}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0', className)}>
      <div
        className={clsx(
          listClass,
          'min-w-0 space-y-2',
          mobileDetailOpen && 'hidden lg:block'
        )}
      >
        {list}
      </div>
      <div
        className={clsx(
          detailClass,
          'min-w-0 lg:sticky lg:top-3 self-start',
          !mobileDetailOpen && 'hidden lg:block'
        )}
      >
        {detail}
      </div>
    </div>
  );
}
