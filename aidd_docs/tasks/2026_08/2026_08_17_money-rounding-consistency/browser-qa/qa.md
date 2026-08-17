# Browser QA: Money rounding consistency

- **Verdict**: pass
- **Source**: `aidd_docs/tasks/2026_08/2026_08_17_money-rounding-consistency/phase-6.md`
- **Run**: 2026_08_17

## Scenarios

| Scenario | Result | Verdict | Evidence | Duration |
| -------- | ------ | ------- | -------- | -------- |
| Happy path | `58.50 / 58.55 CHF` stays `0.05 CHF` over budget from the card to the detail panel. | pass | [happy-path.webm](../evidence/browser-qa/happy-path.webm) | 8 s |
| Noisy equality | `0.1 + 0.2` against `0.30 CHF` stays at `100% utilisé`, with no over-budget state. | pass | [edge-case-zero-equality.webm](../evidence/browser-qa/edge-case-zero-equality.webm) | 8 s |
| One-cent edge | `58.50 / 58.51 CHF` stays `0.01 CHF` over budget; the panel remains legible at `390×844`. | pass | [edge-case-one-cent.webm](../evidence/browser-qa/edge-case-one-cent.webm) | 8 s |
| EUR locale | The same one-cent edge uses `58,51 €`, `-0,01 €`, and `Dépassé de 0,01 €` consistently. | pass | [edge-case-eur.webm](../evidence/browser-qa/edge-case-eur.webm) | 8 s |
| Masking and accessibility | Amounts are blurred after the labelled toggle while the accessibility tree keeps the exact value. | pass | [edge-case-masking-accessibility.webm](../evidence/browser-qa/edge-case-masking-accessibility.webm) | 10 s |

## Cross-platform checks

- Web was inspected at `1280×720` and `390×844`; no clipped value or zero-justified financial state was found.
- The iOS CHF harness was inspected on the dedicated simulator. Its masking and large-text accessibility UI tests both passed.
- The full iOS suite passed with 2,176 tests in 224 suites; the formatter matrix includes exact `0.05 CHF` and `0,05 €` assertions.
