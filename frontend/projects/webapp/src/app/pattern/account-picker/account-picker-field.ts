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
import { FEATURE_FLAGS } from 'pulpe-shared';

import { PostHogService } from '@core/analytics/posthog';
import { injectNetWorthResource } from '@core/asset/net-worth';
import { UserSettingsStore } from '@core/user-settings';

/**
 * « Compte » picker: the asset a movement leaves from or arrives on. One
 * component for the forms and for the « Compte par défaut » setting.
 *
 * Value-based like the asset picker: `[value]` in, `(valueChanged)` out, the
 * first option maps to `null`. Two groups follow, what I have then what I owe,
 * read from the cache « Mon patrimoine » already fills. It renders nothing with
 * the `net_worth` flag off, while the list loads or fails, or with nothing to
 * offer. An archived account the movement already carries stays listed,
 * otherwise the select would show the link as empty.
 */
@Component({
  selector: 'pulpe-account-picker-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [MatFormFieldModule, MatSelectModule, TranslocoPipe],
  template: `
    @if (groups(); as groups) {
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ labelKey() | transloco }}</mat-label>
        <mat-select
          [value]="value()"
          [disableOptionCentering]="true"
          panelClass="pulpe-account-select-panel"
          (selectionChange)="valueChanged.emit($event.value)"
          [attr.aria-invalid]="errorKey() ? 'true' : null"
          data-testid="account-picker-select"
        >
          <mat-option [value]="null">{{
            'netWorth.link.none' | transloco
          }}</mat-option>
          @if (groups.own.length > 0) {
            <mat-optgroup [label]="'netWorth.account.groupOwn' | transloco">
              @for (account of groups.own; track account.id) {
                <mat-option
                  [value]="account.id"
                  [attr.data-testid]="'account-picker-option-' + account.id"
                  ><span class="ph-no-capture">{{
                    account.name
                  }}</span></mat-option
                >
              }
            </mat-optgroup>
          }
          @if (groups.owe.length > 0) {
            <mat-optgroup [label]="'netWorth.account.groupOwe' | transloco">
              @for (account of groups.owe; track account.id) {
                <mat-option
                  [value]="account.id"
                  [attr.data-testid]="'account-picker-option-' + account.id"
                  ><span class="ph-no-capture">{{
                    account.name
                  }}</span></mat-option
                >
              }
            </mat-optgroup>
          }
        </mat-select>
        @if (errorKey(); as key) {
          <mat-hint
            class="text-error"
            role="alert"
            data-testid="account-picker-error"
            >{{ key | transloco }}</mat-hint
          >
        } @else if (hintKey(); as key) {
          <mat-hint data-testid="account-picker-hint">{{
            key | transloco
          }}</mat-hint>
        }
      </mat-form-field>
    }
  `,
})
export class AccountPickerField {
  readonly value = input<string | null>(null);
  readonly labelKey = input('netWorth.account.label');
  /** Translation key of the message shown under the field, `null` when fine. */
  /** Translation key of a standing hint under the field, shown when there is no error. */
  readonly hintKey = input<string | null>(null);
  readonly errorKey = input<string | null>(null);
  readonly valueChanged = output<string | null>();

  // The resource is only created with the flag on: nothing to fetch otherwise.
  readonly #netWorth = inject(PostHogService).isFeatureEnabled(
    FEATURE_FLAGS.NET_WORTH,
  )
    ? injectNetWorthResource()
    : null;

  protected readonly groups = computed(() => {
    const assets = this.#netWorth?.value()?.assets ?? [];
    const offered = assets.filter(
      (asset) => asset.archivedAt === null || asset.id === this.value(),
    );
    if (offered.length === 0) return null;
    return {
      own: offered.filter((asset) => asset.direction === 'own'),
      owe: offered.filter((asset) => asset.direction === 'owe'),
    };
  });
}

/**
 * The account a new form starts on: the default account, or none with the
 * flag off. The server clears the setting when its account goes away, so a
 * value read here is an active account.
 */
export function injectInitialAccountId(): () => string | null {
  const isEnabled = inject(PostHogService).isFeatureEnabled(
    FEATURE_FLAGS.NET_WORTH,
  );
  const settings = inject(UserSettingsStore);
  return () => (isEnabled ? settings.defaultAccountId() : null);
}
