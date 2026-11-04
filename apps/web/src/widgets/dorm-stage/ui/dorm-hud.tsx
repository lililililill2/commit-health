import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib';

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const menus = [
  {
    label: '커밋하기',
    href: '/commit',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  },
  {
    label: '기록',
    href: '/records',
    icon: (
      <>
        <path d="M6 3.5h12v17H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8 3.5v17M11 8h4M11 12h4M11 16h2" />
      </>
    ),
  },
  {
    label: '업적',
    href: '/achievements',
    icon: (
      <>
        <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" />
      </>
    ),
  },
  {
    label: '설정',
    href: '/settings',
    icon: (
      <>
        <path d="m10 3-.6 2.2-1.5.9-2.2-.6-2 3.4 1.6 1.6v1.8L3.7 14l2 3.4 2.2-.6 1.5.9.6 2.3h4l.6-2.3 1.5-.9 2.2.6 2-3.4-1.6-1.7v-1.8l1.6-1.6-2-3.4-2.2.6-1.5-.9L14 3h-4Z" />
        <circle cx="12" cy="11.5" r="3" />
      </>
    ),
  },
];

const quests = [
  {
    id: 'daily-visit',
    label: '오늘 출석하기',
  },
  {
    id: 'daily-record',
    label: '오늘 기록 항목 3개 저장',
  },
  {
    id: 'view-record',
    label: '내 기록 1개 열어보기',
  },
];

export function DormHud() {
  return (
    <div className="relative min-h-0 min-w-0">
      <nav
        className="absolute top-1/2 left-[clamp(20px,3.2vw,64px)] -translate-y-1/2 mobile:left-4"
        aria-label="메인 메뉴"
      >
        <ul className="m-0 flex list-none flex-col gap-[clamp(18px,3.8vh,40px)] p-0 short-screen:gap-2.5">
          {menus.map((menu) => (
            <li key={menu.href}>
              <Link
                href={menu.href}
                className={cn(
                  'pointer-events-auto inline-flex min-h-11 cursor-pointer items-center gap-[15px] border-0 bg-transparent p-0',
                  'text-[clamp(15px,1.2vw,19px)] font-medium tracking-[-0.025em] text-white no-underline [text-shadow:0_2px_8px_rgb(0_0_0/45%)]',
                  'transition-[color,translate] duration-[160ms] ease-[ease-out] motion-reduce:transition-none',
                  'pointer-fine:hover:text-[#7db8ff] motion-safe:pointer-fine:hover:translate-x-[3px]',
                  'focus-visible:rounded-[3px] focus-visible:text-[#7db8ff] focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-current',
                  'mobile:gap-[9px] mobile:text-[13px]',
                )}
              >
                <Icon className="shrink-0 drop-shadow-[0_2px_4px_rgb(0_0_0/25%)] mobile:size-[22px]">
                  {menu.icon}
                </Icon>
                <span>{menu.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <aside
        className={cn(
          'absolute top-[clamp(28px,5vh,64px)] right-[clamp(20px,3.2vw,64px)] w-[clamp(144px,12vw,208px)]',
          '[text-shadow:0_2px_8px_rgb(0_0_0/45%)]',
          'mobile:top-6 mobile:right-4 mobile:w-[136px] short-screen:top-[18px]',
        )}
        aria-labelledby="daily-quests-heading"
      >
        <section>
          <h2
            id="daily-quests-heading"
            className="m-0 text-[18px] font-medium tracking-[-0.03em] mobile:text-base"
          >
            일일 퀘스트
          </h2>
          <ul
            className={cn(
              'm-0 mt-[26px] flex list-none flex-col gap-[23px] p-0',
              'mobile:mt-[22px] mobile:gap-[18px] short-screen:mt-4 short-screen:gap-3',
            )}
          >
            {quests.map((quest) => (
              <li
                key={quest.id}
                className="flex items-start gap-2.5 text-sm leading-[1.65] break-keep text-white/92 mobile:gap-[7px] mobile:text-xs"
              >
                <Icon className="mt-0.5 size-[19px] shrink-0 opacity-80 mobile:size-4">
                  <circle cx="12" cy="12" r="8" />
                </Icon>
                <span>{quest.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
