import type { MealKind, MealRecord } from '@/entities/meal';

import type { FoodInput, MealDayInput, SchoolRef } from './meal-actions';

export type DraftItem = {
  key: string;
  name: string;
  source: MealRecord['items'][number]['source'];
  input: FoodInput;
  portions: number;
  kcal: string;
  referenceUrl?: string;
  legacyEnergy?: number | null;
  schoolMealKcal?: number | null;
};

export type DraftSlot = {
  items: DraftItem[];
  skipped: boolean;
  school?: SchoolRef & { menu: string[]; mealKcal: number | null };
  previous?: { id: string; revision: number };
  catalogVersion?: string;
  manualName?: string;
  manualKcal?: string;
};

export type DraftSlots = Partial<Record<MealKind, DraftSlot>>;
export type DayDraft = { requestId: string; slots: DraftSlots };
export const mainMealKinds = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;

export function draftSlot(record?: MealRecord): DraftSlot {
  return {
    previous: record && { id: record.id, revision: record.revision },
    skipped: Boolean(record && record.kind !== 'SNACK' && !record.items.length),
    items: (record?.items ?? []).map((item) => ({
      key: item.id,
      name: item.name,
      source: item.source,
      input: { savedId: item.id },
      portions: item.source === 'SCHOOL' ? 1 : (item.portions ?? 1),
      kcal: item.source === 'SCHOOL' ? '' : String(item.kcalPerPortion ?? ''),
      referenceUrl: item.source === 'CATALOG' ? item.servingSourceUrl : undefined,
      legacyEnergy:
        item.source === 'CATALOG' && item.portions == null ? (item.energyKcal ?? null) : undefined,
      schoolMealKcal: item.source === 'SCHOOL' ? item.schoolMealKcal : undefined,
    })),
  };
}

export function readKcal(value: string) {
  if (!value.trim()) return null;
  const kcal = Number(value);
  return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/u.test(value.trim()) && kcal <= 10000 ? kcal : NaN;
}

export function itemEnergy(item: DraftItem) {
  if (item.legacyEnergy !== undefined) return item.legacyEnergy;
  const kcal = readKcal(item.kcal);
  return kcal == null || Number.isNaN(kcal) ? null : Math.round(kcal * item.portions * 100) / 100;
}

export function hasMeal(slot: DraftSlot) {
  return slot.skipped || Boolean(slot.items.length || slot.school);
}

export function pendingInput(slot: DraftSlot) {
  return Boolean(slot.manualName?.trim() || slot.manualKcal?.trim());
}

export function canSaveSlot(slot: DraftSlot) {
  return !pendingInput(slot) && slot.items.every((item) => !Number.isNaN(readKcal(item.kcal)));
}

export function dayInput(
  date: string,
  draft: DayDraft,
  slots: Record<MealKind, DraftSlot>,
): MealDayInput {
  const kinds: MealKind[] = [...mainMealKinds];
  if (hasMeal(slots.SNACK) || slots.SNACK.previous) kinds.push('SNACK');
  return {
    date,
    requestId: draft.requestId,
    meals: kinds.map((kind) => {
      const { school, items, previous, catalogVersion, skipped } = slots[kind];
      return {
        kind,
        previous,
        catalogVersion,
        skipped,
        school: school && {
          officeCode: school.officeCode,
          schoolCode: school.schoolCode,
          menu: school.menu,
        },
        items: items.map((item) => {
          if (item.source === 'SCHOOL' || item.legacyEnergy !== undefined) return item.input;
          return {
            ...item.input,
            portions: item.portions,
            ...(item.referenceUrl ? {} : { kcalPerPortion: readKcal(item.kcal) }),
          };
        }),
      };
    }),
  };
}

export function readDayDraft(key: string): DayDraft | undefined {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return;
    const parsed = JSON.parse(value) as { expires: number; draft: DayDraft };
    if (parsed.expires > Date.now() && parsed.draft?.requestId && parsed.draft.slots)
      return parsed.draft;
    window.localStorage.removeItem(key);
  } catch {
    // An unavailable browser store must not stop editing.
  }
}

export function writeDayDraft(key: string, draft?: DayDraft) {
  try {
    if (draft) {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          draft,
          expires: Date.now() + 7 * 86_400_000,
        }),
      );
    } else {
      window.localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
