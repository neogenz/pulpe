import Foundation

/// What the element sheet holds, with its validation and its payloads, away from the view.
struct AssetFormDraft: Equatable {
    var name = ""
    var direction: AssetDirection = .own
    var currency: SupportedCurrency = .chf
    /// `nil` until a Type is picked or typed.
    var category: AssetCategoryChoice?
    /// Always a magnitude; `isOverdraft` carries the sign of an account.
    var amount: Decimal?
    var isOverdraft = false

    init(currency: SupportedCurrency = .chf) {
        self.currency = currency
    }

    init(asset: Asset) {
        name = asset.name
        direction = asset.direction
        currency = asset.currency
        category = .existing(id: asset.categoryId)
        amount = asset.latestValue.magnitude
        isOverdraft = asset.direction == .own && asset.latestValue < 0
    }

    // MARK: - Types

    struct TypeOptions: Equatable {
        /// Types an element of this direction already uses, most used first.
        let used: [AssetCategory]
        /// Suggested names for this direction that no listed Type carries.
        let suggestions: [String]

        /// The most used Type of the direction, or its first suggestion.
        var defaultChoice: AssetCategoryChoice? {
            if let first = used.first { return .existing(id: first.id) }
            return suggestions.first.map { .starter(name: $0) }
        }
    }

    /// Localized, so a Type created from a suggestion reads in the user's language.
    static func starterNames(for direction: AssetDirection) -> [String] {
        switch direction {
        case .own:
            [
                AppLocale.string("Comptes"), AppLocale.string("Épargne"), AppLocale.string("Placements"),
                AppLocale.string("Cash"), AppLocale.string("Objets de valeur"), AppLocale.string("Biens")
            ]
        case .owe:
            [
                AppLocale.string("Crédit"), AppLocale.string("Hypothèque"),
                AppLocale.string("Leasing"), AppLocale.string("Carte de crédit")
            ]
        }
    }

    /// A Type has no direction of its own: it is offered where its elements are.
    static func typeOptions(
        direction: AssetDirection,
        categories: [AssetCategory],
        assets: [Asset],
        starters: [String]? = nil
    ) -> TypeOptions {
        var uses: [String: Int] = [:]
        for asset in assets where asset.direction == direction {
            uses[asset.categoryId, default: 0] += 1
        }
        let used = categories
            .enumerated()
            .filter { uses[$0.element.id] != nil }
            .sorted { lhs, rhs in
                let (left, right) = (uses[lhs.element.id] ?? 0, uses[rhs.element.id] ?? 0)
                return left == right ? lhs.offset < rhs.offset : left > right
            }
            .map(\.element)
        let taken = Set(used.map { $0.name.lowercased() })
        return TypeOptions(
            used: used,
            suggestions: (starters ?? starterNames(for: direction)).filter { !taken.contains($0.lowercased()) }
        )
    }

    /// A typed name resolves to the matching Type when there is one, hidden ones included, so
    /// the server never sees a duplicate; a blank name is no choice.
    static func choice(forName name: String, existing: [AssetCategory]) -> AssetCategoryChoice? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let match = existing.first(where: { $0.name.lowercased() == trimmed.lowercased() }) {
            return .existing(id: match.id)
        }
        return .starter(name: trimmed)
    }

    // MARK: - Validation

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var isValid: Bool { !trimmedName.isEmpty && category != nil && amount != nil }

    /// Shown once the user has typed then cleared the name, never on a pristine form.
    var nameError: String? {
        trimmedName.isEmpty && !name.isEmpty ? AppLocale.string("Donne-lui un nom") : nil
    }

    // MARK: - Payloads

    /// A debt is what remains due, never negative; an account goes negative as an overdraft.
    var signedValue: Decimal? {
        amount.map { direction == .own && isOverdraft ? -$0 : $0 }
    }

    /// `categoryId` is overwritten by `AssetStore.create` from the Type choice.
    func createPayload(categoryId: String) -> AssetCreate {
        AssetCreate(
            name: trimmedName, categoryId: categoryId, currency: currency, direction: direction,
            inPulpe: false, value: signedValue ?? 0
        )
    }

    enum Submission: Equatable {
        case create
        case edit(AssetEdit)
        case close
    }

    /// What saving does. An untouched edit just closes: the backend rejects an empty `PATCH`,
    /// and a value left as it was is not a new snapshot.
    func submission(original: Asset?) -> Submission {
        guard let original else { return .create }
        var edit = AssetEdit()
        if trimmedName != original.name { edit.updates = AssetUpdate(name: trimmedName) }
        if category != .existing(id: original.categoryId) { edit.category = category }
        if let signedValue, signedValue != original.latestValue { edit.value = signedValue }
        return edit == AssetEdit() ? .close : .edit(edit)
    }
}
