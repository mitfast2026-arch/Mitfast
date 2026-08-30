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
      ? 'md:col-span-4 lg:col-span-4'
      : listCols === 5
        ? 'md:col-span-5 lg:col-span-5'
        : 'md:col-span-4 lg:col-span-4';
  const detailClass =
    detailCols === 8
      ? 'md:col-span-8 lg:col-span-8'
      : detailCols === 7
        ? 'md:col-span-7 lg:col-span-7'
        : 'md:col-span-8 lg:col-span-8';

  if (scrollable) {
    return (
      <div
        className={clsx(
          'grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 min-w-0',
          'md:h-[calc(100dvh-12rem)] md:min-h-[26rem] lg:h-[calc(100dvh-13.5rem)] lg:min-h-[28rem]',
          className
        )}
      >
        <div
          className={clsx(
            listClass,
            'min-w-0 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5',
            mobileDetailOpen
              ? 'hidden md:block lg:max-h-none'
              : 'max-h-[min(70vh,calc(100dvh-14rem))] md:max-h-none lg:max-h-none'
          )}
        >
          {list}
        </div>
        <div
          className={clsx(
            detailClass,
            'min-w-0 min-h-0 overflow-y-auto overscroll-contain',
            mobileDetailOpen
              ? 'max-h-[calc(100dvh-12rem)] md:max-h-none lg:max-h-none'
              : 'hidden md:block lg:max-h-none'
          )}
        >
          {detail}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 items-start min-w-0', className)}>
      <div
        className={clsx(
          listClass,
          'min-w-0 space-y-2',
          mobileDetailOpen && 'hidden md:block'
        )}
      >
        {list}
      </div>
      <div
        className={clsx(
          detailClass,
          'min-w-0 md:sticky md:top-3 self-start',
          !mobileDetailOpen && 'hidden md:block'
        )}
      >
        {detail}
      </div>
    </div>
  );
}
