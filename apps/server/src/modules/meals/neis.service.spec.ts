import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NeisService, parseMenu } from './neis.service.js';

describe('NEIS meals', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses line breaks and allergy suffixes without discarding food descriptions', () => {
    expect(parseMenu('살구잼(저당) (2.5.)<br />쌀밥<br>된장국 (5.6)')).toEqual([
      '살구잼(저당)',
      '쌀밥',
      '된장국',
    ]);
  });

  it('distinguishes no records from an upstream failure', async () => {
    const client = new NeisService(new ConfigService({ NEIS_API_KEY: 'test-key' }));
    const network = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ RESULT: { CODE: 'INFO-200' } }))
      .mockResolvedValueOnce(Response.json({ RESULT: { CODE: 'ERROR-290' } }));
    await expect(client.schools('테스트')).resolves.toEqual([]);
    await expect(client.schools('테스트')).rejects.toMatchObject({ status: 503 });
    const [request] = network.mock.calls[0] ?? [];
    expect(request).toBeInstanceOf(URL);
    expect((request as URL).pathname).toBe('/hub/schoolInfo');
    expect((request as URL).searchParams.get('SCHUL_NM')).toBe('테스트');
  });

  it('keeps energy at the meal level and does not invent missing values', async () => {
    const client = new NeisService(new ConfigService({ NEIS_API_KEY: 'test-key' }));
    const base = {
      ATPT_OFCDC_SC_CODE: 'T10',
      SD_SCHUL_CODE: '7003714',
      MLSV_YMD: '20261124',
      DDISH_NM: '쌀밥<br/>김치',
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        mealServiceDietInfo: [
          { head: [{ RESULT: { CODE: 'INFO-000' } }] },
          {
            row: [
              { ...base, MMEAL_SC_CODE: '2', CAL_INFO: '1,007.9 Kcal' },
              { ...base, MMEAL_SC_CODE: '3', CAL_INFO: '미등록' },
              { ...base, MLSV_YMD: '20261125', MMEAL_SC_CODE: '1', CAL_INFO: '500 Kcal' },
            ],
          },
        ],
      }),
    );
    await expect(
      client.menus({ officeCode: 'T10', schoolCode: '7003714' }, '2026-11-24'),
    ).resolves.toEqual([
      { kind: 'LUNCH', items: ['쌀밥', '김치'], mealKcal: 1007.9 },
      { kind: 'DINNER', items: ['쌀밥', '김치'], mealKcal: null },
    ]);
  });

  it('searches school names without spaces and puts exact and prefix matches first', async () => {
    const client = new NeisService(new ConfigService({ NEIS_API_KEY: 'test-key' }));
    const network = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        schoolInfo: [
          { head: [{ RESULT: { CODE: 'INFO-000' } }] },
          {
            row: ['서울가온고등학교', '가온고등학교', '가온고'].map((name, index) => ({
              ATPT_OFCDC_SC_CODE: 'B10',
              SD_SCHUL_CODE: String(7000000 + index),
              SCHUL_NM: name,
              LCTN_SC_NM: '서울특별시',
            })),
          },
        ],
      }),
    );
    const candidates = await client.schools('가온 고');
    expect(candidates.map(({ name }) => name)).toEqual([
      '가온고',
      '가온고등학교',
      '서울가온고등학교',
    ]);
    expect((network.mock.calls[0][0] as URL).searchParams.get('SCHUL_NM')).toBe('가온고');
    expect((network.mock.calls[0][0] as URL).searchParams.get('Type')).toBe('json');
    expect(new Headers(network.mock.calls[0][1]?.headers).get('Accept')).toBeNull();
    expect(network).toHaveBeenCalledTimes(1);
  });
});
