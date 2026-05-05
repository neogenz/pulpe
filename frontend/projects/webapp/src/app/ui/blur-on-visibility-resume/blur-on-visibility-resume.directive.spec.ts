import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BlurOnVisibilityResumeDirective } from './blur-on-visibility-resume.directive';

@Component({
  imports: [BlurOnVisibilityResumeDirective],
  template: `
    <div pulpeBlurOnVisibilityResume data-testid="host">
      <input data-testid="inside" />
    </div>
    <input data-testid="outside" />
  `,
})
class HostComponent {}

function setVisibilityState(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('BlurOnVisibilityResumeDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    setVisibilityState('visible');
  });

  it('should blur active element inside host on visibility change to visible', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const insideInput = fixture.nativeElement.querySelector(
      '[data-testid="inside"]',
    ) as HTMLInputElement;
    insideInput.focus();
    expect(document.activeElement).toBe(insideInput);

    setVisibilityState('visible');
    dispatchVisibilityChange();

    expect(document.activeElement).not.toBe(insideInput);
  });

  it('should NOT blur active element outside host on visibility change', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const outsideInput = fixture.nativeElement.querySelector(
      '[data-testid="outside"]',
    ) as HTMLInputElement;
    outsideInput.focus();
    expect(document.activeElement).toBe(outsideInput);

    setVisibilityState('visible');
    dispatchVisibilityChange();

    expect(document.activeElement).toBe(outsideInput);
  });

  it('should not blur when visibility changes to hidden', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const insideInput = fixture.nativeElement.querySelector(
      '[data-testid="inside"]',
    ) as HTMLInputElement;
    insideInput.focus();

    setVisibilityState('hidden');
    dispatchVisibilityChange();

    expect(document.activeElement).toBe(insideInput);
  });

  it('should not throw when no element is focused on visibility change', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    (document.activeElement as HTMLElement | null)?.blur();

    setVisibilityState('visible');
    expect(() => dispatchVisibilityChange()).not.toThrow();
  });

  it('should remove the visibilitychange listener on destroy', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const insideInput = fixture.nativeElement.querySelector(
      '[data-testid="inside"]',
    ) as HTMLInputElement;
    insideInput.focus();

    fixture.destroy();

    setVisibilityState('visible');
    dispatchVisibilityChange();

    expect(document.activeElement).toBe(insideInput);
  });
});
