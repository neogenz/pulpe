import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TagStore } from '@core/tag';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';

@Component({
  selector: 'pulpe-tags-settings-page',
  imports: [MatIconModule, TranslocoPipe, BaseLoading, StateCard],
  template: `
    <div
      class="flex flex-col gap-6 h-full min-w-0"
      data-testid="tags-settings-page"
    >
      <header class="pulpe-page-header" data-testid="page-header">
        <div class="min-w-0">
          <h1
            class="text-headline-medium md:text-display-small truncate"
            data-testid="page-title"
          >
            {{ 'settings.tags.title' | transloco }}
          </h1>
          @if (
            store.tags.status() !== 'loading' && store.tags.status() !== 'error'
          ) {
            <p
              class="text-body-medium text-on-surface-variant mt-1"
              data-testid="tag-counter"
            >
              {{
                (tagCount() === 1
                  ? 'settings.tags.countOne'
                  : 'settings.tags.countMany'
                ) | transloco: { count: tagCount() }
              }}
            </p>
          }
        </div>
      </header>

      @switch (store.tags.status()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'settings.tags.loading' | transloco"
            size="large"
            testId="tags-loading"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'settings.tags.errorTitle' | transloco"
            [message]="'settings.tags.errorMessage' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="store.tags.reload()"
            testId="tags-error"
          />
        }
        @default {
          @if (tagCount() === 0) {
            <pulpe-state-card
              variant="empty"
              [title]="'settings.tags.emptyTitle' | transloco"
              [message]="'settings.tags.emptyMessage' | transloco"
              testId="tags-empty"
            />
          } @else {
            <ul
              class="rounded-2xl border border-outline-variant overflow-hidden divide-y divide-outline-variant"
              [attr.aria-label]="'settings.tags.listLabel' | transloco"
              data-testid="tags-list"
            >
              @for (tag of store.tags.value() ?? []; track tag.id) {
                <li
                  class="flex items-center gap-4 min-h-16 px-5 py-3 bg-surface-container-low"
                  data-testid="tag-row"
                >
                  <mat-icon class="text-on-surface-variant" aria-hidden="true"
                    >sell</mat-icon
                  >
                  <span class="text-body-large break-words min-w-0">
                    {{ tag.name }}
                  </span>
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TagsSettingsPage {
  protected readonly store = inject(TagStore);
  protected readonly tagCount = computed(
    () => this.store.tags.value()?.length ?? 0,
  );
}
