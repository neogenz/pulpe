import SwiftUI

/// Adds an asset or a debt, or edits one (`asset != nil`). Direction and currency are frozen at
/// creation; the value changes through its own sheet, never here.
struct AssetFormSheet: View {
    let asset: Asset?

    @Environment(AssetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var draft: AssetFormDraft
    @State private var amountText = ""
    @State private var typedCategory = ""
    @State private var isTypingCategory = false
    @State private var errorMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case amount
        case name
        case category
    }

    init(asset: Asset?, currency: SupportedCurrency) {
        self.asset = asset
        _draft = State(initialValue: asset.map(AssetFormDraft.init(asset:)) ?? AssetFormDraft(currency: currency))
    }

    private var isEditing: Bool { asset != nil }

    private var title: String {
        if let asset { return AppLocale.string("Modifier \(asset.name)") }
        return AppLocale.string("Ajouter à mon patrimoine")
    }

    private var canSave: Bool { draft.isValid && !store.isSaving }

    var body: some View {
        SheetFormContainer(
            title: title,
            isLoading: false,
            focus: $focus,
            focusOrder: isEditing ? [.name] : [.amount, .name]
        ) {
            if isEditing {
                Text("Pour changer sa valeur, passe par « Mettre à jour la valeur » dans le menu de la ligne.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HeroAmountField(
                    amount: $draft.amount,
                    amountText: $amountText,
                    focus: $focus,
                    field: .amount,
                    hint: AppLocale.string("Valeur actuelle"),
                    currency: draft.currency,
                    caption: AppLocale.string("Valeur actuelle")
                )
            }
            nameField
            directionAndCurrency
            categoryBlock
            if draft.direction == .own { inPulpeBlock }
            if let errorMessage {
                ErrorBanner(message: errorMessage) { self.errorMessage = nil }
            }
            saveButton
        }
    }

    // MARK: - Fields

    private var nameField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            FormTextField(
                hint: AppLocale.string("Compte UBS, Leasing…"),
                text: $draft.name,
                label: AppLocale.string("Nom"),
                focusBinding: $focus,
                field: .name
            )
            .accessibilityIdentifier("assetFormName")
            if let nameError = draft.nameError {
                Text(nameError)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.financialOverBudget)
                    .padding(.leading, DesignTokens.Spacing.xs)
            }
        }
    }

    private var directionAndCurrency: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SegmentedPicker(
                selection: $draft.direction,
                title: AppLocale.string("Sens"),
                options: [.own, .owe],
                disabledOptions: isEditing ? [draft.direction == .own ? .owe : .own] : []
            ) { direction in
                Text(direction == .own ? AppLocale.string("Ce que j'ai") : AppLocale.string("Ce que je dois"))
            }
            CurrencyAmountPicker(selectedCurrency: $draft.currency, isReadOnly: isEditing)
            if isEditing {
                Text("Le sens et la devise restent ceux de la création.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

    private var categoryBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            FormCard {
                categoryRow
                if isTypingCategory {
                    FormRowDivider()
                    FormTextField(
                        hint: AppLocale.string("Nom de la catégorie"),
                        text: $typedCategory,
                        accessibilityLabel: AppLocale.string("Nom de la catégorie"),
                        focusBinding: $focus,
                        field: .category
                    )
                    .padding(.vertical, DesignTokens.Spacing.sm)
                    .onChange(of: typedCategory) { _, name in
                        draft.category = AssetFormDraft.choice(forName: name, existing: store.categories)
                    }
                }
            }
            if isNewCategory {
                Text("Nouvelle catégorie : je la crée à l'enregistrement.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }
        }
    }

    private var categoryRow: some View {
        Menu {
            if !store.categories.isEmpty {
                Section(AppLocale.string("Mes catégories")) {
                    ForEach(store.categories) { category in
                        Button(category.name) { pick(.existing(id: category.id)) }
                    }
                }
            }
            let suggestions = AssetFormDraft.starterSuggestions(existing: store.categories.map(\.name))
            if !suggestions.isEmpty {
                Section(AppLocale.string("Suggestions")) {
                    ForEach(suggestions, id: \.self) { name in
                        Button(name) { pick(.starter(name: name)) }
                    }
                }
            }
            Button(AppLocale.string("Autre catégorie…")) {
                isTypingCategory = true
                focus = .category
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Catégorie")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                if isNewCategory { PulpeChip(label: AppLocale.string("Nouvelle"), style: .semantic(.pulpePrimary)) }
                Text(categoryName ?? AppLocale.string("Choisir"))
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textSecondary)
                RowChevron()
            }
            .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            .contentShape(Rectangle())
        }
        .accessibilityIdentifier("assetFormCategory")
    }

    private var inPulpeBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            FormCard {
                Toggle(isOn: $draft.inPulpe) {
                    Text("Dans Pulpe")
                        .font(PulpeTypography.rowTitleRegular)
                        .foregroundStyle(Color.textPrimary)
                }
                .tint(Color.pulpePrimary)
                .frame(minHeight: DesignTokens.ListRow.minHeight)
            }
            // swiftlint:disable:next line_length
            Text("Pour le compte que tu pointes dans ton budget. Je le pré-remplis quand tu fais le point sur tes comptes.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
        }
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            isEditing ? Text("Enregistrer") : Text("Ajouter")
        }
        .disabled(!canSave)
        .primaryButtonStyle(isEnabled: canSave)
        .accessibilityIdentifier("assetFormSubmit")
    }

    // MARK: - Logic

    private var categoryName: String? {
        switch draft.category {
        case .existing(let id): store.categories.first { $0.id == id }?.name
        case .starter(let name): name
        case nil: nil
        }
    }

    private var isNewCategory: Bool {
        if case .starter = draft.category { return true }
        return false
    }

    private func pick(_ choice: AssetCategoryChoice) {
        draft.category = choice
        isTypingCategory = false
        typedCategory = ""
    }

    private func save() async {
        guard canSave, let category = draft.category else { return }
        errorMessage = nil
        do {
            if let asset {
                guard draft.hasChanges(from: asset) else { return dismiss() }
                try await store.update(
                    id: asset.id,
                    draft.updatePayload(original: asset),
                    category: draft.categoryChange(from: asset)
                )
            } else {
                var existingId = ""
                if case .existing(let id) = category { existingId = id }
                try await store.create(draft.createPayload(categoryId: existingId), category: category)
            }
            dismiss()
        } catch {
            errorMessage = DomainErrorLocalizer.localize(error)
        }
    }
}
