import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HasBudgetCache } from './has-budget-cache';

describe('HasBudgetCache', () => {
  let service: HasBudgetCache;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HasBudgetCache);
  });

  it('should start with null (unknown state)', () => {
    expect(service.hasBudget()).toBeNull();
  });

  it('should return true when cache is set to true', () => {
    service.setHasBudget(true);

    expect(service.hasBudget()).toBe(true);
  });

  it('should return false when cache is set to false', () => {
    service.setHasBudget(false);

    expect(service.hasBudget()).toBe(false);
  });

  it('should return null after clear', () => {
    service.setHasBudget(true);

    service.clear();

    expect(service.hasBudget()).toBeNull();
  });

  it('should allow state transitions', () => {
    expect(service.hasBudget()).toBeNull();

    service.setHasBudget(true);
    expect(service.hasBudget()).toBe(true);

    service.setHasBudget(false);
    expect(service.hasBudget()).toBe(false);

    service.clear();
    expect(service.hasBudget()).toBeNull();
  });
});
