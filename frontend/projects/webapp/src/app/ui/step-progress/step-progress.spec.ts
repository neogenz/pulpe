import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { StepProgress } from './step-progress';

async function render(currentStep: number) {
  await TestBed.configureTestingModule({
    imports: [StepProgress],
    providers: [provideZonelessChangeDetection(), ...provideTranslocoForTest()],
  }).compileComponents();

  const fixture = TestBed.createComponent(StepProgress);
  fixture.componentRef.setInput('steps', [
    { labelKey: 'step.one' },
    { labelKey: 'step.two' },
    { labelKey: 'step.three' },
  ]);
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
});
