import { Injectable, inject } from '@angular/core';
import { Title as BrowserTitle } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class Title {
  readonly #title = inject(BrowserTitle);
  readonly #router = inject(Router);
  readonly #activatedRoute = inject(ActivatedRoute);

  private readonly APP_NAME = 'Pulpe';
  private readonly SEPARATOR = ' • ';

  readonly currentTitle = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.extractCurrentRouteTitle()),
    ),
    { initialValue: '' },
  );

  setTitle(title: string): void {
    this.#title.setTitle(`${title}${this.SEPARATOR}${this.APP_NAME}`);
  }

  private extractCurrentRouteTitle(): string {
    let currentRoute: ActivatedRoute | null = this.#activatedRoute.root;
    let title = '';
    let titleRoute: ActivatedRoute | null = null;

    while (currentRoute) {
      if (currentRoute.snapshot.data?.['title']) {
        title = currentRoute.snapshot.data['title'];
        titleRoute = currentRoute;
      }
      if (currentRoute.snapshot.title) {
        title = currentRoute.snapshot.title;
        titleRoute = currentRoute;
      }

      currentRoute = currentRoute.firstChild;
    }

    const parameters = titleRoute?.snapshot.params || {};
    return this.resolveParameters(title, parameters);
  }

  private resolveParameters(
    title: string,
    parameters: Record<string, string>,
  ): string {
    return title.replace(/\{\{(\w+)\}\}/g, (match, parameterName) => {
      return parameters[parameterName] || match;
    });
  }
}
