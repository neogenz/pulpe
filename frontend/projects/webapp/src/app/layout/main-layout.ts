import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { NavigationMenu } from './navigation-menu';

@Component({
  selector: 'pulpe-main-layout',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    NavigationMenu,
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
        <pulpe-navigation-menu
          class="md:pt-4 md:pb-4 md:pl-4 h-full"
          (navItemClick)="onNavItemClick($event)"
        />
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

        <main class="main-content p-4">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  private readonly breakpointObserver = inject(BreakpointObserver);

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
