import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
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
import {
  ProductTourService,
  type TourPageId,
} from '@core/product-tour/product-tour.service';
import { BreadcrumbState } from '@core/routing/breadcrumb-state';
import { ROUTES } from '@core/routing/routes-constants';
import { PulpeBreadcrumb } from '@ui/breadcrumb/breadcrumb';
import { of } from 'rxjs';
import { delay, filter, map, shareReplay, switchMap } from 'rxjs/operators';
import { AboutDialog } from './about-dialog';
import { LogoutDialog } from './logout-dialog';

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
    <mat-sidenav-container
      class="bg-surface-container!"
      [class.h-dvh]="!isHandset()"
      [class.min-h-dvh]="isHandset()"
    >
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
          <div
            class="py-4 px-6 flex items-center gap-3"
            style="padding-top: max(1rem, env(safe-area-inset-top))"
          >
            <img src="logo.svg" alt="Pulpe" class="w-10 h-auto" />
            <span class="text-lg font-medium text-on-surface">Pulpe</span>
          </div>
        } @else {
          <!-- Rail Mode Header -->
          <div class="py-6 flex justify-center items-center">
            <img src="logo.svg" alt="Pulpe" class="w-10 h-auto" />
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
        class="flex flex-col max-w-full"
        [class.h-full]="!isHandset()"
        [class.overflow-hidden]="!isHandset()"
        [class.p-2]="!isHandset()"
        data-testid="main-content"
      >
        <div
          class="flex flex-col bg-surface relative min-w-0"
          [class.h-full]="!isHandset()"
          [class.overflow-hidden]="!isHandset()"
          [class.p-2]="!isHandset()"
          [class.pt-0]="!isHandset() && !isDemoMode()"
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
            [class.toolbar-desktop]="!isHandset()"
            class="shrink-0"
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
            @if (!isHandset() && hasBreadcrumb()) {
              <div
                class="breadcrumb-scroll-fade flex-1 min-w-0 overflow-x-auto scrollbar-hide"
              >
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
              @if (currentTourPageId()) {
                <button
                  mat-menu-item
                  (click)="startPageTour()"
                  aria-label="Découvrir cette page"
                  data-testid="page-tour-button"
                >
                  <mat-icon matMenuItemIcon>help_outline</mat-icon>
                  <span>Découvrir cette page</span>
                </button>
              }
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
                class="px-4 pb-3"
                [items]="breadcrumbState.breadcrumbs()"
              />
            </div>
          }

          <!-- Page Content - Scrollable Container -->
          <main
            class="flex-1 bg-surface text-on-surface pt-2! min-w-0"
            [class.overflow-y-auto]="!isHandset()"
            [class.overflow-x-hidden]="!isHandset()"
            [class.p-6]="!isHandset()"
            [class.md:p-8]="!isHandset()"
            [class.p-4]="isHandset()"
            data-testid="page-content"
            data-tour="page-content"
          >
            <div #scrollSentinel class="h-0" aria-hidden="true"></div>
            <router-outlet />
          </main>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100dvh;
      }

      @media (max-width: 599.98px) {
        :host {
          height: auto;
          min-height: 100dvh;
        }
      }

      :host mat-sidenav {
        --mat-filled-button-container-shape: 50%;
        --mat-outlined-button-container-shape: 50%;
        --mat-text-button-container-shape: 50%;
        --mat-tonal-button-container-shape: 50%;
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

      /* Mobile: sticky header enables body-level scroll while keeping toolbar visible */
      @media (max-width: 599.98px) {
        mat-toolbar {
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .breadcrumb-mobile {
          position: sticky;
          top: 56px;
          z-index: 40;
          background: var(--mat-sys-surface);
        }
      }

      mat-toolbar.scrolled,
      .breadcrumb-mobile.scrolled {
        box-shadow: var(--mat-sys-level2);

        /* Coupe tout ce qui dépasse en HAUT (0), mais laisse passer le reste (-20px) */
        /* Ordre : Top, Right, Bottom, Left */
        clip-path: inset(0px -20px -20px -20px);
        z-index: 10;
      }

      .toolbar-desktop {
        margin-left: -0.5rem !important;
        margin-right: -0.5rem !important;
        width: auto !important;
      }

      /* Mobile: override Material scroll containment for body-level scrolling */
      @media (max-width: 599.98px) {
        :host mat-sidenav-container {
          overflow: visible !important;
        }

        :host mat-sidenav-content {
          overflow: visible !important;
          height: auto !important;
        }
      }

      /* Gradient fade-out for horizontal scroll affordance */
      .breadcrumb-scroll-fade {
        position: relative;

        &::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 24px;
          background: linear-gradient(
            to right,
            transparent,
            var(--mat-sys-surface)
          );
          pointer-events: none;
        }
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
  protected readonly hasBreadcrumb = computed(
    () => this.breadcrumbState.breadcrumbs().length > 1,
  );
  private readonly scrollSentinel =
    viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  readonly #destroyRef = inject(DestroyRef);
  readonly #logger = inject(Logger);
  readonly #dialog = inject(MatDialog);
  readonly #productTourService = inject(ProductTourService);
  protected readonly loadingIndicator = inject(LoadingIndicator);
  // Display "Mode Démo" for demo users, otherwise show email
  readonly userEmail = computed(() => {
    if (this.#demoModeService.isDemoMode()) {
      return 'demo@gmail.com';
    }
    return this.#authState.authState().user?.email;
  });

  // Route to settings page
  protected readonly settingsRoute = `/${ROUTES.SETTINGS}`;

  // Navigation items configuration
  protected readonly navigationItems: readonly NavigationItem[] = [
    {
      route: ROUTES.DASHBOARD,
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
      shareReplay({ bufferSize: 1, refCount: true }),
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

  // Current tour page ID based on route
  protected readonly currentTourPageId = computed((): TourPageId | null => {
    const url = this.#currentRoute();
    if (url.includes(`/${ROUTES.DASHBOARD}`)) return 'current-month';
    if (url.match(/\/budget\/[^/]+$/)) return 'budget-details';
    if (url.includes(`/${ROUTES.BUDGET}`)) return 'budget-list';
    if (url.includes(`/${ROUTES.BUDGET_TEMPLATES}`)) return 'templates-list';
    return null;
  });

  // Scroll detection for toolbar shadow
  protected readonly isScrolled = signal(false);

  // Desktop: shadow on toolbar (breadcrumb inside)
  // Mobile: shadow on toolbar only if no breadcrumb (otherwise breadcrumb has shadow)
  protected readonly showToolbarShadow = computed(() => {
    const isScrolled = this.isScrolled();
    const isHandset = this.isHandset();
    const hasBreadcrumb = this.hasBreadcrumb();
    return isScrolled && (!isHandset || !hasBreadcrumb);
  });

  constructor() {
    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;

      const observer = new IntersectionObserver(
        ([entry]) => this.isScrolled.set(!entry.isIntersecting),
        { threshold: 0 },
      );

      observer.observe(sentinel);
      this.#destroyRef.onDestroy(() => observer.disconnect());
    });
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

  protected startPageTour(): void {
    const pageId = this.currentTourPageId();
    if (pageId) {
      this.#productTourService.startPageTour(pageId);
    }
  }

  async onLogout(): Promise<void> {
    if (this.#isLoggingOut()) return;

    this.#isLoggingOut.set(true);
    this.#dialog.open(LogoutDialog, { disableClose: true });

    try {
      await this.#authSession.signOut();
    } catch (error) {
      if (!this.#applicationConfig.isProduction()) {
        this.#logger.error('Erreur lors de la déconnexion:', error);
      }
    } finally {
      // Reset flag in case redirect fails or flow changes in the future
      this.#isLoggingOut.set(false);
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
    if (this.#isLoggingOut()) return;

    this.#isLoggingOut.set(true);
    this.#dialog.open(LogoutDialog, { disableClose: true });

    try {
      await this.#demoInitializer.exitDemoMode();
    } catch (error) {
      if (!this.#applicationConfig.isProduction()) {
        this.#logger.error('Failed to exit demo mode', { error });
      }
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
