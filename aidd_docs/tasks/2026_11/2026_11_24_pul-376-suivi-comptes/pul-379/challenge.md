My confidence level of correctness now: 85%

# Correctness (100%)
- Server: the value and the history are computed by the same function. `assetValueCents` is now the sum of `retainedMoves` from the last entry, and `assetHistory` runs `retainedMoves` on each period between two entries. That makes CA5 true by construction (the open movements add up to value − last entry), including a debt's floor at zero (CA13, −200 then +100) and a foreign rate (CA14). The existing `GET /v1/assets` expectations are unchanged. CA19 holds: « Courses » shows −120 under the 1 November entry and −280 above it, and the value is 9 140.
- Entry order agrees end to end. `findSnapshots` sorts `recorded_at` ascending then `id` descending, and `asset_latest_snapshot` sorts `recorded_at DESC, id`: both pick the same entry as the latest, even when two entries share a timestamp. The history sorts by (instant desc, entry before movement, id). `pageOf` uses the same key for its keyset cursor, and no key repeats, because a prévision that appears in two periods has two different instants. Pages therefore have no duplicates and no gaps.
- Deployment: `list_asset_movements_for` is additive. It runs with the caller's rights and an empty `search_path`, and is closed to `anon`. The old function stays in place for a PUL-378 backend that is still deployed. Production applies migrations before the fast-forward, so the new backend never calls a function that does not exist yet.
- Clients compute nothing; they only render what the server sends. Web uses the route `/net-worth/:id`, with the first page cached under `['assets', …]`, so a budget write or an edit invalidates it. iOS pushes `NetWorthDestination.asset` and reloads in `.task` and `editDismissed`. Android has its own Patrimoine stack, `useInfiniteQuery` under `netWorthKeys.all`, and a refetch on focus. The three keys `type+id+at` keep both « Courses » rows apart (now tested on all three clients).
- Review findings 1, 2, 4 and 5 are fixed and tested. iOS shows the date alone, matching web and Android. Android no longer flashes « introuvable » after archiving or deleting from the detail (Q29, two tests). Web shows « 1º » in Italian and the real minus sign in the header. Finding 3 is kept on purpose (Q30). The round 1 validation gaps CA13/CA14 (iOS, Android), CA19 (clients) and the iOS row behaviour are now tested. CA8 on iOS is shown by `shots/ios-fr-ca8-after-uncheck-light.png` (9’500.00 CHF, no « Restaurant »). `android-10` was retaken with the final copy.
- Re-run at HEAD 84a142f50: backend `bun test src/modules/asset` 135 pass, 0 fail; web `ng test` net-worth + core/asset 15 files, 147 pass; Android `jest src/features/net-worth src/core/navigation` 20 suites, 150 pass.

# Deal breakers
-

# Suggestions (enhancements only)
- Commit the task record. Q16–31 in `questions.md`, plus `review.md` and `validation.md`, are still uncommitted or untracked; PUL-378 committed its own. Also, `validation.md` describes 3e23bcd63, before the three fix commits. Finish round 2 on HEAD (iOS suite, e2e) and then commit, so the branch keeps the decisions it implements.
- Run the CA16 e2e at least once: `frontend/e2e/tests/features/net-worth.spec.ts` gained `goBack`/`goForward`/`reload` steps that have never run, here or in round 1. The same goes for the iOS suite after 84a142f50 (menu refactor and new tests). The 18:01 captures show the build at HEAD compiles, but they do not prove the tests pass.
- iOS: `.task { await model.load() }` replaces every loaded page with the first page each time the view appears. With more than 30 entries, a user who scrolled down, switches tabs and comes back loses the pages already loaded, and the scroll position jumps. Web keeps the later pages unless the first page changed. Smallest fix: in `load()`, keep the appended entries when the new first page equals the current one.
- Web: `/net-worth/<not-a-uuid>` gets a 400 from `ParseUUIDPipe`, so the page shows « Impossible de charger cet historique, réessaie » with a retry that can never succeed. Mapping a 400 on this read to the not-found state is a one-line change in `isNotFound`. Only matters for hand-typed links.
- Linear contract: update PUL-379 to match what shipped. Android is now in scope (Q1), and CA18 reads « Valeur enregistrée » rather than « Valeur saisie » (Q2). Otherwise the next challenge or QA pass measures against the wrong text.
- Later cleanup (already Q11): `list_asset_movements(timestamptz)` has no caller left once this backend is in production. A contract migration can drop it, so the two selections cannot drift apart.
- Q30 stays a known inaccuracy: for an entry written when PUL-377 shipped after a dismissed suggestion, « Déjà compris dans ta saisie du … » says the entry includes the movement, which is not always true. It was accepted on purpose; reopen it only if a user reports it.

## After the challenge

- Suggestion 2: CA16 e2e run at 7dc0d196f, 3 passed; iOS suite rerun at 031d3cd6b, 2778 passed.
- Suggestion 3 fixed in 031d3cd6b (iOS keeps the appended pages when the first page is unchanged).
- Suggestion 4 fixed in 7dc0d196f (web: a non-uuid id shows « introuvable » without calling the API).
- Suggestions 1, 5 and 6: the task record is committed with this note; the Linear contract update and the removal of `list_asset_movements` stay outside this story (no Linear change allowed here).
