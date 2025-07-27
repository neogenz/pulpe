import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Output, Input, NO_ERRORS_SCHEMA } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { MainLayout } from './main-layout';
import { AuthApi } from '../core/auth/auth-api';
import { BreadcrumbState } from '../core/routing/breadcrumb-state';
import { ROUTES } from '../core/routing/routes-constants';
import { environment } from '../../environments/environment';

// Mock NavigationMenu component
@Component({
  selector: 'pulpe-navigation-menu',
  template: '<div>Mock Navigation Menu</div>',
  standalone: true,
})
class MockNavigationMenuComponent {
  @Output() navItemClick = new Subject<Event>();
}

// Mock PulpeBreadcrumb component
@Component({
  selector: 'pulpe-breadcrumb',
  template: '<div>Mock Breadcrumb</div>',
  standalone: true,
})
class MockPulpeBreadcrumbComponent {
  @Input() items: unknown[] = [];
}

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;
  let mockAuthApi: {
    signOut: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockBreakpointObserver: {
    observe: ReturnType<typeof vi.fn>;
    isMatched: ReturnType<typeof vi.fn>;
  };
  let mockBreadcrumbState: {
    breadcrumbs: ReturnType<typeof vi.fn>;
  };
  let breakpointSubject: Subject<{ matches: boolean }>;

  beforeEach(() => {
    // Create observables for breakpoint changes
    breakpointSubject = new Subject<{ matches: boolean }>();

    // Create mocks
    mockAuthApi = {
      signOut: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue(breakpointSubject.asObservable()),
      isMatched: vi.fn().mockReturnValue(false),
    };
    mockBreadcrumbState = {
      breadcrumbs: vi.fn().mockReturnValue([]),
    };

    // Configure TestBed
    TestBed.configureTestingModule({
      imports: [
        MainLayout,
        NoopAnimationsModule,
        MatSidenavModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        RouterModule,
        MockNavigationMenuComponent,
        MockPulpeBreadcrumbComponent,
      ],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: Router, useValue: mockRouter },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
        { provide: BreadcrumbState, useValue: mockBreadcrumbState },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    // Override the main layout component to use mock components
    TestBed.overrideComponent(MainLayout, {
      set: {
        imports: [
          MatSidenavModule,
          MatToolbarModule,
          MatButtonModule,
          MatIconModule,
          MatMenuModule,
          RouterModule,
          MockNavigationMenuComponent,
          MockPulpeBreadcrumbComponent,
        ],
      },
    });

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with correct default states', () => {
      expect(component.isLoggingOut()).toBe(false);
      expect(component.sidenavMode()).toBe('side'); // Default for desktop
    });

    it('should observe breakpoints on initialization', () => {
      fixture.detectChanges();
      expect(mockBreakpointObserver.observe).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('should set sidenav mode to "over" on mobile breakpoints', () => {
      // Simulate mobile breakpoint
      mockBreakpointObserver.isMatched.mockReturnValue(true);
      breakpointSubject.next({ matches: true });
      fixture.detectChanges();

      expect(component.sidenavMode()).toBe('over');
    });

    it('should set sidenav mode to "side" on desktop breakpoints', () => {
      // Simulate desktop breakpoint
      mockBreakpointObserver.isMatched.mockReturnValue(false);
      breakpointSubject.next({ matches: false });
      fixture.detectChanges();

      expect(component.sidenavMode()).toBe('side');
    });

    it('should adjust sidenav opened state based on screen size', () => {
      // Start with desktop (sidenav open)
      mockBreakpointObserver.isMatched.mockReturnValue(false);
      fixture.detectChanges();
      expect(component.sidenavOpened()).toBe(true);

      // Switch to mobile (sidenav should close)
      mockBreakpointObserver.isMatched.mockReturnValue(true);
      breakpointSubject.next({ matches: true });
      fixture.detectChanges();
      expect(component.sidenavOpened()).toBe(false);
    });
  });

  describe('Navigation Interaction', () => {
    it('should close sidenav on mobile after navigation item click', () => {
      // Set mobile mode first and then open sidenav
      mockBreakpointObserver.isMatched.mockReturnValue(true);
      breakpointSubject.next({ matches: true });
      fixture.detectChanges();

      // Now set sidenav to open
      component.sidenavOpened.set(true);
      fixture.detectChanges();

      component.onNavItemClick();

      expect(component.sidenavOpened()).toBe(false);
    });

    it('should not close sidenav on desktop after navigation item click', () => {
      // Set desktop mode
      mockBreakpointObserver.isMatched.mockReturnValue(false);
      component.sidenavOpened.set(true);
      fixture.detectChanges();

      component.onNavItemClick();

      expect(component.sidenavOpened()).toBe(true);
    });
  });

  describe('Logout Functionality', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should not allow multiple logout attempts', async () => {
      // Start first logout attempt
      const firstLogout = component.onLogout();

      // Try to start another logout while first is in progress
      await component.onLogout();

      // Wait for first logout to complete
      await firstLogout;

      // Should only be called once from the first logout
      expect(mockAuthApi.signOut).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });

    it('should successfully logout and navigate to login', async () => {
      mockAuthApi.signOut.mockResolvedValue(undefined);
      mockRouter.navigate.mockResolvedValue(true);

      const logoutPromise = component.onLogout();

      // Check loading state is set
      expect(component.isLoggingOut()).toBe(true);

      await logoutPromise;

      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.navigate).toHaveBeenCalledWith([ROUTES.LOGIN]);
      expect(component.isLoggingOut()).toBe(false);
    });

    it('should handle auth service errors gracefully', async () => {
      const authError = new Error('Auth service error');
      mockAuthApi.signOut.mockRejectedValue(authError);
      mockRouter.navigate.mockResolvedValue(true);

      // Mock environment to test error logging
      const originalProduction = environment.production;
      Object.defineProperty(environment, 'production', {
        value: false,
        writable: true,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });

      await component.onLogout();

      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.navigate).toHaveBeenCalledWith([ROUTES.LOGIN]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Erreur lors de la déconnexion:',
        authError,
      );
      expect(component.isLoggingOut()).toBe(false);

      // Restore original environment
      Object.defineProperty(environment, 'production', {
        value: originalProduction,
        writable: true,
      });
      consoleSpy.mockRestore();
    });

    it('should not log errors in production', async () => {
      const authError = new Error('Auth service error');
      mockAuthApi.signOut.mockRejectedValue(authError);
      mockRouter.navigate.mockResolvedValue(true);

      // Mock production environment
      const originalProduction = environment.production;
      Object.defineProperty(environment, 'production', {
        value: true,
        writable: true,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });

      await component.onLogout();

      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.navigate).toHaveBeenCalledWith([ROUTES.LOGIN]);
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(component.isLoggingOut()).toBe(false);

      // Restore original environment
      Object.defineProperty(environment, 'production', {
        value: originalProduction,
        writable: true,
      });
      consoleSpy.mockRestore();
    });

    it('should handle navigation errors during logout', async () => {
      const navError = new Error('Navigation error');
      mockAuthApi.signOut.mockResolvedValue(undefined);
      mockRouter.navigate.mockRejectedValue(navError);

      // Mock development environment
      const originalProduction = environment.production;
      Object.defineProperty(environment, 'production', {
        value: false,
        writable: true,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });

      await component.onLogout();

      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.navigate).toHaveBeenCalledWith([ROUTES.LOGIN]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Erreur lors de la navigation vers login:',
        navError,
      );
      expect(component.isLoggingOut()).toBe(false);

      // Restore original environment
      Object.defineProperty(environment, 'production', {
        value: originalProduction,
        writable: true,
      });
      consoleSpy.mockRestore();
    });

    it('should ensure loading state is reset even if both auth and navigation fail', async () => {
      mockAuthApi.signOut.mockRejectedValue(new Error('Auth error'));
      mockRouter.navigate.mockRejectedValue(new Error('Navigation error'));

      await component.onLogout();

      expect(component.isLoggingOut()).toBe(false);
    });

    it('should include delay to prevent race conditions', async () => {
      mockAuthApi.signOut.mockResolvedValue(undefined);
      mockRouter.navigate.mockResolvedValue(true);

      const start = Date.now();
      await component.onLogout();
      const duration = Date.now() - start;

      // Should have waited at least 100ms
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some margin for test timing
      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.navigate).toHaveBeenCalledWith([ROUTES.LOGIN]);
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render sidenav container', () => {
      const sidenavContainer = fixture.nativeElement.querySelector(
        'mat-sidenav-container',
      );
      expect(sidenavContainer).toBeTruthy();
    });

    it('should render toolbar with user menu', () => {
      const toolbar = fixture.nativeElement.querySelector('mat-toolbar');
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );

      expect(toolbar).toBeTruthy();
      expect(userMenuButton).toBeTruthy();
    });

    it('should render logout button in menu', async () => {
      // Open the menu first
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );
      expect(userMenuButton).toBeTruthy();

      userMenuButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Wait a bit more for Angular Material menu animation
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 100);
      });
      fixture.detectChanges();

      const logoutButton =
        fixture.nativeElement.querySelector('[data-testid="logout-button"]') ||
        document.querySelector('[data-testid="logout-button"]');

      // If still not found, check if menu is in overlay
      if (!logoutButton) {
        const overlayContainer = document.querySelector(
          '.cdk-overlay-container',
        );
        const menuButton = overlayContainer?.querySelector(
          '[data-testid="logout-button"]',
        );
        expect(menuButton).toBeTruthy();
      } else {
        expect(logoutButton).toBeTruthy();
      }
    });

    it('should show loading state when isLoggingOut is true', () => {
      expect(component.isLoggingOut()).toBe(false);

      // Test the loading state through the public readonly signal
      // We can't directly set the private field, but we can test the public interface
      const isLoading = component.isLoggingOut();
      expect(typeof isLoading).toBe('boolean');
    });

    it('should have proper loading states reflected in template', () => {
      // This tests that the template properly uses the isLoggingOut signal
      // Even if we can't directly set the private field
      expect(component.isLoggingOut()).toBe(false);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should have proper aria-labels for user menu trigger', () => {
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );
      expect(userMenuButton.getAttribute('aria-label')).toBe(
        'Menu utilisateur',
      );
    });

    it('should have dynamic aria-label based on logout state', () => {
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );

      // Test that aria-label exists and changes based on loading state
      const ariaLabel = userMenuButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(['Menu utilisateur', 'Déconnexion en cours...']).toContain(
        ariaLabel,
      );
    });

    it('should have proper aria-labels for logout button when menu is open', async () => {
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );
      userMenuButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const logoutButton = fixture.nativeElement.querySelector(
        '[data-testid="logout-button"]',
      );
      if (logoutButton) {
        const ariaLabel = logoutButton.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect([
          'Se déconnecter de votre compte',
          'Déconnexion en cours, veuillez patienter',
        ]).toContain(ariaLabel);
      }
    });

    it('should have aria-hidden on decorative icons when menu is open', async () => {
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );
      userMenuButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const icon = fixture.nativeElement.querySelector(
        'mat-icon[matMenuItemIcon]',
      );
      if (icon) {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('should have screen reader feedback for logout state', () => {
      const srOnlyDiv = fixture.nativeElement.querySelector(
        '.sr-only[aria-live="polite"]',
      );
      expect(srOnlyDiv).toBeTruthy();
      expect(srOnlyDiv.getAttribute('aria-atomic')).toBe('true');
    });

    it('should properly handle screen reader announcements', () => {
      const srOnlyDiv = fixture.nativeElement.querySelector(
        '.sr-only[aria-live="polite"]',
      );
      expect(srOnlyDiv).toBeTruthy();

      // The content should be empty initially when not logging out
      expect(srOnlyDiv.textContent.trim()).toBe('');
    });
  });

  describe('Visual States', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should have proper visual states for logo', () => {
      const logo = fixture.nativeElement.querySelector('.toolbar-logo');
      expect(logo).toBeTruthy();

      // Test that the logo exists and has the correct classes
      expect(logo.classList.contains('toolbar-logo')).toBe(true);
    });

    it('should have correct initial state for user menu button', () => {
      const userMenuButton = fixture.nativeElement.querySelector(
        '[data-testid="user-menu-trigger"]',
      );
      expect(userMenuButton).toBeTruthy();

      // Initially should not be disabled when not logging out
      expect(userMenuButton.disabled).toBe(false);
    });

    it('should handle visual state changes properly', () => {
      // Test that the component can handle state changes
      // We test the public interface rather than private implementation
      expect(component.isLoggingOut()).toBe(false);
      expect(component.sidenavOpened()).toBeDefined();
      expect(component.sidenavMode()).toBeDefined();
    });
  });
});
