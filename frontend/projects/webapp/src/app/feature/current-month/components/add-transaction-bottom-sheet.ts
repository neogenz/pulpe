import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, merge } from 'rxjs';

import { BlurOnVisibilityResumeDirective } from '@ui/blur-on-visibility-resume/blur-on-visibility-resume.directive';
import { LoadingButton } from '@ui/loading-button/loading-button';
import {
  AddTransactionDialogService,
  type AddTransactionShellData,
} from '../services/add-transaction-dialog.service';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

/** Cible du `aria-labelledby` posé sur le conteneur — voir le constructeur. */
const SHEET_TITLE_ID = 'add-transaction-sheet-title';

@Component({
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AddTransactionForm,
    BlurOnVisibilityResumeDirective,
    LoadingButton,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6" pulpeBlurOnVisibilityResume>
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <div class="flex justify-between items-center gap-4">
        <div class="min-w-0">
          <h2
            [id]="titleId"
            class="text-title-large text-on-surface m-0 [text-wrap:balance]"
          >
            {{
              'currentMonth.addTransactionTitle'
                | transloco
                  : {
                      nature:
                        'transactionKindIndefinite.' + form.kind() | transloco,
                    }
            }}
          </h2>
        </div>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <pulpe-add-transaction-form #form (created)="onCreated($event)" />

      <!-- Pinned, because the sheet is taller than a phone: the submit button's
           top edge measured one pixel below the fold on a 812px viewport, and
           the amount field autofocuses, so the keyboard then pushed it a few
           hundred more. The step that commits the money was reachable only by
           guessing the sheet scrolls, which it gives no sign of doing. The
           background matches the sheet's own surface-container-low so the
           form passes under the bar instead of through it; the existing top
           rule doubles as the scroll edge. Desktop uses the dialog, which is
           short enough that this changes nothing there. -->
      <div
        class="sticky bottom-0 flex flex-col gap-3 pt-4 pb-2 -mb-2 border-t border-outline-variant bg-surface-container-low"
      >
        <!-- The refusal belongs here rather than in a toast: the sheet is
             still up, holding everything that was typed, and a toast at the
             bottom of a phone lands under it. Retrying is one press away. -->
        @if (refusal()) {
          <p
            class="text-body-small text-error m-0 flex items-start gap-2"
            role="alert"
            data-testid="transaction-refusal"
          >
            <mat-icon class="mat-icon-sm shrink-0" aria-hidden="true"
              >error</mat-icon
            >
            {{ refusal() }}
          </p>
        }
        <div class="flex gap-3">
          <button
            matButton
            (click)="close()"
            class="flex-1"
            data-testid="transaction-cancel-button"
          >
            {{ 'currentMonth.addTransactionCancel' | transloco }}
          </button>
          <pulpe-loading-button
            class="flex-2"
            type="button"
            [loading]="form.isSubmitting() || isPersisting()"
            [disabled]="!form.canSubmit() || isPersisting()"
            [loadingText]="'common.loading' | transloco"
            (click)="form.submit()"
            testId="transaction-submit-button"
          >
            {{ 'currentMonth.addTransactionSubmit' | transloco }}
          </pulpe-loading-button>
        </div>
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet, TransactionFormData>,
  );
  readonly #data = inject<AddTransactionShellData>(MAT_BOTTOM_SHEET_DATA);
  readonly #dialogService = inject(AddTransactionDialogService);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly formRef = viewChild.required(AddTransactionForm);

  protected readonly titleId = SHEET_TITLE_ID;

  // The sheet holds the only copy of what was typed, so it stays up until the
  // write is accepted. `isSubmitting` on the form ends at the built payload,
  // which is why the button stopped spinning while the request was still out.
  protected readonly isPersisting = signal(false);
  protected readonly refusal = signal('');

  constructor() {
    // La feuille s'annonçait sans nom. Son jumeau de bureau en reçoit un
    // gratuitement de `mat-dialog-title` ; `MatBottomSheetContainer`, lui, ne
    // lie qu'un `ariaLabel` figé pris dans sa config — périmé dès que la
    // nature choisie réécrit le titre. Le désigner plutôt que le recopier
    // garde le nom annoncé et le titre lu à l'écran sur la même phrase.
    afterNextRender(() => {
      this.#host.nativeElement
        .closest('mat-bottom-sheet-container')
        ?.setAttribute('aria-labelledby', SHEET_TITLE_ID);
    });

    // Même garde-fou que le dialogue de bureau, et pour la même raison : sur
    // téléphone la feuille occupe l'écran, donc le fond visible sur lequel on
    // clique par réflexe pour revenir à la page est justement ce qui effaçait
    // la saisie.
    merge(
      this.#bottomSheetRef.backdropClick(),
      this.#bottomSheetRef
        .keydownEvents()
        .pipe(filter((event) => event.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.close());
  }

  protected async close(): Promise<void> {
    if (
      this.formRef().hasInput() &&
      !(await this.#dialogService.confirmDiscard())
    )
      return;
    this.#bottomSheetRef.dismiss();
  }

  protected async onCreated(tx: TransactionFormData): Promise<void> {
    this.refusal.set('');
    this.isPersisting.set(true);
    try {
      const refusal = await this.#data.persist(tx);
      if (refusal) {
        this.refusal.set(refusal);
        return;
      }
      this.#bottomSheetRef.dismiss(tx);
    } finally {
      this.isPersisting.set(false);
    }
  }
}
