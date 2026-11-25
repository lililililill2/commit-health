'use client';

import { useEffect, useState } from 'react';

import {
  mealLabels,
  useSchool,
  useSchoolMenus,
  useSchoolSearch,
  type School,
  type SchoolMenu,
} from '@/entities/meal';

import { mealError, useSchoolChange } from '../model/meal-actions';
import { mealAlert, mealButton, mealInput, mealMuted } from './meal-styles';

interface SchoolPanelProps {
  userId: string;
  date: string;
  kind: SchoolMenu['kind'];
  disabled: boolean;
  recorded: boolean;
  availableSlots: number;
  onSelect: (school: School, menu: SchoolMenu) => void;
}

export function SchoolPanel({
  userId,
  date,
  kind,
  disabled,
  recorded,
  availableSlots,
  onSelect,
}: SchoolPanelProps) {
  const school = useSchool(userId);
  const menus = useSchoolMenus(userId, date, school.data);
  const change = useSchoolChange(userId);
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [name, setName] = useState('');
  const [settledName, setSettledName] = useState('');
  const [composing, setComposing] = useState(false);
  const showSearch = changing || school.data === null;
  const query = name.trim().normalize('NFKC');
  const hasQuery = showSearch && query.replace(/\s+/gu, '').length >= 2 && !composing;
  const ready = hasQuery && settledName === query;
  const search = useSchoolSearch(userId, ready ? settledName : '');
  const menu = menus.data?.meals.find((meal) => meal.kind === kind);

  useEffect(() => {
    if (!hasQuery || ready) return;
    const timer = window.setTimeout(() => setSettledName(query), 300);
    return () => window.clearTimeout(timer);
  }, [hasQuery, ready, query]);

  function clearSearch() {
    setName('');
    setSettledName('');
    setComposing(false);
  }

  function select(result: School) {
    change.mutate(
      { officeCode: result.officeCode, schoolCode: result.schoolCode },
      {
        onSuccess: () => {
          setChanging(false);
          clearSearch();
        },
      },
    );
  }

  return (
    <section aria-labelledby="school-meals-title" className="space-y-3">
      <h2 id="school-meals-title" className="text-lg font-semibold">
        학교 급식
      </h2>
      {school.isPending && (
        <p role="status" className={mealMuted}>
          등록한 학교를 확인하는 중…
        </p>
      )}
      {school.isError && (
        <p role="alert" className={mealAlert}>
          학교 정보를 불러오지 못했어요.
          <button type="button" className={mealButton} onClick={() => void school.refetch()}>
            다시 시도
          </button>
        </p>
      )}
      {school.data && (
        <>
          <div className="flex flex-wrap items-center gap-x-3">
            <p>
              <span className="font-medium">{school.data.name}</span>{' '}
              <span className={mealMuted}>{school.data.region}</span>
            </p>
            <span className="text-sm text-emerald-300" role="status">
              학교 연결됨
            </span>
            <button
              type="button"
              className={mealButton}
              disabled={disabled || change.isPending}
              onClick={() => {
                setChanging(!changing);
                clearSearch();
                setRemoving(false);
                change.reset();
              }}
            >
              {changing ? '변경 취소' : '학교 변경'}
            </button>
            <button
              type="button"
              className={mealButton}
              disabled={disabled || change.isPending}
              onClick={() => {
                setRemoving(!removing);
                setChanging(false);
                change.reset();
              }}
            >
              {removing ? '취소' : '등록 해제'}
            </button>
          </div>
          {removing && (
            <p className={mealMuted}>
              학교 등록을 해제할까요? 저장한 급식 기록은 유지돼요.
              <button
                type="button"
                disabled={disabled || change.isPending}
                className={mealButton}
                onClick={() => change.mutate(null, { onSuccess: () => setRemoving(false) })}
              >
                등록 해제 확인
              </button>
            </p>
          )}
          {menus.isPending && (
            <p role="status" className={mealMuted}>
              급식 메뉴를 불러오는 중…
            </p>
          )}
          {menus.isError && (
            <p role="alert" className={mealAlert}>
              {mealError(menus.error, '급식 메뉴를 불러오지 못했어요.')}
              <button type="button" className={mealButton} onClick={() => void menus.refetch()}>
                다시 시도
              </button>
            </p>
          )}
          {menus.data && !menu && (
            <p className={mealMuted}>이 날짜에 등록된 {mealLabels[kind]} 급식이 없어요.</p>
          )}
          {menus.data?.school && menu && (
            <div className="space-y-2 border-t border-white/15 pt-3">
              <p className="font-medium">{mealLabels[kind]} 식단</p>
              <p className={mealMuted}>{menu.items.join(' · ')}</p>
              <p className={mealMuted}>
                {menu.mealKcal == null
                  ? '학교 제공 열량 정보 없음'
                  : `학교 제공 한 끼 열량 · ${menu.mealKcal.toLocaleString('ko-KR')} kcal`}
              </p>
              {recorded ? (
                <p className={mealMuted}>급식을 담았어요.</p>
              ) : menu.items.length > availableSlots ? (
                <p className={mealMuted}>담은 음식을 줄이면 이 급식을 기록할 수 있어요.</p>
              ) : (
                <button
                  type="button"
                  className={mealButton}
                  disabled={disabled || change.isPending}
                  onClick={() => {
                    if (menus.data.school) onSelect(menus.data.school, menu);
                  }}
                >
                  이 급식 먹었어요
                </button>
              )}
              <a
                href="https://open.neis.go.kr/"
                target="_blank"
                rel="noreferrer"
                className="block w-fit text-xs text-white/65 underline"
              >
                출처 · NEIS 교육정보 개방 포털
              </a>
            </div>
          )}
        </>
      )}
      {showSearch && (
        <>
          <label className="block space-y-1 text-sm">
            <span>학교 이름</span>
            <input
              type="search"
              className={mealInput}
              value={name}
              autoComplete="off"
              disabled={disabled || change.isPending}
              onChange={(event) => setName(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setComposing(false);
                setName(event.currentTarget.value);
              }}
              placeholder="예: 소프트웨어, 한빛고"
              maxLength={60}
            />
          </label>
          {change.isPending && (
            <p role="status" className={mealMuted}>
              학교 연결 중…
            </p>
          )}
          {hasQuery && (!ready || search.isPending) && (
            <p role="status" className={mealMuted}>
              학교 검색 중…
            </p>
          )}
          {ready && search.isError && (
            <p role="alert" className={mealAlert}>
              {mealError(search.error, '학교 검색에 실패했어요.')}
              <button className={mealButton} type="button" onClick={() => void search.refetch()}>
                다시 시도
              </button>
            </p>
          )}
          {ready && search.data?.length === 0 && (
            <p className={mealMuted} role="status">
              검색 결과가 없어요. 학교 이름 일부를 다시 입력해 주세요.
            </p>
          )}
          {ready && search.data && search.data.length > 0 && (
            <ul className="max-h-52 space-y-1 overflow-y-auto" aria-label="연관 학교 검색 결과">
              {search.data.map((result) => (
                <li key={`${result.officeCode}-${result.schoolCode}`}>
                  <button
                    type="button"
                    className={`${mealButton} w-full flex-wrap justify-between gap-x-4 text-left`}
                    disabled={disabled || change.isPending}
                    onClick={() => select(result)}
                  >
                    <span>{result.name}</span>
                    <span className={mealMuted}>{result.region} · 연결</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {change.isError && (
        <p role="alert" className={mealAlert}>
          {mealError(change.error, '학교 정보를 저장하지 못했어요.')}
        </p>
      )}
    </section>
  );
}
