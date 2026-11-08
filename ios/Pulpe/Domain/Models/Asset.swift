import Foundation

/// `own` = what I have; `owe` = what I owe, valued by the remaining balance.
enum AssetDirection: String, Codable, Sendable, Hashable {
    case own
    case owe
}

/// A category as read on the page: `total` is in the base currency.
struct AssetCategory: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let total: Decimal
}

/// A category as returned by writes: no amounts.
struct AssetCategoryRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
}

/// Value proposed by the checked prévisions since the last snapshot. Both amounts are in
/// the asset's own currency; `delta` is signed.
struct AssetSuggestion: Codable, Hashable, Sendable {
    let delta: Decimal
    let proposedValue: Decimal
}

/// An asset as read on the page. `convertedValue` is in the base currency and `nil` when
/// no rate is available; `suggestion` is `nil` when nothing justifies one.
struct Asset: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let categoryId: String
    let name: String
    let currency: SupportedCurrency
    let direction: AssetDirection
    let inPulpe: Bool
    let archivedAt: Date?
    let latestValue: Decimal
    let latestRecordedAt: Date
    let convertedValue: Decimal?
    let suggestion: AssetSuggestion?
}

/// An asset as returned by writes: no amounts.
struct AssetRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let categoryId: String
    let name: String
    let currency: SupportedCurrency
    let direction: AssetDirection
    let inPulpe: Bool
    let archivedAt: Date?
}

/// Totals in the base currency. `debts` is a positive magnitude; `net = gross - debts`.
/// `incomplete`: an active asset could not be converted and is left out of the totals.
struct NetWorthTotals: Codable, Hashable, Sendable {
    let baseCurrency: SupportedCurrency
    let gross: Decimal
    let debts: Decimal
    let net: Decimal
    let incomplete: Bool
}

struct NetWorth: Codable, Hashable, Sendable {
    let totals: NetWorthTotals
    let categories: [AssetCategory]
    let assets: [Asset]
}

// MARK: - Create/Update DTOs

struct AssetCreate: Codable, Hashable, Sendable {
    let name: String
    let categoryId: String
    let currency: SupportedCurrency
    let direction: AssetDirection
    let inPulpe: Bool
    /// First snapshot of the asset.
    let value: Decimal
}

/// Currency and direction are frozen at creation. `nil` keys are omitted from the body.
struct AssetUpdate: Codable, Hashable, Sendable {
    var name: String?
    var categoryId: String?
    var inPulpe: Bool?
    var archived: Bool?
}

struct AssetSnapshotItem: Codable, Hashable, Sendable {
    let assetId: String
    let value: Decimal
}

struct AssetSnapshotsCreate: Codable, Hashable, Sendable {
    let items: [AssetSnapshotItem]
}

/// `recordedAt` is shared by every snapshot of the batch.
struct AssetSnapshotsResult: Codable, Hashable, Sendable {
    let recordedAt: Date
}

/// Body of a category create and rename.
struct AssetCategoryWrite: Codable, Hashable, Sendable {
    let name: String
}
