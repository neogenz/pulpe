import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
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
import { PulpeBreadcrumb } from '../ui/breadcrumb/breadcrumb';
import { BreadcrumbState } from '../core/routing/breadcrumb-state';
import { AuthApi } from '../core/auth/auth-api';
import { ROUTES } from '../core/routing/routes-constants';
import { environment } from '../../environments/environment';

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
  ],
  template: `
    <mat-sidenav-container class="h-screen !bg-surface-container">
      <!-- Navigation Sidenav -->
      <mat-sidenav
        #drawer
        class="!bg-surface-container"
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
          <mat-nav-list class="pt-4 !px-2">
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
          <nav class="pt-4 px-3">
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
        class="flex flex-col h-full overflow-hidden"
        [class.p-2]="!isHandset()"
      >
        <div
          class="flex flex-col h-full bg-surface relative"
          [class.p-2]="!isHandset()"
          [class.rounded-xl]="!isHandset()"
        >
          <!-- Top App Bar - Fixed Header -->
          <mat-toolbar
            color="primary"
            class="flex-shrink-0"
            [class.rounded-t-xl]="!isHandset()"
          >
            @if (isHandset()) {
              <button
                mat-icon-button
                (click)="drawer.toggle()"
                aria-label="Toggle navigation"
              >
                <mat-icon>menu</mat-icon>
              </button>
            }

            <span>{{ currentPageTitle() }}</span>

            <span class="flex-1"></span>

            <!-- Toolbar Actions -->
            <button
              type="button"
              mat-button
              [matMenuTriggerFor]="userMenu"
              class="w-11 h-11 min-w-[44px] p-2 rounded-full flex items-center justify-center transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-60"
              [attr.aria-label]="
                isLoggingOut() ? 'Déconnexion en cours...' : 'Menu utilisateur'
              "
              [disabled]="isLoggingOut()"
              data-testid="user-menu-trigger"
            >
              <div
                class="w-8 h-8 pulpe-gradient rounded-full transition-all duration-200 hover:scale-105"
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
            class="flex-1 overflow-y-auto bg-surface text-on-surface"
            [class.p-6]="!isHandset()"
            [class.md:p-8]="!isHandset()"
            [class.p-4]="isHandset()"
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
        height: 100vh;
      }

      /*
       * En appliquant la surcharge de style pour les boutons à l'intérieur
       * du sélecteur 'mat-toolbar', nous limitons sa portée aux boutons
       * qui sont DANS la barre d'outils de ce composant uniquement.
       * Cela empêche le style de s'appliquer aux composants dans <router-outlet>.
       */
      :host mat-toolbar {
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
export class MainLayout {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly scrollDispatcher = inject(ScrollDispatcher);
  private readonly authApi = inject(AuthApi);
  readonly breadcrumbState = inject(BreadcrumbState);

  // Navigation items configuration
  protected readonly navigationItems: readonly NavigationItem[] = [
    {
      route: ROUTES.CURRENT_MONTH,
      label: 'Mois en cours',
      icon: 'today',
      tooltip: 'Budget du mois en cours',
    },
    {
      route: ROUTES.BUDGET,
      label: 'Mes budgets',
      icon: 'calendar_month',
      tooltip: 'Consulter tous vos budgets',
    },
    {
      route: ROUTES.BUDGET_TEMPLATES,
      label: 'Modèles',
      icon: 'description',
      tooltip: 'Modèles de budget',
    },
  ] as const;

  // Responsive breakpoint detection
  protected readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );

  // Current route tracking
  private readonly currentRoute = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // Current navigation item based on route
  protected readonly currentNavigationItem = computed(() => {
    const url = this.currentRoute();
    return this.navigationItems.find((item) => url.includes(item.route));
  });

  // Dynamic page title
  protected readonly currentPageTitle = computed(() => {
    const navigationItem = this.currentNavigationItem();
    return navigationItem?.label || 'Pulpe Budget';
  });

  // Scroll detection for header border
  protected isScrolled = toSignal(
    this.scrollDispatcher.scrolled(100).pipe(
      takeUntilDestroyed(),
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

  async onLogout(): Promise<void> {
    if (this.#isLoggingOut()) return;

    try {
      this.#isLoggingOut.set(true);

      // Sign out and wait for session to be cleared
      await this.authApi.signOut();

      // Add a small delay to ensure auth state has been updated
      // This prevents race conditions with the auth state change
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.router.navigate([ROUTES.LOGIN]);
    } catch (error) {
      // Only log detailed errors in development
      if (!environment.production) {
        console.error('Erreur lors de la déconnexion:', error);
      }

      // Always navigate to login on error to ensure user is signed out
      try {
        await this.router.navigate([ROUTES.LOGIN]);
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
