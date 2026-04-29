import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

/**
 * Reloads the current page. Indirected through DI so tests can stub the
 * effect without touching `window.location`.
 *
 * **Used by**:
 * - `core/lifecycle/resume-refresh.service.ts` — hard reload fallback when
 *   soft refresh after resume fails or auth never resolves.
 * - `core/routing/navigation-error-handler.ts` — chunk reload recovery when
 *   a stale lazy chunk hash no longer exists on the server (post-deploy).
 *
 * Keep the factory minimal — anything more elaborate (cooldown, telemetry)
 * belongs in the caller, not in the token, so each consumer keeps its own
 * policy.
 */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.defaultView?.location.reload();
  },
});
