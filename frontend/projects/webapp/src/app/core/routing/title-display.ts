import { Injectable, inject, afterNextRender, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import {
  filter,
  startWith,
  distinctUntilChanged,
  tap,
  switchMap,
} from 'rxjs/operators';
import { Subject } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Lightweight class that exposes the current page title as a signal.
 * Works in conjunction with PulpeTitleStrategy for consistent title management.
 * This class only provides read access to the current title for template binding.
 *
 * Note: Due to Angular's intentional timing (NavigationEnd fires before title update),
 * we use afterNextRender to ensure proper synchronization with the DOM title.
 */
@Injectable({
  providedIn: 'root',
})
export class TitleDisplay {
  readonly #browserTitle = inject(Title);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);

  private readonly APP_NAME = 'Pulpe';
  private readonly SEPARATOR = ' • ';

  // Subject to emit when title is updated after render
  readonly #titleUpdated$ = new Subject<string>();

  /**
   * Signal that provides the current page title (without the app name).
   * Updates automatically when navigation occurs.
   *
   * Uses afterNextRender to handle Angular's intentional timing where NavigationEnd
   * fires before the title is actually updated in the DOM.
   */
  readonly currentTitle = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      tap(() => this.#scheduleAfterRenderTitleUpdate()),
      switchMap(() => this.#titleUpdated$),
      startWith(this.#extractPageTitleFromBrowser()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /**
   * Extracts just the page title part from the full browser title.
   * Handles the format: "Page Title • Pulpe" -> "Page Title"
   */
  #extractPageTitleFromBrowser(): string {
    const fullTitle = this.#browserTitle.getTitle();

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

  /**
   * Schedules title extraction after the next render cycle.
   * This ensures the browser title is read after Angular's TitleStrategy has updated the DOM.
   * Uses Angular's afterNextRender for proper lifecycle integration.
   */
  #scheduleAfterRenderTitleUpdate(): void {
    afterNextRender(
      () => {
        const title = this.#extractPageTitleFromBrowser();
        this.#titleUpdated$.next(title);
      },
      { injector: this.#injector },
    );
  }
}
