import { Service, signal, type TemplateRef } from '@angular/core';

/**
 * Page → app-shell channel for a bottom action bar (mirrors the {@link
 * BreadcrumbState} page→layout pattern). A routed page projects a `TemplateRef`
 * here; `MainLayout` renders it as a sibling of `<main>` so the bar spans the
 * panel full-width and stays pinned to the bottom — like the sticky top toolbar,
 * without the page needing to break out of the scroll container with
 * absolute/fixed positioning.
 *
 * The slot holds at most one bar at a time. A page `set()`s its template while
 * relevant and `clear()`s it on teardown (or when the bar should hide).
 */
@Service()
export class PageActionBar {
  /** The bar currently projected into the shell slot, or `null` when none. */
  readonly template = signal<TemplateRef<unknown> | null>(null);

  set(template: TemplateRef<unknown>): void {
    this.template.set(template);
  }

  clear(): void {
    this.template.set(null);
  }
}
