import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './dorm-stage.module.css';

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
    <div className={styles.hud}>
      <nav className={styles.navigation} aria-label="메인 메뉴">
        <ul className={styles.menuList}>
          {menus.map((menu) => (
            <li key={menu.href}>
              <Link href={menu.href} className={styles.menu}>
                <Icon>{menu.icon}</Icon>
                <span>{menu.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <aside className={styles.rightUi} aria-labelledby="daily-quests-heading">
        <section>
          <h2 id="daily-quests-heading" className={styles.questHeading}>
            일일 퀘스트
          </h2>
          <ul className={styles.questList}>
            {quests.map((quest) => (
              <li key={quest.id}>
                <Icon className={styles.questIcon}>
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
