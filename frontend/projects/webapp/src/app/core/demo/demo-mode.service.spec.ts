import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DemoModeService } from './demo-mode.service';
import { Logger } from '../logging/logger';

describe('DemoModeService', () => {
  let service: DemoModeService;

  const mockLogger = {
    info: () => void 0,
    debug: () => void 0,
    warn: () => void 0,
    error: () => void 0,
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        DemoModeService,
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DemoModeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('User activates demo mode', () => {
    it('should allow user to enter demo mode with email', () => {
      // WHEN: User starts demo mode
      service.activateDemoMode('demo-123@pulpe.app');

      // THEN: Demo mode is active
      expect(service.isDemoMode()).toBe(true);
      expect(service.demoUserEmail()).toBe('demo-123@pulpe.app');
    });

    it('should persist demo state in localStorage', () => {
      // WHEN: User activates demo mode
      service.activateDemoMode('demo@pulpe.app');

      // Force effect to run
      TestBed.flushEffects();

      // THEN: State is persisted
      expect(localStorage.getItem('pulpe-demo-mode')).toBe('true');
      expect(localStorage.getItem('pulpe-demo-user-email')).toBe(
        'demo@pulpe.app',
      );
    });

    it('should extract display name from email', () => {
      // WHEN: User activates demo mode
      service.activateDemoMode('demo-abc123@pulpe.app');

      // THEN: Display name is extracted
      expect(service.demoUserDisplayName()).toBe('demo-abc123');
    });
  });

  describe('Demo state persists across sessions', () => {
    it('should restore demo mode from localStorage on init', () => {
      // GIVEN: Demo mode was previously active
      localStorage.setItem('pulpe-demo-mode', 'true');
      localStorage.setItem('pulpe-demo-user-email', 'demo@pulpe.app');

      // WHEN: Service is reinitialized
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          DemoModeService,
          { provide: Logger, useValue: mockLogger },
        ],
      });

      const newService = TestBed.inject(DemoModeService);

      // THEN: Demo mode is restored
      expect(newService.isDemoMode()).toBe(true);
      expect(newService.demoUserEmail()).toBe('demo@pulpe.app');
    });

    it('should handle missing localStorage gracefully', () => {
      // GIVEN: localStorage is empty
      localStorage.clear();

      // WHEN: Service is initialized
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          DemoModeService,
          { provide: Logger, useValue: mockLogger },
        ],
      });

      const newService = TestBed.inject(DemoModeService);

      // THEN: Demo mode is inactive
      expect(newService.isDemoMode()).toBe(false);
      expect(newService.demoUserEmail()).toBeNull();
    });
  });

  describe('User exits demo mode', () => {
    it('should deactivate demo mode', () => {
      // GIVEN: User is in demo mode
      service.activateDemoMode('demo@pulpe.app');
      expect(service.isDemoMode()).toBe(true);

      // WHEN: User exits demo mode
      service.deactivateDemoMode();

      // THEN: Demo mode is inactive
      expect(service.isDemoMode()).toBe(false);
      expect(service.demoUserEmail()).toBeNull();
    });

    it('should clear localStorage on deactivation', () => {
      // GIVEN: Demo mode is active with localStorage set
      service.activateDemoMode('demo@pulpe.app');
      TestBed.flushEffects();

      // WHEN: User deactivates demo mode
      service.deactivateDemoMode();
      TestBed.flushEffects();

      // THEN: localStorage is cleared
      expect(localStorage.getItem('pulpe-demo-mode')).toBeNull();
      expect(localStorage.getItem('pulpe-demo-user-email')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple activations correctly', () => {
      // WHEN: Demo mode is activated multiple times
      service.activateDemoMode('demo1@pulpe.app');
      service.activateDemoMode('demo2@pulpe.app');

      // THEN: Latest activation wins
      expect(service.demoUserEmail()).toBe('demo2@pulpe.app');
    });

    it('should handle deactivation when already inactive', () => {
      // GIVEN: Demo mode is already inactive
      expect(service.isDemoMode()).toBe(false);

      // WHEN: Deactivation is called
      service.deactivateDemoMode();

      // THEN: No error occurs
      expect(service.isDemoMode()).toBe(false);
    });

    it('should handle emails without @ symbol gracefully', () => {
      // WHEN: Invalid email is provided
      service.activateDemoMode('invalid-email');

      // THEN: Display name returns the full string
      expect(service.demoUserDisplayName()).toBe('invalid-email');
    });

    it('should handle empty email string', () => {
      // WHEN: Empty email is provided
      service.activateDemoMode('');

      // THEN: Demo mode is active but email is empty
      expect(service.isDemoMode()).toBe(true);
      expect(service.demoUserEmail()).toBe('');
      // Empty string split results in empty display name
      expect(service.demoUserDisplayName()).toBeNull();
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage read errors gracefully', () => {
      // GIVEN: localStorage throws on getItem
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = () => {
        throw new Error('localStorage disabled');
      };

      // WHEN: Service is initialized
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          DemoModeService,
          { provide: Logger, useValue: mockLogger },
        ],
      });

      const newService = TestBed.inject(DemoModeService);

      // THEN: Demo mode defaults to inactive
      expect(newService.isDemoMode()).toBe(false);

      // Cleanup
      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle localStorage write errors gracefully', () => {
      // GIVEN: localStorage throws on setItem
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('localStorage full');
      };

      // WHEN: User tries to activate demo mode
      service.activateDemoMode('demo@pulpe.app');
      TestBed.flushEffects();

      // THEN: Signal state is updated even if localStorage fails
      expect(service.isDemoMode()).toBe(true);

      // Cleanup
      Storage.prototype.setItem = originalSetItem;
    });
  });
});
