# Savings plan simulator redistribution control synchronization

## Target

Keep the monthly contribution slider, its numeric amount input, and the month-by-month savings plan synchronized after the user redistributes the remaining amount across the open months.

## Hard constraints

- Triggering redistribution must update the displayed slider position and numeric amount immediately, without applying or persisting the simulated plan.
- The existing redistribution calculation, currency rounding, and allocation outcomes must remain unchanged.
- The slider, numeric input, and month-by-month plan must continue to provide their existing accessible labels, states, and live feedback when their displayed values change.
- Existing reset behavior and direct slider or numeric-input editing behavior must remain unchanged.
- A non-uniform plan must not be presented by the controls as though one uniform monthly amount applied to every open month.

## Non-goals

- Backend, API, persistence, or data-model changes.
- A visual redesign of the simulator or its controls.
- Changes to redistribution mathematics or currency-rounding rules.
- Changes to manually pinned or otherwise non-uniform monthly plans, except where necessary to avoid displaying a false uniform monthly amount.
- Applying or saving the plan as a side effect of redistribution.

## Done-when

- When the user selects « Répartir sur les mois restants » and the resulting open-month plan is uniform, the slider thumb and numeric amount input immediately represent the newly redistributed per-month amount instead of the previous amount.
- The amount represented by both controls agrees with the redistributed values in the month-by-month plan, subject only to the existing unchanged currency-rounding outcome.
- Redistribution alone leaves the simulated changes unapplied and unpersisted.
- Reset restores the same state and control values it restored before this change.
- Subsequent direct edits through either the slider or numeric input continue to synchronize the controls and month-by-month plan as before.
- Automated regression coverage fails when redistribution updates the month-by-month plan but leaves either the slider or numeric amount input stale, and passes for redistribution, reset, and normal control editing.

## Context (optional)

Observed behavior: redistribution updates the open-month rows to the calculated recurring amount (for example, 5'486.12 CHF), while « Chaque mois, je mets » can keep showing the previous amount (for example, 10'972 CHF), creating two contradictory representations of the same simulated plan.
