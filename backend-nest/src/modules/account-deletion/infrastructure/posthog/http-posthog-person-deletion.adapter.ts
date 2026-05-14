import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type {
  PostHogDeletionResult,
  PostHogPersonDeletionPort,
} from '../../domain/ports/posthog-person-deletion.port';

const POSTHOG_TIMEOUT_MS = 5000;

/**
 * Calls PostHog's bulk-delete-persons API after a Supabase auth user is
 * deleted (RGPD Art. 17). Requires three env vars — all optional. When any
 * is missing, the adapter is "disabled" and returns silently without HTTP.
 *
 * Auth: Personal API Key with `person:write` scope (NOT a project key),
 * sent as a Bearer token.
 *
 * Endpoint: POST {host}/api/projects/{projectId}/persons/bulk_delete/
 * Docs: https://posthog.com/docs/privacy/data-deletion
 *
 * Fail-soft contract: never throws. Caller must inspect the returned
 * `PostHogDeletionResult` and decide whether to log/escalate.
 */
@Injectable()
export class HttpPostHogPersonDeletionAdapter implements PostHogPersonDeletionPort {
  readonly #config: { apiKey: string; projectId: string; host: string } | null;

  constructor(
    @InjectInfoLogger(HttpPostHogPersonDeletionAdapter.name)
    private readonly logger: InfoLogger,
    configService: ConfigService,
  ) {
    const apiKey = configService.get<string>('POSTHOG_API_KEY');
    const projectId = configService.get<string>('POSTHOG_PROJECT_ID');
    const host = configService.get<string>('POSTHOG_HOST');
    this.#config =
      apiKey && projectId && host ? { apiKey, projectId, host } : null;
  }

  async deletePerson(distinctId: string): Promise<PostHogDeletionResult> {
    if (!this.#config) {
      return { ok: false, reason: 'disabled' };
    }
    return this.#callPostHog(distinctId, this.#config);
  }

  async #callPostHog(
    distinctId: string,
    config: { apiKey: string; projectId: string; host: string },
  ): Promise<PostHogDeletionResult> {
    const url = `${config.host}/api/projects/${config.projectId}/persons/bulk_delete/`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distinct_ids: [distinctId],
          delete_events: true,
          delete_recordings: true,
        }),
        signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
      });

      return this.#mapResponseStatus(response.status, distinctId);
    } catch (error) {
      return this.#mapFetchError(error, distinctId);
    }
  }

  #mapResponseStatus(
    statusCode: number,
    distinctId: string,
  ): PostHogDeletionResult {
    if (statusCode === HttpStatus.OK || statusCode === HttpStatus.ACCEPTED) {
      this.logger.info({ statusCode }, 'PostHog person deletion accepted');
      return { ok: true, statusCode };
    }

    if (statusCode === HttpStatus.NOT_FOUND) {
      this.logger.info(
        { distinctId, statusCode },
        'PostHog person not found — nothing to delete (soft success)',
      );
      return { ok: true, statusCode };
    }

    this.logger.warn(
      { distinctId, statusCode },
      'PostHog bulk_delete returned non-success status',
    );
    return { ok: false, reason: 'http_error', statusCode };
  }

  #mapFetchError(error: unknown, distinctId: string): PostHogDeletionResult {
    if (this.#isAbortError(error)) {
      this.logger.warn(
        { distinctId, timeoutMs: POSTHOG_TIMEOUT_MS },
        'PostHog bulk_delete timed out',
      );
      return { ok: false, reason: 'timeout' };
    }

    this.logger.warn(
      { distinctId, err: error },
      'PostHog bulk_delete network error',
    );
    return { ok: false, reason: 'http_error' };
  }

  #isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const name = (error as { name?: unknown }).name;
    return name === 'AbortError' || name === 'TimeoutError';
  }
}
