import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { SavingsGoalSourceLine } from './savings-goal-source-line';

const LONG_NAME =
  'Objectif de rénovation complète de la cuisine et de la salle de bain';

describe('SavingsGoalSourceLine', () => {
  let fixture: ComponentFixture<SavingsGoalSourceLine>;
  let component: SavingsGoalSourceLine;

  const render = (): HTMLElement | null =>
    fixture.nativeElement.querySelector(
      '[data-testid="savings-goal-source-line"]',
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SavingsGoalSourceLine, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    });

    fixture = TestBed.createComponent(SavingsGoalSourceLine);
    component = fixture.componentInstance;
  });

  it('names the goal an active link points to', () => {
    setTestInput(component.goalId, 'goal-1');
    setTestInput(component.goalName, 'Maison');
    fixture.detectChanges();

    const line = render()!;
    expect(line.textContent).toContain('Pris sur');
    expect(line.textContent).toContain('Maison');
    expect(line.querySelector('mat-icon')?.textContent?.trim()).toBe('savings');
  });

  it('keeps a deleted goal readable and neutral rather than erroneous', () => {
    setTestInput(component.goalId, null);
    setTestInput(component.goalName, 'Maison');
    fixture.detectChanges();

    const line = render()!;
    expect(line.textContent).toContain('Objectif supprimé');
    expect(line.textContent).toContain('Maison');
    expect(line.querySelector('mat-icon')?.textContent?.trim()).toBe(
      'link_off',
    );
    expect(line.className).not.toContain('error');
  });

  // A generic <span> cannot be named by `aria-label` — ARIA in HTML forbids it,
  // so browsers drop it. Hiding the only text behind `aria-hidden` on top of
  // that left the line, and the link wrapping it in the edit form, with no
  // accessible name at all. The visible text IS the name; only the icon
  // ligature ("savings") has to stay out of it.
  it('exposes the origin as text rather than behind a label ARIA ignores', () => {
    setTestInput(component.goalId, 'goal-1');
    setTestInput(component.goalName, 'Maison');
    fixture.detectChanges();

    const line = render()!;
    expect(line.getAttribute('aria-label')).toBeNull();
    expect(
      line.querySelector('[aria-hidden="true"]')?.textContent,
    ).not.toContain('Maison');
    expect(line.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('ellipses a long name in a compact list but keeps it whole for assistive tech', () => {
    setTestInput(component.goalId, 'goal-1');
    setTestInput(component.goalName, LONG_NAME);
    fixture.detectChanges();

    const line = render()!;
    expect(line.classList).toContain('truncate');
    expect(line.textContent).toContain(LONG_NAME);
  });

  it('shows the whole name in the detail variant', () => {
    setTestInput(component.goalId, 'goal-1');
    setTestInput(component.goalName, LONG_NAME);
    setTestInput(component.variant, 'detail');
    fixture.detectChanges();

    const line = render()!;
    expect(line.classList).not.toContain('truncate');
    expect(line.textContent).toContain(LONG_NAME);
  });

  it('renders nothing without a name', () => {
    setTestInput(component.goalId, null);
    setTestInput(component.goalName, null);
    fixture.detectChanges();

    expect(render()).toBeNull();
  });
});
