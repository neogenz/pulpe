import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { BudgetViewToggle } from './budget-view-toggle';

describe('BudgetViewToggle', () => {
  it('keeps one view selected and switches views', async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetViewToggle, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BudgetViewToggle);
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      'mat-button-toggle-group',
    );
    const grid: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="grid-mode-chip"] button',
    );
    const table: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="table-mode-chip"] button',
    );

    expect(group.getAttribute('aria-label')).toBe("Mode d'affichage");
    expect(grid.getAttribute('aria-checked')).toBe('true');

    table.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.viewMode()).toBe('table');
    expect(table.getAttribute('aria-checked')).toBe('true');

    table.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.viewMode()).toBe('table');
  });
});
