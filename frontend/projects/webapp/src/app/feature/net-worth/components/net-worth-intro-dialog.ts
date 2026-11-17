import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { AnalyticsService } from '@core/analytics';
import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import {
  INTRO_SAMPLE,
  INTRO_STEPS,
  introTotals,
  primaryAction,
  type IntroSource,
} from './net-worth-intro.model';

export interface NetWorthIntroDialogData {
  source: IntroSource;
  isEmpty: boolean;
}

/** `'add'`: open the creation form next. Anything else: just closed. */
export type NetWorthIntroResult = 'add' | 'close' | undefined;

/**
 * « Mon patrimoine » explainer: three steps, each an animated example card above a title
 * and a short text. The view shows the model and adds nothing up.
 */
@Component({
  selector: 'pulpe-net-worth-intro-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  host: { 'data-testid': 'net-worth-intro-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-dialog-content class="!pt-6">
      <div class="scene" aria-hidden="true">
        <!-- One branch per step: the step's DOM is rebuilt, so its CSS animations replay. -->
        @switch (stepName()) {
          @case ('overview') {
            <div class="flex items-center justify-between gap-2">
              <span class="text-label-large text-on-surface-variant">{{
                'netWorth.intro.sample.everything' | transloco
              }}</span>
              <span class="example">{{
                'netWorth.intro.example' | transloco
              }}</span>
            </div>
            <p
              class="fade-in late m-0 mt-1 text-headline-medium font-extrabold tabular-nums"
            >
              {{ totals.gross | appCurrency: currency() : '1.0-0' }}
            </p>
            <div class="mt-3 grid grid-cols-1 gap-2">
              @for (
                line of sample.assets;
                track line.labelKey;
                let i = $index
              ) {
                <div class="tile converge" [style.--i]="i">
                  <span class="icon"
                    ><mat-icon>{{ line.icon }}</mat-icon></span
                  >
                  <span class="min-w-0 flex-1 truncate">{{
                    line.labelKey | transloco
                  }}</span>
                  <span class="tabular-nums">{{
                    line.value | appCurrency: currency() : '1.0-0'
                  }}</span>
                </div>
              }
            </div>
          }
          @case ('netWorth') {
            <div class="flex justify-end">
              <span class="example">{{
                'netWorth.intro.example' | transloco
              }}</span>
            </div>
            <div class="row rise">
              <span class="dot dot-own"></span>
              <span class="flex-1">{{ 'netWorth.gross' | transloco }}</span>
              <span class="tabular-nums">{{
                totals.gross | appCurrency: currency() : '1.0-0'
              }}</span>
            </div>
            <div class="row rise" style="--i: 1">
              <span class="dot dot-owe"></span>
              <span class="flex-1">
                {{ 'netWorth.debts' | transloco }}
                <span class="text-on-surface-variant"
                  >· {{ 'netWorth.intro.sample.loan' | transloco }}</span
                >
              </span>
              <span class="amber tabular-nums"
                >−{{ sample.debt | appCurrency: currency() : '1.0-0' }}</span
              >
            </div>
            <div class="bar">
              <span class="bar-debt" [style.width.%]="debtShare"></span>
            </div>
            <div class="net pop">
              <p class="m-0 text-title-small">
                {{ 'netWorth.heroTitle' | transloco }}
              </p>
              <p
                class="m-0 mt-1 text-headline-medium font-extrabold tabular-nums"
              >
                {{ totals.netBefore | appCurrency: currency() : '1.0-0' }}
              </p>
            </div>
          }
          @case ('update') {
            <div class="flex items-center justify-between gap-2">
              <span class="text-label-large text-on-surface-variant">{{
                'netWorth.heroTitle' | transloco
              }}</span>
              <span class="example">{{
                'netWorth.intro.example' | transloco
              }}</span>
            </div>
            <p
              class="swap m-0 mt-1 text-headline-medium font-extrabold tabular-nums"
            >
              <span class="swap-out">{{
                totals.netBefore | appCurrency: currency() : '1.0-0'
              }}</span>
              <span class="swap-in">{{
                totals.netAfter | appCurrency: currency() : '1.0-0'
              }}</span>
            </p>
            <div class="tile mt-3">
              <span class="icon"><mat-icon>savings</mat-icon></span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span>{{ 'netWorth.intro.sample.savings' | transloco }}</span>
                <span class="swap text-body-small text-on-surface-variant">
                  <span class="swap-out">{{
                    'netWorth.intro.updatedLongAgo' | transloco
                  }}</span>
                  <span class="swap-in font-semibold text-primary">{{
                    'netWorth.intro.updatedToday' | transloco
                  }}</span>
                </span>
              </span>
              <span class="swap font-bold tabular-nums">
                <span class="swap-out">{{
                  sample.savingsBefore | appCurrency: currency() : '1.0-0'
                }}</span>
                <span class="swap-in">{{
                  sample.savingsAfter | appCurrency: currency() : '1.0-0'
                }}</span>
              </span>
              <span class="pencil press"><mat-icon>edit</mat-icon></span>
            </div>
            <p class="hint rise late m-0 mt-3 text-body-medium">
              <mat-icon class="shrink-0 text-primary">swap_vert</mat-icon>
              {{
                'netWorth.intro.budgetHint'
                  | transloco
                    : {
                        amount:
                          sample.budgetSuggestion
                          | appCurrency: currency() : '1.0-0',
                      }
              }}
            </p>
          }
        }
      </div>
      <p class="sr-only">
        {{
          'netWorth.intro.steps.' + stepName() + '.scene'
            | transloco: sceneParams()
        }}
      </p>

      <h2
        id="net-worth-intro-title"
        class="rise m-0 mt-6 text-headline-small font-bold"
        style="--i: 2"
      >
        {{ 'netWorth.intro.steps.' + stepName() + '.title' | transloco }}
      </h2>
      <p
        class="rise m-0 mt-2 text-body-large text-on-surface-variant"
        style="--i: 2"
      >
        {{ 'netWorth.intro.steps.' + stepName() + '.body' | transloco }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions class="flex-wrap !px-6 !pb-6 gap-2">
      <div class="mr-auto flex gap-1.5" aria-hidden="true">
        @for (name of steps; track name; let i = $index) {
          <span class="step-dot" [class.step-dot-current]="i === step()"></span>
        }
      </div>
      @if (action() === 'next') {
        <button
          matButton
          (click)="close(undefined)"
          data-testid="net-worth-intro-later-button"
        >
          {{ 'netWorth.intro.later' | transloco }}
        </button>
      }
      <button
        matButton="filled"
        cdkFocusInitial
        (click)="onPrimary()"
        data-testid="net-worth-intro-primary-button"
      >
        {{ 'netWorth.intro.actions.' + action() | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
    /* Full screen on a phone: the content takes the height, so the actions sit at the bottom */
    :host-context(.full-screen-dialog) {
      display: flex;
      flex-direction: column;
      height: 100%;
      mat-dialog-content {
        flex: 1;
        max-height: none;
      }
    }
    /* Flat: the dialog already floats, so the card sets itself apart by tone, not by a shadow */
    .scene {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--pulpe-surface-radius-card);
      background: var(--mat-sys-surface-container-lowest);
      padding: 1.25rem;
    }
    .example {
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-medium);
      padding: 0.25rem 0.625rem;
    }
    .tile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container);
      padding: 0.625rem;
    }
    .icon,
    .pencil {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .pencil {
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0;
    }
    .dot {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 50%;
    }
    .dot-own {
      background: var(--mat-sys-primary);
    }
    .dot-owe {
      background: var(--pulpe-amber);
    }
    .amber {
      color: var(--pulpe-amber);
    }
    .bar {
      position: relative;
      overflow: hidden;
      height: 0.75rem;
      margin: 0.625rem 0 1rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary);
    }
    .bar-debt {
      position: absolute;
      inset-block: 0;
      right: 0;
      background: var(--pulpe-amber);
      transform-origin: right center;
      animation: grow 0.8s var(--ease) 0.5s both;
    }
    .net {
      border-radius: var(--pulpe-surface-radius-card);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      padding: 1rem;
      text-align: center;
    }
    .hint {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      border: 1px dashed var(--mat-sys-outline);
      border-radius: var(--mat-sys-corner-medium);
      padding: 0.625rem 0.75rem;
    }
    .step-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-outline-variant);
      transition: width 0.3s var(--ease);
    }
    .step-dot-current {
      width: 1.375rem;
      background: var(--mat-sys-primary);
    }
    .swap {
      display: grid;
    }
    .swap > * {
      grid-area: 1 / 1;
    }

    /* Motion: one keyframe per gesture, delays in steps of 0.15s through --i. */
    :host {
      --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .converge {
      animation: converge 0.7s var(--ease) calc(0.1s + var(--i) * 0.15s) both;
    }
    .converge:nth-child(even) {
      --dx: 3rem;
      --tilt: 7deg;
    }
    .converge:nth-child(odd) {
      --dx: -3rem;
      --tilt: -8deg;
    }
    .converge:nth-child(-n + 2) {
      --dy: -3.5rem;
    }
    .converge:nth-child(n + 3) {
      --dy: 3.5rem;
    }
    .rise {
      animation: rise 0.55s var(--ease) calc(var(--i, 0) * 0.2s) both;
    }
    .fade-in {
      animation: fade 0.4s ease both;
    }
    .late {
      animation-delay: 0.9s;
    }
    .rise.late {
      animation-delay: 1.9s;
    }
    .pop {
      animation: pop 0.6s var(--ease) 1s both;
    }
    .press {
      animation: press 0.35s ease 1s both;
    }
    .swap-out {
      animation: fade-out 0.3s ease 1.4s forwards;
    }
    .swap-in {
      animation: fade 0.3s ease 1.4s both;
    }
    @keyframes converge {
      from {
        opacity: 0;
        transform: translate(var(--dx), var(--dy)) rotate(var(--tilt));
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(0.875rem);
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes fade-out {
      to {
        opacity: 0;
      }
    }
    @keyframes grow {
      from {
        transform: scaleX(0);
      }
    }
    @keyframes pop {
      0% {
        opacity: 0;
        transform: scale(0.85);
      }
      60% {
        opacity: 1;
        transform: scale(1.04);
      }
    }
    @keyframes press {
      50% {
        transform: scale(0.88);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .converge,
      .rise,
      .fade-in,
      .pop,
      .press,
      .bar-debt,
      .swap-in {
        animation: fade 0.2s ease both;
      }
      .late,
      .rise.late {
        animation-delay: 0s;
      }
      .swap-out {
        animation: fade-out 0.01s forwards;
      }
      .step-dot {
        transition: none;
      }
    }
  `,
})
export class NetWorthIntroDialog {
  readonly #dialogRef =
    inject<MatDialogRef<NetWorthIntroDialog, NetWorthIntroResult>>(
      MatDialogRef,
    );
  readonly #data = inject<NetWorthIntroDialogData>(MAT_DIALOG_DATA);
  readonly #analytics = inject(AnalyticsService);
  readonly #settings = inject(UserSettingsStore);

  protected readonly steps = INTRO_STEPS;
  protected readonly sample = INTRO_SAMPLE;
  protected readonly totals = introTotals(INTRO_SAMPLE);
  protected readonly debtShare = (INTRO_SAMPLE.debt / this.totals.gross) * 100;
  protected readonly currency = this.#settings.currency;

  /** Screen readers get the step's example as one sentence, with the ISO code they pronounce best. */
  protected readonly sceneParams = computed(() => {
    const currency = this.currency();
    const { numberLocale } = CURRENCY_CONFIG[currency];
    const money = (value: number) =>
      `${formatNumber(value, numberLocale, '1.0-0')} ${currency}`;
    return {
      gross: money(this.totals.gross),
      debt: money(INTRO_SAMPLE.debt),
      net: money(this.totals.netBefore),
      before: money(INTRO_SAMPLE.savingsBefore),
      after: money(INTRO_SAMPLE.savingsAfter),
      netAfter: money(this.totals.netAfter),
    };
  });

  protected readonly step = signal(0);
  protected readonly stepName = computed(() => INTRO_STEPS[this.step()]);
  protected readonly action = computed(() =>
    primaryAction(this.step(), this.#data.isEmpty),
  );

  constructor() {
    const source = this.#data.source;
    this.#analytics.captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED, {
      source,
    });
    // afterClosed covers every way out (button, Escape, backdrop): exactly one end event.
    this.#dialogRef.afterClosed().subscribe((result) => {
      if (result === 'add' || result === 'close') {
        this.#analytics.captureEvent(
          ANALYTICS_EVENTS.NET_WORTH_INTRO_COMPLETED,
          {
            source,
            action: result === 'add' ? 'add_asset' : 'close',
          },
        );
      } else {
        this.#analytics.captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_SKIPPED, {
          source,
          step: this.step(),
        });
      }
    });
  }

  protected onPrimary(): void {
    const action = this.action();
    if (action === 'next') {
      this.step.update((step) => step + 1);
      return;
    }
    this.close(action === 'add' ? 'add' : 'close');
  }

  protected close(result: NetWorthIntroResult): void {
    this.#dialogRef.close(result);
  }
}
