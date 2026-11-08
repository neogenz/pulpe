import SwiftUI

/// Renames, creates and deletes the categories that sort the page.
struct AssetCategoriesSheet: View {
    @Environment(AssetStore.self) private var store

    @State private var renamingId: String?
    @State private var renameText = ""
    @State private var newName = ""
    @State private var errorMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case rename
        case new
    }

    private var trimmedNew: String { newName.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedRename: String { renameText.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Mes catégories"),
            isLoading: false,
            focus: $focus,
            focusOrder: []
        ) {
            Text("Elles rangent tes comptes, ton épargne et tes dettes sur la page.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if store.categories.isEmpty {
                Text("Aucune catégorie pour l'instant : elles se créent quand tu ajoutes un compte, ou ici.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                FormCard {
                    ForEach(Array(store.categories.enumerated()), id: \.element.id) { index, category in
                        if index > 0 { FormRowDivider() }
                        row(category)
                    }
                }
            }
            if let errorMessage {
                ErrorBanner(message: errorMessage) { self.errorMessage = nil }
            }
            addBlock
        }
    }

    // MARK: - Rows

    @ViewBuilder
    private func row(_ category: AssetCategory) -> some View {
        if renamingId == category.id {
            HStack(spacing: DesignTokens.Spacing.sm) {
                FormTextField(
                    hint: AppLocale.string("Nom de la catégorie"),
                    text: $renameText,
                    accessibilityLabel: AppLocale.string("Nom de la catégorie"),
                    focusBinding: $focus,
                    field: .rename,
                    onSubmit: { Task { await rename(category) } }
                )
                iconButton("checkmark", AppLocale.string("Enregistrer le nom"), enabled: !trimmedRename.isEmpty) {
                    Task { await rename(category) }
                }
                iconButton("xmark", AppLocale.string("Annuler le renommage"), enabled: true) { renamingId = nil }
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        } else {
            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(category.name)
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                iconButton("pencil", AppLocale.string("Renommer \(category.name)"), enabled: true) {
                    errorMessage = nil
                    renameText = category.name
                    renamingId = category.id
                    focus = .rename
                }
                iconButton("trash", AppLocale.string("Supprimer \(category.name)"), enabled: !store.isSaving) {
                    Task { await delete(category) }
                }
            }
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
    }

    private func iconButton(
        _ systemImage: String, _ label: String, enabled: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .foregroundStyle(Color.textSecondary)
                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
        }
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private var addBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            FormTextField(
                hint: AppLocale.string("Ex. Crypto"),
                text: $newName,
                label: AppLocale.string("Nouvelle catégorie"),
                focusBinding: $focus,
                field: .new,
                onSubmit: { Task { await create() } }
            )
            .accessibilityIdentifier("assetCategoryNew")
            Button {
                Task { await create() }
            } label: {
                Text("Ajouter")
            }
            .disabled(trimmedNew.isEmpty || store.isSaving)
            .primaryButtonStyle(isEnabled: !trimmedNew.isEmpty && !store.isSaving)
            .accessibilityIdentifier("assetCategoryAdd")
        }
    }

    // MARK: - Writes

    private func create() async {
        guard !trimmedNew.isEmpty else { return }
        if await run({ try await store.createCategory(name: trimmedNew) }) { newName = "" }
    }

    private func rename(_ category: AssetCategory) async {
        guard !trimmedRename.isEmpty else { return }
        if await run({ try await store.renameCategory(id: category.id, name: trimmedRename) }) {
            renamingId = nil
        }
    }

    private func delete(_ category: AssetCategory) async {
        _ = await run({ try await store.deleteCategory(id: category.id) }, categoryId: category.id)
    }

    /// `true` when the write went through. A refused delete names the assets that block it.
    private func run(_ operation: () async throws -> Void, categoryId: String? = nil) async -> Bool {
        errorMessage = nil
        do {
            try await operation()
            return true
        } catch APIError.assetCategoryNotEmpty {
            let names = AssetCategoriesLogic.blockingAssetNames(
                categoryId: categoryId ?? "", in: store.netWorth?.assets ?? []
            )
            errorMessage = names.isEmpty
                ? DomainErrorLocalizer.localize(APIError.assetCategoryNotEmpty)
                : AssetCategoriesLogic.notEmptyMessage(names: names)
        } catch {
            errorMessage = DomainErrorLocalizer.localize(error)
        }
        return false
    }
}
