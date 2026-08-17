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
import { AppCurrencyPipe } from '@core/currency';
import { CurrencyInput } from '@ui/currency-input';
import { GoalPlanSimulatorStore } from '../services/goal-plan-simulator-store';

/**
 * Toolbar de simulation (docs/SAVINGS.md §10.1). Slider global
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
    AppCurrencyPipe,
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
            class="w-full md:flex-1"
            [min]="0"
            [max]="store.sliderMax()"
            [step]="STEP"
          >
            <input
              matSliderThumb
              [ngModel]="sliderValue()"
              (ngModelChange)="onSliderChange($event)"
              [attr.aria-label]="'savingsGoals.simulate.everyMonth' | transloco"
              data-testid="goal-plan-slider"
            />
          </mat-slider>
          <div class="md:w-44">
            <pulpe-currency-input
              [label]="'savingsGoals.simulate.amountInput' | transloco"
              [value]="sliderValue()"
              (valueChange)="onInputChange($event)"
              [currency]="currency()"
              [autoFocus]="false"
              placeholder="0.00"
              [showSuffix]="true"
              [errorId]="hasInputError() ? amountErrorId : undefined"
              testId="goal-plan-amount-input"
            />
            @if (hasInputError()) {
              <p
                [id]="amountErrorId"
                role="alert"
                class="text-body-small text-error text-pretty"
                data-testid="goal-plan-amount-error"
              >
                {{ 'savingsGoals.plan.globalAmountInvalid' | transloco }}
              </p>
            }
          </div>
        </div>
        @if (store.hasTarget() && !targetReached()) {
          <p
            class="ph-no-capture text-body-small text-on-surface-variant text-pretty"
            data-testid="goal-plan-target-hint"
          >
            {{
              'savingsGoals.simulate.targetHint'
                | transloco
                  : {
                      amount:
                        store.defaultMonthlyAmount()
                        | appCurrency: currency() : '1.0-2',
                    }
            }}
          </p>
        }
        @if (store.hasVariableAmounts()) {
          <p
            class="flex items-start gap-1.5 text-body-small text-on-surface-variant text-pretty"
            data-testid="goal-plan-variable-hint"
          >
            <mat-icon
              class="text-base! w-auto! h-auto! leading-none mt-0.5 shrink-0"
              aria-hidden="true"
              >info</mat-icon
            >
            <span>{{
              'savingsGoals.simulate.variableAmountsHint' | transloco
            }}</span>
          </p>
        }
        <!-- Verdict callout. RG-002: savings is never an alert color — attention
             comes from the tinted container + leading icon + weight, all in the
             savings-green/neutral family, never amber/red. -->
        @if (store.hasTarget()) {
          <div
            class="mt-1 flex items-start gap-2 rounded-xl bg-financial-savings/10 px-3 py-2.5"
            data-testid="goal-plan-verdict"
            aria-hidden="true"
          >
            <mat-icon
              class="mt-0.5 shrink-0 text-financial-savings text-lg! w-auto! h-auto! leading-none"
              aria-hidden="true"
            >
              {{ targetReached() ? 'check_circle' : 'flag' }}
            </mat-icon>
            <p class="text-body-medium font-semibold text-financial-savings">
              {{ verdict() }}
            </p>
          </div>
          <p class="ph-no-capture sr-only" aria-live="polite">
            {{ ariaVerdict() }}
          </p>
        }
      </div>

      <div class="flex flex-wrap items-center gap-2">
        @if (store.hasTarget()) {
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
        }
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
        class="ph-no-capture sr-only"
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
  /** Whether the current draft reaches the target within the shown horizon —
   *  drives the verdict icon (check vs flag), never a color change (RG-002). */
  readonly targetReached = input(false);

  protected readonly STEP = 10;
  protected readonly amountErrorId = 'goal-plan-amount-error';

  // Twin value shared by the slider and the numeric input. Seeds the user's
  // *current* plan amount (`currentMonthlyAmount`) — not the deadline anchor —
  // so the slider opens where the plan actually is and stays consistent with
  // the verdict. The anchor is shown separately as a « cible » target hint.
  protected readonly sliderValue = linkedSignal(
    (): number =>
      this.store.globalAmount() ?? this.store.currentMonthlyAmount(),
  );

  protected readonly announcement = signal('');
  protected readonly hasInputError = signal(false);

  readonly #meta = computed(() => CURRENCY_METADATA[this.currency()]);

  // `store.globalAmount` is the single source of truth for the amount; the
  // `sliderValue` linkedSignal re-derives from it, so setting the store is
  // enough — no manual `sliderValue.set` is needed to keep the twin controls
  // in sync.
  protected onSliderChange(value: number): void {
    this.#clearInputRefusal();
    this.store.setGlobalAmount(value);
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.sliderOverwrite'),
    );
  }

  /**
   * Toute action qui réécrit le montant affiché lève le refus : le champ ne
   * montre plus la saisie fautive, il n'a plus de raison de la reprocher.
   */
  #clearInputRefusal(): void {
    this.hasInputError.set(false);
    this.store.setGlobalAmountInvalid(false);
  }

  /**
   * Le jumeau du slider suit la même règle que le champ inline du plan : une
   * saisie refusée laisse le plan tel quel et referme « Appliquer », au lieu
   * d'écrire `0` en silence. Un champ vidé est incomplet, pas fautif — il
   * verrouille sans accuser ; seul un montant négatif reçoit le message, celui
   * qui oriente vers le budget puisque c'est là qu'un retrait se crée.
   */
  protected onInputChange(value: number | null): void {
    const isIncomplete = value === null || !Number.isFinite(value);
    const isRefused = !isIncomplete && value < 0;
    this.hasInputError.set(isRefused);
    this.store.setGlobalAmountInvalid(isIncomplete || isRefused);
    if (isIncomplete || isRefused) return;

    this.store.setGlobalAmount(value);
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
    this.#clearInputRefusal();
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
    this.#clearInputRefusal();
    this.store.revert();
    this.announcement.set(
      this.#transloco.translate('savingsGoals.simulate.reverted'),
    );
  }
}
