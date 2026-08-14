import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { GoalPlanRepairCallout } from './goal-plan-repair-callout';
import { setTestInput } from '../../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../../testing/transloco-testing';

describe('GoalPlanRepairCallout', () => {
  let fixture: ComponentFixture<GoalPlanRepairCallout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalPlanRepairCallout],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalPlanRepairCallout);
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  it('renders nothing when there is nothing to repair', () => {
    setTestInput(fixture.componentInstance.count, 0);
    fixture.detectChanges();

    expect(query('goal-plan-repair-callout')).toBeFalsy();
  });

  it('uses the singular wording for a single repairable month', () => {
    setTestInput(fixture.componentInstance.count, 1);
    fixture.detectChanges();

    const callout = query('goal-plan-repair-callout');
    expect(callout).toBeTruthy();
    expect(callout.nativeElement.textContent).toContain(
      'Le versement prévu pour cet objectif manque dans un budget déjà créé.',
    );
    expect(
      query('goal-plan-repair-preview').nativeElement.textContent,
    ).toContain('Vérifier avant d’ajouter');
  });

  it('uses natural plural agreement for several repairable months', () => {
    setTestInput(fixture.componentInstance.count, 2);
    fixture.detectChanges();

    expect(
      query('goal-plan-repair-callout').nativeElement.textContent,
    ).toContain(
      'Les versements prévus pour cet objectif manquent dans 2 budgets déjà créés.',
    );
  });

  it('emits previewRequested when the preview button is clicked', () => {
    setTestInput(fixture.componentInstance.count, 1);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.previewRequested.subscribe(spy);

    query('goal-plan-repair-preview').nativeElement.click();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('disables the preview button while a repair is being applied', () => {
    setTestInput(fixture.componentInstance.count, 1);
    setTestInput(fixture.componentInstance.isApplying, true);
    fixture.detectChanges();

    expect(query('goal-plan-repair-preview').nativeElement.disabled).toBe(true);
  });
});
