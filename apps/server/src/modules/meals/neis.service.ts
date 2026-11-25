import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MealKind, SchoolDto } from './meal.dto.js';

type Row = Record<string, unknown>;
type SchoolMenu = { kind: Exclude<MealKind, 'SNACK'>; items: string[]; mealKcal: number | null };
const mealKindByCode: Readonly<Record<string, Exclude<MealKind, 'SNACK'>>> = {
  '1': 'BREAKFAST',
  '2': 'LUNCH',
  '3': 'DINNER',
};

function object(value: unknown): Row | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : undefined;
}

function readRows(payload: unknown, endpoint: string): Row[] {
  const root = object(payload);
  if (object(root?.RESULT)?.CODE === 'INFO-200') return [];
  const sections: unknown = root?.[endpoint];
  if (!Array.isArray(sections)) throw new Error('Unexpected NEIS response');
  const header: unknown = sections.map(object).find((section) => section?.head)?.head;
  if (Array.isArray(header)) {
    const code = object(header.map(object).find((item) => item?.RESULT)?.RESULT)?.CODE;
    if (code === 'INFO-200') return [];
    if (code !== 'INFO-000') throw new Error('NEIS rejected the request');
  } else {
    throw new Error('Missing NEIS result');
  }
  const rows: unknown = sections.map(object).find((section) => section?.row)?.row;
  if (!Array.isArray(rows)) throw new Error('Missing NEIS rows');
  return rows.map(object).filter((row): row is Row => row !== undefined);
}

function field(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseMealKcal(value: string): number | null {
  const match = /^(\d+(?:,\d{3})*(?:\.\d+)?)\s*kcal$/iu.exec(value);
  if (!match) return null;
  const kcal = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(kcal) ? kcal : null;
}

export function parseMenu(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/<br\s*\/?>|\r?\n/iu)
        .map((name) => name.replace(/\s*\((?:\d{1,2}\s*\.?\s*)+\)\s*$/u, '').trim())
        .filter((name) => name.length > 0 && name.length <= 120),
    ),
  ].slice(0, 40);
}

@Injectable()
export class NeisService {
  constructor(private readonly config: ConfigService) {}

  private async rows(
    endpoint: 'schoolInfo' | 'mealServiceDietInfo',
    params: Record<string, string>,
    pageSize: number,
    signal = AbortSignal.timeout(3_500),
  ) {
    const key = this.config.get<string>('NEIS_API_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('학교 급식 연결이 아직 설정되지 않았어요.');
    try {
      const url = new URL(`https://open.neis.go.kr/hub/${endpoint}`);
      url.search = new URLSearchParams({
        KEY: key,
        Type: 'json',
        pIndex: '1',
        pSize: String(pageSize),
        ...params,
      }).toString();
      // NEIS uses Type above and can return HTTP 500 with Accept: application/json.
      const response = await fetch(url, {
        signal,
        redirect: 'error',
      });
      if (!response.ok) throw new Error('NEIS request failed');
      return readRows(await response.json(), endpoint);
    } catch {
      throw new ServiceUnavailableException('학교 급식 정보를 불러오지 못했어요.');
    }
  }

  async schools(query: string | SchoolDto) {
    const name = typeof query === 'string' ? query.normalize('NFKC').trim() : '';
    const compact = name.replace(/\s+/gu, '');
    const signal = AbortSignal.timeout(3_500);
    const rows =
      typeof query === 'string'
        ? await this.rows('schoolInfo', { SCHUL_NM: compact }, 20, signal)
        : await this.rows(
            'schoolInfo',
            { ATPT_OFCDC_SC_CODE: query.officeCode, SD_SCHUL_CODE: query.schoolCode },
            20,
            signal,
          );
    const candidates =
      rows.length === 0 && name !== compact
        ? await this.rows('schoolInfo', { SCHUL_NM: name }, 20, signal)
        : rows;
    const schools = candidates
      .map((row) => ({
        officeCode: field(row, 'ATPT_OFCDC_SC_CODE'),
        schoolCode: field(row, 'SD_SCHUL_CODE'),
        name: field(row, 'SCHUL_NM'),
        region: field(row, 'LCTN_SC_NM') || field(row, 'ORG_RDNMA'),
      }))
      .filter(
        (school) =>
          /^[A-Z][0-9]{2}$/.test(school.officeCode) &&
          /^\d{7}$/.test(school.schoolCode) &&
          school.name.length > 0 &&
          school.name.length <= 120 &&
          school.region.length <= 200,
      );
    if (typeof query !== 'string') return schools;
    const rank = (schoolName: string) => {
      const comparable = schoolName.normalize('NFKC').replace(/\s+/gu, '');
      if (comparable === compact) return 0;
      return comparable.startsWith(compact) ? 1 : 2;
    };
    return schools.sort((a, b) => rank(a.name) - rank(b.name));
  }

  async menus(school: SchoolDto, date: string) {
    const neisDate = date.replaceAll('-', '');
    const rows = await this.rows(
      'mealServiceDietInfo',
      {
        ATPT_OFCDC_SC_CODE: school.officeCode,
        SD_SCHUL_CODE: school.schoolCode,
        MLSV_YMD: neisDate,
      },
      10,
    );
    const menus = new Map<SchoolMenu['kind'], SchoolMenu>();
    for (const row of rows) {
      const kind = mealKindByCode[field(row, 'MMEAL_SC_CODE')];
      if (
        !kind ||
        field(row, 'MLSV_YMD') !== neisDate ||
        field(row, 'ATPT_OFCDC_SC_CODE') !== school.officeCode ||
        field(row, 'SD_SCHUL_CODE') !== school.schoolCode
      )
        continue;
      const items = parseMenu(field(row, 'DDISH_NM'));
      if (items.length) {
        menus.set(kind, { kind, items, mealKcal: parseMealKcal(field(row, 'CAL_INFO')) });
      }
    }
    return [...menus.values()];
  }
}
