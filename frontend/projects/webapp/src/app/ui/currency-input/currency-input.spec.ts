import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';
import { CurrencyInput } from './currency-input';

describe('CurrencyInput', () => {
  let component: CurrencyInput;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyInput, FormsModule],
      providers: [provideZonelessChangeDetection(), provideAnimationsAsync()],
    }).compileComponents();

    component = TestBed.createComponent(CurrencyInput).componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have required label input defined', () => {
      expect(component.label).toBeDefined();
    });

    it('should have value model defined', () => {
      expect(component.value).toBeDefined();
      expect(typeof component.value).toBe('function');
    });

    it('should have optional inputs defined', () => {
      expect(component.placeholder).toBeDefined();
      expect(component.ariaDescribedBy).toBeDefined();
      expect(component.required).toBeDefined();
      expect(component.testId).toBeDefined();
      expect(component.currency).toBeDefined();
      expect(component.autoFocus).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should have placeholder default to 0.00', () => {
      expect(component.placeholder()).toBe('0.00');
    });

    it('should have currency default to CHF', () => {
      expect(component.currency()).toBe('CHF');
    });

    it('should have required default to false', () => {
      expect(component.required()).toBe(false);
    });

    it('should have testId default to currency-input', () => {
      expect(component.testId()).toBe('currency-input');
    });

    it('should have autoFocus default to true', () => {
      expect(component.autoFocus()).toBe(true);
    });

    it('should have value default to null', () => {
      expect(component.value()).toBeNull();
    });
  });

  describe('Model Binding', () => {
    it('should allow setting value via model', () => {
      component.value.set(250);
      expect(component.value()).toBe(250);
    });

    it('should allow setting value to null', () => {
      component.value.set(100);
      component.value.set(null);
      expect(component.value()).toBeNull();
    });
  });
});
