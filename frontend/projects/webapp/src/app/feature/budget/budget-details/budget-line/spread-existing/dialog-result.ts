import type { SpreadFromExistingPeriod } from 'pulpe-shared';

/**
 * SPREAD-EXISTING (PUL-17 v1.1) — input/output contract for
 * {@link SpreadExistingDialog}.
 *
 * The dialog is source-agnostic: `source` only drives the confirm copy
 * (prévision → "on remplace cette prévision", réel → "on transforme cette
 * dépense"). `total` is the source amount, LOCKED (read-only). `month`/`year`
 * are M0 — the window start (forward-only).
 */
export type SpreadSourceKind = 'forecast' | 'transaction';

export interface SpreadExistingDialogData {
  source: SpreadSourceKind;
  total: number;
  month: number;
  year: number;
}

/** The chosen target periods (sorted, M0 included). */
export interface SpreadExistingDialogResult {
  periods: SpreadFromExistingPeriod[];
}
