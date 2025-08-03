import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Service lightweight pour notifier les changements de titre programmatiques.
 * Évite les dépendances circulaires entre TitleDisplayService et PulpeTitleStrategy.
 */
@Injectable({
  providedIn: 'root',
})
export class TitleChangeNotifier {
  readonly #titleChanged$ = new Subject<void>();

  /**
   * Observable qui émet quand le titre est changé programmatiquement
   */
  readonly titleChanged$ = this.#titleChanged$.asObservable();

  /**
   * Notifie qu'un changement de titre programmatique a eu lieu
   */
  notifyTitleChanged(): void {
    this.#titleChanged$.next();
  }
}
