import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { MatChipSelectionChange } from '@angular/material/chips';
import { BudgetTableCheckedFilter } from './budget-table-checked-filter';

describe('BudgetTableCheckedFilter', () => {
  let component: BudgetTableCheckedFilter;
  let fixture: ComponentFixture<BudgetTableCheckedFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetTableCheckedFilter, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetTableCheckedFilter);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should emit true when unchecked filter is selected', () => {
    fixture.detectChanges();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);

    const event = {
      isUserInput: true,
      selected: true,
    } as MatChipSelectionChange;
    component.onFilterChange(true, event);

    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should emit false when all items filter is selected', () => {
    fixture.detectChanges();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);

    const event = {
      isUserInput: true,
      selected: true,
    } as MatChipSelectionChange;
    component.onFilterChange(false, event);

    expect(emitSpy).toHaveBeenCalledWith(false);
  });

  it('should not emit on programmatic selection (isUserInput=false)', () => {
    fixture.detectChanges();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);

    const event = {
      isUserInput: false,
      selected: true,
    } as MatChipSelectionChange;
    component.onFilterChange(true, event);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not emit when chip is deselected', () => {
    fixture.detectChanges();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);

    const event = {
      isUserInput: true,
      selected: false,
    } as MatChipSelectionChange;
    component.onFilterChange(true, event);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should have correct aria-label on listbox', () => {
    fixture.detectChanges();

    const listbox = fixture.nativeElement.querySelector('mat-chip-listbox');

    expect(listbox.getAttribute('aria-label')).toBe('Filtrer les éléments');
  });

  it('should have aria-live region for screen readers', () => {
    fixture.detectChanges();

    const liveRegion = fixture.nativeElement.querySelector('[role="status"]');

    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
  });
});
