---
status: pending
---

# Instruction: Activation and public wording

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── ENCRYPTION.md ✏️
└── landing/
    ├── app/
    │   ├── (fr)/privacy/page.tsx ✏️
    │   └── (fr)/about/page.tsx ✏️
    └── content/
        └── dictionaries/
            ├── fr.ts ✏️
            ├── en.ts ✏️
            ├── de.ts ✏️
            └── it.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phases 1 to 6 in production with the switch `off`; `scripts/label-snapshot.ts` run on Maxime's account | A reference snapshot of every label of the account, across the nine tables | cli |
| Happy path | Switch `listed` with Maxime's account, then one request with the PIN | A conversion log line with a success; a second snapshot equals the first; no label of the account without the marker | api |
| Happy path | One week of normal use on iOS, Android and web | No alert; the daily line shows one converted account and no mixed account | system |
| Happy path | Export the nine tables from production, encrypted before it touches the disk, and restore it once into a scratch database | The restore completes and the row counts match; the scratch copy is deleted, the encrypted export is kept | system |
| Happy path | Switch `all` | The count of converted accounts grows with sign-ins; no alert; a week later the encrypted export is deleted | system |
| Edge case  | Stale key on each released client | PIN screen | browser |
| Edge case  | An alert or a non-empty snapshot diff during the week | Switch back to `off`; no general activation | system |
| Edge case  | Public copy after the wording change | No sentence says "tous", "100 %" or "au maximum"; `pnpm test:lexicon` is green | cli |

## Tasks to do

### `1)` Rehearse on one account

> Maxime's account first, for a week (Q11).

1. Run `scripts/label-snapshot.ts` on the account and keep the output; `GET /budgets/export` is not enough, it holds budgets only and a changing `exportDate`. Set `LABEL_ENCRYPTION_SCOPE=listed` and `LABEL_ENCRYPTION_USER_IDS` in production, open the app once.
2. Run the snapshot again and diff the two files; read the conversion log line; delete both files.
3. Use the three clients for a week; read the daily line.

### `2)` Export and restore drill

> A backup that was never restored is a hope (Q11).

1. Read-only export of the nine label tables from production, piped into a passphrase-based encryption tool before it touches the disk; the passphrase goes in the password manager. No destructive command on the linked database.
2. Restore it once into a scratch local database, compare the row counts, delete the scratch copy.
3. Keep the encrypted export until a week after general activation, then delete it. An account that converts later relies on the conversion's own checks: all or nothing, each value decrypted and compared before it is sent.

### `3)` Go or no-go

> The four conditions of Q14, all met or no activation.

1. CI green, with the deliberate red runs of phases 2 and 6 recorded.
2. The rehearsal week without an alert and with an empty snapshot diff.
3. The released iOS, Android and web builds checked by hand by Maxime, about 30 minutes: stale key, search, tag order, goal rename, PIN change.
4. The export restored once.

### `4)` Activate for everyone

> A configuration change, no code.

1. Set `LABEL_ENCRYPTION_SCOPE=all`; watch the daily line and the alerts for the following week.
2. At the end of that week, delete the encrypted export.

### `5)` Publish the wording

> Silent until now, then one reassuring note (Q12).

1. What's New note through the release skill, in Pulpe's voice, never "tous", "100 %" or "au maximum": accounts that never return stay as they are.
2. "Montants" becomes "montants et noms" in the four landing dictionaries and in `landing/app/(fr)/privacy/page.tsx` and `landing/app/(fr)/about/page.tsx`; grep `chiffr` and its translations again at that time, the copy will have moved.
3. In-app sentences also say "montants" only: web `frontend/projects/webapp/public/i18n/fr.json` ("Tes montants restent privés"), Android `android/src/core/i18n/catalogs/fr.json`, iOS `ios/Pulpe/Resources/Localizable.xcstrings`. They stay true after activation. Ask Maxime whether Q12 covers them; if it does, they change in every locale of each catalog and ship with the app releases.
4. `docs/ENCRYPTION.md`: final state, and the end of SQL support for names.
5. ADR-0020 moves to Accepted.

### `6)` Contributor check

> The project's own gates, from the root.

1. `pnpm quality`.
2. `ng build` for the Angular templates, which `pnpm quality` does not type-check.
3. The backend integration and SQL suites with `RUN_INTEGRATION_TESTS=true`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The two snapshots of Maxime's account are identical and no label of the account is stored without the marker |
| 2    | The restored row counts match production, the scratch copy is deleted, and the export never sat on disk in clear |
| 3    | The four conditions are written down with their evidence before the switch moves |
| 4    | A week after `all`, the daily line shows no mixed account, no alert fired, and the encrypted export is deleted |
| 5    | The landing dictionaries, the privacy page and the about page say "montants et noms", the note is live, no copy claims every account is covered, and the in-app sentences have a recorded decision |
| 6    | The three commands pass on the last pull request |
