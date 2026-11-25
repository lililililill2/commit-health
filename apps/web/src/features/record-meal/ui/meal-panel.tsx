'use client';

import { useState } from 'react';

import { mealKinds, mealLabels, useMeals, type MealKind } from '@/entities/meal';
import { useSession } from '@/entities/session';
import { cn } from '@/shared/lib';

import { mealError, useSaveMealDay } from '../model/meal-actions';
import {
  canSaveSlot,
  dayInput,
  draftSlot,
  hasMeal,
  itemEnergy,
  mainMealKinds,
  pendingInput,
  readDayDraft,
  writeDayDraft,
  type DayDraft,
  type DraftSlot,
} from '../model/meal-draft';
import { MealEditor } from './meal-editor';
import { mealAlert, mealButton, mealInput, mealMuted, mealPrimary } from './meal-styles';

const koreanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

function DayMeals({ userId, date }: { userId: string; date: string }) {
  const meals = useMeals(userId, date);
  const change = useSaveMealDay(userId);
  const storageKey = `commit-health:meal-draft:v1:${userId}:${date}`;
  const [draft, setDraft] = useState(() => readDayDraft(storageKey));
  const [editor, setEditor] = useState<MealKind>();
  const [message, setMessage] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const records = new Map(meals.data?.map((record) => [record.kind, record]));
  const slots = {
    BREAKFAST: draft?.slots.BREAKFAST ?? draftSlot(records.get('BREAKFAST')),
    LUNCH: draft?.slots.LUNCH ?? draftSlot(records.get('LUNCH')),
    DINNER: draft?.slots.DINNER ?? draftSlot(records.get('DINNER')),
    SNACK: draft?.slots.SNACK ?? draftSlot(records.get('SNACK')),
  };
  const completed = mainMealKinds.filter((kind) => hasMeal(slots[kind])).length;
  const hasPendingInput = mealKinds.some((kind) => pendingInput(slots[kind]));
  const allValid = mealKinds.every((kind) => canSaveSlot(slots[kind]));
  const canSave = Boolean(draft && meals.data && completed === 3 && allValid && !change.isPending);

  function store(next?: DayDraft) {
    setDraft(next);
    setStorageAvailable(writeDayDraft(storageKey, next));
  }

  function editSlot(kind: MealKind, slot: DraftSlot) {
    change.reset();
    setMessage('');
    store({ requestId: crypto.randomUUID(), slots: { ...draft?.slots, [kind]: slot } });
  }

  function saveDay() {
    if (!draft || !canSave) return;
    setMessage('');
    change.mutate(dayInput(date, draft, slots), {
      onSuccess: () => {
        setEditor(undefined);
        store();
        setMessage('하루 식사를 저장했어요.');
      },
    });
  }

  function revertDraft() {
    if (!window.confirm('이 날짜의 임시저장 내용을 지울까요?')) return;
    change.reset();
    store();
    setEditor(undefined);
    setMessage('');
  }

  return (
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
          <p className={mealMuted}>아침·점심·저녁 {completed}/3</p>
          <ul className="divide-y divide-current/10">
            {mealKinds.map((kind) => {
              const slot = slots[kind];
              const ready = hasMeal(slot);
              const snacks = kind === 'SNACK';
              const count = slot.items.length + (slot.school?.menu.length ?? 0);
              const schoolKcal =
                slot.school?.mealKcal ??
                slot.items.find((item) => item.schoolMealKcal != null)?.schoolMealKcal;
              const energies = slot.items.map(itemEnergy).filter((energy) => energy !== null);
              const total =
                Math.round(energies.reduce((sum, energy) => sum + energy, 0) * 100) / 100;
              return (
                <li key={kind} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">
                      {mealLabels[kind]} {snacks && <span className={mealMuted}>선택</span>}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={mealButton}
                        disabled={change.isPending}
                        aria-expanded={editor === kind}
                        onClick={() => setEditor(editor === kind ? undefined : kind)}
                      >
                        {editor === kind ? '닫기' : count ? '음식 수정' : '음식 담기'}
                      </button>
                      {!snacks && (
                        <button
                          type="button"
                          aria-pressed={slot.skipped}
                          className={slot.skipped ? mealPrimary : mealButton}
                          disabled={change.isPending}
                          onClick={() =>
                            editSlot(kind, {
                              previous: slot.previous,
                              items: [],
                              skipped: !slot.skipped,
                            })
                          }
                        >
                          안 먹었어요
                        </button>
                      )}
                      {snacks && (count > 0 || pendingInput(slot)) && (
                        <button
                          type="button"
                          className={mealButton}
                          disabled={change.isPending}
                          onClick={() =>
                            editSlot(kind, { previous: slot.previous, items: [], skipped: false })
                          }
                        >
                          간식 비우기
                        </button>
                      )}
                    </div>
                  </div>
                  {slot.skipped ? (
                    <p className={mealMuted}>안 먹었어요</p>
                  ) : ready ? (
                    <>
                      {schoolKcal != null && (
                        <p className={mealMuted}>
                          학교 제공 한 끼 열량 · {schoolKcal.toLocaleString('ko-KR')} kcal
                        </p>
                      )}
                      {energies.length > 0 && (
                        <p className={mealMuted}>계산한 에너지 합계 {total} kcal</p>
                      )}
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                        {slot.items.map((item) => (
                          <li key={item.key} className="break-words">
                            {item.name}
                            {item.source !== 'SCHOOL' && item.legacyEnergy === undefined && (
                              <span className={mealMuted}> · {item.portions}인분</span>
                            )}
                          </li>
                        ))}
                        {slot.school && (
                          <li className={mealMuted}>급식 · {slot.school.menu.join(' · ')}</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <p className={mealMuted}>
                      {pendingInput(slot) ? '입력 중인 음식이 있어요.' : '아직 입력하지 않았어요.'}
                    </p>
                  )}
                  {editor === kind && (
                    <MealEditor
                      key={kind}
                      userId={userId}
                      date={date}
                      kind={kind}
                      draft={slot}
                      busy={change.isPending}
                      onChange={(next) => editSlot(kind, next)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-white/15 pt-4">
            {message && (
              <p role="status" className="text-sm text-emerald-300">
                {message}
              </p>
            )}
            {change.isError && (
              <p role="alert" className={mealAlert}>
                {mealError(
                  change.error,
                  '저장 결과를 확인하지 못했어요. 초안이 남아 있으니 다시 시도해 주세요.',
                )}
              </p>
            )}
            {hasPendingInput && <p className={mealMuted}>직접 입력한 음식은 담기를 눌러 주세요.</p>}
            {!hasPendingInput && !allValid && (
              <p className={mealAlert}>입력한 열량 값을 확인해 주세요.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={mealPrimary} disabled={!canSave} onClick={saveDay}>
                {change.isPending ? '저장 중…' : '하루 식사 저장'}
              </button>
              {draft && (
                <button
                  type="button"
                  className={mealButton}
                  disabled={change.isPending}
                  onClick={revertDraft}
                >
                  초안 되돌리기
                </button>
              )}
            </div>
            {draft && (
              <p role="status" className={mealMuted}>
                {storageAvailable
                  ? '이 브라우저에 임시저장됨'
                  : '임시저장할 수 없어요. 페이지를 닫으면 입력이 사라질 수 있어요.'}
              </p>
            )}
          </div>
        </>
      )}
    </section>
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
