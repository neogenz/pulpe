---
status: pending
---

# Instruction: Asset API client and error copy

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Core/
    │   │   └── Network/
    │   │       ├── Endpoints.swift ✏️
    │   │       └── APIError.swift ✏️
    │   ├── Domain/
    │   │   ├── Models/
    │   │   │   └── Asset.swift ✅
    │   │   └── Services/
    │   │       └── AssetService.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        ├── Core/
        │   └── Network/
        │       └── APIErrorLocalizationTests.swift ✏️
        └── Domain/
            ├── Models/
            │   └── AssetCodableTests.swift ✅
            └── Services/
                └── AssetServiceTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | `cd ios && xcodegen generate --use-cache` | Project lists the new files | cli |
| Happy path | `AssetServiceTests` through `InterceptingURLProtocol`: each call hits its method and path | `GET /assets`, `POST /assets`, `PATCH /assets/:id`, `DELETE /assets/:id`, `POST /assets/snapshots`, `POST /assets/:id/dismiss-suggestion`, `POST/PATCH/DELETE /asset-categories[/:id]` | cli |
| Happy path | Decode a `GET /v1/assets` body with CHF and EUR assets, a suggestion, an archived asset | Every field decodes; `convertedValue` and `suggestion` null decode as `nil` | cli |
| Edge case  | Encode an `AssetUpdate` with only `archived` set | Body is exactly `{"archived":true}`; no other key | cli |
| Edge case  | Each `ERR_ASSET_*` code from the server | Maps to its case and its French message in `fr`, its translation in `de`, `en`, `it` | cli |
| Edge case  | Unknown `ERR_ASSET_SOMETHING` | Falls back to the server message as today | cli |

## Tasks to do

### `1)` Models

> The wire shapes of `shared/schemas.ts:3065-3222`, as Sendable structs.

1. `Asset.swift`: `AssetDirection` (`own`, `owe`), `AssetCategory` (`id`, `name`, `total: Decimal`), `AssetCategoryRecord` (`id`, `name`), `AssetSuggestion` (`delta`, `proposedValue` as `Decimal`), `Asset` (`id`, `categoryId`, `name`, `currency: SupportedCurrency`, `direction`, `inPulpe`, `archivedAt: Date?`, `latestValue: Decimal`, `latestRecordedAt: Date`, `convertedValue: Decimal?`, `suggestion: AssetSuggestion?`), `AssetRecord` (the same without amounts), `NetWorthTotals` (`baseCurrency`, `gross`, `debts`, `net`, `incomplete`), `NetWorth` (`totals`, `categories`, `assets`).
2. Request DTOs: `AssetCreate` (`name`, `categoryId`, `currency`, `direction`, `inPulpe`, `value`), `AssetUpdate` (all optional: `name`, `categoryId`, `inPulpe`, `archived`; nil keys omitted by synthesized `encodeIfPresent`), `AssetSnapshotsCreate` (`items: [AssetSnapshotItem]` with `assetId`, `value`), `AssetCategoryWrite` (`name`) used for create and rename, `AssetSnapshotsResult` (`recordedAt`).
3. No logic in the models: grouping and labels belong to the features.

### `2)` Endpoints and service

> One actor wraps every asset route.

1. `Endpoints.swift`: `assets`, `asset(id:)`, `assetSnapshots`, `assetDismissSuggestion(id:)`, `assetCategories`, `assetCategory(id:)` with their paths; methods per route. `.asset(id:)` and `.assetCategory(id:)` serve PATCH and DELETE through the explicit `method:` the caller passes, as `savingsGoal(id:)` does.
2. `AssetService.swift`: `protocol AssetServicing: Sendable` and `actor AssetService` with `static let shared`, on the model of `SavingsGoalService.swift`: `getNetWorth() -> NetWorth`, `create(_:) -> AssetRecord`, `update(id:_:) -> AssetRecord`, `delete(id:)`, `recordSnapshots(_:) -> AssetSnapshotsResult`, `dismissSuggestion(id:) -> AssetRecord`, `createCategory(_:) -> AssetCategoryRecord`, `renameCategory(id:_:) -> AssetCategoryRecord`, `deleteCategory(id:)`. Deletes use `requestVoid`.

### `3)` French errors

> Every `ERR_ASSET_*` code of `shared/src/error-codes.ts:100-109` shows its own message.

1. Nine `APIError` cases (`assetNotFound`, `assetCategoryNotFound`, `assetCategoryNotEmpty`, `assetCategoryDuplicate`, `assetValueInvalid`, `assetFetchFailed`, `assetCreateFailed`, `assetUpdateFailed`, `assetDeleteFailed`), their `codeMapping` entries and their `catalogKey` copy taken from `apiError.asset*` in `frontend/projects/webapp/public/i18n/fr.json`.
2. The nine keys in `Localizable.xcstrings` with `de`, `en`, `it` from the matching web i18n files, state `translated`.
3. `APIErrorLocalizationTests`: one parameterized test over the nine codes asserting the case and the French message.

### `4)` Contract tests

> The client matches the backend contract before anything uses it.

1. `AssetCodableTests`: a full `GET /v1/assets` body decodes; null `convertedValue`, `suggestion`, `archivedAt` decode as `nil`.
2. `AssetServiceTests` (suite `.serialized`, `makeAPIClient()` + `InterceptingURLProtocol`, like `TagServiceTests`): method, path and body of each call; `AssetUpdate` with one key encodes one key.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `AssetCodableTests` pass; `Asset` and `NetWorth` are `Codable`, `Sendable`, `Hashable` |
| 2    | `AssetServiceTests` pass, each of the nine calls asserted on method, path and body |
| 3    | `APIErrorLocalizationTests` pass for the nine codes; `pnpm test:lexicon` passes from the repo root |
| 4    | `xcodebuild test -project Pulpe.xcodeproj -scheme PulpeLocal -configuration Local -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath <scratchpad>/dd CODE_SIGNING_ALLOWED=NO -only-testing:PulpeTests/AssetServiceTests -only-testing:PulpeTests/AssetCodableTests -only-testing:PulpeTests/APIErrorLocalizationTests` reports a non-zero executed count and passes; `swiftlint lint --strict` in `ios/` passes |
