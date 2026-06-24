import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';

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

  protected readonly goals = toSignal(
    this.#api.getAll$().pipe(map((r) => r.data ?? [])),
    { initialValue: [] },
  );
}
