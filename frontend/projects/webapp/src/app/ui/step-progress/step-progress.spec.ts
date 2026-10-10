import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { StepProgress, type ProgressStep } from './step-progress';

const STEPS = [
  { labelKey: 'step.one' },
  { labelKey: 'step.two' },
  { labelKey: 'step.three' },
];

async function render(currentStep: number, steps: ProgressStep[] = STEPS) {
  await TestBed.configureTestingModule({
    imports: [StepProgress],
    providers: [provideZonelessChangeDetection(), ...provideTranslocoForTest()],
  }).compileComponents();

  const fixture = TestBed.createComponent(StepProgress);
  fixture.componentRef.setInput('steps', steps);
  fixture.componentRef.setInput('ariaLabel', 'Progress');
  fixture.componentRef.setInput('currentStep', currentStep);
  fixture.detectChanges();

  return fixture.nativeElement.querySelector('ol') as HTMLOListElement;
}

describe('StepProgress', () => {
  it('should mark steps before the current one as completed and the rest as upcoming', async () => {
    const list = await render(2);

    const states = [...list.querySelectorAll('li')].map((li) =>
      li.getAttribute('data-state'),
    );
    expect(states).toEqual(['completed', 'current', 'upcoming']);
    expect(list.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(list.getAttribute('aria-label')).toBe('Progress');
  });

  it('should render no data-testid when none is given', async () => {
    const list = await render(1);

    expect(list.hasAttribute('data-testid')).toBe(false);
  });

  it('should show the short label on mobile and the full label from sm up', async () => {
    const list = await render(1, [
      ...STEPS.slice(0, 2),
      { labelKey: 'step.three', shortLabelKey: 'step.threeShort' },
    ]);

    const labels = [
      ...list
        .querySelectorAll('li')[2]
        .querySelectorAll('.sm\\:hidden, .sm\\:inline'),
    ].map((span) => [span.textContent?.trim(), span.className]);
    expect(labels).toEqual([
      ['step.threeShort', 'sm:hidden'],
      ['step.three', 'hidden sm:inline'],
    ]);
  });
});
