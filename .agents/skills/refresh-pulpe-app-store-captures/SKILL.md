---
name: refresh-pulpe-app-store-captures
description: Regenerate Pulpe iOS App Store screenshots in place from the PNG roster already present in appstore-screenshots. Use when asked to refresh, update, add, or remove Pulpe store captures while preserving filenames, French UI, CHF, iPhone 17 Pro Max sizing, and deterministic screen selection.
---

# Refresh Pulpe App Store Captures

Treat `appstore-screenshots/*.png` as the requested roster. Never restore a deleted
capture from memory or from the route catalog.

## Run

1. Read `references/routes.json` only when adding a route or diagnosing navigation.
2. Ensure local Supabase/backend are running and `PulpeLocal` is installed on an
   available iPhone 17 Pro Max. Regenerate Xcode with
   `xcodegen generate --use-cache` before rebuilding.
3. Preview the exact roster without touching the simulator:

   ```bash
   python3 .agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py plan
   ```

4. Run the deterministic AXe driver:

   ```bash
   python3 .agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py run
   ```

   Pass `--udid <UDID>` only to override device discovery. The runner launches
   `app.pulpe.ios` in `fr_CH`, normalizes the status bar, unlocks the seed account,
   replaces each requested PNG atomically, then clears the status-bar override.
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

## Safety

- Never mutate the shared demo database for prettier screenshots. Prefer deterministic
  DEBUG fixtures; otherwise capture the existing account state and report weak data.
- Never reset a linked Supabase database.
- Keep the output directory ignored by Git; track this skill and its route catalog.
- Reuse `ios-marketing-capture` for multiple locales, devices, appearances, or isolated
  elements. Reuse `asc-shots-pipeline` for framing/upload. `app-store-screenshots` is
  for composition, not raw capture.
