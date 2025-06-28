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

  override buildTitle(snapshot: RouterStateSnapshot): string | undefined {
    // Parcourir toutes les routes de l'arbre pour trouver le titre le plus spécifique
    const titles = this.collectTitles(snapshot.root);

    // Retourner le dernier titre trouvé (le plus spécifique)
    return titles.length > 0 ? titles[titles.length - 1] : undefined;
  }

  private collectTitles(route: ActivatedRouteSnapshot): string[] {
    const titles: string[] = [];

    // Parcourir récursivement toutes les routes
    this.traverseRoute(route, titles);

    return titles;
  }

  private traverseRoute(route: ActivatedRouteSnapshot, titles: string[]): void {
    // Vérifier si cette route a un titre
    if (route.data?.['title']) {
      const resolvedTitle = this.resolveTitle(route.data['title'], route);
      titles.push(resolvedTitle);
    }

    // Vérifier si cette route a une propriété title directe
    if (route.title) {
      const resolvedTitle = this.resolveTitle(route.title, route);
      titles.push(resolvedTitle);
    }

    // Parcourir tous les enfants
    route.children.forEach((child) => {
      this.traverseRoute(child, titles);
    });
  }

  private resolveTitle(title: string, route: ActivatedRouteSnapshot): string {
    // Si le titre contient des paramètres (ex: "Modèle {{templateId}}"), les remplacer
    return title.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      const paramValue = route.params[paramName];
      return paramValue || match;
    });
  }
}
