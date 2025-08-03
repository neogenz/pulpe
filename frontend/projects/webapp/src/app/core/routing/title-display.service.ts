import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith, distinctUntilChanged } from 'rxjs/operators';
import { merge } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TitleChangeNotifier } from './title-change-notifier';

/**
 * Lightweight service that exposes the current page title as a signal.
 * Works in conjunction with PulpeTitleStrategy for consistent title management.
 * This service only provides read access to the current title for template binding.
 */
@Injectable({
  providedIn: 'root',
})
export class TitleDisplayService {
  readonly #browserTitle = inject(Title);
  readonly #router = inject(Router);
  readonly #titleChangeNotifier = inject(TitleChangeNotifier);

  private readonly APP_NAME = 'Pulpe';
  private readonly SEPARATOR = ' • ';

  /**
   * Signal that provides the current page title (without the app name).
   * Updates automatically when navigation occurs or when titles are changed programmatically.
   */
  readonly currentTitle = toSignal(
    merge(
      // Écoute les navigations pour les mises à jour immédiates
      this.#router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.#extractPageTitleFromBrowser()),
      ),
      // Écoute les notifications de changements programmatiques
      this.#titleChangeNotifier.titleChanged$.pipe(
        map(() => this.#extractPageTitleFromBrowser()),
      ),
    ).pipe(
      startWith(this.#extractPageTitleFromBrowser()),
      distinctUntilChanged(), // Évite les émissions redondantes
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
}
