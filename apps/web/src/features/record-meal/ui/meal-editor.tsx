'use client';

import { useState } from 'react';

import {
  mealLabels,
  normalizeFoodName,
  searchFoodTerms,
  sourceLabels,
  useFoodCatalog,
  useMealHistory,
  type CatalogFood,
  type MealKind,
  type MealRecord,
} from '@/entities/meal';
import { cn } from '@/shared/lib';

import { mealError, type FoodInput, type MealInput } from '../model/meal-actions';
import { mealAlert, mealButton, mealInput, mealMuted, mealPrimary } from './meal-styles';

const modes = [
  { id: 'school', label: '급식' },
  { id: 'catalog', label: '음식 검색' },
  { id: 'manual', label: '직접 입력' },
] as const;

type DraftItem = {
  key: string;
  name: string;
  source: keyof typeof sourceLabels;
  input: FoodInput;
  portions: number;
  kcal: string;
  referenceUrl?: string;
  legacyEnergy?: number;
};

const portionChoices = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];

function readKcal(value: string) {
  if (!value.trim()) return null;
  const kcal = Number(value);
  return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/u.test(value.trim()) && kcal <= 10000 ? kcal : NaN;
}

function catalogItem(food: CatalogFood): DraftItem {
  return {
    key: food.id,
    name: food.name,
    input: { foodId: food.id },
    source: 'CATALOG',
    portions: 1,
    kcal: String(food.kcalPerPortion ?? ''),
    referenceUrl: food.servingSourceUrl,
  };
}

function manualItem(name: string, kcal = ''): DraftItem {
  return {
    key: `manual:${normalizeFoodName(name)}`,
    name,
    input: { name },
    source: 'MANUAL',
    portions: 1,
    kcal,
  };
}

function itemEnergy(item: DraftItem) {
  if (item.legacyEnergy !== undefined) return item.legacyEnergy;
  const kcal = readKcal(item.kcal);
  return kcal == null || Number.isNaN(kcal) ? null : Math.round(kcal * item.portions * 100) / 100;
}

export function MealEditor({
  userId,
  date,
  kind,
  record,
  busy,
  error,
  onSave,
  onCancel,
}: {
  userId: string;
  date: string;
  kind: MealKind;
  record?: MealRecord;
  busy: boolean;
  error: unknown;
  onSave: (input: Omit<MealInput, 'requestId'>) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    (record?.items ?? []).map((item) => ({
      key: item.id,
      name: item.name,
      source: item.source,
      input: { savedId: item.id },
      portions: item.source === 'SCHOOL' ? 1 : (item.portions ?? 1),
      kcal: item.source === 'SCHOOL' ? '' : String(item.kcalPerPortion ?? ''),
      referenceUrl: item.source === 'CATALOG' ? item.servingSourceUrl : undefined,
      legacyEnergy:
        item.source === 'CATALOG' && item.portions == null
          ? (item.energyKcal ?? undefined)
          : undefined,
    })),
  );
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [mode, setMode] = useState<(typeof modes)[number]['id']>('catalog');
  const catalog = useFoodCatalog(mode === 'catalog');
  const history = useMealHistory(userId, mode === 'catalog');
  const foods = catalog.data?.foods ?? [];
  const groups = searchFoodTerms(foods, query);
  const usedNames = new Set(items.map((item) => normalizeFoodName(item.name)));
  const full = items.length >= 40;
  const batch = new Map<string, CatalogFood>();
  for (const group of groups) {
    const selected = picks[group.key];
    const candidate =
      selected !== undefined
        ? group.matches.find((food) => food.id === selected)
        : (group.matches.find((food) => normalizeFoodName(food.name) === group.key) ??
          (group.matches.length === 1 ? group.matches[0] : undefined));
    if (candidate && !usedNames.has(normalizeFoodName(candidate.name)))
      batch.set(candidate.id, candidate);
  }
  const batchCount = Math.min(batch.size, 40 - items.length);
  const energies = items.map(itemEnergy);
  const calculated = energies.filter((energy) => energy !== null);
  const total = Math.round(calculated.reduce((sum, energy) => sum + energy, 0) * 100) / 100;
  const invalidKcal = items.some((item) => Number.isNaN(readKcal(item.kcal)));

  function add(newItems: DraftItem[]) {
    setItems((current) => {
      const names = new Set(current.map((item) => normalizeFoodName(item.name)));
      const additions = [];
      for (const item of newItems) {
        const key = normalizeFoodName(item.name);
        if (names.has(key)) continue;
        names.add(key);
        additions.push(item);
      }
      return [...current, ...additions].slice(0, 40);
    });
  }

  function update(key: string, patch: Partial<Pick<DraftItem, 'portions' | 'kcal'>>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6"
      aria-labelledby="meal-editor-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="meal-editor-title" className="text-lg font-semibold">
          {mealLabels[kind]} {record ? '수정' : '기록'}
        </h2>
        <button type="button" className={mealButton} disabled={busy} onClick={onCancel}>
          닫기
        </button>
      </div>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="음식 추가 방식">
          {modes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === mode}
              className={cn(id === mode ? mealPrimary : mealButton, 'px-1 sm:px-4')}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'school' && <p className={mealMuted}>학교 급식 연동은 준비 중이에요.</p>}

        {mode === 'catalog' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span>음식 이름</span>
              <input
                className={mealInput}
                placeholder="예: 김밥, 김치찌개, 쌀밥"
                maxLength={240}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPicks({});
                }}
              />
            </label>
            {catalog.isPending && (
              <p role="status" className={mealMuted}>
                음식 목록을 불러오는 중…
              </p>
            )}
            {catalog.isError && (
              <p role="alert" className={mealAlert}>
                음식 목록을 불러오지 못했어요.{' '}
                <button type="button" className={mealButton} onClick={() => void catalog.refetch()}>
                  다시 시도
                </button>
              </p>
            )}
            {catalog.data &&
              groups.length === 1 &&
              (groups[0].matches.length > 0 ? (
                <ul className="max-h-48 divide-y divide-white/10 overflow-y-auto">
                  {groups[0].matches.map((food) => (
                    <li key={food.id} className="flex items-center justify-between gap-2 py-1">
                      <p className="min-w-0 break-words text-sm">
                        {food.name}{' '}
                        {food.kcalPerPortion != null && (
                          <span className={mealMuted}>약 {food.kcalPerPortion} kcal / 인분</span>
                        )}
                      </p>
                      <button
                        type="button"
                        className={cn(mealButton, 'shrink-0')}
                        aria-label={`${food.name} 담기`}
                        disabled={full || usedNames.has(normalizeFoodName(food.name))}
                        onClick={() => add([catalogItem(food)])}
                      >
                        담기
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={mealMuted}>검색 결과가 없어요. 직접 입력할 수 있어요.</p>
              ))}
            {catalog.data && groups.length > 1 && (
              <>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {groups.map(({ key, term, matches }) => {
                    const first =
                      matches.find((food) => normalizeFoodName(food.name) === key) ??
                      (matches.length === 1 ? matches[0] : undefined);
                    return matches.length ? (
                      <label
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 text-sm"
                      >
                        <span className="truncate">{term}</span>
                        <select
                          className={mealInput}
                          value={picks[key] ?? first?.id ?? ''}
                          onChange={(event) =>
                            setPicks((current) => ({ ...current, [key]: event.target.value }))
                          }
                        >
                          <option value="">선택 안 함</option>
                          {matches.map((food) => (
                            <option key={food.id} value={food.id}>
                              {food.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p key={key} className={mealMuted}>
                        {term} · 결과 없음
                      </p>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={mealButton}
                  disabled={!batchCount}
                  onClick={() => add([...batch.values()].slice(0, batchCount).map(catalogItem))}
                >
                  {batchCount}개 한 번에 담기
                </button>
              </>
            )}
            {!groups.length &&
              (['recent', 'frequent'] as const).map((key) => {
                const entries = history.data?.[key];
                if (!entries?.length) return null;
                return (
                  <div key={key} className="space-y-2">
                    <p className={mealMuted}>{key === 'recent' ? '최근 기록' : '자주 먹은 음식'}</p>
                    <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                      {entries.map(({ name: recentName, foodId }) => {
                        const food = foodId ? foods.find((row) => row.id === foodId) : undefined;
                        return (
                          <li key={foodId ?? recentName}>
                            <button
                              type="button"
                              className={mealButton}
                              disabled={
                                full ||
                                usedNames.has(normalizeFoodName(recentName)) ||
                                Boolean(foodId && !food)
                              }
                              onClick={() =>
                                add([food ? catalogItem(food) : manualItem(recentName)])
                              }
                            >
                              {recentName}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
          </div>
        )}

        {mode === 'manual' && (
          <form
            className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || Number.isNaN(readKcal(manualKcal))) return;
              add([manualItem(name.trim(), manualKcal.trim())]);
              setName('');
              setManualKcal('');
            }}
          >
            <label className="col-span-2 min-w-0 space-y-1 text-sm sm:col-span-1">
              <span>음식 이름</span>
              <input
                className={mealInput}
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm">
              <span>
                1인분 kcal <span className={mealMuted}>(선택)</span>
              </span>
              <input
                className={mealInput}
                inputMode="decimal"
                value={manualKcal}
                maxLength={8}
                aria-invalid={Number.isNaN(readKcal(manualKcal))}
                onChange={(event) => setManualKcal(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className={mealButton}
              disabled={
                full ||
                !name.trim() ||
                usedNames.has(normalizeFoodName(name)) ||
                Number.isNaN(readKcal(manualKcal))
              }
            >
              담기
            </button>
          </form>
        )}

        <div className="border-t border-white/15 pt-3">
          <h3 className="mb-2 font-medium">
            담은 음식 <span className={mealMuted}>{items.length}/40</span>
          </h3>
          {items.length ? (
            <ul className="max-h-[min(34dvh,16rem)] divide-y divide-white/10 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <li key={item.key} className="space-y-1 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 break-words text-sm">{item.name}</span>
                    <button
                      type="button"
                      className={cn(mealButton, 'shrink-0 border-0')}
                      aria-label={`${item.name} 빼기`}
                      onClick={() =>
                        setItems((current) => current.filter(({ key }) => key !== item.key))
                      }
                    >
                      빼기
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.source !== 'SCHOOL' && item.legacyEnergy === undefined && (
                      <>
                        <select
                          aria-label={`${item.name} 인분 수`}
                          className={cn(mealInput, 'w-auto')}
                          value={item.portions}
                          onChange={(event) =>
                            update(item.key, { portions: Number(event.target.value) })
                          }
                        >
                          {[...new Set([...portionChoices, item.portions])]
                            .sort((a, b) => a - b)
                            .map((servings) => (
                              <option key={servings} value={servings}>
                                {servings}인분
                              </option>
                            ))}
                        </select>
                        {!item.referenceUrl && (
                          <input
                            aria-label={`${item.name} 1인분 kcal`}
                            className={cn(mealInput, 'w-28')}
                            inputMode="decimal"
                            value={item.kcal}
                            maxLength={8}
                            placeholder="1인분 kcal"
                            aria-invalid={Number.isNaN(readKcal(item.kcal))}
                            onChange={(event) => update(item.key, { kcal: event.target.value })}
                          />
                        )}
                      </>
                    )}
                    <span className={mealMuted}>
                      {energies[index] == null ? '열량 미입력' : `약 ${energies[index]} kcal`}
                    </span>
                    {item.referenceUrl && (
                      <a
                        className={cn(mealMuted, 'underline')}
                        href={item.referenceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        기준 출처
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={mealMuted}>아직 담은 음식이 없어요.</p>
          )}
        </div>

        {(invalidKcal || Number.isNaN(readKcal(manualKcal))) && (
          <p role="alert" className={mealAlert}>
            kcal는 0~10,000 사이 숫자로 입력해 주세요.
          </p>
        )}
        {error != null && (
          <p role="alert" className={mealAlert}>
            {mealError(error, '식사를 저장하지 못했어요. 다시 시도해 주세요.')}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3">
          <p className="text-sm font-medium" aria-live="polite">
            {calculated.length
              ? `합계 약 ${total} kcal (${calculated.length}/${items.length}개)`
              : '합계 — kcal'}
          </p>
          {error != null && items.some((item) => 'foodId' in item.input) && (
            <button className={mealButton} type="button" onClick={() => void catalog.refetch()}>
              음식 목록 새로고침
            </button>
          )}
          <button
            type="button"
            className={mealPrimary}
            disabled={!items.length || invalidKcal || busy}
            onClick={() =>
              onSave({
                date,
                kind,
                catalogVersion: catalog.data?.version,
                items: items.map((item) => {
                  if (item.source === 'SCHOOL' || item.legacyEnergy !== undefined)
                    return item.input;
                  return {
                    ...item.input,
                    portions: item.portions,
                    ...(item.referenceUrl ? {} : { kcalPerPortion: readKcal(item.kcal) }),
                  };
                }),
              })
            }
          >
            {busy ? '저장 중…' : '식사 저장'}
          </button>
        </div>
      </fieldset>
    </section>
  );
}
