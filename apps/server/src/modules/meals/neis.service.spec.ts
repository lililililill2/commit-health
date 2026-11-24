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
});
