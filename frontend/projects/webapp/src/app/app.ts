import { Component, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, race, take, timer } from 'rxjs';

const SPLASH_TIMEOUT_MS = 15_000;

function removeSplash(): void {
  requestAnimationFrame(() => {
    document.getElementById('pulpe-splash')?.remove();
  });
}

@Component({
  selector: 'pulpe-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    const routerReady$ = inject(Router).events.pipe(
      filter(
        (e) =>
          e instanceof NavigationEnd ||
          e instanceof NavigationError ||
          e instanceof NavigationCancel,
      ),
      take(1),
    );

    race(routerReady$, timer(SPLASH_TIMEOUT_MS)).subscribe(() => {
      removeSplash();
    });
  }
}
