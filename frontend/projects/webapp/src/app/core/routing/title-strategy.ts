import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  type RouterStateSnapshot,
  TitleStrategy,
  type ActivatedRouteSnapshot,
} from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({
  providedIn: 'root',
})
export class PulpeTitleStrategy extends TitleStrategy {
  readonly #title = inject(Title);
  readonly #transloco = inject(TranslocoService);

  readonly #APP_NAME = 'Pulpe';
  readonly #SEPARATOR = ' • ';

  updateTitle(routerState: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(routerState);

    if (titleKey) {
      const translated = this.#transloco.translate(titleKey);
      const finalTitle = `${translated}${this.#SEPARATOR}${this.#APP_NAME}`;
      this.#title.setTitle(finalTitle);
    } else {
      this.#title.setTitle(this.#APP_NAME);
    }
  }

  /**
   * Allows components to programmatically set titles while maintaining consistent format.
   * Used for dynamic titles that cannot be set via routing (e.g., from API data).
   */
  setTitle(title: string): void {
    const finalTitle = `${title}${this.#SEPARATOR}${this.#APP_NAME}`;
    this.#title.setTitle(finalTitle);
  }

  override buildTitle(snapshot: RouterStateSnapshot): string | undefined {
    const titles = this.#collectTitles(snapshot.root);
    return titles.length > 0 ? titles[titles.length - 1] : undefined;
  }

  #collectTitles(route: ActivatedRouteSnapshot): string[] {
    const titles: string[] = [];
    this.#traverseRoute(route, titles);
    return titles;
  }

  #traverseRoute(route: ActivatedRouteSnapshot, titles: string[]): void {
    if (route.data?.['title']) {
      titles.push(route.data['title']);
    }

    if (route.title) {
      titles.push(route.title);
    }

    route.children.forEach((child) => {
      this.#traverseRoute(child, titles);
    });
  }
}
