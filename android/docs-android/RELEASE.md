# Releasing Pulpe on Android

Everything in this file is written and committed. **None of it has been run**:
the pipeline needs an Expo account and a Play Console account that do not exist
yet, so the first execution of every command below is still ahead of us. Treat
the steps as a checklist to work through, not as a description of something
that already works.

## What must exist before any of this runs

| # | Thing | Where | Blocks |
| - | ----- | ----- | ------ |
| 1 | Expo account + `eas init` | expo.dev | every build |
| 2 | Google Play Console account (one-off fee) | play.google.com/console | every submit |
| 3 | Play service-account JSON | Play Console → API access | `eas submit` |
| 4 | Google OAuth client IDs (web + Android) | Google Cloud, project `894420283180` | Google sign-in |
| 5 | Sentry org/project/auth token | sentry.io | symbolicated crashes |
| 6 | PostHog project key (EU host) | posthog.com | analytics (none wired yet) |
| 7 | Backend env on Railway | `MIN_ANDROID_VERSION`, `LATEST_ANDROID_VERSION`, `ANDROID_STORE_URL` | force-update gate |
| 8 | `assetlinks.json` on `app.pulpe.app` | landing/web hosting | App Links verification |

`eas init` writes `extra.eas.projectId` and `updates.url` into `app.json`.
Until it runs, `expo-updates` has no server to ask and OTA is inert — the app
still builds and runs, it simply never checks for an update.

## First-time setup

```bash
cd android
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

Then the signing key. Let EAS generate and hold it — a keystore on a laptop is
a keystore that gets lost, and Play App Signing means losing the upload key is
recoverable while losing a self-managed app-signing key is not:

```bash
pnpm dlx eas-cli@latest credentials --platform android
```

Record the resulting **SHA-256** fingerprint: it goes into the Android OAuth
client (item 4) and into `assetlinks.json` (item 8). The debug fingerprint,
already used for local Google sign-in, is
`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
— it is not the release one, and both need registering.

## The three profiles

`eas.json` defines them; each carries its own OTA channel of the same name.

| Profile | Output | Distribution | Use |
| ------- | ------ | ------------ | --- |
| `development` | APK, dev client | internal | day-to-day, needs Metro |
| `preview` | APK, standalone | internal | share a build, run Maestro |
| `production` | AAB, auto-incremented versionCode | Play | releases |

`appVersionSource: "remote"` means EAS owns `versionCode`; nothing in the repo
tracks it and nothing should. The user-facing `version` stays in `app.json`,
in lockstep with the root `package.json` like every other Pulpe surface.

## Workflows

Two files in `.eas/workflows/`, run by EAS rather than GitHub Actions:

- **`deploy-preview.yml`** — pushes to an `android/**` branch build a preview
  APK and run two Maestro journeys against it. Not wired to pull requests: most
  PRs in this monorepo never touch `android/` and would pay for a build anyway.
- **`deploy-production.yml`** — pushes to `main` build the AAB and submit it to
  the Play **internal** track as a **draft**. `main` is not this repo's default
  branch (`preview` is), so a push there is already a deliberate act; the draft
  status means nothing reaches a user until it is promoted by hand.

This is a deliberate divergence from iOS, whose distribution workflow is
`workflow_dispatch`-only with an explicit SHA. The safety comes from a
different place on each platform — an explicit trigger there, a draft on a
closed track here — and both end with a human promoting the build.

## OTA vs a new binary

`runtimeVersion` uses the `appVersion` policy, so an update only reaches builds
whose `version` matches exactly.

Ship over the air with `eas update --channel production`:

- JavaScript and TypeScript changes
- copy, styles, images under `assets/`
- anything under `src/`

Cut a new binary instead when:

- a native module is added, removed or upgraded (anything in `plugins`)
- `app.json` changes outside `version` — permissions, intent filters, icons
- the Expo SDK or React Native version moves
- `version` itself changes, which by definition ends the current runtime

The rule to remember: if `npx expo prebuild` would produce different native
output, it is a binary. There is no gradual rollout for OTA — an update is live
for the whole channel at once, so the rollback is a second update, not a
setting:

```bash
pnpm dlx eas-cli@latest update:republish --group <previous-group-id>
```

## Maestro journeys

Three flows in `maestro/`, covering what must never break:

| Flow | Proves |
| ---- | ------ |
| `login-vault.yaml` | sign in, unlock the vault, reach the month |
| `check-operation.yaml` | pointing persists, and un-pointing undoes it |
| `onboarding.yaml` | the eight onboarding screens chain to a real budget |

Only the first two run in CI. `onboarding.yaml` registers a real account, so
running it per push would fill the database with throwaway users; run it by
hand before a release with a disposable address.

```bash
brew install maestro
maestro test -e EMAIL=demo@pulpe.test -e PASSWORD=local-demo-only maestro/login-vault.yaml
```

**These flows have never been executed.** The selectors were read out of the
source — `sign-in-email`, `sign-in-password` and `sign-in-submit` are testIDs
added for exactly this purpose, the rest are visible French copy — but no run
has confirmed them, and the first one should be budgeted as a debugging pass
rather than a verification.

## Play Console listing

- **Title** Pulpe · **Category** Finance · **Copy** French
- Icon: `assets/images/adaptive-icon.png` (adaptive, `#C6F0BA` background)
- Feature graphic and screenshots: no Android sources exist yet. The iOS store
  slides live in `~/Desktop/pulpe-marketing/slides/` (a Next.js project) and
  are the obvious starting point, at Android's aspect ratios.
- **Data safety**: the app collects an email address and financial amounts.
  The amounts are encrypted client-side (AES-256-GCM, see `docs/ENCRYPTION.md`)
  and the server never holds the key, which is worth declaring accurately —
  "encrypted in transit" alone understates it.

Once the listing is published, its URL becomes `ANDROID_STORE_URL` on the
backend (item 7). Until that variable is set, the force-update gate has no
destination: it will still block the app, but its button has nowhere to go.

## Release notes

`GET /whats-new/android` exists and works, and the app asks it once per
upgrade. It answers with nothing today: every entry in
`landing/data/releases.json` is tagged `["web", "ios"]` or narrower, and the
Android feed only returns entries whose `platforms` include `android`.

So the first Android release has one extra step the iOS ones do not: add
`"android"` to the `platforms` array of that release in
`landing/data/releases.json`, and mirror it into
`backend-nest/src/modules/whats-new/domain/releases-data.ts`, which is the
checked-in copy the deployed backend actually reads. Miss it and the sheet
simply never appears — no error, no log, nothing to notice.

Android reads `version` (the repo version, which the bundle ships verbatim)
where iOS reads `iosVersion`, so no separate Android numbering is needed.

## App Links

`app.json` already declares the intent filter for
`https://app.pulpe.app/reset-password` with `autoVerify`. Verification fails
today — `adb shell pm get-app-links app.pulpe.android` reports state `1024`,
meaning no `assetlinks.json` was found. Publish this at
`https://app.pulpe.app/.well-known/assetlinks.json`, with the release SHA-256
from the credentials step:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.pulpe.android",
      "sha256_cert_fingerprints": ["<release SHA-256>"]
    }
  }
]
```

Until it is served, password-reset links open in the browser instead of the
app. Nothing breaks — the web page handles the reset — but the handoff is
missing.
