import { provideAppInitializer, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { filter, race, take, timer } from 'rxjs';

const SPLASH_TIMEOUT_MS = 15_000;

function removeSplash(): void {
  requestAnimationFrame(() => {
    document.getElementById('pulpe-splash')?.remove();
  });
}

export function provideSplashRemoval() {
  return provideAppInitializer(() => {
    const routerReady$ = inject(Router).events.pipe(
      filter(
        (e) =>
          e instanceof NavigationEnd ||
          e instanceof NavigationError ||
          e instanceof NavigationCancel,
      ),
      take(1),
    );

    race(routerReady$, timer(SPLASH_TIMEOUT_MS))
      .pipe(take(1))
      .subscribe({
        next: () => removeSplash(),
        error: () => removeSplash(),
      });
  });
}
