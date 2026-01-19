import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStateService } from '@core/auth/auth-state.service';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { Logger } from '@core/logging/logger';
import { BreadcrumbState } from '@core/routing/breadcrumb-state';
import { ROUTES } from '@core/routing/routes-constants';
import { PulpeBreadcrumb } from '@ui/breadcrumb/breadcrumb';
import { of } from 'rxjs';
import { delay, filter, map, shareReplay, switchMap } from 'rxjs/operators';
import { AboutDialog } from './about-dialog';

interface NavigationItem {
  readonly route: string;
  readonly label: string;
  readonly icon: string;
  readonly tooltip?: string;
}

@Component({
  selector: 'pulpe-main-layout',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    PulpeBreadcrumb,
    MatProgressBarModule,
  ],
  template: `
    <mat-sidenav-container class="h-dvh bg-surface-container!">
      <!-- Navigation Sidenav -->
      <mat-sidenav
        #drawer
        class="bg-surface-container!"
        [class.!w-auto]="!isHandset()"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
        [fixedInViewport]="isHandset()"
        [fixedTopGap]="isHandset() ? 0 : 64"
      >
        <!-- Sidenav Header -->
        @if (isHandset()) {
          <div class="py-4 px-6 flex items-center gap-3">
            <div class="w-10 h-10 pulpe-gradient rounded-full"></div>
            <span class="text-lg font-medium text-on-surface">Pulpe</span>
          </div>
        } @else {
          <!-- Rail Mode Header -->
          <div class="py-6 flex justify-center items-center">
            <div class="w-10 h-10 pulpe-gradient rounded-full"></div>
          </div>
        }

        <!-- Navigation List -->
        @if (isHandset()) {
          <!-- Mobile: Full navigation list -->
          <mat-nav-list class="pt-4 px-2!" data-testid="mobile-navigation">
            @for (item of navigationItems; track item.route) {
              <a
                mat-list-item
                [routerLink]="item.route"
                routerLinkActive
                #rla="routerLinkActive"
                [activated]="rla.isActive"
                [class.pointer-events-none]="isNavigating()"
                [class.opacity-50]="isNavigating()"
                (click)="closeDrawerOnMobile(drawer)"
              >
                <mat-icon matListItemIcon [class.icon-filled]="rla.isActive">{{
                  item.icon
                }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
          </mat-nav-list>
        } @else {
          <!-- Desktop: Material 3 Navigation Rail -->
          <nav
            class="pt-4 px-3"
            data-testid="desktop-navigation"
            data-tour="navigation"
          >
            @for (item of navigationItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive
                #rla="routerLinkActive"
                class="flex flex-col items-center mb-3 group transition-opacity"
                [class.pointer-events-none]="isNavigating()"
                [class.opacity-50]="isNavigating()"
                [matTooltip]="item.tooltip || item.label"
                matTooltipPosition="right"
              >
                <div
                  class="w-14 h-8 flex items-center justify-center rounded-full transition-all duration-200"
                  [class.bg-secondary-container]="rla.isActive"
                  [class.text-on-secondary-container]="rla.isActive"
                  [class.text-on-surface-variant]="!rla.isActive"
                  [class.group-hover:bg-surface-container-highest]="
                    !rla.isActive
                  "
                >
                  <mat-icon
                    class="text-2xl transition-all duration-200 transform"
                    [class.icon-filled]="rla.isActive"
                    [class.group-hover:icon-filled]="!rla.isActive"
                    [class.group-hover:scale-110]="!rla.isActive"
                    >{{ item.icon }}</mat-icon
                  >
                </div>
                <span
                  class="text-xs font-medium text-center leading-tight mt-1 max-w-full"
                  [class.text-on-surface]="rla.isActive"
                  [class.text-on-surface-variant]="!rla.isActive"
                >
                  {{ item.label }}
                </span>
              </a>
            }
          </nav>
        }
      </mat-sidenav>

      <!-- Main Content -->
      <mat-sidenav-content
        class="flex flex-col h-full overflow-hidden max-w-full"
        [class.p-2]="!isHandset()"
        data-testid="main-content"
      >
        <div
          class="flex flex-col h-full bg-surface relative overflow-hidden min-w-0"
          [class.p-2]="!isHandset()"
          [class.rounded-xl]="!isHandset()"
        >
          @if (loadingIndicator.isLoading() || isNavigating()) {
            <div class="absolute top-0 left-0 right-0">
              <mat-progress-bar
                mode="indeterminate"
                aria-label="Chargement en cours"
                data-testid="loading-progress"
              />
            </div>
          }
          <!-- Demo Mode Banner -->
          @if (isDemoMode()) {
            <div
              [class.-mx-2]="!isHandset()"
              [class.-mt-2]="!isHandset()"
              class="bg-tertiary-container text-on-tertiary-container px-4 py-3 flex items-center justify-between"
              role="alert"
              aria-live="polite"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-tertiary/20 backdrop-blur-sm rounded-full flex justify-center items-center p-2"
                >
                  <mat-icon>science</mat-icon>
                </div>
                <div class="flex flex-col">
                  <span class="text-label-large font-semibold">
                    Mode Démo
                  </span>
                  <span class="text-body-small opacity-80">
                    Vos données seront supprimées après 24h
                  </span>
                </div>
              </div>
              <button
                matButton
                class="hover:bg-tertiary/10! transition-colors"
                (click)="exitDemoMode()"
              >
                <mat-icon>close</mat-icon>
                <span>Quitter</span>
              </button>
            </div>
          }
          <!-- Top App Bar - Fixed Header -->
          <mat-toolbar
            color="primary"
            class="shrink-0"
            [class.rounded-t-xl]="!isHandset()"
            [class.scrolled]="showToolbarShadow()"
          >
            @if (isHandset()) {
              <button
                matIconButton
                (click)="drawer.toggle()"
                aria-label="Toggle navigation"
                data-testid="menu-toggle"
              >
                <mat-icon>menu</mat-icon>
              </button>
            }
            @if (!isHandset() && breadcrumbState.breadcrumbs().length > 1) {
              <div class="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                <pulpe-breadcrumb [items]="breadcrumbState.breadcrumbs()" />
              </div>
            } @else {
              <span class="flex-1"></span>
            }

            <!-- Toolbar Actions -->
            <button
              matButton
              [matMenuTriggerFor]="userMenu"
              [attr.aria-label]="
                isLoggingOut() ? 'Déconnexion en cours...' : 'Menu utilisateur'
              "
              [disabled]="isLoggingOut()"
              data-testid="user-menu-trigger"
            >
              <div class="flex items-center gap-2">
                <mat-icon>person</mat-icon>
                <span class="ph-no-capture max-w-64 truncate">{{
                  userEmail()
                }}</span>
              </div>
            </button>

            <mat-menu #userMenu="matMenu" xPosition="before">
              <a
                mat-menu-item
                [routerLink]="settingsRoute"
                aria-label="Accéder aux paramètres"
                data-testid="settings-link"
              >
                <mat-icon matMenuItemIcon>settings</mat-icon>
                <span>Paramètres</span>
              </a>
              <mat-divider />
              <button
                mat-menu-item
                (click)="openAboutDialog()"
                aria-label="Afficher les informations de l'application"
                data-testid="about-button"
              >
                <mat-icon matMenuItemIcon aria-hidden="true">info</mat-icon>
                <span>À propos</span>
              </button>
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

          <!-- Breadcrumb (mobile only) -->
          @if (isHandset() && breadcrumbState.breadcrumbs().length > 1) {
            <div class="breadcrumb-mobile" [class.scrolled]="isScrolled()">
              <pulpe-breadcrumb
                class="px-4 py-3"
                [items]="breadcrumbState.breadcrumbs()"
              />
            </div>
          }

          <!-- Page Content - Scrollable Container -->
          <main
            class="flex-1 overflow-y-auto overflow-x-hidden bg-surface text-on-surface pt-2! min-w-0"
            [class.p-6]="!isHandset()"
            [class.md:p-8]="!isHandset()"
            [class.p-4]="isHandset()"
            data-testid="page-content"
            data-tour="page-content"
            (scroll)="onScroll($event)"
          >
            <router-outlet />
          </main>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      @use '@angular/material' as mat;

      :host {
        display: block;
        height: 100dvh;
      }

      /*
       * En appliquant la surcharge de style pour les boutons à l'intérieur
       * du sélecteur 'mat-nav-list', nous limitons sa portée aux boutons
       * qui sont DANS la barre d'outils de ce composant uniquement.
       * Cela empêche le style de s'appliquer aux composants dans <router-outlet>.
       */
      :host mat-sidenav {
        @include mat.button-overrides(
          (
            filled-container-shape: 50%,
            outlined-container-shape: 50%,
            text-container-shape: 50%,
            tonal-container-shape: 50%,
          )
        );
      }

      /* Smooth transition for icon fill and scale */
      mat-icon {
        transition:
          font-variation-settings 200ms ease-in-out,
          transform 200ms ease-in-out;
      }

      /* Prevent layout shift on scale */
      .group:hover mat-icon,
      .active mat-icon {
        will-change: transform;
      }

      /* Shadow on scroll - projects onto content below */
      mat-toolbar,
      .breadcrumb-mobile {
        position: relative;
        z-index: 10;
      }

      mat-toolbar.scrolled::after,
      .breadcrumb-mobile.scrolled::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -8px;
        height: 8px;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.08),
          transparent
        );
        pointer-events: none;
        z-index: 10;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MainLayout {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #router = inject(Router);
  readonly #authState = inject(AuthStateService);
  readonly #authSession = inject(AuthSessionService);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #demoModeService = inject(DemoModeService);
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly breadcrumbState = inject(BreadcrumbState);
  readonly #logger = inject(Logger);
  readonly #dialog = inject(MatDialog);
  protected readonly loadingIndicator = inject(LoadingIndicator);
  // Display "Mode Démo" for demo users, otherwise show email
  readonly userEmail = computed(() => {
    if (this.#demoModeService.isDemoMode()) {
      return 'demo@gmail.com';
    }
    return this.#authState.authState().user?.email;
  });

  // Route to settings page
  protected readonly settingsRoute = `/${ROUTES.APP}/${ROUTES.SETTINGS}`;

  // Navigation items configuration
  protected readonly navigationItems: readonly NavigationItem[] = [
    {
      route: ROUTES.CURRENT_MONTH,
      label: 'Ce mois-ci',
      icon: 'today',
      tooltip: 'Suivez vos dépenses du mois',
    },
    {
      route: ROUTES.BUDGET,
      label: 'Budgets',
      icon: 'calendar_month',
      tooltip: 'Planifiez tous vos mois',
    },
    {
      route: ROUTES.BUDGET_TEMPLATES,
      label: 'Modèles',
      icon: 'description',
      tooltip: 'Préparez vos bases mensuelles',
    },
  ] as const;

  // Responsive breakpoint detection
  protected readonly isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );

  // Current route tracking
  readonly #currentRoute = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.#router.url },
  );

  // Current navigation item based on route
  protected readonly currentNavigationItem = computed(() => {
    const url = this.#currentRoute();
    return this.navigationItems.find((item) => url.includes(item.route));
  });

  // Dynamic page title
  protected readonly currentPageTitle = computed(() => {
    const navigationItem = this.currentNavigationItem();
    return navigationItem?.label || 'Pulpe Budget';
  });

  // Scroll detection for toolbar shadow
  protected readonly isScrolled = signal(false);

  protected readonly showToolbarShadow = computed(
    () =>
      this.isScrolled() &&
      (!this.isHandset() || this.breadcrumbState.breadcrumbs().length <= 1),
  );

  protected onScroll(event: Event) {
    const target = event.target as HTMLElement;
    this.isScrolled.set(target.scrollTop > 0);
  }

  // Navigation state for progress bar feedback (debounced to prevent flicker)
  protected readonly isNavigating = toSignal(
    this.#router.events.pipe(
      filter(
        (e) =>
          e instanceof NavigationStart ||
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError,
      ),
      switchMap(
        (e) =>
          e instanceof NavigationStart
            ? of(true).pipe(delay(100)) // Show loader only if navigation > 100ms
            : of(false), // Hide immediately
      ),
    ),
    { initialValue: false },
  );

  // State for logout process
  readonly #isLoggingOut = signal<boolean>(false);
  readonly isLoggingOut = this.#isLoggingOut.asReadonly();

  protected closeDrawerOnMobile(drawer: { close: () => void }): void {
    if (this.isHandset()) {
      drawer.close();
    }
  }

  protected openAboutDialog(): void {
    this.#dialog.open(AboutDialog, {
      width: 'auto',
      maxWidth: '90vw',
    });
  }

  async onLogout(): Promise<void> {
    if (this.#isLoggingOut()) return;

    try {
      this.#isLoggingOut.set(true);

      // Sign out and wait for session to be cleared
      await this.#authSession.signOut();
    } catch (error) {
      // Only log detailed errors in development
      if (!this.#applicationConfig.isProduction()) {
        this.#logger.error('Erreur lors de la déconnexion:', error);
      }
    }

    this.#forceLogoutRedirect();
  }

  /**
   * Reactive signal for demo mode state
   */
  protected readonly isDemoMode = this.#demoModeService.isDemoMode;

  /**
   * Exit demo mode and redirect to login
   */
  protected async exitDemoMode(): Promise<void> {
    try {
      await this.#demoInitializer.exitDemoMode();
    } catch (error) {
      this.#logger.error('Failed to exit demo mode', { error });
    }

    this.#forceLogoutRedirect();
  }

  /**
   * Force redirect to login page with full page reload.
   * Clears all in-memory state (stores, signals, resources).
   */
  #forceLogoutRedirect(): void {
    this.#logger.info('Forcing logout redirect to login page');
    window.location.href = '/' + ROUTES.LOGIN;
  }
}
