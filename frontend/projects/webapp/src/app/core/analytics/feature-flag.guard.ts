import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanMatchFn, Router } from '@angular/router';
import { ROUTES } from '@core/routing';
import { filter, firstValueFrom, race, timer } from 'rxjs';
import { PostHogService } from './posthog';

// A deep link can land before PostHog has resolved the flags.
const FLAGS_WAIT_MS = 3000;

/** Keeps a flagged route closed to anyone the flag is off for, typed URL included. */
export function featureFlagGuard(flag: string): CanMatchFn {
  return async () => {
    const postHog = inject(PostHogService);
    const dashboard = inject(Router).createUrlTree(['/', ROUTES.DASHBOARD]);

    if (
      !postHog.isFeatureEnabled(flag) &&
      postHog.flagsVersion() === 0 &&
      postHog.isEnabled() &&
      postHog.diagnosticSharingEnabled()
    ) {
      await firstValueFrom(
        race(
          toObservable(postHog.flagsVersion).pipe(filter((v) => v > 0)),
          timer(FLAGS_WAIT_MS),
        ),
      );
    }
    return postHog.isFeatureEnabled(flag) ? true : dashboard;
  };
}
