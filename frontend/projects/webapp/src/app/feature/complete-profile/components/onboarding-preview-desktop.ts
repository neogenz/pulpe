import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

const COUNTER_DURATION_MS = 600;

@Component({
  selector: 'pulpe-onboarding-preview-desktop',
  imports: [MatIconModule, TranslocoPipe, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('blockEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate(
          '280ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 0, transform: 'translateY(-4px)' }),
        ),
      ]),
    ]),
    trigger('badgeEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.85)' }),
        animate(
          '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 0, transform: 'scale(0.92)' }),
        ),
      ]),
    ]),
  ],
  template: `
    <div
      class="onboarding-preview-desktop relative overflow-hidden p-8 rounded-3xl bg-surface-container border border-outline-variant/40"
      [class.is-ready]="isReady()"
      [attr.aria-label]="'completeProfile.preview.ariaLabel' | transloco"
    >
      <span
        class="block text-label-small uppercase tracking-[0.12em] text-on-surface-variant/80 mb-4"
        aria-hidden="true"
      >
        {{
          'completeProfile.preview.title' | transloco: { month: monthLabel() }
        }}
      </span>

      @if (trimmedFirstName()) {
        <p
          class="text-title-medium font-semibold text-on-surface mb-6 ph-no-capture truncate"
          [@blockEnter]
        >
          {{
            'completeProfile.preview.greeting'
              | transloco: { name: trimmedFirstName() }
          }}
        </p>
      }

      <div class="flex items-start gap-3 mb-6">
        <div
          class="flex-shrink-0 h-9 w-9 rounded-full bg-surface-container-high flex items-center justify-center"
          aria-hidden="true"
        >
          <mat-icon class="preview-icon text-on-surface-variant">
            payments
          </mat-icon>
        </div>
        <div class="flex-1 min-w-0">
          <span class="block text-label-medium text-on-surface-variant mb-1">
            {{ 'completeProfile.preview.incomeLabel' | transloco }}
          </span>
          <div class="flex items-baseline gap-2">
            @if (hasIncome()) {
              <span
                class="text-display-small font-bold text-on-surface ph-no-capture tabular-nums tracking-tight"
              >
                {{ displayedAmount() | appCurrency: currencyCode() : '1.0-0' }}
              </span>
              <span class="text-body-small" aria-hidden="true">{{
                currencyFlag()
              }}</span>
            } @else {
              <span
                class="text-display-small font-bold text-on-surface opacity-40"
                aria-hidden="true"
                >—</span
              >
            }
          </div>
        </div>
      </div>

      @if (payDayOfMonth() !== null) {
        <div class="flex items-center gap-3 mb-6" [@blockEnter]>
          <div
            class="flex-shrink-0 h-9 w-9 rounded-full bg-surface-container-high flex items-center justify-center"
            aria-hidden="true"
          >
            <mat-icon class="preview-icon text-on-surface-variant">
              event
            </mat-icon>
          </div>
          <span class="text-body-medium text-on-surface-variant">
            {{
              'completeProfile.preview.payDayOn'
                | transloco: { day: payDayOfMonth() }
            }}
          </span>
        </div>
      }

      @if (isReady()) {
        <div
          class="flex items-center gap-2 text-body-small text-primary mb-4"
          [@badgeEnter]
        >
          <mat-icon class="badge-icon">check_circle</mat-icon>
          <span>{{ 'completeProfile.preview.readyBadge' | transloco }}</span>
        </div>
      }

      @if (shouldShowBottomHint()) {
        <div
          class="mt-4 pt-6 border-t border-outline-variant/40 text-body-small text-on-surface-variant"
          [@blockEnter]
        >
          @if (isReady()) {
            {{ 'completeProfile.preview.nextStepHint' | transloco }}
          } @else {
            {{ 'completeProfile.preview.empty' | transloco }}
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .onboarding-preview-desktop {
      transition: border-color var(--pulpe-motion-slow)
        var(--pulpe-ease-emphasized);
    }
    .onboarding-preview-desktop.is-ready {
      border-color: color-mix(
        in oklch,
        var(--mat-sys-primary) 15%,
        var(--mat-sys-outline-variant)
      );
    }
    .preview-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
    .badge-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }
    @media (prefers-reduced-motion: reduce) {
      .onboarding-preview-desktop {
        transition: none;
      }
    }
  `,
})
export class OnboardingPreviewDesktop {
  readonly firstName = input.required<string>();
  readonly monthlyIncome = input.required<number | null>();
  readonly payDayOfMonth = input.required<number | null>();
  readonly currencyCode = input.required<SupportedCurrency>();
  readonly currencyFlag = input.required<string>();
  readonly monthLabel = input.required<string>();
  readonly isReady = input.required<boolean>();

  readonly #destroyRef = inject(DestroyRef);
  readonly #displayedAmount = signal(0);
  readonly #isBrowser = signal(false);
  readonly #prefersReducedMotion = signal(false);

  protected readonly displayedAmount = this.#displayedAmount.asReadonly();

  protected readonly trimmedFirstName = computed(() => this.firstName().trim());

  protected readonly hasIncome = computed(() => {
    const income = this.monthlyIncome();
    return income !== null && income > 0;
  });

  protected readonly shouldShowBottomHint = computed(
    () => !this.hasIncome() || this.isReady(),
  );

  constructor() {
    afterNextRender(() => {
      this.#isBrowser.set(true);
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.#prefersReducedMotion.set(mq.matches);
      const listener = (event: MediaQueryListEvent): void =>
        this.#prefersReducedMotion.set(event.matches);
      mq.addEventListener('change', listener);
      this.#destroyRef.onDestroy(() =>
        mq.removeEventListener('change', listener),
      );
    });

    effect((onCleanup) => {
      const target = this.monthlyIncome() ?? 0;

      if (target <= 0) {
        this.#displayedAmount.set(0);
        return;
      }

      if (!this.#isBrowser() || this.#prefersReducedMotion()) {
        this.#displayedAmount.set(target);
        return;
      }

      const from = untracked(this.#displayedAmount);
      if (from === target) {
        return;
      }

      const start = performance.now();
      let rafId = 0;

      const tick = (now: number): void => {
        const progress = Math.min((now - start) / COUNTER_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.#displayedAmount.set(from + (target - from) * eased);
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        }
      };

      rafId = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(rafId));
    });
  }
}
