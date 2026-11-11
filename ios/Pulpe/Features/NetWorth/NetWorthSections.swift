import Foundation

/// The page's sections, a pure projection of the API response: grouping and ordering only,
/// no sum and no conversion (the server owns every figure).
struct NetWorthSections: Equatable {
    /// One card of the page: a Type and its elements, or the overdrawn accounts.
    struct Group: Identifiable, Equatable {
        let id: String
        let name: String
        let total: Decimal
        let assets: [Asset]
        /// False for « Découverts », which gathers accounts of several Types.
        var isType = true
    }

    static let overdraftsId = "overdrafts"

    let baseCurrency: SupportedCurrency
    let net: Decimal
    let gross: Decimal
    let debtsTotal: Decimal
    let incomplete: Bool
    /// What I have, by Type, with `category.total` as the API returns it.
    let categories: [Group]
    /// What I owe, by Type, then the overdrawn accounts.
    let debtGroups: [Group]
    /// Active `owe` assets and active `own` assets below zero, API order.
    let debts: [Asset]
    let archived: [Asset]
    private let categoryNames: [String: String]

    init(_ netWorth: NetWorth) {
        let active = netWorth.assets.filter { $0.archivedAt == nil }
        baseCurrency = netWorth.totals.baseCurrency
        net = netWorth.totals.net
        gross = netWorth.totals.gross
        debtsTotal = netWorth.totals.debts
        incomplete = netWorth.totals.incomplete
        categories = netWorth.categories.compactMap { category in
            let assets = active.filter {
                $0.categoryId == category.id && $0.direction == .own && $0.latestValue >= 0
            }
            return assets.isEmpty ? nil : Group(
                id: category.id, name: category.name, total: category.total, assets: assets
            )
        }
        debts = active.filter { $0.direction == .owe || $0.latestValue < 0 }
        // The API gives no subtotal per debt Type: the page adds the converted values the API
        // already rounded, and their sum is its debts total.
        let owed = netWorth.categories.compactMap { category -> Group? in
            let assets = active.filter { $0.categoryId == category.id && $0.direction == .owe }
            return assets.isEmpty ? nil : Group(
                id: category.id, name: category.name, total: Self.converted(assets), assets: assets
            )
        }
        let overdrawn = active.filter { $0.direction == .own && $0.latestValue < 0 }
        debtGroups = owed + (overdrawn.isEmpty ? [] : [Group(
            id: Self.overdraftsId, name: AppLocale.string("Découverts"),
            total: Self.converted(overdrawn), assets: overdrawn, isType: false
        )])
        archived = netWorth.assets.filter { $0.archivedAt != nil }
        categoryNames = Dictionary(netWorth.categories.map { ($0.id, $0.name) }) { first, _ in first }
    }

    private static func converted(_ assets: [Asset]) -> Decimal {
        assets.reduce(0) { $0 + ($1.convertedValue ?? 0).magnitude }
    }

    var isEmpty: Bool { categories.isEmpty && debts.isEmpty && archived.isEmpty }

    /// Some active asset is valued in another currency, so its conversion uses today's rate.
    var hasForeignValues: Bool {
        (categories.flatMap(\.assets) + debts).contains { $0.currency != baseCurrency }
    }

    func categoryName(of asset: Asset) -> String? { categoryNames[asset.categoryId] }

    /// Active assets the API could not convert: the totals leave them out.
    var unconverted: [Asset] {
        (categories.flatMap(\.assets) + debts).filter { $0.convertedValue == nil }
    }
}

// MARK: - Row presentation

enum NetWorthBadge: Equatable {
    case inPulpe
    case overdraft
    case excluded
}

extension Asset {
    var isActive: Bool { archivedAt == nil }

    var badges: [NetWorthBadge] {
        var badges: [NetWorthBadge] = []
        if inPulpe { badges.append(.inPulpe) }
        if direction == .own, latestValue < 0 { badges.append(.overdraft) }
        if isActive, convertedValue == nil { badges.append(.excluded) }
        return badges
    }

    /// Foreign values show their base-currency counterpart; with no rate there is none.
    func showsConversion(in baseCurrency: SupportedCurrency) -> Bool {
        currency != baseCurrency && convertedValue != nil
    }

    /// « aujourd'hui », else a relative phrase (« il y a 3 jours ») in the app language.
    func ageLabel(
        now: Date = Date(),
        calendar: Calendar = .current,
        locale: Locale = AppLocale.currentUILocale
    ) -> String {
        if calendar.isDate(latestRecordedAt, inSameDayAs: now) {
            return AppLocale.string("aujourd'hui", locale: locale)
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = locale
        formatter.unitsStyle = .full
        return formatter.localizedString(for: latestRecordedAt, relativeTo: now)
    }
}

// MARK: - Suggestion

enum NetWorthSuggestionDetail: Equatable {
    case saved
    case drawn
    case repaid
}

extension Asset {
    /// An archived asset never offers one, whatever the payload carries.
    var visibleSuggestion: AssetSuggestion? { isActive ? suggestion : nil }

    /// The wording carries the direction (« pointée », « tiré »), so the amount has no sign.
    var suggestionDetail: NetWorthSuggestionDetail {
        if direction == .owe { return .repaid }
        return (suggestion?.delta ?? 0) < 0 ? .drawn : .saved
    }

    var suggestionMagnitude: Decimal { (suggestion?.delta ?? 0).magnitude }
}
