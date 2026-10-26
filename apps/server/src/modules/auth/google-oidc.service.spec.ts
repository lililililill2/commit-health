import { ConfigService } from '@nestjs/config';
import type { Configuration } from 'openid-client';

import { GoogleOidcService } from './google-oidc.service.js';
import { TestOidcProvider, TEST_CALLBACK } from '../../../test/helpers/oidc-provider.js';

class LocalGoogleService extends GoogleOidcService {
  constructor(private readonly provider: TestOidcProvider) {
    super(new ConfigService({ GOOGLE_CALLBACK_URL: TEST_CALLBACK }));
  }
  protected getConfiguration(): Promise<Configuration> {
    return Promise.resolve(this.provider.configuration);
  }
}

describe('Google OIDC verification with signed local provider responses', () => {
  let provider: TestOidcProvider;
  let service: LocalGoogleService;
  beforeEach(() => {
    provider = new TestOidcProvider();
    service = new LocalGoogleService(provider);
  });

  it('requests only openid using state, nonce and S256 PKCE, and verifies the signed ID token', async () => {
    const start = await service.begin();
    const authorization = new URL(start.url);
    expect(authorization.searchParams.get('scope')).toBe('openid');
    expect(authorization.searchParams.get('response_type')).toBe('code');
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    const callback = provider.callback(start.url, 'local-test-sub');
    expect(await service.complete(callback.search, start)).toBe('local-test-sub');
    expect(provider.keyRequests).toBeGreaterThan(0);
  });

  it('rejects incorrect state before contacting the token endpoint', async () => {
    const start = await service.begin();
    const callback = provider.callback(start.url, 'local-test-sub');
    callback.searchParams.set('state', 'incorrect');
    await expect(service.complete(callback.search, start)).rejects.toThrow();
    expect(provider.tokenRequests).toBe(0);
  });

  it('rejects duplicate state and missing authorization code', async () => {
    const start = await service.begin();
    const callback = provider.callback(start.url, 'local-test-sub');
    callback.searchParams.append('state', start.state);
    await expect(service.complete(callback.search, start)).rejects.toThrow();
    await expect(service.complete(`?state=${start.state}`, start)).rejects.toThrow();
  });

  it.each([
    ['nonce', { nonce: 'incorrect' }],
    ['issuer', { iss: 'https://attacker.invalid' }],
    ['audience', { aud: 'another-client' }],
    ['expiry', { exp: 1 }],
    ['subject', { sub: '' }],
  ])('rejects invalid %s', async (_name, claims) => {
    const start = await service.begin();
    const callback = provider.callback(start.url, 'local-test-sub', claims);
    await expect(service.complete(callback.search, start)).rejects.toThrow();
  });

  it('rejects an invalid ID token signature', async () => {
    const start = await service.begin();
    const callback = provider.callback(start.url, 'local-test-sub', {}, true);
    await expect(service.complete(callback.search, start)).rejects.toThrow();
  });

  it('rejects a mismatched PKCE verifier', async () => {
    const start = await service.begin();
    const callback = provider.callback(start.url, 'local-test-sub');
    await expect(
      service.complete(callback.search, { ...start, codeVerifier: 'incorrect-verifier' }),
    ).rejects.toThrow();
  });

  it('handles provider denial without accepting an identity', async () => {
    const start = await service.begin();
    await expect(
      service.complete(`?error=access_denied&state=${start.state}`, start),
    ).rejects.toThrow();
  });

  it('does not start authentication without credentials', async () => {
    await expect(new GoogleOidcService(new ConfigService()).begin()).rejects.toThrow(
      'not configured',
    );
  });
});
