import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HasBudgetState } from './has-budget-state';

describe('HasBudgetState', () => {
  let service: HasBudgetState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HasBudgetState);
  });

  it('should start with null (unknown state)', () => {
    expect(service.get()).toBeNull();
  });

  it('should return true after setHasBudget', () => {
    service.setHasBudget();

    expect(service.get()).toBe(true);
  });

  it('should return false after setNoBudget', () => {
    service.setNoBudget();

    expect(service.get()).toBe(false);
  });

  it('should return null after clear', () => {
    service.setHasBudget();

    service.clear();

    expect(service.get()).toBeNull();
  });

  it('should allow state transitions', () => {
    expect(service.get()).toBeNull();

    service.setHasBudget();
    expect(service.get()).toBe(true);

    service.setNoBudget();
    expect(service.get()).toBe(false);

    service.clear();
    expect(service.get()).toBeNull();
  });
});
