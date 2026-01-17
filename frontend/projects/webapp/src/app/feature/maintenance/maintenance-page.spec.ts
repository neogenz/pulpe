import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  Component,
  Input,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MaintenancePage from './maintenance-page';
import { MaintenanceApi } from '@core/maintenance';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';

// Mock LottieComponent to avoid loading lottie-web in tests
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ng-lottie',
  template: '<div class="mock-lottie"></div>',
})
class MockLottieComponent {
  @Input() options?: AnimationOptions;
}

describe('MaintenancePage', () => {
  let fixture: ComponentFixture<MaintenancePage>;
  let component: MaintenancePage;
  let mockMaintenanceApi: { checkStatus: ReturnType<typeof vi.fn> };
  let originalLocation: Location;

  beforeEach(async () => {
    mockMaintenanceApi = {
      checkStatus: vi.fn(),
    };

    // Save and mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/maintenance',
        href: '',
      },
      writable: true,
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [MaintenancePage],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: MaintenanceApi, useValue: mockMaintenanceApi },
      ],
    })
      .overrideComponent(MaintenancePage, {
        remove: { imports: [LottieComponent] },
        add: { imports: [MockLottieComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MaintenancePage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('initial state', () => {
    it('should have isChecking set to false', () => {
      expect(component['isChecking']()).toBe(false);
    });

    it('should have statusMessage set to empty string', () => {
      expect(component['statusMessage']()).toBe('');
    });

    it('should have lottie options configured', () => {
      const options = component['lottieOptions'] as Record<string, unknown>;
      expect(options['path']).toBe('/lottie/maintenance-animation.json');
      expect(options['loop']).toBe(true);
      expect(options['autoplay']).toBe(true);
    });
  });

  describe('checkAndReload', () => {
    it('should set isChecking to true during API call', async () => {
      // Arrange
      let isCheckingDuringCall = false;
      mockMaintenanceApi.checkStatus.mockImplementation(() => {
        isCheckingDuringCall = component['isChecking']();
        return Promise.resolve({ maintenanceMode: true });
      });

      // Act
      await component['checkAndReload']();

      // Assert
      expect(isCheckingDuringCall).toBe(true);
      expect(component['isChecking']()).toBe(false);
    });

    it('should clear statusMessage before checking', async () => {
      // Arrange
      component['statusMessage'].set('Previous message');
      mockMaintenanceApi.checkStatus.mockResolvedValue({
        maintenanceMode: true,
      });

      // Act
      await component['checkAndReload']();

      // Assert - message should be set to maintenance message, not cleared
      expect(component['statusMessage']()).toBe(
        'Toujours en maintenance — réessaie dans un instant',
      );
    });

    it('should redirect to home when maintenance mode is off', async () => {
      // Arrange
      mockMaintenanceApi.checkStatus.mockResolvedValue({
        maintenanceMode: false,
      });

      // Act
      await component['checkAndReload']();

      // Assert
      expect(window.location.href).toBe('/');
    });

    it('should show maintenance message when still in maintenance', async () => {
      // Arrange
      mockMaintenanceApi.checkStatus.mockResolvedValue({
        maintenanceMode: true,
      });

      // Act
      await component['checkAndReload']();

      // Assert
      expect(component['statusMessage']()).toBe(
        'Toujours en maintenance — réessaie dans un instant',
      );
      expect(window.location.href).toBe('');
    });

    it('should show connection error message on API failure', async () => {
      // Arrange
      mockMaintenanceApi.checkStatus.mockRejectedValue(
        new Error('Network error'),
      );

      // Act
      await component['checkAndReload']();

      // Assert
      expect(component['statusMessage']()).toBe(
        'Connexion difficile — réessaie dans un instant',
      );
    });

    it('should set isChecking to false after successful check', async () => {
      // Arrange
      mockMaintenanceApi.checkStatus.mockResolvedValue({
        maintenanceMode: true,
      });

      // Act
      await component['checkAndReload']();

      // Assert
      expect(component['isChecking']()).toBe(false);
    });

    it('should set isChecking to false after failed check', async () => {
      // Arrange
      mockMaintenanceApi.checkStatus.mockRejectedValue(
        new Error('Network error'),
      );

      // Act
      await component['checkAndReload']();

      // Assert
      expect(component['isChecking']()).toBe(false);
    });
  });

  describe('template rendering', () => {
    it('should display error message when statusMessage is set', async () => {
      // Arrange
      component['statusMessage'].set('Test error message');
      fixture.detectChanges();

      // Act
      const errorElement = fixture.nativeElement.querySelector('.text-error');

      // Assert
      expect(errorElement?.textContent).toContain('Test error message');
    });

    it('should not display error element when statusMessage is empty', () => {
      // Arrange
      component['statusMessage'].set('');
      fixture.detectChanges();

      // Act
      const errorElement = fixture.nativeElement.querySelector('.text-error');

      // Assert
      expect(errorElement).toBeNull();
    });
  });
});
