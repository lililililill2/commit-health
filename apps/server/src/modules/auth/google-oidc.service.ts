import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oidc from 'openid-client';

import { equalToken } from './auth.service.js';

export interface OAuthChecks {
  state: string;
  nonce: string;
  codeVerifier: string;
}

@Injectable()
export class GoogleOidcService {
  private configuration?: Promise<oidc.Configuration>;
  constructor(private readonly config: ConfigService) {}

  protected getConfiguration(): Promise<oidc.Configuration> {
    if (!this.configuration) {
      const id = this.config.get<string>('GOOGLE_CLIENT_ID');
      const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
      if (!id || !secret) throw new ServiceUnavailableException('Google login is not configured');
      this.configuration = oidc
        .discovery(
          new URL('https://accounts.google.com'),
          id,
          { client_secret: secret },
          oidc.ClientSecretPost(secret),
          {
            timeout: 10,
            execute: [oidc.enableNonRepudiationChecks],
          },
        )
        .catch(() => {
          this.configuration = undefined;
          throw new ServiceUnavailableException('Google login is unavailable');
        });
    }
    return this.configuration;
  }

  async begin(): Promise<OAuthChecks & { url: string }> {
    const configuration = await this.getConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: 'openid',
      response_type: 'code',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  async complete(query: string, checks: OAuthChecks): Promise<string> {
    const url = new URL(this.config.getOrThrow<string>('GOOGLE_CALLBACK_URL'));
    if (query.length > 8_192) throw new UnauthorizedException('Invalid OAuth response');
    url.search = query;
    const states = url.searchParams.getAll('state');
    if (states.length !== 1 || !equalToken(states[0], checks.state))
      throw new UnauthorizedException('Invalid OAuth response');
    const tokens = await oidc.authorizationCodeGrant(await this.getConfiguration(), url, {
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      pkceCodeVerifier: checks.codeVerifier,
      idTokenExpected: true,
    });
    const sub = tokens.claims()?.sub;
    if (typeof sub !== 'string' || !sub || sub.length > 255)
      throw new UnauthorizedException('Invalid identity');
    // OAuth/ID tokens are intentionally discarded. Google APIs are not used.
    return sub;
  }
}
