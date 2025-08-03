import { Injectable, inject } from '@angular/core';
import { Title as BrowserTitle } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class Title {
  readonly #title = inject(BrowserTitle);
  readonly #router = inject(Router);

  private readonly APP_NAME = 'Pulpe';
  private readonly SEPARATOR = ' • ';

  readonly currentTitle = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.extractTitleFromRoute()),
      startWith(this.extractTitleFromRoute()),
    ),
    { initialValue: this.extractTitleFromRoute() },
  );

  setTitle(title: string): void {
    this.#title.setTitle(`${title}${this.SEPARATOR}${this.APP_NAME}`);
  }

  private extractTitleFromRoute(): string {
    // Navigate through the route tree to find the deepest route with a title
    let route = this.#router.routerState.root;
    let title = '';

    while (route) {
      // Check for title in route snapshot
      if (route.snapshot.title) {
        title = route.snapshot.title;
      }
      // Check for title in route data
      else if (route.snapshot.data?.['title']) {
        title = route.snapshot.data['title'];
      }

      // Move to the first child if it exists
      if (route.firstChild) {
        route = route.firstChild;
      } else {
        break;
      }
    }

    return title;
  }

  private extractTitleFromBrowser(): string {
    const fullTitle = this.#title.getTitle();

    // If the title contains our separator, extract just the page title part
    if (fullTitle.includes(this.SEPARATOR)) {
      return fullTitle.split(this.SEPARATOR)[0];
    }

    // If it's just the app name, return empty string for page title
    if (fullTitle === this.APP_NAME) {
      return '';
    }

    // Otherwise return the full title
    return fullTitle;
  }
}
