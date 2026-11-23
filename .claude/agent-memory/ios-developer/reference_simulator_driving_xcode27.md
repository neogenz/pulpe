---
name: simulator-driving-xcode27
description: Driving the iOS simulator from Bash on Xcode 27 — axe taps silently do nothing; a throwaway XCUITest command-file driver works; test-without-building installs its own (possibly unsigned) app copy
metadata:
  type: reference
---

On Xcode 27, `axe` 1.6.0 fails to load SimulatorKit (moved to `Contents/SharedFrameworks`). A
`DEVELOPER_DIR` shim (copy of `Xcode.app/Contents` as symlinks, `Developer/Library/PrivateFrameworks/SimulatorKit.framework`
→ SharedFrameworks) makes `axe describe-ui` work, but `axe tap`/`touch` report success and deliver
nothing. There is no Simulator.app any more (DeviceHub.app replaces it); opening it does not help.

What worked (phase 11, 2026-11-21): a temporary `PulpeUITests/ZZ…Tmp.swift` XCUITest that attaches with
`XCUIApplication(bundleIdentifier: "app.pulpe.ios")`, polls `/tmp/…/cmd-N` files written by the host and
answers in `ack-N` (verbs: activate, tapid, taplabel, tapxy, type, swipeup, tree, done). Run it with
`xcodebuild test-without-building -scheme PulpeUITests` in the background; launch the app yourself with
`simctl launch` and flags first. Backspaces typed as `\b` characters clear a field. Trash the file and
`xcodegen generate --use-cache` afterwards.

Gotchas:
- `test-without-building` installs its OWN copy of the app (from the UI-test derived data), not the
  build you meant to capture. If that copy was built with `CODE_SIGNING_ALLOWED=NO`, it has no
  entitlements: keychain reads fail with `-34018` and the app shows « Connexion impossible » although
  the backend is up. After the driver logs `started`, `simctl install` the signed `.app` and compare
  `shasum` of the installed `Pulpe` binary with the one you built.
- Once built, the driver lives in the UI-test derived data: after its source is trashed,
  `test-without-building -only-testing:…/testDrive` on that derived data still runs it, with no
  file to restore and no regeneration.
- `simctl launch` honours `SIMCTL_CHILD_API_BASE_URL=…`: `AppConfiguration` reads the env first, so a
  local proxy on another port can refuse one endpoint (error screens) without touching the shared backend.
- « Masquer les montants » (`sensitiveAmount()`) sets `accessibilityHidden`: a hidden amount field is
  gone from the tree, `taplabel` misses it, and `type` after a `tapxy` focus still fails (« Neither element
  nor any descendant has keyboard focus ») and kills the driver. `axe type` does nothing either. The
  toggle is session-only (relaunch shows amounts) and lives on Accueil; the shake alert does not appear
  over a sheet. Type amounts while visible: a comparison draft only outlives the sheet through a PIN lock
  (30 s in background), and the Accueil path reopens it at once, so use the Budgets-tab path
  (`resumes: false`), toggle on Accueil, then reopen.
- A host helper call that times out still bumps the shared command counter when it finally exits, so later
  commands land on numbers the driver never reads. Kill your own stale helper processes and reset the counter
  before you retry. Send the first command only once the app is running: a tap on an app that is not running
  makes the test fail and the driver exits.
- A sheet's step 1 with a decimal pad: drag the list *into* the keyboard to hide it, after scrolling down first.
  The same drag with the list already at the top swipes the whole sheet away.
- demo@pulpe.test is shared with the Android capture agent: a `user_reconciliation` row or new asset snapshots
  can appear that are not yours. Back up the row before you delete it, and ask the coordinator first.
