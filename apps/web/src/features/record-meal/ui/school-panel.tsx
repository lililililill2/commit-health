'use client';

import { useState } from 'react';

import {
  mealLabels,
  useSchool,
  useSchoolMenus,
  useSchoolSearch,
  type MealKind,
  type School,
  type SchoolMenu,
} from '@/entities/meal';

import { mealError, useSchoolChange } from '../model/meal-actions';
import { mealAlert, mealButton, mealInput, mealMuted } from './meal-styles';

interface SchoolPanelProps {
  userId: string;
  date: string;
  disabled: boolean;
  recorded: ReadonlySet<MealKind>;
  onSelect: (school: School, menu: SchoolMenu) => void;
}

export function SchoolPanel({ userId, date, disabled, recorded, onSelect }: SchoolPanelProps) {
  const school = useSchool(userId);
  const menus = useSchoolMenus(userId, date, school.data);
  const change = useSchoolChange(userId);
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState('');
  const search = useSchoolSearch(userId, submitted);
  const showSearch = changing || school.data === null;

  function select(result: School) {
    change.mutate(
      { officeCode: result.officeCode, schoolCode: result.schoolCode },
      {
        onSuccess: () => {
          setChanging(false);
          setName('');
          setSubmitted('');
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="school-meals-title"
      className="space-y-3 border-b border-current/15 pb-5"
    >
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
            <button
              type="button"
              className={mealButton}
              disabled={disabled || change.isPending}
              onClick={() => {
                setChanging(!changing);
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
          {menus.data?.meals.length === 0 && (
            <p className={mealMuted}>이 날짜에 등록된 급식이 없어요.</p>
          )}
          {menus.data?.school && menus.data.meals.length > 0 && (
            <ul className="divide-y divide-current/10">
              {menus.data.meals.map((menu) => (
                <li
                  key={menu.kind}
                  className="flex flex-wrap items-center gap-x-4 py-2 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="font-medium">{mealLabels[menu.kind]}</p>
                    <p className={mealMuted}>{menu.items.join(' · ')}</p>
                  </div>
                  {recorded.has(menu.kind) ? (
                    <span className={mealMuted}>급식 기록 완료</span>
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
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {showSearch && (
        <>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const query = name.trim();
              if (query.length < 2) return;
              if (query === submitted) void search.refetch();
              else setSubmitted(query);
            }}
          >
            <label className="min-w-0 flex-1 text-sm">
              학교 이름
              <input
                className={mealInput}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="학교 이름을 입력해 주세요"
                maxLength={60}
              />
            </label>
            <button
              className={mealButton}
              disabled={disabled || name.trim().length < 2 || search.isFetching || change.isPending}
            >
              검색
            </button>
          </form>
          {submitted && search.isFetching && (
            <p role="status" className={mealMuted}>
              학교 검색 중…
            </p>
          )}
          {search.isError && (
            <p role="alert" className={mealAlert}>
              {mealError(search.error, '학교 검색에 실패했어요.')}
            </p>
          )}
          {search.data?.length === 0 && <p className={mealMuted}>검색 결과가 없어요.</p>}
          {search.data && (
            <ul className="divide-y divide-current/10">
              {search.data.map((result) => (
                <li key={`${result.officeCode}-${result.schoolCode}`}>
                  <button
                    type="button"
                    className={`${mealButton} w-full flex-wrap justify-between gap-x-4 text-left`}
                    disabled={disabled || change.isPending}
                    onClick={() => select(result)}
                  >
                    <span>{result.name}</span>
                    <span className={mealMuted}>{result.region}</span>
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
