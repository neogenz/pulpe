import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  signal,
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
import { PulpeBreadcrumb } from '../ui/breadcrumb/breadcrumb';
import { BreadcrumbState } from '../core/routing/breadcrumb-state';
import { AuthApi } from '../core/auth/auth-api';
import { ROUTES } from '../core/routing/routes-constants';
import { environment } from '../../environments/environment';

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
              class="toolbar-logo-button"
              [attr.aria-label]="
                isLoggingOut() ? 'Déconnexion en cours...' : 'Menu utilisateur'
              "
              [disabled]="isLoggingOut()"
              data-testid="user-menu-trigger"
            >
              <div
                class="pulpe-gradient rounded-full toolbar-logo"
                [class.opacity-50]="isLoggingOut()"
              ></div>
            </button>

            <mat-menu #userMenu="matMenu" xPosition="before">
              <button
                mat-menu-item
                (click)="onLogout()"
                [disabled]="isLoggingOut()"
                [attr.aria-label]="
                  isLoggingOut()
                    ? 'Déconnexion en cours, veuillez patienter'
                    : 'Se déconnecter de votre compte'
                "
                data-testid="logout-button"
              >
                <mat-icon matMenuItemIcon [attr.aria-hidden]="true">
                  @if (isLoggingOut()) {
                    hourglass_top
                  } @else {
                    logout
                  }
                </mat-icon>
                <span>
                  @if (isLoggingOut()) {
                    Déconnexion...
                  } @else {
                    Se déconnecter
                  }
                </span>
              </button>
            </mat-menu>

            <!-- Accessibility: Screen reader feedback for logout state -->
            <div class="sr-only" aria-live="polite" aria-atomic="true">
              @if (isLoggingOut()) {
                Déconnexion en cours, veuillez patienter...
              }
            </div>
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

      mat-toolbar .toolbar-logo-button.mat-mdc-button {
        width: 44px;
        height: 44px;
        min-width: 44px;
        padding: 8px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        --mat-mdc-button-persistent-ripple-color: transparent;
        --mdc-text-button-container-shape: 50%;
        transition: opacity 0.2s ease-in-out;
      }

      mat-toolbar
        .toolbar-logo-button.mat-mdc-button:hover:not(:disabled)
        .toolbar-logo {
        transform: scale(1.05);
      }

      mat-toolbar .toolbar-logo-button.mat-mdc-button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .toolbar-logo {
        width: 32px;
        height: 32px;
        transition:
          transform 0.2s ease-in-out,
          opacity 0.2s ease-in-out;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
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

  // State for logout process
  readonly #isLoggingOut = signal<boolean>(false);
  readonly isLoggingOut = this.#isLoggingOut.asReadonly();

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
    if (this.#isLoggingOut()) return;

    try {
      this.#isLoggingOut.set(true);

      // Sign out and wait for session to be cleared
      await this.#authApi.signOut();

      // Add a small delay to ensure auth state has been updated
      // This prevents race conditions with the auth state change
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.#router.navigate([ROUTES.LOGIN]);
    } catch (error) {
      // Only log detailed errors in development
      if (!environment.production) {
        console.error('Erreur lors de la déconnexion:', error);
      }

      // Always navigate to login on error to ensure user is signed out
      try {
        await this.#router.navigate([ROUTES.LOGIN]);
      } catch (navError) {
        if (!environment.production) {
          console.error('Erreur lors de la navigation vers login:', navError);
        }
      }
    } finally {
      this.#isLoggingOut.set(false);
    }
  }
}
