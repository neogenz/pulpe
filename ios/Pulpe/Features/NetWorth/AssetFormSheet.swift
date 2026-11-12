import SwiftUI

/// Adds an element to « Mon patrimoine », or edits one (`asset != nil`): its value, its name and
/// its Type, in one sheet. Direction and currency are frozen at creation.
struct AssetFormSheet: View {
    let asset: Asset?

    @Environment(AssetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var draft: AssetFormDraft
    @State private var amountText: String
    @State private var typedType = ""
    @State private var isTypingType = false
    @State private var errorMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case amount
        case name
        case type
    }

    init(asset: Asset?, currency: SupportedCurrency) {
        self.asset = asset
        let draft = asset.map(AssetFormDraft.init(asset:)) ?? AssetFormDraft(currency: currency)
        _draft = State(initialValue: draft)
        _amountText = State(initialValue: asset == nil ? "" : draft.amount.map { "\($0)" } ?? "")
    }

    private var isEditing: Bool { asset != nil }

    private var title: String {
        if let asset { return AppLocale.string("Modifier \(asset.name)") }
        return AppLocale.string("Ajouter à mon patrimoine")
    }

    private var canSave: Bool { draft.isValid && !store.isSaving }

    private var typeOptions: AssetFormDraft.TypeOptions {
        AssetFormDraft.typeOptions(
            direction: draft.direction,
            categories: store.categories,
            assets: store.netWorth?.assets ?? []
        )
    }

    private var lastValue: String? {
        guard let asset else { return nil }
        let date = asset.latestRecordedAt.formatted(
            .dateTime.day().month(.abbreviated).locale(AppLocale.currentUILocale)
        )
        return AppLocale.string(
            "Dernière valeur : \(asset.latestValue.magnitude.asCurrency(asset.currency)), le \(date)"
        )
    }

    var body: some View {
        SheetFormContainer(
            title: title,
            isLoading: false,
            focus: $focus,
            focusOrder: [.amount, .name]
        ) {
            HeroAmountField(
                amount: $draft.amount,
                amountText: $amountText,
                focus: $focus,
                field: .amount,
                hint: AppLocale.string("Valeur actuelle"),
                currency: draft.currency,
                caption: lastValue ?? AppLocale.string("Valeur actuelle")
            )
            if draft.direction == .own { overdraftToggle }
            nameField
            directionAndCurrency
            typeBlock
            if let errorMessage {
                ErrorBanner(message: errorMessage) { self.errorMessage = nil }
            }
            saveButton
        }
        .onAppear {
            if draft.category == nil { draft.category = typeOptions.defaultChoice }
        }
        // The Types and the overdraft follow the direction: a debt is never filed under « Comptes ».
        .onChange(of: draft.direction) {
            isTypingType = false
            typedType = ""
            draft.isOverdraft = false
            draft.category = typeOptions.defaultChoice
        }
    }

    // MARK: - Fields

    private var overdraftToggle: some View {
        FormCard {
            Toggle(isOn: $draft.isOverdraft) {
                Text("Solde négatif (découvert)")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
            }
            .tint(Color.pulpePrimary)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .accessibilityIdentifier("assetFormOverdraft")
        }
    }

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
            if isEditing {
                Text("Le sens et la devise restent ceux de la création.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            } else {
                CurrencyAmountPicker(selectedCurrency: $draft.currency, isReadOnly: false)
            }
        }
    }

    private var typeBlock: some View {
        FormCard {
            typeRow
            if isTypingType {
                FormRowDivider()
                FormTextField(
                    hint: AppLocale.string("Nom du type"),
                    text: $typedType,
                    accessibilityLabel: AppLocale.string("Nom du type"),
                    focusBinding: $focus,
                    field: .type
                )
                .padding(.vertical, DesignTokens.Spacing.sm)
                .onChange(of: typedType) { _, name in
                    draft.category = AssetFormDraft.choice(forName: name, existing: store.categories)
                }
            }
        }
    }

    private var typeRow: some View {
        Menu {
            let options = typeOptions
            Section {
                ForEach(options.used) { category in
                    Button(category.name) { pick(.existing(id: category.id)) }
                }
            }
            Section {
                ForEach(options.suggestions, id: \.self) { name in
                    Button(name) { pick(.starter(name: name)) }
                }
            }
            Button(AppLocale.string("Autre type…")) {
                isTypingType = true
                draft.category = AssetFormDraft.choice(forName: typedType, existing: store.categories)
                focus = .type
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Type")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(typeLabel)
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textSecondary)
                RowChevron()
            }
            .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            .contentShape(Rectangle())
        }
        .accessibilityIdentifier("assetFormType")
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

    private var typeLabel: String {
        if isTypingType { return AppLocale.string("Autre type…") }
        switch draft.category {
        case .existing(let id): return store.categories.first { $0.id == id }?.name ?? AppLocale.string("Choisir")
        case .starter(let name): return name
        case nil: return AppLocale.string("Choisir")
        }
    }

    private func pick(_ choice: AssetCategoryChoice) {
        draft.category = choice
        isTypingType = false
        typedType = ""
    }

    private func save() async {
        guard canSave, let category = draft.category else { return }
        errorMessage = nil
        do {
            switch draft.submission(original: asset) {
            case .close: break
            case .edit(let edit):
                guard let asset else { return }
                try await store.save(id: asset.id, edit)
            case .create:
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
