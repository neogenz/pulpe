<!-- Challenge findings report skeleton. Fill each section verbatim, keep the header order. -->

My confidence level of correctness now: 85%

# Correctness (100%)
- The value rule (last entry plus what was checked since, debts never below zero, conversion at today's rate, archived or no rate keeps the entry) is computed in one place on the server (`asset.formulas.ts`). Web and iOS only display `latestValue` and `recordedValue`, so the two clients cannot disagree on the amount.
- CA1-CA5, CA7, CA9, CA10 and CA12-CA18 are each proven by a test that uses the story's own amounts.
  - CA11 is proven through the real `toggle_budget_line_check` RPC, as the owner.
  - CA17 is proven by running the real migration file twice, plus a use case test (+200 => 10 200).
- Compatibility with installed apps holds: `suggestion` is still sent, always `null`, and `dismiss-suggestion` answers without writing anything.
  - iOS 1.14 decodes it (AssetCodableTests).
  - The shared schema still parses an old payload (`asset-schema.spec.ts`).
- The challenge found a real gap and fixed it: `recordedValue`, now required in `shared`, broke the Android typecheck in five spec fixtures. The fixtures are fixed. Android type-check, lint and format pass, and `jest` net-worth + current-month gives 302/302. No Android screen changed.
- Supervision points 1-4 are closed:
  - the SQL and iOS tests were run;
  - the CA6/CA11/CA16/CA17 gaps are covered (CA6's ordering half is explained);
  - the stacked layout at accessibility sizes is checked on the simulator;
  - the web reminder now has its own spacing.
- Results on the current tree:
  - backend `bun test`: 2145/0;
  - backend `bun run quality`: OK;
  - shared: 952;
  - frontend `ng test`: 3688;
  - `ng build`: OK;
  - frontend lint and spec typecheck: OK;
  - lexicon: 12/12;
  - public-surface: 8/8;
  - SQL `asset_*`: 0 errors;
  - Android: 302 tests.

# Deal breakers
-

# Suggestions (enhancements only)
- Q4: deploy the API before the web for this release, or accept a few minutes in which the `net_worth` page fails to read the old response. This is a product or ops call, written in `questions.md`.
- CA6, ordering half: the « 200, −300, then +100 => 100 » test can only fail once a movement can raise a debt. It lands with PUL-378.
- iOS default text size: checked by eye on the simulator, not pixel-diffed. The only change at default size is the row's `frame(maxWidth: .infinity, alignment: .leading)`, which the default `Spacer` already implied.
