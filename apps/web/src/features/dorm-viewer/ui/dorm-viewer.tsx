'use client';

import dynamic from 'next/dynamic';
import { Component, memo, useCallback, useState, type ReactNode } from 'react';

import { ViewerStatus } from './viewer-status';
import styles from './dorm-viewer.module.css';

const DormCanvas = dynamic(() => import('./dorm-canvas'), { ssr: false });

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <ViewerStatus kind="error" /> : this.props.children;
  }
}

export const DormViewer = memo(function DormViewer({
  children,
  onInteractionChange,
}: {
  children?: ReactNode;
  onInteractionChange?: (active: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <div className={styles.viewer}>
      <ViewerBoundary>
        <DormCanvas onReady={onReady} onInteractionChange={onInteractionChange} />
        {!ready && <ViewerStatus />}
      </ViewerBoundary>
      {children && <div className={styles.overlay}>{children}</div>}
    </div>
  );
});
