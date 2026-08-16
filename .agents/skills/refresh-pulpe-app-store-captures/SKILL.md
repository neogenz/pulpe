---
name: refresh-pulpe-app-store-captures
description: Regenerate Pulpe iOS App Store screenshots in place from the PNG roster already present in appstore-screenshots. Use when asked to refresh, update, add, or remove Pulpe store captures while preserving filenames, French UI, CHF, iPhone 17 Pro Max sizing, and deterministic screen selection.
---

# Refresh Pulpe App Store Captures

Treat `appstore-screenshots/*.png` as the requested roster. Never restore a deleted
capture from memory or from the route catalog.

## Run

1. Read `references/routes.json` only when adding a route or diagnosing navigation.
2. Start this workspace's normal local backend on port 3000. The refresh refuses a
   backend owned by another worktree and never starts, stops, or resets Supabase.
3. Preview the exact roster without touching the simulator:

   ```bash
   python3 .agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py plan
   ```

4. Run the deterministic refresh:

   ```bash
   bash .agents/skills/refresh-pulpe-app-store-captures/scripts/refresh.sh
   ```

   The command verifies the backend's working directory, regenerates Xcode, builds
   and installs `PulpeLocal` with Xcode's normal reusable DerivedData. It creates one
   reusable `Pulpe App Store Captures` simulator (iPhone 17 Pro Max), launches
   `app.pulpe.ios` in `fr_CH`, forces light appearance, normalizes the status bar,
   unlocks the seed account, replaces each requested PNG atomically, then clears
   the status-bar override.
   On a fresh install it signs in with the local seed account first; override
   `PULPE_CAPTURE_EMAIL`, `PULPE_CAPTURE_PASSWORD`, or `PULPE_CAPTURE_PIN` only
   when the local fixture credentials differ.
5. Inspect all produced images visually. Reject loading, modal, keyboard, toast,
   clipped, hidden-amount, non-French, or non-CHF states.
6. Run the deterministic file gate:

   ```bash
   python3 .agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py check
   git check-ignore -v appstore-screenshots/01-accueil.png
   ```

## Roster changes

- **Refresh:** run with no include flags; only existing PNG names are captured.
- **Refresh one existing screen:** pass `--only <filename.png>`; the filename must
  already belong to the folder roster.
- **Add explicitly:** add its stable route to `references/routes.json`, then run with
  `--include <filename.png>`. After the first successful capture, the file joins all
  future refreshes automatically.
- **Remove explicitly:** delete only the requested PNG. Optionally remove its stale
  catalog route; absence from the folder is already authoritative.
- **Unknown existing PNG:** stop. Register its route from the user's explicit
  navigation request; never infer or silently skip it.

## Stable routes

- Select native tabs with the DEBUG-only `UITEST_CAPTURE_TAB` launch environment;
  SwiftUI does not expose stable identifiers for the tab-bar buttons it creates.
- Prefer `tap_id` and stable accessibility identifiers for actions and `expect`.
  Use `tap_label` only for stable system controls, and `tap_point` only as a
  documented last resort.
- Product copy, translated labels, and layout coordinates must not define whether
  a route succeeds. A visual refresh should require no catalog or runner changes.

## Safety

- Never mutate the shared demo database for prettier screenshots. Prefer deterministic
  DEBUG fixtures; otherwise capture the existing account state and report weak data.
- Never start, stop, or reset the shared Supabase stack from this workflow.
- Never install or capture on the generic shared iPhone simulator. Use the dedicated
  `Pulpe App Store Captures` device so concurrent agents cannot alter its app/session.
- Never reset a linked Supabase database.
- Keep the output directory ignored by Git; track this skill and its route catalog.
- Reuse `ios-marketing-capture` for multiple locales, devices, appearances, or isolated
  elements. Reuse `asc-shots-pipeline` for framing/upload. `app-store-screenshots` is
  for composition, not raw capture.
