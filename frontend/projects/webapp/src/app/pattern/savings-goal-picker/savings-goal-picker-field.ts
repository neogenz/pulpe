import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { cachedResource } from 'ngx-ziflux';

import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';

/**
 * Reusable "Objectif" picker for the 3 CA26 saving-line surfaces.
 *
 * Value-based (not a Signal-Forms field): the caller passes the current
 * `savingsGoalId` via `[value]` and reacts to `(valueChanged)`. A first
 * option maps to `null` ("Aucun objectif").
 */
@Component({
  selector: 'pulpe-savings-goal-picker-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [MatFormFieldModule, MatSelectModule, TranslocoPipe],
  template: `
    <mat-form-field
      appearance="outline"
      subscriptSizing="dynamic"
      class="w-full"
    >
      <mat-label>{{ 'savingsGoals.pickerLabel' | transloco }}</mat-label>
      <mat-select
        [value]="value()"
        (selectionChange)="valueChanged.emit($event.value)"
        data-testid="savings-goal-picker-select"
      >
        <mat-option [value]="null">{{
          'savingsGoals.pickerNone' | transloco
        }}</mat-option>
        @for (g of goals(); track g.id) {
          <mat-option [value]="g.id">{{ g.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
})
export class SavingsGoalPickerField {
  readonly value = input<string | null>(null);
  readonly valueChanged = output<string | null>();

  readonly #api = inject(SavingsGoalApi);

  // Shares the SavingsGoalApi DataCache (key ['savings-goals','list']) with
  // SavingsGoalStore: dedups the fetch across pickers/list and picks up store
  // invalidations. cachedResource.value() returns undefined (never throws) on
  // load/error, so a failed fetch degrades to an empty picker instead of
  // crashing the open dialog.
  readonly #goalsResource = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['savings-goals', 'list'],
    loader: () => this.#api.getAll$().pipe(map((r) => r.data ?? [])),
  });

  protected readonly goals = computed(() => this.#goalsResource.value() ?? []);
}
