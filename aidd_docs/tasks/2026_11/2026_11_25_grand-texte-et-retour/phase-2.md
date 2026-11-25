---
status: pending
---

# Instruction: iOS shared form components

## Architecture projection

```txt
.
└── ios/Pulpe/Shared/Components/
    ├── MovementSheet/ChipFlowLayout.swift ✏️
    ├── SegmentedPicker.swift ✏️
    ├── FormTextField.swift ✏️
    ├── QuickAmountChips.swift ✏️
    ├── TransactionDateSelector.swift ✏️
    ├── PulpeChip.swift ✏️
    ├── TagPickerField.swift ✏️
    └── SavingsGoalFieldChrome.swift ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Local backend, dedicated simulator at AX5 (`xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large`), demo account (PIN 1234) | Accueil shown | system |
| Happy path | Open « Nouvelle dépense », « Nouvelle prévision » (« Quand ? ») and « Nouvelle ligne » | Every control fits the width, nothing cut on either edge, the sheet scrolls vertically | system |
| Edge case  | Same sheets at the default size, light and dark | Layout unchanged from before | system |
| Teardown   | Text size back to Large, appearance light | Simulator at its defaults | system |

## Tasks to do

### `1)` Chip rows stay within the width

> A chip wider than the row wraps its own text.

1. `TransactionDateSelector` puts the compact `DatePicker` under its label: it never shrinks, and beside the label it widened the whole sheet.
2. In `ChipFlowLayout`, measure an over-wide chip at the row width and place each chip at its measured size.
3. `QuickAmountChips` flows on several rows at accessibility sizes.
4. A `PulpeChip` label keeps its words in a narrow chip (`layoutPriority`).

### `2)` Controls stack at accessibility sizes

> Side-by-side controls go one under the other instead of truncating.

1. `SegmentedPicker` stacks its segments in a rounded track, labels wrap.
2. `FormTextField` `.row` style puts the field under its label.
3. The « Tags » row and the `savingsGoalMenuLabel` `.row` put their value under the title.
4. `ios/DESIGN.md` Segmented Choice states the stacked rendering.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | At AX5 no chip row is wider than the sheet and no text is cut on the left |
| 2    | At AX5 every segment label reads in full; at the default size the picker is the same capsule as before |
