import { Directive, effect, input, signal } from '@angular/core';

/** Plays the shared confirmation motion only after an unchecked item becomes checked. */
@Directive({
  selector: 'mat-slide-toggle[pulpeCheckReward]',
  host: {
    '[class.pulpe-check-reward]': 'rewarding()',
    '(animationend)': 'finishReward($event)',
  },
})
export class CheckRewardDirective {
  readonly checked = input(false, { alias: 'pulpeCheckReward' });
  protected readonly rewarding = signal(false);
  #wasChecked: boolean | undefined;

  constructor() {
    effect(() => {
      const checked = this.checked();
      if (checked && this.#wasChecked === false) this.rewarding.set(true);
      if (!checked) this.rewarding.set(false);
      this.#wasChecked = checked;
    });
  }

  protected finishReward(event: AnimationEvent): void {
    if (event.animationName === 'pulpe-check-reward-pop') {
      this.rewarding.set(false);
    }
  }
}
