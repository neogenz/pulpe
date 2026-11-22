import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  output,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { PostHogService } from '@core/analytics/posthog';
import {
  GUIDE_SCENES,
  guideAction,
  type GuideOutcome,
  type GuideSource,
} from './reconcile-guide.model';
import {
  GuideCheckScene,
  GuideCompareScene,
  GuideTypeScene,
} from './reconcile-guide-scenes';

/**
 * The three-scene guide of « Comparer avec mes comptes », a page inside the comparison dialog.
 * Each scene is an animated drawing (decorative) above a title and one sentence (read aloud).
 */
@Component({
  selector: 'pulpe-reconcile-guide',
  imports: [
    MatButtonModule,
    TranslocoPipe,
    GuideCompareScene,
    GuideTypeScene,
    GuideCheckScene,
  ],
  host: { 'data-testid': 'reconcile-guide' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="top">
      <button
        matButton
        (click)="finish('skipped')"
        data-testid="reconcile-guide-skip"
      >
        {{ 'currentMonth.reconcile.guide.skip' | transloco }}
      </button>
    </div>

    <div class="scene" aria-hidden="true" data-testid="reconcile-guide-scene">
      <!-- One branch per scene: its DOM is rebuilt, so its CSS animations replay. -->
      @switch (sceneName()) {
        @case ('compare') {
          <pulpe-guide-compare-scene />
        }
        @case ('type') {
          <pulpe-guide-type-scene />
        }
        @case ('check') {
          <pulpe-guide-check-scene />
        }
      }
    </div>

    <!-- Focus lands on the title on open, so the first scene is read; later scenes are announced live. -->
    <div class="text" aria-live="polite">
      <h2
        #title
        class="title"
        tabindex="-1"
        aria-describedby="reconcile-guide-sentence"
        data-testid="reconcile-guide-title"
      >
        {{
          'currentMonth.reconcile.guide.scenes.' + sceneName() + '.title'
            | transloco
        }}
      </h2>
      <p id="reconcile-guide-sentence" class="sentence">
        {{
          'currentMonth.reconcile.guide.scenes.' + sceneName() + '.body'
            | transloco
        }}
      </p>
    </div>

    <div class="bottom">
      <div
        class="step-dots"
        role="img"
        [attr.aria-label]="
          'currentMonth.reconcile.guide.stepOf'
            | transloco: { step: step() + 1 }
        "
        data-testid="reconcile-guide-dots"
      >
        @for (name of scenes; track name; let i = $index) {
          <span class="step-dot" [class.step-dot-current]="i === step()"></span>
        }
      </div>
      <button
        #primary
        matButton="filled"
        (click)="onPrimary()"
        data-testid="reconcile-guide-primary"
      >
        {{ 'currentMonth.reconcile.guide.' + action() | transloco }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      padding: 0.5rem 1.75rem 1.5rem;
      /* One step of the choreography: delays are written as --i multiples of it. */
      --beat: var(--pulpe-motion-slow);
    }
    :host-context(.full-screen-dialog) {
      height: 100%;
      box-sizing: border-box;
      padding: max(0.5rem, env(safe-area-inset-top)) 1.25rem
        max(1.25rem, env(safe-area-inset-bottom));
      .text {
        min-height: 0;
      }
      .scene {
        flex: 1 1 0;
        min-height: 12rem;
        max-height: 26rem;
      }
      .bottom {
        flex-direction: column;
        align-items: stretch;
        margin-top: auto;
        padding-top: 1.5rem;
        gap: 1rem;
      }
      .step-dots {
        align-self: center;
      }
    }
    .top {
      display: flex;
      justify-content: flex-end;
      min-height: 2.75rem;
      margin-right: -0.5rem;
    }
    .scene {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 22rem;
      margin-top: 0.5rem;
      padding: 1.25rem;
      border-radius: var(--pulpe-surface-radius-card);
      background: var(--mat-sys-surface-container);
    }
    /* Room for the longest scene (two-line title and sentence), so the dialog keeps one height. */
    .text {
      min-height: 9rem;
    }
    .title:focus {
      outline: none;
    }
    .title {
      margin: 1.5rem 0 0.5rem;
      font: var(--mat-sys-headline-small);
      font-weight: 700;
      text-wrap: balance;
    }
    .sentence {
      margin: 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
      text-wrap: pretty;
    }
    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .step-dots {
      display: flex;
      gap: 0.375rem;
    }
    .step-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-outline-variant);
      transition: width var(--pulpe-motion-slow) var(--pulpe-ease-emphasized);
    }
    .step-dot-current {
      width: 1.375rem;
      background: var(--mat-sys-primary);
    }
    @media (prefers-reduced-motion: reduce) {
      .step-dot {
        transition: none;
      }
    }
  `,
})
export class ReconcileGuide implements OnInit {
  readonly source = input.required<GuideSource>();
  readonly finished = output<GuideOutcome>();

  readonly #postHog = inject(PostHogService);
  private readonly titleHeading =
    viewChild.required<ElementRef<HTMLElement>>('title');
  #outcome: GuideOutcome | null = null;

  protected readonly scenes = GUIDE_SCENES;
  protected readonly step = signal(0);
  protected readonly sceneName = computed(() => GUIDE_SCENES[this.step()]);
  protected readonly action = computed(() => guideAction(this.step()));

  constructor() {
    afterNextRender(() => this.titleHeading().nativeElement.focus());
    // Escape and backdrop close the whole dialog: still exactly one end event.
    inject(DestroyRef).onDestroy(() => this.#end('skipped'));
  }

  ngOnInit(): void {
    this.#postHog.captureEvent(
      ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
      { source: this.source() },
    );
  }

  protected onPrimary(): void {
    if (this.action() === 'next') {
      this.step.update((step) => step + 1);
      return;
    }
    this.finish('completed');
  }

  protected finish(outcome: GuideOutcome): void {
    this.#end(outcome);
    this.finished.emit(outcome);
  }

  #end(outcome: GuideOutcome): void {
    if (this.#outcome) return;
    this.#outcome = outcome;
    this.#postHog.captureEvent(
      outcome === 'completed'
        ? ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED
        : ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED,
      { source: this.source() },
    );
  }
}
