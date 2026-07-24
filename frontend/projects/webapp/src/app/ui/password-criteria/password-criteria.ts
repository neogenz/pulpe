import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export interface PasswordCriterion {
  readonly labelKey: string;
  readonly isMet: boolean;
}

// Source unique des règles de mot de passe côté web (parité iOS
// `PasswordValidator`). `signup-form.schema.ts` les importe d'ici — ui/ ne
// peut pas importer feature/, donc la règle vit dans la couche la plus basse.
export const PASSWORD_HAS_NUMBER = /\p{N}/u;
export const PASSWORD_HAS_LETTER = /\p{L}/u;

/// Pure et exportée : la checklist visuelle et ses tests partagent ce calcul —
/// l'env vitest JIT ne liant pas les inputs après la première instanciation,
/// la logique doit rester testable hors TestBed.
export function passwordCriteria(
  value: string,
  minLength: number,
): PasswordCriterion[] {
  return [
    {
      labelKey: 'form.passwordCriteria.minLength',
      isMet: value.length >= minLength,
    },
    {
      labelKey: 'form.passwordCriteria.hasNumber',
      isMet: PASSWORD_HAS_NUMBER.test(value),
    },
    {
      labelKey: 'form.passwordCriteria.hasLetter',
      isMet: PASSWORD_HAS_LETTER.test(value),
    },
  ];
}

/**
 * Live password criteria checklist — web analog of the iOS `PasswordCriteriaList`.
 * Same three rules as `signupFormSchema` / iOS `PasswordValidator`.
 */
@Component({
  selector: 'pulpe-password-criteria',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Zone live séparée : un lecteur d'écran entend l'évolution globale
         pendant la saisie, sans annonce par critère (verbosité). -->
    <span
      class="sr-only"
      role="status"
      aria-live="polite"
      data-testid="password-criteria-live"
    >
      {{
        remainingCount() === 0
          ? ('form.passwordCriteria.allMet' | transloco)
          : ('form.passwordCriteria.remaining'
            | transloco: { count: remainingCount() })
      }}
    </span>
    <ul class="flex flex-col gap-1 mt-1" data-testid="password-criteria">
      @for (criterion of criteria(); track criterion.labelKey) {
        <li
          class="flex items-center gap-2 text-body-small"
          [class.text-primary]="criterion.isMet"
          [class.text-on-surface-variant]="!criterion.isMet"
        >
          <mat-icon aria-hidden="true" class="!text-base !w-4 !h-4">
            {{ criterion.isMet ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <!-- count ne sert qu'au label minLength ; les autres clés l'ignorent. -->
          <span>{{
            criterion.labelKey | transloco: { count: minLength() }
          }}</span>
          <span class="sr-only">
            {{
              (criterion.isMet
                ? 'form.passwordCriteria.met'
                : 'form.passwordCriteria.notMet'
              ) | transloco
            }}
          </span>
        </li>
      }
    </ul>
  `,
})
export class PasswordCriteria {
  readonly password = input.required<string>();
  // ui/ layer cannot import @core — the caller passes PASSWORD_MIN_LENGTH.
  readonly minLength = input(8);

  protected readonly remainingCount = computed(
    () => this.criteria().filter((criterion) => !criterion.isMet).length,
  );

  protected readonly criteria = computed<PasswordCriterion[]>(() =>
    passwordCriteria(this.password(), this.minLength()),
  );
}
