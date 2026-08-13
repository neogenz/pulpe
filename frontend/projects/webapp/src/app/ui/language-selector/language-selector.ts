import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from 'pulpe-shared';

/**
 * Pick the interface language. Used on the settings page and on the welcome
 * screen, where someone whose browser was detected wrong needs a way out
 * before they even have an account.
 *
 * A select rather than a row of toggles: four languages do not fit on one
 * mobile line, and `Deutsch` is the one that would overflow first. It also
 * stays the same control on both surfaces, so neither has its own variant to
 * keep in step.
 *
 * The language names are never translated — someone looking for their language
 * scans for `Italiano`, not for `Italien`.
 */
@Component({
  selector: 'pulpe-language-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule, TranslocoPipe],
  template: `
    <mat-form-field
      appearance="outline"
      subscriptSizing="dynamic"
      class="w-full"
    >
      <mat-label>{{ 'settings.languageLabel' | transloco }}</mat-label>
      <mat-select
        data-testid="language-select"
        [value]="locale()"
        [disabled]="disabled()"
        (selectionChange)="localeChange.emit($event.value)"
      >
        @for (option of locales; track option) {
          <mat-option [value]="option">
            {{ localeNames[option] }}
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
})
export class LanguageSelector {
  readonly locale = input.required<SupportedLocale>();
  readonly disabled = input(false);
  readonly localeChange = output<SupportedLocale>();

  protected readonly locales = SUPPORTED_LOCALES;
  protected readonly localeNames = Object.fromEntries(
    SUPPORTED_LOCALES.map((code) => [code, LOCALE_METADATA[code].nativeName]),
  ) as Record<SupportedLocale, string>;
}
