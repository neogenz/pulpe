import Foundation

/// What the asset form holds, with its validation and its payloads, away from the view.
struct AssetFormDraft: Equatable {
    var name = ""
    var direction: AssetDirection = .own
    var currency: SupportedCurrency = .chf
    /// `nil` until a category is picked or typed.
    var category: AssetCategoryChoice?
    var inPulpe = false
    var amount: Decimal?
    private var isEditing = false

    init(currency: SupportedCurrency = .chf) {
        self.currency = currency
    }

    init(asset: Asset) {
        name = asset.name
        direction = asset.direction
        currency = asset.currency
        category = .existing(id: asset.categoryId)
        inPulpe = asset.inPulpe
        isEditing = true
    }

    /// Localized, so a category created from a suggestion reads in the user's language.
    static var starterNames: [String] {
        [
            AppLocale.string("Comptes"), AppLocale.string("Épargne"), AppLocale.string("Placements"),
            AppLocale.string("Cash"), AppLocale.string("Objets de valeur"), AppLocale.string("Biens")
        ]
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Creating needs a first value (the web requires it); editing does not touch the value here.
    var isValid: Bool { !trimmedName.isEmpty && category != nil && (isEditing || amount != nil) }

    /// Shown once the user has typed then cleared the name, never on a pristine form.
    var nameError: String? {
        trimmedName.isEmpty && !name.isEmpty ? AppLocale.string("Donne-lui un nom") : nil
    }

    /// The starter names no category already uses (case-insensitive).
    static func starterSuggestions(existing: [String], starters: [String] = starterNames) -> [String] {
        let used = Set(existing.map { $0.lowercased() })
        return starters.filter { !used.contains($0.lowercased()) }
    }

    /// A typed or suggested name resolves to the matching category when there is one, so the
    /// server never sees a duplicate; a blank name is no choice.
    static func choice(forName name: String, existing: [AssetCategory]) -> AssetCategoryChoice? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let match = existing.first(where: { $0.name.lowercased() == trimmed.lowercased() }) {
            return .existing(id: match.id)
        }
        return .starter(name: trimmed)
    }

    /// The first value is never negative: an overdraft is entered later, as an update.
    /// `categoryId` is overwritten by `AssetStore.create` from the category choice.
    func createPayload(categoryId: String) -> AssetCreate {
        AssetCreate(
            name: trimmedName, categoryId: categoryId, currency: currency, direction: direction,
            inPulpe: direction == .own && inPulpe, value: max(amount ?? 0, 0)
        )
    }

    /// Only the keys that changed. The category goes through `categoryChange(from:)`.
    func updatePayload(original: Asset) -> AssetUpdate {
        AssetUpdate(
            name: trimmedName == original.name ? nil : trimmedName,
            inPulpe: direction == .own && inPulpe != original.inPulpe ? inPulpe : nil
        )
    }

    /// False for an untouched edit: the backend rejects an empty PATCH, so nothing is sent.
    func hasChanges(from original: Asset) -> Bool {
        updatePayload(original: original) != AssetUpdate() || categoryChange(from: original) != nil
    }

    /// `nil` when the asset stays in its category.
    func categoryChange(from original: Asset) -> AssetCategoryChoice? {
        category == .existing(id: original.categoryId) ? nil : category
    }
}
