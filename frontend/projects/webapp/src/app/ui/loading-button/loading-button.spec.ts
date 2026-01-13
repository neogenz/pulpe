import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoadingButton } from './loading-button';

describe('LoadingButton', () => {
  let component: LoadingButton;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingButton],
      providers: [provideZonelessChangeDetection(), provideAnimationsAsync()],
    }).compileComponents();

    component = TestBed.createComponent(LoadingButton).componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have loading input defined', () => {
      expect(component.loading).toBeDefined();
    });

    it('should have disabled input defined', () => {
      expect(component.disabled).toBeDefined();
    });

    it('should have variant input defined', () => {
      expect(component.variant).toBeDefined();
    });

    it('should have color input defined', () => {
      expect(component.color).toBeDefined();
    });

    it('should have type input defined', () => {
      expect(component.type).toBeDefined();
    });

    it('should have loadingText input defined', () => {
      expect(component.loadingText).toBeDefined();
    });

    it('should have icon input defined', () => {
      expect(component.icon).toBeDefined();
    });

    it('should have testId input defined', () => {
      expect(component.testId).toBeDefined();
    });

    it('should have fullWidth input defined', () => {
      expect(component.fullWidth).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should have loading default to false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have disabled default to false', () => {
      expect(component.disabled()).toBe(false);
    });

    it('should have variant default to filled', () => {
      expect(component.variant()).toBe('filled');
    });

    it('should have color default to primary', () => {
      expect(component.color()).toBe('primary');
    });

    it('should have type default to submit', () => {
      expect(component.type()).toBe('submit');
    });

    it('should have loadingText default to en cours...', () => {
      expect(component.loadingText()).toBe('en cours...');
    });

    it('should have fullWidth default to true', () => {
      expect(component.fullWidth()).toBe(true);
    });

    it('should have icon undefined by default', () => {
      expect(component.icon()).toBeUndefined();
    });

    it('should have testId undefined by default', () => {
      expect(component.testId()).toBeUndefined();
    });
  });

  describe('buttonClass method', () => {
    it('should include h-12 class', () => {
      const result = component['buttonClass']();
      expect(result).toContain('h-12');
    });

    it('should include w-full when fullWidth is true (default)', () => {
      const result = component['buttonClass']();
      expect(result).toContain('w-full');
    });
  });
});
