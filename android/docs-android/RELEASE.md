# Releasing Pulpe on Android

The Expo project is linked. PR #608 has produced both a successful EAS preview
APK and a successful GitHub Maestro smoke run. Play signing, submission and OTA
still need their first successful run, so keep treating those sections as a
checklist rather than a description of a finished release pipeline.

## What must exist before any of this runs

| #   | Thing                                     | Where                                                                | Blocks                 |
| --- | ----------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| 1   | Expo account + `eas init` + GitHub link   | expo.dev                                                             | every build/workflow   |
| 2   | Google Play Console account (one-off fee) | play.google.com/console                                              | every submit           |
| 3   | Play service-account JSON                 | Play Console → API access                                            | `eas submit`           |
| 4   | Google OAuth client IDs (web + Android)   | Google Cloud, project `894420283180`                                 | Google sign-in         |
| 5   | PostHog project key (EU host)             | posthog.com                                                          | analytics + JS errors  |
| 6   | Backend env on Railway                    | `MIN_ANDROID_VERSION`, `LATEST_ANDROID_VERSION`, `ANDROID_STORE_URL` | force-update gate      |
| 7   | `assetlinks.json` on `app.pulpe.app`      | `frontend/projects/webapp/public/.well-known/`                       | App Links verification |

`eas init` writes `extra.eas.projectId` into `app.json`; `eas update:configure`
writes `updates.url`. Until the latter runs, OTA is inert — the app still builds
and runs, it simply never checks for an update.

## First-time setup

```bash
cd android
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

Link the GitHub repository from the EAS project. In the GitHub `Preview`
environment, create `MAESTRO_EMAIL`, `MAESTRO_PASSWORD` and `MAESTRO_PIN`
secrets for a deterministic account containing an unchecked `Loyer` operation.

Then the upload key. Let EAS generate and hold it — a keystore on a laptop is a
keystore that gets lost, and Play App Signing means losing the upload key is
recoverable while losing a self-managed app-signing key is not:

```bash
pnpm dlx eas-cli@latest credentials --platform android
```

This certificate signs APKs installed directly and authenticates AAB uploads;
it does **not** sign the APK Play delivers. Keep its SHA-1 in the Android OAuth
client only if direct production APKs must support Google sign-in, and its
SHA-256 in `assetlinks.json` only if those APKs must verify App Links.

After the first AAB is accepted, open **Play Console → Play app signing → App
signing key certificate** (under App integrity / Play Store distribution). That
is the certificate seen by an internal tester. Register its **SHA-1** in the
Android OAuth client and its **SHA-256** in `assetlinks.json`. Repeat for every
active Play app-signing certificate during a signing-key rotation. Debug and
EAS upload certificates remain separate identities; obtain their SHA-1/SHA-256
from the tool that owns each keystore and register them only for the
distributions that still use them.

## The three profiles

`eas.json` defines them; each carries its own OTA channel of the same name.

| Profile       | Output                            | Distribution | Use                        |
| ------------- | --------------------------------- | ------------ | -------------------------- |
| `development` | APK, dev client                   | internal     | day-to-day, needs Metro    |
| `preview`     | APK, standalone                   | internal     | share a build, run Maestro |
| `production`  | AAB, auto-incremented versionCode | Play         | releases                   |

`appVersionSource: "remote"` means EAS owns `versionCode`; nothing in the repo
tracks it and nothing should. The user-facing `version` stays in `app.json`,
in lockstep with the root `package.json` like every other Pulpe surface.

## Workflows

Two files in `.eas/workflows/` handle distributable builds:

- **`deploy-preview.yml`** — relevant pull requests to `preview` or `main`
  build a preview APK. Path filters skip unrelated monorepo changes; manual
  dispatch remains available.
- **`deploy-production.yml`** — pushes to `main` build the AAB and submit it to
  the Play **internal** track as a **draft**. `main` is not this repo's default
  branch (`preview` is), so a push there is already a deliberate act; the draft
  status means nothing reaches a user until it is promoted by hand.

This is a deliberate divergence from iOS, whose distribution workflow is
`workflow_dispatch`-only with an explicit SHA. The safety comes from a
different place on each platform — an explicit trigger there, a draft on a
closed track here — and both end with a human promoting the build.

`.github/workflows/android-e2e.yml` owns the smoke gate without a paid Expo
plan. It generates a release APK for x86_64, boots an API 35 emulator, verifies
the pinned Maestro archive before installing it, and keeps a screenshot plus
logcat when the journey fails.

Android declares React and ReactDOM 19.2.3 together even though it does not ship
a web build. `expo-router` has an optional ReactDOM peer; without the local
declaration, Expo Doctor traverses the monorepo and borrows Landing's 19.2.8,
then reports a duplicate React installation. Landing deliberately remains on
React/ReactDOM 19.2.8.

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

Four flows in `maestro/`, covering what must never break:

| Flow                   | Proves                                              |
| ---------------------- | --------------------------------------------------- |
| `login-vault.yaml`     | sign in, unlock the vault, reach the month          |
| `check-operation.yaml` | pointing persists, and un-pointing undoes it        |
| `onboarding.yaml`      | the eight onboarding screens chain to a real budget |
| `smoke.yaml`           | composes login/unlock, pointing and undo            |

Only the first two run in CI. `onboarding.yaml` registers a real account, so
running it per push would fill the database with throwaway users; run it by
hand before a release with a disposable address.

Install Maestro, boot an emulator, install the preview APK and start the local
backend/Supabase seed, then run:

```bash
pnpm --filter pulpe-android test:e2e
```

The local seed credentials are explicit fallbacks. GitHub Actions uses
`MAESTRO_EMAIL`, `MAESTRO_PASSWORD` and `MAESTRO_PIN` secrets from the
`Preview` environment instead. The workflow pins Maestro 2.7.0 and captures
the screen plus logcat on failure.

Run five consecutive green pull-request checks before making the Maestro smoke
status required in branch protection.

PR #608 has successfully executed the composed smoke journey on GitHub, which
covers `login-vault.yaml` and `check-operation.yaml`. `onboarding.yaml` remains
manual because it registers a real account; run it with a disposable address
before promoting the first Play build.

## Play Console listing

- **Title** Pulpe · **Category** Finance · **Copy** French
- Icon: `assets/images/adaptive-icon.png` (adaptive, `#C6F0BA` background)
- Feature graphic and screenshots: no Android sources exist yet. The iOS store
  slides live in `~/Desktop/pulpe-marketing/slides/` (a Next.js project) and
  are the obvious starting point, at Android's aspect ratios.
- **Data safety**: internal-only releases are currently exempt from publishing
  the form, but complete it before any closed, open or production track. Audit
  the current build and privacy policy against this inventory — do not reduce
  the declaration to email and amounts:

  | Play data family         | Current Android flow                                                                                                         | Purpose and control                                                      |
  | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
  | Personal info            | Supabase/backend receive account email, user ID and profile name.                                                            | Account management, authentication and app functionality.                |
  | Financial info           | User-entered amounts, balances and savings goals reach the backend as AES-256-GCM ciphertext.                                | Core app functionality; TLS in transit, server has no vault key.         |
  | Other user content       | Budget, operation and goal names, tags, descriptions and dates support the user's records.                                   | Core app functionality; review each field's encryption before declaring. |
  | App activity             | PostHog receives screen names and allow-listed onboarding/auth interaction events, without route IDs, typed text or amounts. | Analytics; production only, controlled by “Partager les diagnostics”.    |
  | App info and performance | PostHog receives uncaught JavaScript exceptions and unhandled rejections, plus app version, build, platform and environment. | Diagnostics; no native crash/session replay, same user control.          |
  | Device or other IDs      | PostHog assigns a distinct/device identifier and SDK device/app/OS properties.                                               | Analytics and diagnostics; same user control.                            |

  Verify the final Play answers against the PostHog/Supabase processor terms,
  retention, deletion path and whether each transfer qualifies as “sharing”
  under Play's definitions. The encryption note in `docs/ENCRYPTION.md` is
  stronger than transport encryption, but it does not remove these collection
  categories.

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
`https://app.pulpe.app/.well-known/assetlinks.json`, with the **Play app-signing
SHA-256** from Play Console after the first AAB upload:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.pulpe.android",
      "sha256_cert_fingerprints": ["<Play app-signing SHA-256>"]
    }
  }
]
```

Until it is served, password-reset links open in the browser instead of the
app. Nothing breaks — the web page handles the reset — but the handoff is
missing.
