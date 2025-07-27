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
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { NavigationMenu } from './navigation-menu';
import { PulpeBreadcrumb } from '@ui/breadcrumb/breadcrumb';
import { BreadcrumbState } from '@core/routing/breadcrumb-state';
import { AuthApi } from '@core/auth/auth-api';
import { ROUTES } from '@core/routing/routes-constants';

@Component({
  selector: 'pulpe-main-layout',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
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
        @defer {
          <pulpe-navigation-menu
            class="md:pt-4 md:pb-4 md:pl-4 h-full"
            (navItemClick)="onNavItemClick()"
          />
        }
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
            <button
              type="button"
              mat-button
              [matMenuTriggerFor]="userMenu"
              class="toolbar-logo-button !min-w-0 !p-2 !rounded-full"
              aria-label="Menu utilisateur"
              data-testid="user-menu-trigger"
            >
              <div
                class="size-8 pulpe-gradient rounded-full toolbar-logo"
              ></div>
            </button>

            <mat-menu #userMenu="matMenu" xPosition="before">
              <button
                mat-menu-item
                (click)="onLogout()"
                data-testid="logout-button"
              >
                <mat-icon matMenuItemIcon>logout</mat-icon>
                <span>Se déconnecter</span>
              </button>
            </mat-menu>
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

      .toolbar-logo-button {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        --mat-mdc-button-persistent-ripple-color: transparent;
      }

      .toolbar-logo-button:hover .toolbar-logo {
        transform: scale(1.05);
        transition: transform 0.2s ease-in-out;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #authApi = inject(AuthApi);
  readonly #router = inject(Router);
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

  async onLogout(): Promise<void> {
    try {
      await this.#authApi.signOut();
      await this.#router.navigate([ROUTES.LOGIN]);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }
}
