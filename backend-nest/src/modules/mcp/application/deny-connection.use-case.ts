import { Inject, Injectable } from '@nestjs/common';
import {
  OAUTH_AUTHORIZATION_PORT,
  type OAuthAuthorizationPort,
} from '../domain/ports/oauth-authorization.port';

/** Refusal keeps nothing: the authorization server answers the client with an OAuth error. */
@Injectable()
export class DenyConnectionUseCase {
  constructor(
    @Inject(OAUTH_AUTHORIZATION_PORT)
    private readonly authorizations: OAuthAuthorizationPort,
  ) {}

  /** @returns the URL the browser must be sent back to (carries `error=access_denied`). */
  execute(authorizationId: string, accessToken: string): Promise<string> {
    return this.authorizations.deny(authorizationId, accessToken);
  }
}
