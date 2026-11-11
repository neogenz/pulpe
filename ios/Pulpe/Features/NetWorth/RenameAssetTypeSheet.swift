import SwiftUI

/// Renames one Type, opened from the menu of its header on the page.
struct RenameAssetTypeSheet: View {
    let type: NetWorthSections.Group

    @Environment(AssetStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var errorMessage: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case name
    }

    init(type: NetWorthSections.Group) {
        self.type = type
        _name = State(initialValue: type.name)
    }

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !trimmed.isEmpty && !store.isSaving }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Renommer le type"),
            isLoading: false,
            focus: $focus,
            focusOrder: [.name]
        ) {
            FormTextField(
                hint: AppLocale.string("Nom du type"),
                text: $name,
                label: AppLocale.string("Nom du type"),
                focusBinding: $focus,
                field: .name,
                onSubmit: { Task { await save() } }
            )
            .accessibilityIdentifier("renameAssetTypeName")
            if let errorMessage {
                ErrorBanner(message: errorMessage) { self.errorMessage = nil }
            }
            Button {
                Task { await save() }
            } label: {
                Text("Enregistrer")
            }
            .disabled(!canSave)
            .primaryButtonStyle(isEnabled: canSave)
            .accessibilityIdentifier("renameAssetTypeSubmit")
        }
        .task { focus = .name }
    }

    private func save() async {
        guard canSave else { return }
        guard trimmed != type.name else { return dismiss() }
        errorMessage = nil
        do {
            try await store.renameCategory(id: type.id, name: trimmed)
            dismiss()
        } catch {
            errorMessage = DomainErrorLocalizer.localize(error)
        }
    }
}
