import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, Service, type DestroyRef } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, type Observable } from 'rxjs';

/** Lets the global styles reach the sheets' buttons (`_reconcile-dialog.scss`). */
const SHEET_CLASS = 'pulpe-reconcile-sheet';

/** The comparison's small sheets: a bottom sheet on a phone, a dialog on desktop, one body for both. */
@Service()
export class ReconcileSheet {
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #breakpoints = inject(BreakpointObserver);

  /** The sheet closes with `owner`: it never outlives the step whose figures it shows. */
  open<TComponent, TData, TResult>(
    component: ComponentType<TComponent>,
    data: TData,
    ariaLabel: string,
    owner: DestroyRef,
  ): Promise<TResult | undefined> {
    let closed: Observable<TResult | undefined>;
    let close: () => void;
    if (this.#breakpoints.isMatched(Breakpoints.Handset)) {
      const ref = this.#bottomSheet.open<TComponent, TData, TResult>(
        component,
        { data, ariaLabel, panelClass: SHEET_CLASS },
      );
      closed = ref.afterDismissed();
      close = () => ref.dismiss();
    } else {
      const ref = this.#dialog.open<TComponent, TData, TResult>(component, {
        data,
        ariaLabel,
        width: '480px',
        maxWidth: 'calc(100vw - 48px)',
        // Large text or a short window: the sheet scrolls instead of leaving the screen.
        maxHeight: 'calc(100dvh - 48px)',
        panelClass: SHEET_CLASS,
      });
      closed = ref.afterClosed();
      close = () => ref.close();
    }
    const stop = owner.onDestroy(close);
    return firstValueFrom(closed).finally(stop);
  }
}
