'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';

import { DormViewer } from '@/features/dorm-viewer';
import { cn } from '@/shared/lib';

import { DormHud } from './dorm-hud';
import { LiveClock } from './live-clock';

const fadeClasses =
  'pointer-events-none absolute inset-0 transition-opacity duration-[220ms] ease-[cubic-bezier(0,0,0.58,1)] motion-reduce:transition-none';

export function DormStage({ title, children }: { title: string; children?: ReactNode }) {
  const [rotating, setRotating] = useState(false);
  return (
    <main
      className="relative h-dvh overflow-hidden bg-[#9bccef] text-white"
      aria-labelledby="dorm-heading"
    >
      <h1 id="dorm-heading" className="sr-only">
        {title}
      </h1>
      {children}
      <div className="absolute inset-0 z-0">
        <DormViewer onInteractionChange={setRotating} />
      </div>
      <div
        className={cn(
          fadeClasses,
          'z-1 overflow-hidden [contain:paint] will-change-[opacity]',
          rotating ? 'opacity-0' : 'opacity-100',
        )}
        data-hidden={rotating}
        aria-hidden="true"
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-1/6 mobile:w-[32%]',
            'bg-[linear-gradient(90deg,rgb(10_19_25/78%),rgb(10_19_25/38%)_50%,transparent)]',
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-1/6 mobile:w-[43%]',
            'bg-[linear-gradient(270deg,rgb(10_19_25/78%),rgb(10_19_25/38%)_50%,transparent)]',
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-[clamp(148px,24vh,240px)]',
            'bg-[linear-gradient(180deg,rgb(10_19_25/32%),transparent)]',
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(100px,18vh,180px)]',
            'bg-[linear-gradient(0deg,rgb(10_19_25/28%),transparent)]',
          )}
        />
      </div>
      <div
        className={cn(
          fadeClasses,
          'z-2 grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[96px_minmax(0,1fr)_48px]',
          'mobile:grid-rows-[84px_minmax(0,1fr)_32px] short-screen:grid-rows-[64px_minmax(0,1fr)_24px]',
          rotating ? 'opacity-0' : 'opacity-100',
        )}
        data-hidden={rotating}
        inert={rotating}
        aria-hidden={rotating}
      >
        <header
          className={cn(
            'relative z-2 flex items-center justify-between gap-6 bg-[#304655] px-[clamp(20px,3.2vw,64px)]',
            'border-b border-white/10 shadow-[0_10px_22px_-8px_rgb(23_43_58/55%)]',
            'mobile:gap-4 mobile:px-4',
          )}
        >
          <Image
            src="/brand/commit-health-logo.svg"
            alt="Commit Health"
            width={204}
            height={30}
            className="block h-auto w-[168px] drop-shadow-[0_2px_10px_rgb(0_0_0/25%)] mobile:w-[136px]"
            preload
          />
          <LiveClock />
        </header>
        <DormHud />
        <footer
          className="relative z-2 border-t border-white/10 bg-[#304655] shadow-[0_-10px_22px_-8px_rgb(23_43_58/55%)]"
          aria-hidden="true"
        />
      </div>
    </main>
  );
}
