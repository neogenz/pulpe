import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';
import { CurrencyInput } from '@ui/currency-input';
import { GoalPlanSimulatorStore } from '../services/goal-plan-simulator-store';

/**
 * Pilier C — toolbar de simulation (docs/SAVINGS_PLAN.md §2). Slider global
 * « Chaque mois, je mets » + input jumeau (chemin précision/a11y), redistribution
 * de l'effort restant, reset du brouillon.
 * Bouger le slider écrase tous les overrides par mois — annoncé en `aria-live`.
 */
@Component({
  selector: 'pulpe-goal-plan-simulator-toolbar',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
    TranslocoPipe,
    CurrencyInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-4 rounded-2xl bg-surface-container p-4"
      data-testid="goal-plan-simulator-toolbar"
    >
      <div class="flex flex-col gap-2">
        <div>
          <span class="text-title-small font-medium">
            {{ 'savingsGoals.simulate.everyMonth' | transloco }}
          </span>
        </div>
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <mat-slider
            class="flex-1"
            [min]="0"
            [max]="store.sliderMax()"
            [step]="STEP"
            [disabled]="store.hasVariableAmounts()"
          >
            <input
              matSliderThumb
              [ngModel]="sliderValue() ?? 0"
              (ngModelChange)="onSliderChange($event)"
              [attr.aria-label]="
                (store.hasVariableAmounts()
                  ? 'savingsGoals.simulate.variableAmountsHint'
                  : 'savingsGoals.simulate.everyMonth'
                ) | transloco
              "
              data-testid="goal-plan-slider"
            />
          </mat-slider>
          <div class="md:w-44">
            <pulpe-currency-input
              [label]="
                (store.hasVariableAmounts()
                  ? 'savingsGoals.simulate.variableAmounts'
                  : 'savingsGoals.simulate.amountInput'
                ) | transloco
              "
              [value]="sliderValue()"
              (valueChange)="onInputChange($event)"
              [currency]="currency()"
              [autoFocus]="false"
              [placeholder]="
                store.hasVariableAmounts()
                  ? ('savingsGoals.simulate.variableAmounts' | transloco)
                  : '0.00'
              "
              testId="goal-plan-amount-input"
            />
          </div>
        </div>
        <p
          class="text-body-medium font-medium text-financial-savings"
          data-testid="goal-plan-verdict"
          aria-hidden="true"
        >
          {{ verdict() }}
        </p>
        <p class="sr-only" aria-live="polite">{{ ariaVerdict() }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          matButton="tonal"
          (click)="onRedistribute()"
          [matTooltip]="'savingsGoals.simulate.redistributeHint' | transloco"
          matTooltipPosition="above"
          data-testid="goal-plan-redistribute"
        >
          <mat-icon>auto_awesome</mat-icon>
          {{ 'savingsGoals.simulate.redistribute' | transloco }}
        </button>
        <button
          matButton
          (click)="onRevert()"
          [disabled]="!store.hasChanges()"
          data-testid="goal-plan-revert"
        >
          {{ 'savingsGoals.simulate.revert' | transloco }}
        </button>
      </div>

      <p
        class="sr-only"
        aria-live="polite"
        data-testid="goal-plan-announcement"
      >
        {{ announcement() }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class GoalPlanSimulatorToolbar {
  protected readonly store = inject(GoalPlanSimulatorStore);
  readonly #transloco = inject(TranslocoService);

  readonly currency = input.required<SupportedCurrency>();
  readonly verdict = input('');
  readonly ariaVerdict = input('');

  protected readonly STEP = 10;

  // Twin value shared by the slider and the numeric input. Re-seeds from the
  // store's global amount (e.g. after « Réajuster » clears it back to null).
  protected readonly sliderValue = linkedSignal((): number | null =>
    this.store.hasVariableAmounts()
      ? null
      : (this.store.globalAmount() ?? this.store.defaultMonthlyAmount()),
  );

  protected readonly announcement = signal('');

  readonly #meta = computed(() => CURRENCY_METADATA[this.currency()]);

  protected onSliderChange(value: number): void {
    this.sliderValue.set(value);
    this.store.setGlobalAmount(value);
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.sliderOverwrite'),
    );
  }

  protected onInputChange(value: number | null): void {
    const amount = value ?? 0;
    this.sliderValue.set(amount);
    this.store.setGlobalAmount(amount);
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.sliderOverwrite'),
    );
  }

  protected onRedistribute(): void {
    const result = this.store.redistribute();
    if (!result.isDistributable) {
      this.announcement.set(
        this.#transloco.translate('savingsGoals.simulate.redistributeNoop'),
      );
      return;
    }
    if (this.store.hasVariableAmounts()) {
      this.announcement.set(
        this.#transloco.translate(
          'savingsGoals.simulate.redistributeVariableDone',
        ),
      );
      return;
    }
    const meta = this.#meta();
    const perMonth = new Intl.NumberFormat(meta.numberLocale, {
      maximumFractionDigits: 0,
    }).format(result.perRemainingMonth);
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.redistributeDone', {
        perMonth: `${perMonth} ${meta.symbol}`,
      }),
    );
  }

  protected onRevert(): void {
    this.store.revert();
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.reverted'),
    );
  }
}
