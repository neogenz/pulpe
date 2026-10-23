# Interface review

## Scope and Coverage

Full mode; Impeccable Operate/adapt. Angular 22, Material 3, Tailwind v4 and existing Pulpe tokens. Scope: quick-entry dialog and bottom sheet; representative consistency checks against Settings, edit-entry and forecast forms, not a whole-app audit.

| Category    | Evidence inspected                                                                                   | Result                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Typography  | Form labels/help, balanced shell headings, tabular amounts; final 600/767/768/1440/390 px captures   | Clear; natural reading order and legible help                   |
| Surfaces    | Both option rows, dialog content/actions, sticky sheet footer; Settings row and edit/forecast shells | Three layout issues resolved below                              |
| Animations  | Existing Material switch feedback and quick-amount transition source                                 | Unchanged; no added motion; 10% playback not reviewed           |
| Icons       | Existing Material close/calendar/switch states; final keyboard-focus captures                        | Clear; same icon vocabulary and state cues                      |
| Performance | CSS-only reflow, unchanged imports and handlers                                                      | No new dependency, listener or layout script; profiling not run |

## Findings

### Responsive reading order and consistent control grouping

| Severity          | Location                                                                                                | Before                                                                       | After                                                                     | Why                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| MEDIUM — resolved | `frontend/projects/webapp/src/app/feature/current-month/components/add-transaction-form.ts:246`         | Checked row spanned both desktop columns                                     | Row belongs to the details column                                         | Optical grouping: label and switch belong to the same visible field group   |
| MEDIUM — resolved | `frontend/projects/webapp/src/app/feature/current-month/components/add-transaction-form.ts:238`         | Narrow desktop dialog retained two compressed columns                        | One vertical column below 768 px; two columns above                       | Adaptation: readable fields and quick amounts, same information order       |
| MEDIUM — resolved | `frontend/projects/webapp/src/app/feature/current-month/components/add-transaction-form.ts:160`, `:204` | Two adjacent option rows used different help placement and horizontal insets | Both use label/help left, switch right, gap-4 and py-2, matching Settings | Consistency: options read as one family and labels no longer touch switches |

## Considered but Rejected

| Location         | Candidate                                                          | Rejected because                                                                         |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Narrow dialog    | Keep two columns and only add a gap                                | Geometry passed, but the 600 px capture still felt compressed                            |
| Both option rows | Keep the checked inset or place both help texts below the full row | Preserves mismatched edges or abandons the established Settings pattern                  |
| Form shell       | Replace Material controls, add decoration or a shared wrapper      | Existing controls provide the correct Pulpe states; the defect needs layout changes only |

## Verification and Verdict

Chrome responsive journey passed in 15.8 s at 600/767/768/1440/390 px: expense/income, both switches, Tab/Space, readable grouping, visible primary action, no horizontal scrolling in the real scroll container. Final screenshots inspected independently, including narrow-form top and lower controls. Source comparison preserves title balance, amount stability, Material focus/ripple and existing scroll ownership.

**Approve.** No actionable interface findings remain. Not verified: Safari/Firefox, physical touch devices, 10% motion playback, runtime loading/error states or real-account writes; no such behavior was changed. Production build and hosted deployment remain delivery gates.
