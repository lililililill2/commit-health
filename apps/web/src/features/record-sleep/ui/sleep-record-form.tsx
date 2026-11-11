'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useSession } from '@/entities/session';
import {
  formatSleepDuration,
  formatSleepTime,
  sleepDuration,
  useTodaySleep,
} from '@/entities/sleep';

import { sleepSaveError, useRecordSleep, type SleepInput } from '../model/use-record-sleep';
import { SleepTimePicker } from './sleep-time-picker';

const buttonClass =
  'min-h-11 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff] disabled:cursor-not-allowed disabled:opacity-50';

export function SleepRecordForm() {
  const session = useSession();
  const today = useTodaySleep(session.data?.user.id);
  const save = useRecordSleep(session.data?.user.id);
  const router = useRouter();
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [confirmation, setConfirmation] = useState<SleepInput | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const duration = sleepDuration(bedtime, wakeTime);

  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmation]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!today.data || duration === null || save.isPending) return;
    save.reset();
    setConfirmation({ recordDate: today.data.recordDate, bedtime, wakeTime });
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || save.isPending) return;
    try {
      await save.mutateAsync(confirmation);
      router.replace('/commit');
    } catch {
      // The mutation state keeps the failure visible without discarding the input.
    }
  }

  if (today.isPending)
    return (
      <p role="status" className="mt-8 text-sm text-white/60">
        수면 기록을 불러오는 중…
      </p>
    );
  if (!today.data)
    return (
      <div role="alert" className="mt-8 space-y-4">
        <p>수면 기록을 불러오지 못했어요.</p>
        <button type="button" onClick={() => void today.refetch()} className={buttonClass}>
          다시 시도
        </button>
      </div>
    );

  const record = today.data.record;
  if (record)
    return (
      <section className="mt-8 max-w-xl rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-6">
        <h2 className="font-medium text-emerald-300">✓ 확정한 수면 기록</h2>
        <p className="mt-3 text-sm text-white/60">{record.recordDate} 기상 기준 · 한국 시간</p>
        <p className="mt-6 text-2xl font-medium">{formatSleepDuration(record.durationMinutes)}</p>
        <p className="mt-3 text-sm">
          잠든 시간 {formatSleepTime(record.bedtime)} → 일어난 시간{' '}
          {formatSleepTime(record.wakeTime)}
        </p>
        <p className="mt-6 text-sm text-white/60">확정한 기록은 수정할 수 없어요.</p>
      </section>
    );

  return (
    <>
      <form
        onSubmit={review}
        className="mt-8 max-w-xl space-y-6 rounded-xl border border-white/20 bg-white/5 p-6"
      >
        <p className="text-sm text-white/70">{today.data.recordDate} 기상 기준 · 한국 시간</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { id: 'bedtime', label: '잠든 시간', value: bedtime, change: setBedtime },
            { id: 'wake-time', label: '일어난 시간', value: wakeTime, change: setWakeTime },
          ].map((field) => (
            <SleepTimePicker
              key={field.id}
              id={field.id}
              label={field.label}
              value={field.value}
              onChange={field.change}
            />
          ))}
        </div>
        <p className="text-xs leading-6 text-white/60">
          대략적인 시간을 15분 단위로 선택해 주세요. 잠든 시간이 일어난 시간보다 늦으면 전날
          취침으로 계산해요.
        </p>
        <div aria-live="polite" className="rounded-lg bg-white/5 p-4">
          <p className="text-sm text-white/60">수면 시간</p>
          <p className="mt-2 text-2xl font-medium">
            {duration === null ? '시간을 선택해 주세요.' : formatSleepDuration(duration)}
          </p>
          {bedtime && wakeTime && bedtime === wakeTime && (
            <p className="mt-2 text-sm text-red-300">
              잠든 시간과 일어난 시간을 다르게 선택해 주세요.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={duration === null || save.isPending}
          className={buttonClass}
        >
          기록 확인하기
        </button>
      </form>
      <dialog
        ref={dialog}
        aria-labelledby="sleep-confirm-heading"
        aria-describedby="sleep-confirm-warning"
        onClose={() => setConfirmation(null)}
        onCancel={(event) => {
          if (save.isPending) event.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-white/20 bg-[#17171a] p-6 text-white backdrop:bg-black/70"
      >
        <form onSubmit={(event) => void confirm(event)}>
          <h2 id="sleep-confirm-heading" className="text-lg font-medium">
            수면 기록을 확정할까요?
          </h2>
          {confirmation && (
            <div className="mt-5 space-y-2 text-sm">
              <p>{confirmation.recordDate} 기상 기준</p>
              <p>
                잠든 시간 {confirmation.bedtime} → 일어난 시간 {confirmation.wakeTime}
              </p>
              <p className="text-xl font-medium">
                {formatSleepDuration(sleepDuration(confirmation.bedtime, confirmation.wakeTime)!)}
              </p>
            </div>
          )}
          <p id="sleep-confirm-warning" className="mt-5 text-sm leading-6 text-amber-200">
            확정하면 오늘의 수면 기록은 다시 수정할 수 없어요. 날짜와 시간을 확인해 주세요.
          </p>
          {save.isError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {sleepSaveError(save.error)}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => setConfirmation(null)}
              className={buttonClass}
            >
              돌아가기
            </button>
            <button type="submit" disabled={save.isPending} className={buttonClass}>
              {save.isPending ? '저장 중…' : '확정하기'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
