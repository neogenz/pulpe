import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset } from 'pulpe-shared';

export type AddAccountChoice =
  | { readonly kind: 'free'; readonly side: 'own' | 'owe' }
  | { readonly kind: 'asset'; readonly asset: Asset };

export interface AddAccountSheetData {
  /** Mon patrimoine items still on offer, grouped by type. Empty hides the block. */
  readonly groups: readonly {
    readonly name: string;
    readonly items: readonly Asset[];
  }[];
}

/** One body for both frames: a bottom sheet on a phone, a dialog on desktop. */
@Component({
  selector: 'pulpe-reconcile-add-account-sheet',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-3 p-5"
      data-testid="reconcile-add-account-sheet"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 class="m-0 text-title-large font-bold">
          {{ 'currentMonth.reconcile.accounts.add.title' | transloco }}
        </h2>
        <button
          matIconButton
          type="button"
          class="-mr-2"
          (click)="choose(undefined)"
          [attr.aria-label]="
            'currentMonth.reconcile.accounts.add.close' | transloco
          "
          data-testid="reconcile-add-close-button"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </div>
      <p class="m-0 text-sm leading-normal text-on-surface-variant">
        {{ 'currentMonth.reconcile.accounts.add.intro' | transloco }}
      </p>
      @for (option of options; track option.side) {
        <button
          type="button"
          class="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-(--pulpe-surface-radius-panel) border border-outline-variant bg-surface-container-low p-3 text-left text-on-surface"
          (click)="choose({ kind: 'free', side: option.side })"
          [attr.data-testid]="option.testId"
        >
          <mat-icon class="shrink-0 text-primary" aria-hidden="true">{{
            option.icon
          }}</mat-icon>
          <span class="flex flex-col">
            <span class="font-medium">{{ option.title | transloco }}</span>
            <span class="text-sm text-on-surface-variant">{{
              option.hint | transloco
            }}</span>
          </span>
        </button>
      }
      @if (data.groups.length > 0) {
        <div class="mt-3 flex flex-col">
          <span class="font-medium">{{
            'currentMonth.reconcile.accounts.add.fromNetWorth' | transloco
          }}</span>
          <span class="text-sm text-on-surface-variant">{{
            'currentMonth.reconcile.accounts.add.fromNetWorthHint' | transloco
          }}</span>
        </div>
        @for (group of data.groups; track group.name) {
          <div class="flex flex-col">
            <span
              class="ph-no-capture pb-1 pt-2 text-sm text-on-surface-variant"
              >{{ group.name }}</span
            >
            @for (asset of group.items; track asset.id) {
              <button
                type="button"
                class="flex min-h-13 w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border-0 border-t border-solid border-outline-variant bg-transparent px-0 py-2 text-left text-on-surface"
                (click)="choose({ kind: 'asset', asset })"
                data-testid="reconcile-add-asset-button"
              >
                <span
                  class="ph-no-capture min-w-0 flex-[1_1_8rem] break-words"
                  >{{ asset.name }}</span
                >
                <span
                  class="shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
                  [class]="
                    asset.direction === 'own'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-financial-expense-light text-on-financial-light'
                  "
                  >{{
                    'currentMonth.reconcile.accounts.' + asset.direction
                      | transloco
                  }}</span
                >
                <mat-icon
                  class="ml-auto shrink-0 text-primary"
                  aria-hidden="true"
                  >add</mat-icon
                >
              </button>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ReconcileAddAccountSheet {
  readonly #dialogRef = inject(MatDialogRef, { optional: true });
  readonly #sheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: AddAccountSheetData =
    inject(MAT_DIALOG_DATA, { optional: true }) ??
    inject(MAT_BOTTOM_SHEET_DATA);
  protected readonly options = [
    {
      side: 'own',
      icon: 'add',
      testId: 'reconcile-add-new-button',
      title: 'currentMonth.reconcile.accounts.add.newTitle',
      hint: 'currentMonth.reconcile.accounts.add.newHint',
    },
    {
      side: 'owe',
      icon: 'remove',
      testId: 'reconcile-add-owe-button',
      title: 'currentMonth.reconcile.accounts.add.oweTitle',
      hint: 'currentMonth.reconcile.accounts.add.oweHint',
    },
  ] as const;

  protected choose(choice: AddAccountChoice | undefined): void {
    if (this.#dialogRef) this.#dialogRef.close(choice);
    else this.#sheetRef?.dismiss(choice);
  }
}
