import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { NavigationMenu } from './navigation-menu';
import { PulpeBreadcrumb } from '@ui/breadcrumb/breadcrumb';
import { BreadcrumbState } from '@core/routing/breadcrumb-state';

@Component({
  selector: 'pulpe-main-layout',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    NavigationMenu,
    PulpeBreadcrumb,
  ],
  template: `
    <mat-sidenav-container class="h-full">
      <mat-sidenav
        #drawer
        fixedInViewport
        [mode]="sidenavMode()"
        [(opened)]="sidenavOpened"
      >
        <pulpe-navigation-menu
          class="md:pt-4 md:pb-4 md:pl-4 h-full"
          (navItemClick)="onNavItemClick()"
        />
      </mat-sidenav>

      <mat-sidenav-content>
        <div class="flex flex-col h-full">
          <mat-toolbar class="toolbar flex-shrink-0">
            <button
              type="button"
              aria-label="Toggle sidenav"
              mat-icon-button
              (click)="sidenavOpened.set(!sidenavOpened())"
            >
              <mat-icon>menu</mat-icon>
            </button>

            <span class="flex-1"></span>
            <div class="size-8 pulpe-gradient rounded-full toolbar-logo"></div>
          </mat-toolbar>

          <pulpe-breadcrumb
            class="px-4 py-3"
            [items]="breadcrumbState.breadcrumbs()"
          />

          <main class="flex-1 overflow-auto min-h-0">
            <div class="p-4 2xl:h-full">
              <router-outlet />
            </div>
          </main>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly breadcrumbState = inject(BreadcrumbState);

  // Clean signal for breakpoint state
  readonly #isHandset = toSignal(
    this.#breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    {
      initialValue: this.#breakpointObserver.isMatched([
        Breakpoints.Handset,
        Breakpoints.TabletPortrait,
      ]),
    },
  );

  // Computed signal for sidenav mode
  readonly sidenavMode = computed<'side' | 'over'>(() =>
    this.#isHandset() ? 'over' : 'side',
  );

  // Single source of truth for sidenav state
  readonly sidenavOpened = model<boolean>(!this.#isHandset());

  constructor() {
    effect(() => {
      this.sidenavOpened.set(!this.#isHandset());
    });
  }

  onNavItemClick(): void {
    // Auto-close on mobile after navigation
    if (this.#isHandset()) {
      this.sidenavOpened.set(false);
    }
  }
}
