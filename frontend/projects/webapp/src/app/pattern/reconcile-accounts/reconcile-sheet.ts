import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, Service } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

/** The comparison's small sheets: a bottom sheet on a phone, a dialog on desktop, one body for both. */
@Service()
export class ReconcileSheet {
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #breakpoints = inject(BreakpointObserver);

  open<TComponent, TData, TResult>(
    component: ComponentType<TComponent>,
    data: TData,
    ariaLabel: string,
  ): Promise<TResult | undefined> {
    return firstValueFrom(
      this.#breakpoints.isMatched(Breakpoints.Handset)
        ? this.#bottomSheet
            .open<TComponent, TData, TResult>(component, { data, ariaLabel })
            .afterDismissed()
        : this.#dialog
            .open<TComponent, TData, TResult>(component, {
              data,
              ariaLabel,
              width: '480px',
              maxWidth: 'calc(100vw - 48px)',
            })
            .afterClosed(),
    );
  }
}
