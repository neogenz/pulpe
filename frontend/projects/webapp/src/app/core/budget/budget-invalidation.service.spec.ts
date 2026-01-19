import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetInvalidationService } from './budget-invalidation.service';

describe('BudgetInvalidationService', () => {
  let service: BudgetInvalidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), BudgetInvalidationService],
    });
    service = TestBed.inject(BudgetInvalidationService);
  });

  it('should start with version 0', () => {
    expect(service.version()).toBe(0);
  });

  it('should increment version on invalidate', () => {
    service.invalidate();

    expect(service.version()).toBe(1);
  });

  it('should increment version multiple times', () => {
    service.invalidate();
    service.invalidate();
    service.invalidate();

    expect(service.version()).toBe(3);
  });
});
