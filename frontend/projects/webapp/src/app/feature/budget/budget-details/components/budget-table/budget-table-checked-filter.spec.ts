import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { MatButtonToggleChange } from '@angular/material/button-toggle';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { BudgetTableCheckedFilter } from './budget-table-checked-filter';

describe('BudgetTableCheckedFilter', () => {
  let component: BudgetTableCheckedFilter;
  let fixture: ComponentFixture<BudgetTableCheckedFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetTableCheckedFilter, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
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

    component.onFilterChange({ value: true } as MatButtonToggleChange);

    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('should emit false when all items filter is selected', () => {
    fixture.detectChanges();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);

    component.onFilterChange({ value: false } as MatButtonToggleChange);

    expect(emitSpy).toHaveBeenCalledWith(false);
  });

  it('should keep the active filter selected when clicked again', async () => {
    fixture.componentRef.setInput('isShowingOnlyUnchecked', true);
    await fixture.whenStable();
    const emitSpy = vi.fn();
    component.isShowingOnlyUncheckedChange.subscribe(emitSpy);
    const activeToggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="unchecked-filter-chip"] button',
    );

    activeToggle.click();
    await fixture.whenStable();

    expect(activeToggle.getAttribute('aria-checked')).toBe('true');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should have the correct aria-label on the toggle group', () => {
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      'mat-button-toggle-group',
    );

    expect(group.getAttribute('aria-label')).toBe('Filtrer les éléments');
  });

  it('should have aria-live region for screen readers', () => {
    fixture.detectChanges();

    const liveRegion = fixture.nativeElement.querySelector('[role="status"]');

    expect(liveRegion).toBeTruthy();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
  });
});
