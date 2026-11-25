'use client';

import { useRef, useState, type FormEvent } from 'react';

import {
  formatCaffeineMg,
  useCaffeineCatalog,
  useTodayCaffeine,
  type CaffeineDay,
  type CaffeineRecord,
} from '@/entities/caffeine';
import { useSession } from '@/entities/session';
import { cn } from '@/shared/lib';

import {
  CaffeineQuantitySaveError,
  caffeineSaveError,
  useRecordCaffeine,
} from '../model/use-record-caffeine';
import { CaffeineProductGrid } from './caffeine-product-grid';

const koreanTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const panel = 'rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6';
const field =
  'min-h-11 w-full rounded-lg border border-white/25 bg-[#171717] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-sky-300';
const button =
  'min-h-11 cursor-pointer rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-default disabled:opacity-50';
const selected = 'border-sky-300 bg-sky-300/10';
const maxQuantity = 10;

function drinkSearch(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function CaffeineEditor({ day, userId }: { day: CaffeineDay; userId: string }) {
  const catalog = useCaffeineCatalog(userId);
  const change = useRecordCaffeine(userId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const [search, setSearch] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [drinkName, setDrinkName] = useState('');
  const [mg, setMg] = useState('');
  const [editId, setEditId] = useState<string>();

  const terms = search.trim().split(/\s+/).map(drinkSearch);
  const matching = (catalog.data ?? []).filter((product) => {
    const label = drinkSearch(`${product.brand} ${product.name} ${product.servingLabel}`);
    return terms.every((term) => label.includes(term));
  });
  const product = catalog.data?.find((item) => item.id === catalogId);
  const canSave = mode === 'catalog' ? Boolean(product) : Boolean(drinkName.trim() && mg !== '');
  const saveQuantity = mode === 'catalog' && !editId ? quantity : 1;

  function selectProduct(id: string) {
    setCatalogId(id);
    setQuantity(1);
  }

  function resetForm() {
    setEditId(undefined);
    setSearch('');
    selectProduct('');
    setDrinkName('');
    setMg('');
  }

  function startEdit(record: CaffeineRecord) {
    const hasProduct = catalog.data?.some((item) => item.id === record.catalogId);
    change.reset();
    setEditId(record.id);
    setMode(hasProduct ? 'catalog' : 'manual');
    setSearch('');
    selectProduct(hasProduct ? (record.catalogId ?? '') : '');
    setDrinkName(record.drinkName);
    setMg(String(record.caffeineMg));
    heading.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || change.isPending) return;
    const drink =
      mode === 'catalog' ? { catalogId } : { drinkName: drinkName.trim(), caffeineMg: Number(mg) };
    const editedRecord = day.records.find((record) => record.id === editId);
    const consumedTime = editedRecord
      ? koreanTime.format(new Date(editedRecord.consumedAt))
      : undefined;
    change.mutate(
      {
        kind: 'save',
        id: editId,
        quantity: saveQuantity,
        input: { ...drink, recordDate: day.recordDate, consumedTime },
      },
      {
        onSuccess: resetForm,
        onError: (error) => {
          if (!(error instanceof CaffeineQuantitySaveError)) return;
          if (error.uncertain) resetForm();
          else setQuantity(saveQuantity - error.saved);
        },
      },
    );
  }

  function remove(record: CaffeineRecord) {
    if (!window.confirm(`‘${record.drinkName}’ 기록을 삭제할까요?`)) return;
    change.mutate(
      { kind: 'remove', id: record.id, recordDate: day.recordDate },
      {
        onSuccess: () => {
          if (record.id === editId) resetForm();
        },
      },
    );
  }

  return (
    <div className="mt-8 max-w-3xl space-y-5">
      <section className={panel} aria-labelledby="caffeine-total-heading">
        <h2 id="caffeine-total-heading" className="text-sm text-white/70">
          오늘 마신 카페인
        </h2>
        <p aria-live="polite" className="mt-2 text-3xl font-medium tabular-nums">
          {formatCaffeineMg(day.totalMg)}
        </p>
        <p className="mt-2 text-sm text-white/60">{day.recordDate} · 한국 시간</p>
      </section>

      <form onSubmit={submit} className={panel}>
        <h2 ref={heading} tabIndex={-1} className="text-lg font-medium">
          {editId ? '카페인 기록 수정' : '음료 추가'}
        </h2>
        <fieldset disabled={change.isPending} className="mt-4 min-w-0 space-y-4">
          <div role="group" aria-label="입력 방식" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={mode === 'catalog'}
              className={cn(button, mode === 'catalog' && selected)}
              onClick={() => setMode('catalog')}
            >
              제품 찾기
            </button>
            <button
              type="button"
              aria-pressed={mode === 'manual'}
              className={cn(button, mode === 'manual' && selected)}
              onClick={() => setMode('manual')}
            >
              직접 입력
            </button>
          </div>

          {mode === 'catalog' ? (
            <div className="space-y-3">
              <label htmlFor="caffeine-search" className="block text-sm">
                브랜드 또는 음료명
              </label>
              <input
                id="caffeine-search"
                type="search"
                className={field}
                placeholder="예: 핫식스, 몬스터, 아메리카노"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {catalog.isPending ? (
                <p role="status" className="text-sm text-white/60">
                  제품 목록을 불러오는 중…
                </p>
              ) : catalog.isError && !catalog.data ? (
                <p role="alert" className="text-sm text-red-300">
                  제품 목록을 불러오지 못했어요. 직접 입력하거나{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void catalog.refetch()}
                  >
                    다시 시도
                  </button>
                  해 주세요.
                </p>
              ) : matching.length ? (
                <CaffeineProductGrid
                  products={matching}
                  selectedId={catalogId}
                  onSelect={selectProduct}
                />
              ) : (
                <p className="text-sm text-white/60">
                  검색 결과가 없어요. 직접 입력으로 추가할 수 있어요.
                </p>
              )}
              {product && (
                <div className="space-y-3 rounded-xl border border-sky-300/30 bg-sky-300/5 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {product.brand} {product.name}
                      </p>
                      <p className="mt-1 text-xs text-white/65">
                        {product.servingLabel}당 {formatCaffeineMg(product.caffeineMg)}
                      </p>
                    </div>
                    {!editId && (
                      <div role="group" aria-label="음료 수량" className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={quantity === 1}
                          aria-label="수량 줄이기"
                          className={cn(button, 'min-w-11 px-0 text-base')}
                          onClick={() => setQuantity(quantity - 1)}
                        >
                          −
                        </button>
                        <output className="min-w-10 text-center tabular-nums">{quantity}개</output>
                        <button
                          type="button"
                          disabled={quantity === maxQuantity}
                          aria-label="수량 늘리기"
                          className={cn(button, 'min-w-11 px-0 text-base')}
                          onClick={() => setQuantity(quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/15 pt-3">
                    <span className="text-white/70">
                      {editId ? '카페인 함량' : '추가할 카페인'}
                    </span>
                    <span
                      aria-live="polite"
                      className="text-xl font-semibold text-sky-200 tabular-nums"
                    >
                      {formatCaffeineMg(product.caffeineMg * saveQuantity)}
                    </span>
                  </p>
                  <p className="text-xs text-white/65">
                    용량이나 샷을 바꿨다면 직접 입력해 주세요.{' '}
                    <a
                      href={product.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 underline"
                    >
                      공식 출처 보기<span className="sr-only"> (새 탭)</span>
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <label className="space-y-2 text-sm">
                <span className="block">음료 이름</span>
                <input
                  className={field}
                  required
                  maxLength={100}
                  value={drinkName}
                  onChange={(event) => setDrinkName(event.target.value)}
                  placeholder="예: 편의점 카페라떼"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="block">카페인 함량 (mg)</span>
                <input
                  className={field}
                  type="number"
                  inputMode="decimal"
                  required
                  min={0}
                  max={9999.99}
                  step={0.01}
                  value={mg}
                  onChange={(event) => setMg(event.target.value)}
                />
              </label>
              <p className="text-xs text-white/60 sm:col-span-2">
                포장지에 적힌 함량을 참고해서 실제 마신 양에 해당하는 mg을 입력해 주세요.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={cn(button, selected)}
              disabled={!canSave || change.isPending}
            >
              {change.isPending && change.variables?.kind === 'save'
                ? '저장 중…'
                : editId
                  ? '수정 저장'
                  : saveQuantity > 1
                    ? `${saveQuantity}개 기록하기`
                    : '음료 기록하기'}
            </button>
            {editId && (
              <button
                type="button"
                className={button}
                onClick={() => {
                  resetForm();
                  change.reset();
                }}
              >
                취소
              </button>
            )}
          </div>
        </fieldset>
        {change.isError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {caffeineSaveError(change.error)}
          </p>
        )}
        {change.isSuccess && (
          <p role="status" className="mt-3 text-sm text-emerald-300">
            {change.variables?.kind === 'remove'
              ? '음료 기록을 삭제했어요.'
              : (change.variables?.quantity ?? 1) > 1
                ? `음료 ${change.variables?.quantity}개를 기록했어요.`
                : '음료 기록을 저장했어요.'}
          </p>
        )}
      </form>

      <section className={panel} aria-labelledby="caffeine-records-heading">
        <h2 id="caffeine-records-heading" className="text-lg font-medium">
          오늘의 음료 기록
        </h2>
        <p className="mt-2 text-sm text-white/60">
          한국 시간 자정까지 수정하거나 삭제할 수 있어요.
        </p>
        {day.records.length ? (
          <ul className="mt-3 divide-y divide-white/15">
            {day.records.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words">
                    {record.drinkName} · {formatCaffeineMg(record.caffeineMg)}
                  </p>
                  <p className="mt-1 text-sm text-white/60">{record.servingLabel ?? '직접 입력'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={change.isPending}
                    className={button}
                    aria-label={`${record.drinkName} 기록 수정`}
                    onClick={() => startEdit(record)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={change.isPending}
                    className={cn(button, 'text-red-300')}
                    aria-label={`${record.drinkName} 기록 삭제`}
                    onClick={() => remove(record)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-white/60">아직 오늘 기록한 음료가 없어요.</p>
        )}
      </section>
    </div>
  );
}

export function CaffeineRecordForm() {
  const session = useSession();
  const userId = session.data?.user.id;
  const today = useTodayCaffeine(userId);
  if (today.isPending || !userId) {
    return (
      <p role="status" className="mt-8 text-sm text-white/60">
        오늘 기록을 불러오는 중…
      </p>
    );
  }
  if (!today.data) {
    return (
      <p role="alert" className="mt-8 text-sm text-red-300">
        오늘 기록을 불러오지 못했어요.{' '}
        <button type="button" className="underline" onClick={() => void today.refetch()}>
          다시 시도
        </button>
      </p>
    );
  }
  return (
    <CaffeineEditor key={`${userId}:${today.data.recordDate}`} day={today.data} userId={userId} />
  );
}
