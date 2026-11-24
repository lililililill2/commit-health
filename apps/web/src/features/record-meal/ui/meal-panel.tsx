'use client';

import { useRef, useState } from 'react';

import {
  mealKinds,
  mealLabels,
  sourceLabels,
  useMeals,
  type MealKind,
  type MealRecord,
} from '@/entities/meal';
import { useSession } from '@/entities/session';
import { cn } from '@/shared/lib';

import { mealError, useMealChange, type MealInput } from '../model/meal-actions';
import { MealEditor } from './meal-editor';
import { mealAlert, mealButton, mealInput, mealMuted } from './meal-styles';

const koreanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

function DayMeals({ userId, date }: { userId: string; date: string }) {
  const meals = useMeals(userId, date);
  const change = useMealChange(userId);
  const [editor, setEditor] = useState<{ kind: MealKind; record?: MealRecord }>();
  const [deleting, setDeleting] = useState<string>();
  const [message, setMessage] = useState('');
  const request = useRef<{ signature: string; id: string } | undefined>(undefined);
  const records = new Map(meals.data?.map((record) => [record.kind, record]));

  function save(input: Omit<MealInput, 'requestId'>, record?: MealRecord) {
    if (change.isPending) return;
    const edit = record ? { id: record.id, revision: record.revision } : undefined;
    const signature = JSON.stringify({ input, edit });
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    setMessage('');
    change.mutate(
      { action: 'save', input: { ...input, requestId: request.current.id }, edit },
      {
        onSuccess: () => {
          request.current = undefined;
          setEditor(undefined);
          setMessage(`${mealLabels[input.kind]} 식사를 저장했어요.`);
        },
      },
    );
  }

  function start(kind: MealKind) {
    change.reset();
    setMessage('');
    setDeleting(undefined);
    setEditor({ kind, record: records.get(kind) });
  }

  function remove(record: MealRecord) {
    setMessage('');
    change.mutate(
      { action: 'delete', id: record.id, revision: record.revision },
      {
        onSuccess: () => {
          setDeleting(undefined);
          setMessage(`${mealLabels[record.kind]} 기록을 삭제했어요.`);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      {!editor && change.isError && (
        <p role="alert" className={mealAlert}>
          {mealError(
            change.error,
            '요청 결과를 확인하지 못했어요. 기록을 확인하고 다시 시도해 주세요.',
          )}
        </p>
      )}
      {change.isPending && !editor && (
        <p role="status" className={mealMuted}>
          식사 기록을 업데이트하는 중…
        </p>
      )}
      <section aria-labelledby="meal-records-title" className="space-y-3">
        <h2 id="meal-records-title" className="text-lg font-semibold">
          식사 기록
        </h2>
        {meals.isPending && (
          <p role="status" className={mealMuted}>
            식사 기록을 불러오는 중…
          </p>
        )}
        {meals.isError && (
          <p role="alert" className={mealAlert}>
            식사 기록을 불러오지 못했어요.
            <button className={mealButton} type="button" onClick={() => void meals.refetch()}>
              다시 시도
            </button>
          </p>
        )}
        {meals.data && (
          <>
            <p className={mealMuted}>
              아침·점심·저녁 기록 {meals.data.filter(({ kind }) => kind !== 'SNACK').length}/3
            </p>
            <ul className="divide-y divide-current/10">
              {mealKinds.map((kind) => {
                const record = records.get(kind);
                return (
                  <li key={kind} className="space-y-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">{mealLabels[kind]}</h3>
                      <div className="flex flex-wrap items-center justify-end">
                        <button
                          type="button"
                          className={mealButton}
                          disabled={change.isPending || Boolean(editor) || Boolean(deleting)}
                          onClick={() => start(kind)}
                        >
                          {record ? '수정' : '기록하기'}
                        </button>
                        {record && (
                          <button
                            type="button"
                            className={mealButton}
                            disabled={change.isPending || Boolean(editor)}
                            onClick={() => {
                              change.reset();
                              setDeleting(deleting === record.id ? undefined : record.id);
                            }}
                          >
                            {deleting === record.id ? '취소' : '삭제'}
                          </button>
                        )}
                      </div>
                    </div>
                    {record && deleting === record.id && (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={mealMuted}>이 식사 기록을 삭제할까요?</p>
                        <button
                          type="button"
                          className={cn(mealButton, 'text-red-300')}
                          disabled={change.isPending}
                          onClick={() => remove(record)}
                        >
                          삭제 확인
                        </button>
                      </div>
                    )}
                    {record ? (
                      <>
                        {record.items.some(
                          (item) => item.source !== 'SCHOOL' && item.energyKcal != null,
                        ) && (
                          <p className={mealMuted}>
                            계산한 에너지 합계{' '}
                            {Math.round(
                              record.items.reduce(
                                (sum, item) =>
                                  sum + (item.source !== 'SCHOOL' ? (item.energyKcal ?? 0) : 0),
                                0,
                              ) * 100,
                            ) / 100}{' '}
                            kcal
                          </p>
                        )}
                        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                          {record.items.map((item) => (
                            <li key={item.id} className="break-words">
                              {item.name}{' '}
                              <span className={mealMuted}>
                                {item.source === 'SCHOOL'
                                  ? item.schoolName
                                  : sourceLabels[item.source]}
                              </span>
                              {item.source !== 'SCHOOL' && (
                                <span className={mealMuted}>
                                  {item.portions != null && ` · ${item.portions}인분`}
                                  {item.energyKcal != null && ` · 약 ${item.energyKcal} kcal`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className={mealMuted}>아직 기록이 없어요.</p>
                    )}
                    {editor?.kind === kind && (
                      <MealEditor
                        userId={userId}
                        date={date}
                        kind={kind}
                        record={editor.record}
                        busy={change.isPending}
                        error={change.error}
                        onSave={(input) => save(input, editor.record)}
                        onCancel={() => {
                          change.reset();
                          setEditor(undefined);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

export function MealPanel() {
  const session = useSession();
  const today = koreanDate.format(new Date());
  const [selectedDate, setSelectedDate] = useState<string>();
  const date = selectedDate ?? today;

  return (
    <div className="mt-8 max-w-2xl space-y-6 scheme-dark">
      <label className="inline-flex flex-wrap items-center gap-3 text-sm font-medium">
        기록 날짜
        <input
          type="date"
          className={cn(mealInput, 'w-auto')}
          value={date}
          max={today}
          min="1900-01-01"
          onChange={(event) => {
            const input = event.currentTarget;
            if (input.validity.valid && input.value) setSelectedDate(input.value);
          }}
        />
      </label>
      {session.data && (
        <DayMeals
          key={`${session.data.user.id}:${date}`}
          userId={session.data.user.id}
          date={date}
        />
      )}
      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-current/15 pt-4 text-xs">
        <a
          href="https://various.foodsafetykorea.go.kr/nutrient/"
          className="underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          식품영양성분 데이터베이스(K-FCDB)
        </a>
      </footer>
    </div>
  );
}
