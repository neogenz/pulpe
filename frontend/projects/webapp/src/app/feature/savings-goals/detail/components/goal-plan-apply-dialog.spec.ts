import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  GoalPlanApplyDialog,
  type GoalPlanApplyDialogData,
} from './goal-plan-apply-dialog';

function configureDialog(data: GoalPlanApplyDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    imports: [GoalPlanApplyDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(GoalPlanApplyDialog);
  fixture.detectChanges();
  return { fixture, close };
}

function query(fixture: ComponentFixture<GoalPlanApplyDialog>, testId: string) {
  return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
}

describe('GoalPlanApplyDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('blurs the verdict when it carries a recovery projection amount', () => {
    const { fixture } = configureDialog({
      mode: 'creation',
      changes: [{ month: 8, year: 2026, before: 0, after: 175.35 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection après création : 1’375 CHF',
      verdictHasAmount: true,
    });

    const verdict = query(fixture, 'goal-plan-apply-verdict').query(
      By.css('p'),
    );

    expect(verdict.nativeElement.classList).toContain('ph-no-capture');
  });

  it('keeps the simulation verdict readable when it carries no amount', () => {
    const { fixture } = configureDialog({
      changes: [{ month: 8, year: 2026, before: 600, after: 450 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Objectif atteint en août 2026',
    });

    const verdict = query(fixture, 'goal-plan-apply-verdict').query(
      By.css('p'),
    );

    expect(verdict.nativeElement.classList).not.toContain('ph-no-capture');
  });

  it('keeps the confirm action clickable alongside a blurred verdict', () => {
    const { fixture, close } = configureDialog({
      mode: 'creation',
      changes: [{ month: 8, year: 2026, before: 0, after: 175.35 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection après création : 1’375 CHF',
      verdictHasAmount: true,
    });

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();

    expect(close).toHaveBeenCalledWith(true);
  });
});
