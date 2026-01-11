import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, shareReplay, startWith } from 'rxjs/operators';
import { PulpeBreadcrumb } from '@ui/breadcrumb/breadcrumb';
import { BreadcrumbState } from '@core/routing/breadcrumb-state';
import { AuthApi } from '@core/auth/auth-api';
import { ROUTES } from '@core/routing/routes-constants';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LoadingIndicator } from '@core/loading/loading-indicator';
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
                class="flex flex-col items-center mb-3 group"
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
          @if (loadingIndicator.isLoading()) {
            <div class="absolute top-0 left-0 right-0">
              <mat-progress-bar
                mode="indeterminate"
                aria-label="Mise à jour en cours"
                data-testid="budget-list-refresh-progress"
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
            <span class="flex-1"></span>

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

          <!-- Breadcrumb -->
          @if (breadcrumbState.breadcrumbs().length > 1) {
            <pulpe-breadcrumb
              class="px-4 py-3"
              [items]="breadcrumbState.breadcrumbs()"
            />
          }

          <!-- Page Content - Scrollable Container -->
          <main
            cdkScrollable
            class="flex-1 overflow-y-auto overflow-x-hidden bg-surface text-on-surface pt-2! min-w-0"
            [class.p-6]="!isHandset()"
            [class.md:p-8]="!isHandset()"
            [class.p-4]="isHandset()"
            data-testid="page-content"
            data-tour="page-content"
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MainLayout {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #router = inject(Router);
  readonly #scrollDispatcher = inject(ScrollDispatcher);
  readonly #authApi = inject(AuthApi);
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
    return this.#authApi.authState().user?.email;
  });

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

  // Scroll detection for header border
  protected isScrolled = toSignal(
    this.#scrollDispatcher.scrolled(100).pipe(
      map((scrollable) => {
        const top = scrollable
          ? scrollable.getElementRef().nativeElement.scrollTop
          : 0;
        return top > 0;
      }),
      startWith(false),
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
      await this.#authApi.signOut();
    } catch (error) {
      // Only log detailed errors in development
      if (!this.#applicationConfig.isProduction()) {
        this.#logger.error('Erreur lors de la déconnexion:', error);
      }
    }

    // Force full page reload to clear all in-memory state (stores, signals, resources)
    // This prevents stale data from previous user from persisting after login
    window.location.href = '/' + ROUTES.LOGIN;
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

    // Force full page reload to clear all in-memory state
    window.location.href = '/' + ROUTES.LOGIN;
  }
}
