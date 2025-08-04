import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  RouterStateSnapshot,
  TitleStrategy,
  ActivatedRouteSnapshot,
} from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class PulpeTitleStrategy extends TitleStrategy {
  readonly #title = inject(Title);

  private readonly APP_NAME = 'Pulpe';
  private readonly SEPARATOR = ' • ';

  updateTitle(routerState: RouterStateSnapshot): void {
    const title = this.buildTitle(routerState);

    if (title) {
      const finalTitle = `${title}${this.SEPARATOR}${this.APP_NAME}`;
      this.#title.setTitle(finalTitle);
    } else {
      this.#title.setTitle(this.APP_NAME);
    }
  }

  /**
   * Allows components to programmatically set titles while maintaining consistent format.
   * Used for dynamic titles that cannot be set via routing (e.g., from API data).
   */
  setTitle(title: string): void {
    const finalTitle = `${title}${this.SEPARATOR}${this.APP_NAME}`;
    this.#title.setTitle(finalTitle);
  }

  override buildTitle(snapshot: RouterStateSnapshot): string | undefined {
    const titles = this.collectTitles(snapshot.root);
    return titles.length > 0 ? titles[titles.length - 1] : undefined;
  }

  private collectTitles(route: ActivatedRouteSnapshot): string[] {
    const titles: string[] = [];
    this.traverseRoute(route, titles);
    return titles;
  }

  private traverseRoute(route: ActivatedRouteSnapshot, titles: string[]): void {
    if (route.data?.['title']) {
      const resolvedTitle = this.resolveTitle(route.data['title'], route);
      titles.push(resolvedTitle);
    }

    if (route.title) {
      const resolvedTitle = this.resolveTitle(route.title, route);
      titles.push(resolvedTitle);
    }

    route.children.forEach((child) => {
      this.traverseRoute(child, titles);
    });
  }

  private resolveTitle(title: string, route: ActivatedRouteSnapshot): string {
    return title.replace(/\{\{(\w+)\}\}/g, (match, parameterName) => {
      const parameterValue = route.params[parameterName];
      return parameterValue || match;
    });
  }
}
