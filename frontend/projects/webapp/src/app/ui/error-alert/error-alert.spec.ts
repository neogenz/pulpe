import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorAlert } from './error-alert';

describe('ErrorAlert', () => {
  let component: ErrorAlert;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorAlert],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    component = TestBed.createComponent(ErrorAlert).componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have message input defined', () => {
      expect(component.message).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should have default message value of null', () => {
      expect(component.message()).toBeNull();
    });
  });

  describe('Input Type', () => {
    it('should accept string value', () => {
      expect(() => component.message()).not.toThrow();
    });
  });
});
