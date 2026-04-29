import { provideAppInitializer, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { filter, map, race, take, timer } from 'rxjs';
import { AuthStateService } from './auth/auth-state.service';
import { SessionResumeRecoveryService } from './lifecycle/session-resume-recovery.service';
import { Logger } from './logging/logger';

const SPLASH_TIMEOUT_MS = 15_000;

function removeSplash(): void {
  requestAnimationFrame(() => {
    document.getElementById('pulpe-splash')?.remove();
  });
}

export function splashRemovalInitializer(): void {
  const router = inject(Router);
  const authState = inject(AuthStateService);
  const recovery = inject(SessionResumeRecoveryService);
  const logger = inject(Logger);

  const routerReady$ = router.events.pipe(
    filter(
      (e) =>
        e instanceof NavigationEnd ||
        e instanceof NavigationError ||
        e instanceof NavigationCancel,
    ),
    take(1),
  );

  race(
    routerReady$.pipe(map(() => 'router' as const)),
    timer(SPLASH_TIMEOUT_MS).pipe(map(() => 'timeout' as const)),
  )
    .pipe(take(1))
    .subscribe({
      next: (result) => {
        if (result === 'timeout' && authState.isLoading()) {
          logger.warn(
            '[SplashRemoval] Timeout fired while auth still loading, forcing reload',
          );
          recovery.forceReloadOnSplashTimeout();
          return;
        }
        removeSplash();
      },
      error: () => removeSplash(),
    });
}

export function provideSplashRemoval() {
  return provideAppInitializer(splashRemovalInitializer);
}
