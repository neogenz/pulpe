# Excluding an asset from net worth is separate from archiving it

- Date: 2026-11-24
- Status: Accepted

## Context

On « Mon patrimoine », archiving is the only way to take an asset out of the totals. Archiving means "I no longer use this": the asset moves to the archived list and, once PUL-377 ships, checking a linked movement no longer changes its value. A user may want to keep tracking some assets without counting them in net worth. This is a personal choice about what the figure means to them, not about who owns the money.

## Decision

An asset gets its own setting, « Compter dans ma fortune nette », checked by default (PUL-384). An excluded asset stays active and behaves like any other asset everywhere except in the totals: gross worth, debts, net worth, type subtotals, Sankey, percentages and the `incomplete` flag. Exclusion and archiving are independent: unarchiving an excluded asset keeps it excluded.

## Alternatives

- Reuse archiving: rejected, because it is a different intent and freezes the asset's value.
- Count a share of the asset (for example 50 % of a joint account): rejected, because the need is all or nothing and a share is harder to understand and compute.

## Consequences

- Every place that sums assets has to skip excluded ones. Some of those sums run on the clients: the debt subtotals by type on web, iOS and Android, the Sankey and the percentages.
- Apps installed before the change still add an excluded debt to their debt subtotals. The top totals come from the server and stay correct. This is an accepted limit while `net_worth` is limited to early adopters.
