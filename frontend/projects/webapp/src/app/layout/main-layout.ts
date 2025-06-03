import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { NavigationService } from '@core/navigation';

@Component({
  selector: 'pulpe-main-layout',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    RouterModule,
  ],
  template: `
    <mat-sidenav-container class="h-full">
      <mat-sidenav
        #drawer
        fixedInViewport
        [mode]="sidenavMode()"
        [opened]="sidenavOpened()"
        (openedChange)="onSidenavOpenedChange($event)"
      >
        <div class="md:p-4 h-full">
          <div class="bg-surface-container rounded-2xl h-full px-2">
            <div class="flex justify-center items-center py-4">
              <div class="w-10 h-10 pulpe-gradient rounded-full"></div>
            </div>

            <mat-nav-list>
              @for (
                section of navigationService.navigationSections();
                track section.title
              ) {
                <div mat-subheader>{{ section.title }}</div>
                @for (item of section.items; track item.route) {
                  <a
                    mat-list-item
                    [routerLink]="item.route"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: true }"
                    (click)="onNavItemClick($event)"
                  >
                    <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                    <span matListItemTitle>{{ item.label }}</span>
                  </a>
                }
              }
            </mat-nav-list>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar">
          <button
            type="button"
            aria-label="Toggle sidenav"
            mat-icon-button
            (click)="toggleSidenav()"
          >
            <mat-icon>menu</mat-icon>
          </button>

          <span class="toolbar-spacer"></span>

          <div class="w-8 h-8 pulpe-gradient rounded-full toolbar-logo"></div>
        </mat-toolbar>

        <main class="main-content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      @use '@angular/material' as mat;

      .active {
        --mat-list-list-item-label-text-color: var(
          --mat-sys-on-secondary-container
        );
        --mat-list-list-item-leading-icon-color: var(
          --mat-sys-on-secondary-container
        );
        --mat-list-list-item-container-color: var(
          --mat-sys-secondary-container
        );
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly navigationService = inject(NavigationService);

  readonly isHandset = this.breakpointObserver.isMatched([
    Breakpoints.Handset,
    Breakpoints.TabletPortrait,
  ]);

  readonly sidenavMode = signal<'side' | 'over'>(
    this.isHandset ? 'over' : 'side',
  );
  readonly sidenavOpened = signal<boolean>(!this.isHandset);

  constructor() {
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .subscribe((result) => {
        const isSmallScreen = result.matches;
        this.sidenavMode.set(isSmallScreen ? 'over' : 'side');
        this.sidenavOpened.set(!isSmallScreen);
      });
  }

  toggleSidenav(): void {
    this.sidenavOpened.set(!this.sidenavOpened());
  }

  onSidenavOpenedChange(opened: boolean): void {
    this.sidenavOpened.set(opened);
  }

  onNavItemClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    target.blur();

    if (this.isHandset) {
      this.sidenavOpened.set(false);
    }
  }
}
