import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type BudgetTemplate } from 'pulpe-shared';

const LEADING_EMOJI_REGEX =
  /^\s*(\p{Extended_Pictographic}(‍\p{Extended_Pictographic})*️?)\s*/u;

@Component({
  selector: 'pulpe-template-card',
  imports: [RouterLink, MatCardModule, MatIconModule, TranslocoPipe],
  template: `
    <a
      class="template-card-link block h-full"
      [routerLink]="['details', template().id]"
      [attr.data-testid]="'template-' + template().name"
      [attr.aria-label]="
        'template.openAriaLabel' | transloco: { name: displayName() }
      "
    >
      <mat-card
        appearance="outlined"
        class="template-card h-full cursor-pointer"
        [class.template-card--default]="template().isDefault"
      >
        <mat-card-content class="flex min-h-48 flex-col p-5!">
          <div class="flex items-start justify-between gap-3">
            <div
              class="template-card__mark flex size-11 shrink-0 items-center justify-center rounded-corner-medium bg-secondary-container text-on-secondary-container"
            >
              @if (emoji(); as leadingEmoji) {
                <span class="text-2xl" aria-hidden="true">{{
                  leadingEmoji
                }}</span>
              } @else {
                <mat-icon aria-hidden="true">view_quilt</mat-icon>
              }
            </div>

            @if (template().isDefault) {
              <span
                class="shrink-0 rounded-full bg-primary px-2.5 py-1 text-label-small font-medium text-on-primary"
              >
                {{ 'template.defaultTag' | transloco }}
              </span>
            }
          </div>

          <div class="mt-4 min-w-0">
            <h2
              class="ph-no-capture text-title-medium font-semibold text-on-surface"
            >
              {{ displayName() }}
            </h2>
            @if (template().description) {
              <p
                class="ph-no-capture mt-1 line-clamp-2 text-body-medium text-on-surface-variant"
              >
                {{ template().description }}
              </p>
            }
          </div>

          <div
            class="mt-auto flex items-center justify-between gap-3 pt-4 text-label-large text-primary"
          >
            <span>{{ 'template.open' | transloco }}</span>
            <mat-icon aria-hidden="true" class="template-card__arrow"
              >arrow_forward</mat-icon
            >
          </div>
        </mat-card-content>
      </mat-card>
    </a>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .template-card-link {
      color: inherit;
      text-decoration: none;
    }

    .template-card-link:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 3px;
      border-radius: var(--mat-sys-corner-large);
    }

    .template-card {
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-container-low) 18%,
        var(--mat-sys-surface)
      );
      transition:
        background-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        border-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        transform var(--pulpe-motion-fast) var(--pulpe-ease-standard);
    }

    .template-card--default {
      background: color-mix(
        in srgb,
        var(--mat-sys-primary-container) 22%,
        var(--mat-sys-surface)
      );
    }

    .template-card-link:hover .template-card {
      background: var(--mat-sys-surface-container-low);
      border-color: var(--mat-sys-outline);
      transform: translateY(-1px);
    }

    .template-card__arrow {
      transition: transform var(--pulpe-motion-fast) var(--pulpe-ease-standard);
    }

    .template-card-link:hover .template-card__arrow,
    .template-card-link:focus-visible .template-card__arrow {
      transform: translateX(4px);
    }

    @media (prefers-reduced-motion: reduce) {
      .template-card,
      .template-card__arrow {
        transition: none;
      }

      .template-card-link:hover .template-card,
      .template-card-link:hover .template-card__arrow,
      .template-card-link:focus-visible .template-card__arrow {
        transform: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCard {
  readonly template = input.required<BudgetTemplate>();

  protected readonly emoji = computed(() => {
    const match = LEADING_EMOJI_REGEX.exec(this.template().name);
    return match ? match[1] : null;
  });

  protected readonly displayName = computed(() => {
    const name = this.template().name;
    return name.replace(LEADING_EMOJI_REGEX, '').trim() || name;
  });
}
