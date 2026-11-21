import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { GUIDE_GAP, GUIDE_SAMPLE } from './reconcile-guide.model';

/** What every scene drawing shares: the figures, formatted like the board (bare numbers). */
abstract class GuideScene {
  readonly #settings = inject(UserSettingsStore);
  protected readonly sample = GUIDE_SAMPLE;

  protected money(value: number, digits = '1.2-2'): string {
    const { numberLocale } = CURRENCY_CONFIG[this.#settings.currency()];
    return formatNumber(value, numberLocale, digits);
  }
}

export const SCENE_BASE_STYLES = `
    :host {
      display: flex;
      flex-direction: column;
    }
    .card {
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--pulpe-surface-radius-panel);
      background: var(--mat-sys-surface-container-lowest);
    }
    .bank-head,
    .pulpe-head {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.75rem;
      font: var(--mat-sys-label-large);
      font-weight: 700;
    }
    .bank-head {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface);
      mat-icon {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
      }
    }
    .pulpe-head {
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-primary);
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.875rem 0.75rem 1rem;
    }
    .logo {
      width: 0.875rem;
      height: 0.875rem;
      border-radius: 0.25rem;
      background: var(--mat-sys-primary);
    }
    .caption {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .figure {
      font-family: var(--mat-sys-headline-small-font);
      font-size: 1.375rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .figure.small {
      font-size: 1.0625rem;
    }
    .rise {
      animation: rise 0.5s var(--ease) calc(var(--i, 0) * var(--beat)) both;
    }
    .pop {
      animation: pop 0.5s var(--ease) calc(var(--i, 0) * var(--beat)) both;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
    @keyframes pop {
      0% {
        opacity: 0;
        transform: scale(0.4);
      }
      60% {
        opacity: 1;
        transform: scale(1.18);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .rise,
      .pop {
        animation: none;
      }
    }
`;

@Component({
  selector: 'pulpe-guide-compare-scene',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-stretch gap-2">
      <div class="card rise min-w-0 flex-1">
        <div class="bank-head">
          <mat-icon>account_balance</mat-icon>
          <span>{{
            'currentMonth.reconcile.guide.sample.bank' | transloco
          }}</span>
        </div>
        <div class="card-body">
          <span class="caption">{{
            'currentMonth.reconcile.guide.sample.checking' | transloco
          }}</span>
          <span class="figure">{{ money(sample.bank) }}</span>
        </div>
      </div>
      <span class="differs pop" style="--i: 2">≠</span>
      <div class="card rise min-w-0 flex-1" style="--i: 1">
        <div class="pulpe-head">
          <span class="logo"></span>
          <span>{{
            'currentMonth.reconcile.guide.sample.pulpe' | transloco
          }}</span>
        </div>
        <div class="card-body">
          <span class="caption">{{
            'currentMonth.reconcile.guide.sample.checked' | transloco
          }}</span>
          <span class="figure">{{ money(sample.pulpe) }}</span>
        </div>
      </div>
    </div>
    <p class="gap-pill rise" style="--i: 4">
      {{
        'currentMonth.reconcile.guide.sample.gap'
          | transloco: { amount: money(gap, '1.0-0') }
      }}
    </p>
  `,
  styles: [
    SCENE_BASE_STYLES,
    `
      .differs {
        align-self: center;
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 2.125rem;
        height: 2.125rem;
        border-radius: 50%;
        background: var(--pulpe-amber-container);
        color: var(--pulpe-amber);
        font-weight: 700;
        font-size: 1.25rem;
      }
      .gap-pill {
        align-self: center;
        margin: 1.125rem 0 0;
        padding: 0.625rem 1rem;
        border-radius: var(--mat-sys-corner-full);
        background: var(--pulpe-amber-container);
        color: var(--pulpe-amber-on-container);
        font: var(--mat-sys-label-large);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class GuideCompareScene extends GuideScene {
  protected readonly gap = GUIDE_GAP;
}

@Component({
  selector: 'pulpe-guide-type-scene',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card rise">
      <div class="bank-head">
        <mat-icon>account_balance</mat-icon>
        <span>{{
          'currentMonth.reconcile.guide.sample.bank' | transloco
        }}</span>
      </div>
      <div class="flex items-center justify-between gap-2 px-3 py-3">
        <span class="caption">{{
          'currentMonth.reconcile.guide.sample.checking' | transloco
        }}</span>
        <span class="figure circled glow" style="--i: 1">{{
          money(sample.bank)
        }}</span>
      </div>
    </div>
    <mat-icon class="arrow rise" style="--i: 2">arrow_downward</mat-icon>
    <div class="card rise" style="--i: 2">
      <div class="pulpe-head">
        <span class="logo"></span>
        <span>{{
          'currentMonth.reconcile.guide.sample.pulpe' | transloco
        }}</span>
      </div>
      <div class="flex flex-col gap-2 p-3">
        <span class="caption">{{
          'currentMonth.reconcile.guide.sample.onAccounts' | transloco
        }}</span>
        <span class="field figure">
          @for (digit of typedDigits; track $index) {
            <span class="rise" [style.--i]="4 + $index">{{ digit }}</span>
          }
          <span class="caret leaves" style="--i: 7"></span>
        </span>
        <span class="press cta" style="--i: 8">{{
          'currentMonth.reconcile.guide.sample.compareButton' | transloco
        }}</span>
      </div>
    </div>
  `,
  styles: [
    SCENE_BASE_STYLES,
    `
      .circled {
        padding: 0.125rem 0.5rem;
        border-radius: 0.625rem;
        box-shadow: 0 0 0 3px var(--mat-sys-primary);
      }
      .arrow {
        align-self: center;
        margin: 0.5rem 0;
        color: var(--mat-sys-primary);
      }
      .field {
        display: flex;
        align-items: center;
        min-height: 2.5rem;
        padding: 0 0.75rem;
        border: 1.5px solid var(--mat-sys-primary);
        border-radius: var(--mat-sys-corner-medium);
        font-size: 1.25rem;
      }
      .caret {
        width: 2px;
        height: 1.375rem;
        margin-left: 2px;
        background: var(--mat-sys-primary);
      }
      .cta {
        padding: 0.5rem;
        border-radius: var(--mat-sys-corner-full);
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        font: var(--mat-sys-label-large);
        text-align: center;
      }
      .press {
        animation: press 0.35s ease calc(var(--i, 0) * var(--beat)) both;
      }
      .glow {
        animation: glow 0.6s ease calc(var(--i, 0) * var(--beat)) both;
      }
      .leaves {
        animation: leave 0.4s ease calc(var(--i, 0) * var(--beat)) forwards;
      }
      .caret.leaves {
        animation:
          blink 0.8s steps(1) infinite,
          leave 0.2s ease calc(var(--i, 0) * var(--beat)) forwards;
      }
      @keyframes press {
        40% {
          transform: scale(0.94);
          filter: brightness(0.85);
        }
      }
      @keyframes glow {
        from {
          box-shadow: 0 0 0 0 transparent;
        }
      }
      @keyframes leave {
        to {
          opacity: 0;
        }
      }
      @keyframes blink {
        50% {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .press,
        .glow {
          animation: none;
        }
        .leaves,
        .caret.leaves {
          animation: none;
          opacity: 0;
        }
      }
    `,
  ],
})
export class GuideTypeScene extends GuideScene {
  protected readonly typedDigits = String(GUIDE_SAMPLE.bank).split('');
}

@Component({
  selector: 'pulpe-guide-check-scene',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card rise">
      <div class="pulpe-head">
        <span class="logo"></span>
        <span>{{
          'currentMonth.reconcile.guide.sample.pulpe' | transloco
        }}</span>
      </div>
      <div class="flex flex-col gap-2 p-3">
        <div class="flex items-baseline justify-between gap-2">
          <span class="caption">{{
            'currentMonth.reconcile.guide.sample.onAccounts' | transloco
          }}</span>
          <span class="figure small">{{ money(sample.bank) }}</span>
        </div>
        <div class="flex items-baseline justify-between gap-2 border-t pt-2">
          <span class="caption">{{
            'currentMonth.reconcile.guide.sample.pulpeChecked' | transloco
          }}</span>
          <span class="swap figure small">
            <span class="swap-out leaves" style="--i: 7">{{
              money(sample.pulpe)
            }}</span>
            <span class="swap-in rise" style="--i: 7">{{
              money(sample.bank)
            }}</span>
          </span>
        </div>
        <div class="fold" style="--i: 6">
          <p class="question leaves m-0" style="--i: 6">
            {{ 'currentMonth.reconcile.guide.sample.question' | transloco }}
          </p>
        </div>
        <div class="expense">
          <span class="box">
            <span class="tap" style="--i: 3"></span>
            <span class="tick pop" style="--i: 4"
              ><mat-icon>check</mat-icon></span
            >
          </span>
          <span class="min-w-0 flex-1 truncate">{{
            'currentMonth.reconcile.guide.sample.expense' | transloco
          }}</span>
          <span class="tabular-nums">{{ money(sample.essence) }}</span>
        </div>
        <div class="matched rise" style="--i: 9">
          <span class="matched-mark"><mat-icon>check</mat-icon></span>
          <span>{{
            'currentMonth.reconcile.guide.sample.matched' | transloco
          }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    SCENE_BASE_STYLES,
    `
      .border-t {
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .question {
        font: var(--mat-sys-label-large);
      }
      .expense {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.5rem;
        font: var(--mat-sys-body-medium);
      }
      .box {
        position: relative;
        flex-shrink: 0;
        width: 1.375rem;
        height: 1.375rem;
        border: 1.5px solid var(--mat-sys-outline);
        border-radius: 0.375rem;
        box-sizing: border-box;
      }
      .tap {
        position: absolute;
        inset: -0.625rem;
        border-radius: 50%;
        background: var(--mat-sys-primary);
        opacity: 0;
        animation: ripple 0.5s ease calc(var(--i, 0) * var(--beat)) both;
      }
      .tick {
        position: absolute;
        inset: -1.5px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        mat-icon {
          width: 1rem;
          height: 1rem;
          font-size: 1rem;
        }
      }
      .matched {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.625rem 0.75rem;
        border-radius: var(--mat-sys-corner-medium);
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        color: var(--mat-sys-primary);
        font: var(--mat-sys-label-large);
      }
      .matched-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 50%;
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        mat-icon {
          width: 1rem;
          height: 1rem;
          font-size: 1rem;
        }
      }
      .swap {
        display: inline-grid;
        justify-items: end;
      }
      .swap > * {
        grid-area: 1 / 1;
      }
      .leaves {
        animation: leave 0.4s ease calc(var(--i, 0) * var(--beat)) forwards;
      }
      @keyframes ripple {
        0% {
          opacity: 0;
          transform: scale(0.5);
        }
        30% {
          opacity: 0.35;
          transform: scale(1);
        }
        100% {
          opacity: 0;
          transform: scale(1.8);
        }
      }
      @keyframes leave {
        to {
          opacity: 0;
        }
      }
      /* The question fades, then its slot folds away so the final frame has no hole. */
      .fold {
        display: grid;
        grid-template-rows: 1fr;
        animation: fold 0.4s ease calc(var(--i, 0) * var(--beat)) forwards;
      }
      .fold > p {
        min-height: 0;
        overflow: hidden;
      }
      @keyframes fold {
        to {
          grid-template-rows: 0fr;
          margin-block: -0.5rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tap {
          animation: none;
        }
        .leaves {
          animation: none;
          opacity: 0;
        }
        .fold {
          animation: none;
          grid-template-rows: 0fr;
          margin-block: -0.5rem;
        }
      }
    `,
  ],
})
export class GuideCheckScene extends GuideScene {}
