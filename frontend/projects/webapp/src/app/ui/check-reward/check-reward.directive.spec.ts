import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckRewardDirective } from './check-reward.directive';

@Component({
  imports: [MatSlideToggleModule, CheckRewardDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-slide-toggle [pulpeCheckReward]="checked()" data-testid="toggle" />
  `,
})
class HostComponent {
  readonly checked = signal(false);
}

describe('CheckRewardDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('rewards only the transition to checked and settles after the animation', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="toggle"]',
    ) as HTMLElement;

    expect(toggle.classList.contains('pulpe-check-reward')).toBe(false);

    fixture.componentInstance.checked.set(true);
    fixture.detectChanges();
    expect(toggle.classList.contains('pulpe-check-reward')).toBe(true);

    const animationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(animationEnd, 'animationName', {
      value: 'pulpe-check-reward-pop',
    });
    toggle.dispatchEvent(animationEnd);
    fixture.detectChanges();
    expect(toggle.classList.contains('pulpe-check-reward')).toBe(false);

    fixture.componentInstance.checked.set(false);
    fixture.detectChanges();
    expect(toggle.classList.contains('pulpe-check-reward')).toBe(false);

    fixture.componentInstance.checked.set(true);
    fixture.detectChanges();
    expect(toggle.classList.contains('pulpe-check-reward')).toBe(true);
  });

  it('does not start the reward when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="toggle"]',
    ) as HTMLElement;

    fixture.componentInstance.checked.set(true);
    fixture.detectChanges();

    expect(toggle.classList.contains('pulpe-check-reward')).toBe(false);
  });
});
