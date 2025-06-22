import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router, ActivatedRoute, UrlTree } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

export interface BreadcrumbItem {
  readonly label: string;
  readonly url: string;
  readonly icon?: string;
  readonly isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbState {
  readonly #router = inject(Router);
  readonly #activatedRoute = inject(ActivatedRoute);

  // Le signal est privé pour contrôler les écritures, exposé via un signal calculé ou une méthode.
  // Ici, nous le laissons public readonly pour correspondre à l'original.
  readonly breadcrumbs = toSignal(
    this.#router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null), // Déclenche la construction initiale au démarrage
      map(() => this.#buildBreadcrumbs()),
      // distinctUntilChanged n'est plus nécessaire car toSignal le fait par défaut avec une comparaison d'égalité.
      // Si une comparaison profonde est toujours souhaitée, on peut l'ajouter via `computed` ou le garder ici.
    ),
    { initialValue: [] },
  );

  /**
   * Construit le fil d'Ariane en parcourant la hiérarchie des routes de manière fonctionnelle.
   */
  #buildBreadcrumbs(): BreadcrumbItem[] {
    try {
      // 1. Obtenir la chaîne complète des routes, de la racine à la feuille active.
      const routeChain = this.#getRouteChain(this.#activatedRoute.root);

      // 2. Utiliser `reduce` pour construire le chemin et les éléments du fil d'Ariane en un seul passage.
      const breadcrumbs = routeChain.reduce(
        (acc, route) => {
          const breadcrumbLabel = route.snapshot.data?.['breadcrumb'];

          // 1. Accumuler les segments de chemin pour former le chemin complet jusqu'à cette route
          const routeUrlSegments = route.snapshot.url.map(
            (segment) => segment.path,
          );
          // Important: créer un nouveau tableau pour l'immutabilité
          const newPath = [...acc.currentPath, ...routeUrlSegments];

          // 2. Ajouter au breadcrumb seulement si la route a un label et n'est pas une route wrapper vide
          if (breadcrumbLabel && route.snapshot.routeConfig?.path !== '') {
            // 3. Déléguer la création et la sérialisation de l'URL au Router
            const urlTree: UrlTree = this.#router.createUrlTree(newPath);
            const url: string = this.#router.serializeUrl(urlTree);

            acc.items.push({
              label: breadcrumbLabel,
              icon: route.snapshot.data?.['icon'],
              url: url || '/',
              isActive: false,
            });
          }

          // 4. Passer le chemin mis à jour à la prochaine itération
          return { currentPath: newPath, items: acc.items };
        },
        { currentPath: [] as string[], items: [] as BreadcrumbItem[] },
      );

      // 3. Marquer le dernier élément comme actif.
      if (breadcrumbs.items.length > 0) {
        const lastIndex = breadcrumbs.items.length - 1;
        const lastItem = breadcrumbs.items[lastIndex];
        breadcrumbs.items[lastIndex] = { ...lastItem, isActive: true };
      }

      return breadcrumbs.items;
    } catch (error) {
      console.warn("Erreur lors de la construction du fil d'Ariane:", error);
      return [];
    }
  }

  /**
   * Retourne un tableau plat de toutes les routes actives, de la racine jusqu'au dernier enfant.
   */
  #getRouteChain(route: ActivatedRoute | null): ActivatedRoute[] {
    const chain: ActivatedRoute[] = [];
    let currentRoute = route;
    while (currentRoute) {
      chain.push(currentRoute);
      currentRoute = currentRoute.firstChild;
    }
    return chain;
  }
}
