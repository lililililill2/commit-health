'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import {
  activityQueryKey,
  formatActivityDuration,
  timerDigits,
  useTodayActivity,
} from '@/entities/activity';
import { useSession } from '@/entities/session';
import { cn } from '@/shared/lib';
import { activityError, activityTimerApi } from '../model/activity-api';
import { meditationContents, type MeditationContent } from '../model/meditation-content';
import { createMeditationPlayer } from '../model/meditation-player';

const panel = 'rounded-xl border border-current/20 bg-current/5 p-5 sm:p-6';
const button =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-current/25 px-4 py-2 text-sm hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff] disabled:cursor-default disabled:opacity-50';
const quiet = 'text-sm text-current/70';
const link = 'underline underline-offset-4 hover:text-[#7db8ff]';

function MeditationPlayer({ content }: { content: MeditationContent }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const userId = useSession().data?.user.id;
  const today = useTodayActivity(userId);
  const queryClient = useQueryClient();
  const player = useMemo(
    () =>
      createMeditationPlayer({
        audioPath: content.audioPath,
        minimumSeconds: content.minimumSeconds,
        api: activityTimerApi(userId, 'meditation'),
        onResult: () => {
          void queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) });
        },
        describeError: activityError,
      }),
    [content, queryClient, userId],
  );
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  useEffect(() => {
    window.addEventListener('pagehide', player.leave);
    return () => {
      window.removeEventListener('pagehide', player.leave);
      player.leave();
    };
  }, [player]);

  const active = state.phase === 'starting' || state.phase === 'active';
  const qualified = state.seconds >= content.minimumSeconds;
  const cue = content.cues.findLast((item) => item.atSeconds <= state.position);
  const awaitingSave = qualified && state.record !== 'saved';
  const mayStart = !active && !awaitingSave && state.record !== 'saved';

  return (
    <section className={cn(panel, 'mt-6 space-y-5')} aria-labelledby="meditation-content-title">
      <audio ref={audio} preload="none" />
      <div className="space-y-2">
        <h2 id="meditation-content-title" className="text-xl font-medium">
          {content.title}
        </h2>
        {state.phase === 'idle' && <p className={quiet}>{content.description}</p>}
      </div>

      {state.phase === 'idle' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            최소 {formatActivityDuration(content.minimumSeconds)}
          </p>
          <p className={cn(quiet, 'leading-6')}>
            시작하면 안내 음성이 재생돼요. 먼저 기기 음량을 확인해 주세요.
          </p>
        </div>
      )}

      {active && (
        <>
          <div
            className={cn(
              content.background,
              'grid min-h-48 place-items-center rounded-lg px-5 py-8 text-center sm:min-h-64',
            )}
          >
            {content.cues.map((item) => (
              <p
                key={item.atSeconds}
                aria-hidden={item !== cue}
                className={cn(
                  'col-start-1 row-start-1 text-lg leading-relaxed transition-opacity duration-500 motion-reduce:transition-none sm:text-xl',
                  item === cue ? 'opacity-100' : 'pointer-events-none opacity-0 select-none',
                )}
              >
                {item.text}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            <div className={cn(quiet, 'flex justify-between gap-3 tabular-nums')}>
              <span>
                재생 시간 <span className="font-medium">{timerDigits(state.seconds).slice(3)}</span>
              </span>
              <span>목표 {formatActivityDuration(content.minimumSeconds)}</span>
            </div>
            <progress
              aria-label="명상 목표 진행률"
              className="block h-2 w-full accent-sky-300"
              max={content.minimumSeconds}
              value={Math.min(state.seconds, content.minimumSeconds)}
            />
          </div>
          {(state.phase === 'starting' || state.playback === 'waiting') && (
            <p role="status" className={quiet}>
              안내 음성을 준비하는 중이에요.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={button}
              disabled={state.phase === 'starting'}
              onClick={player.togglePlayback}
            >
              {state.playback === 'paused' ? '재개' : '일시정지'}
            </button>
            <button
              type="button"
              className={button}
              aria-pressed={muted}
              onClick={() => {
                if (audio.current) audio.current.muted = !muted;
                setMuted(!muted);
              }}
            >
              음소거
            </button>
            <label className={cn(quiet, 'flex min-h-11 items-center gap-2')}>
              음량
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                className="w-24 cursor-pointer accent-sky-300"
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (audio.current) audio.current.volume = value / 100;
                  setVolume(value);
                }}
              />
            </label>
            <button
              type="button"
              className={cn(button, 'sm:ml-auto')}
              onClick={() => player.finish()}
            >
              {qualified ? '명상 마치기' : '명상 종료'}
            </button>
          </div>
        </>
      )}

      {state.message && (
        <p role="status" className={quiet}>
          {state.message}
        </p>
      )}
      {awaitingSave && state.record !== 'retry' && (
        <p role="status" className={quiet}>
          3분 달성 · 기록을 저장하는 중이에요.
        </p>
      )}
      {state.record === 'retry' && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className={quiet}>
            명상은 완료했어요. 기록 저장을 확인하지 못했어요.
          </p>
          <button type="button" className={button} onClick={player.retrySave}>
            기록 다시 저장
          </button>
        </div>
      )}
      {state.record === 'saved' && (
        <div className="space-y-2" role="status">
          <p className="font-medium text-emerald-300">명상 완료 · 오늘의 기록에 저장했어요.</p>
          {active && <p className={quiet}>이어서 듣거나 여기서 마칠 수 있어요.</p>}
        </div>
      )}
      {!active && state.record === 'saved' && (
        <Link href="/commit" className={button}>
          커밋하기로 돌아가기
        </Link>
      )}
      {mayStart && (
        <>
          {today.isError && !today.data && (
            <p role="alert" className={quiet}>
              오늘 기록을 불러오지 못했어요.{' '}
              <button type="button" className={link} onClick={() => void today.refetch()}>
                다시 시도
              </button>
            </p>
          )}
          {today.data?.activeSession && (
            <p className={quiet}>진행 중인 활동이 있어요. 종료한 뒤 시작해 주세요.</p>
          )}
          <button
            type="button"
            className={cn(button, 'border-sky-300/60 text-sky-100')}
            disabled={!today.data || Boolean(today.data.activeSession)}
            onClick={() => {
              if (audio.current) void player.start(audio.current);
            }}
          >
            {state.phase === 'idle' ? '명상 시작' : '다시 시작'}
          </button>
        </>
      )}
      <footer className="space-y-1 border-t border-current/15 pt-4 text-xs leading-5 text-current/65">
        <p>
          <a href={content.source.url} target="_blank" rel="noreferrer" className={link}>
            {content.source.title}
          </a>
        </p>
        <p>{content.source.credit}</p>
        <p>
          <a href={content.source.licenseUrl} target="_blank" rel="noreferrer" className={link}>
            CC BY-NC-ND 4.0
          </a>
          {' · 비상업적 이용 · '}
          <a href={content.source.audioUrl} target="_blank" rel="noreferrer" className={link}>
            변경 없는 원본 음성
          </a>
        </p>
      </footer>
    </section>
  );
}

export function MeditationPanel() {
  const [selected, setSelected] = useState<MeditationContent>();
  return (
    <main className="mx-auto w-full max-w-2xl scheme-dark">
      <div className="mx-auto max-w-2xl">
        <Link href="/commit" className={cn(quiet, link, 'inline-flex min-h-11 items-center')}>
          ← 커밋하기 목록으로
        </Link>
        <h1 className="mt-6 text-2xl font-medium">명상</h1>
        {selected ? (
          <MeditationPlayer key={selected.id} content={selected} />
        ) : (
          <ul className="mt-6 space-y-3">
            {meditationContents.map((content) => (
              <li key={content.id}>
                <button
                  type="button"
                  onClick={() => setSelected(content)}
                  className={cn(
                    panel,
                    'flex w-full cursor-pointer items-start justify-between gap-4 text-left hover:border-sky-300/60 hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff]',
                  )}
                >
                  <span className="space-y-2">
                    <span className="block font-medium">{content.title}</span>
                    <span className={cn(quiet, 'block')}>{content.description}</span>
                  </span>
                  <span className={cn(quiet, 'shrink-0')}>
                    {formatActivityDuration(content.minimumSeconds)} 이상
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
