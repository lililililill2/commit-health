'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';

import { DormViewer } from '@/features/dorm-viewer';

import { DormHud } from './dorm-hud';
import { LiveClock } from './live-clock';
import styles from './dorm-stage.module.css';

export function DormStage({ title, children }: { title: string; children?: ReactNode }) {
  const [rotating, setRotating] = useState(false);
  return (
    <main className={styles.shell} aria-labelledby="dorm-heading">
      <h1 id="dorm-heading" className="sr-only">
        {title}
      </h1>
      {children}
      <div className={styles.scene}>
        <DormViewer onInteractionChange={setRotating} />
      </div>
      <div className={styles.shadeLayer} data-hidden={rotating} aria-hidden="true">
        <div className={styles.leftShade} />
        <div className={styles.rightShade} />
        <div className={styles.topShade} />
        <div className={styles.bottomShade} />
      </div>
      <div
        className={styles.interface}
        data-hidden={rotating}
        inert={rotating}
        aria-hidden={rotating}
      >
        <header className={styles.header}>
          <Image
            src="/brand/commit-health-logo.svg"
            alt="Commit Health"
            width={204}
            height={30}
            className={styles.logo}
            preload
          />
          <LiveClock />
        </header>
        <DormHud />
        <footer className={styles.footer} aria-hidden="true" />
      </div>
    </main>
  );
}
