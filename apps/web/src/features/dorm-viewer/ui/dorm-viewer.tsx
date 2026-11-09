'use client';

import dynamic from 'next/dynamic';
import { Component, memo, useCallback, useState, type ReactNode } from 'react';

import { cn } from '@/shared/lib';

import { viewerErrorKind } from '../model/viewer-error';
import { ViewerStatus } from './viewer-status';

const DormCanvas = dynamic(() => import('./dorm-canvas'), { ssr: false });

type ViewerFailure = { error: unknown } | null;

class ViewerBoundary extends Component<{ children: ReactNode }, { failure: ViewerFailure }> {
  state: { failure: ViewerFailure } = { failure: null };

  static getDerivedStateFromError(error: unknown) {
    return { failure: { error } };
  }

  render() {
    return this.state.failure ? (
      <ViewerStatus kind={viewerErrorKind(this.state.failure.error)} />
    ) : (
      this.props.children
    );
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
    <div
      className={cn(
        'relative isolate size-full overflow-hidden bg-[#9bccef]',
        '[&_canvas]:block [&_canvas]:touch-none',
      )}
    >
      <ViewerBoundary>
        <DormCanvas onReady={onReady} onInteractionChange={onInteractionChange} />
        {!ready && <ViewerStatus />}
      </ViewerBoundary>
      {children && <div className="pointer-events-none absolute inset-0 z-3">{children}</div>}
    </div>
  );
});
