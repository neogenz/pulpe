export const POSTHOG_PERSON_DELETION_PORT = Symbol(
  'POSTHOG_PERSON_DELETION_PORT',
);

export type PostHogDeletionReason = 'disabled' | 'http_error' | 'timeout';

export type PostHogDeletionResult =
  | { ok: true; statusCode: number }
  | { ok: false; reason: PostHogDeletionReason; statusCode?: number };

export interface PostHogPersonDeletionPort {
  deletePerson(distinctId: string): Promise<PostHogDeletionResult>;
}
