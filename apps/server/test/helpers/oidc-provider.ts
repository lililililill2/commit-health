import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import * as oidc from 'openid-client';

export const TEST_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const TEST_CLIENT_SECRET = 'test-only-not-a-real-secret';
export const TEST_CALLBACK = 'http://localhost:8080/api/auth/google/callback';

interface IssuedCode {
  nonce: string;
  challenge: string;
  sub: string;
  claims: Record<string, unknown>;
  badSignature: boolean;
}

// HTTPS Google metadata with a local fetch implementation. No network or real credentials are used.
export class TestOidcProvider {
  readonly configuration: oidc.Configuration;
  tokenRequests = 0;
  keyRequests = 0;
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly codes = new Map<string, IssuedCode>();

  constructor() {
    this.configuration = new oidc.Configuration(
      {
        issuer: 'https://accounts.google.com',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      },
      TEST_CLIENT_ID,
      { client_secret: TEST_CLIENT_SECRET },
      oidc.ClientSecretPost(TEST_CLIENT_SECRET),
    );
    oidc.enableNonRepudiationChecks(this.configuration);
    this.configuration[oidc.customFetch] = (input, init) => {
      const url = String(input);
      if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
        this.keyRequests++;
        return Promise.resolve(
          Response.json({
            keys: [
              {
                ...this.keys.publicKey.export({ format: 'jwk' }),
                kid: 'local-test-key',
                alg: 'RS256',
                use: 'sig',
              },
            ],
          }),
        );
      }
      if (url !== 'https://oauth2.googleapis.com/token')
        throw new Error('Unexpected test provider endpoint');
      this.tokenRequests++;
      const body = new URLSearchParams(init?.body as string);
      const issued = this.codes.get(body.get('code') ?? '');
      this.codes.delete(body.get('code') ?? '');
      if (
        !issued ||
        body.get('client_id') !== TEST_CLIENT_ID ||
        body.get('client_secret') !== TEST_CLIENT_SECRET ||
        body.get('redirect_uri') !== TEST_CALLBACK ||
        createHash('sha256')
          .update(body.get('code_verifier') ?? '')
          .digest('base64url') !== issued.challenge
      ) {
        return Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 }));
      }
      const now = Math.floor(Date.now() / 1_000);
      const payload = {
        iss: 'https://accounts.google.com',
        aud: TEST_CLIENT_ID,
        sub: issued.sub,
        iat: now,
        exp: now + 300,
        nonce: issued.nonce,
        ...issued.claims,
      };
      const unsigned = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'local-test-key' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
      let signature = sign('RSA-SHA256', Buffer.from(unsigned), this.keys.privateKey).toString(
        'base64url',
      );
      if (issued.badSignature) signature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      return Promise.resolve(
        Response.json({
          access_token: 'discarded-test-access-token',
          token_type: 'Bearer',
          expires_in: 300,
          id_token: `${unsigned}.${signature}`,
        }),
      );
    };
  }

  callback(
    authorizationUrl: string,
    sub: string,
    claims: Record<string, unknown> = {},
    badSignature = false,
  ): URL {
    const authorization = new URL(authorizationUrl);
    const code = randomUUID();
    this.codes.set(code, {
      sub,
      nonce: authorization.searchParams.get('nonce')!,
      challenge: authorization.searchParams.get('code_challenge')!,
      claims,
      badSignature,
    });
    const callback = new URL(TEST_CALLBACK);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', authorization.searchParams.get('state')!);
    return callback;
  }
}
