import SwiftUI

/// Shared multi-select field for attaching up to ten tags to a form.
struct TagPickerField: View {
    @Binding var selection: Set<String>

    @Environment(TagStore.self) private var store
    @State private var isPresented = false

    private var selectedNames: [String] {
        store.tags.filter { selection.contains($0.id) }.map(\.name)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Tags")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            Button {
                isPresented = true
            } label: {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "tag")
                        .foregroundStyle(selection.isEmpty ? Color.onSurfaceVariant : Color.pulpePrimary)
                    Text(summary)
                        .foregroundStyle(selection.isEmpty ? Color.onSurfaceVariant : Color.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .background(
                Color.surfaceContainerLow,
                in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
            )
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel("Tags")
            .accessibilityValue(summary)
        }
        .task { await store.loadIfNeeded() }
        .sheet(isPresented: $isPresented) {
            TagPickerSheet(selection: $selection)
        }
    }

    private var summary: String {
        Self.summary(selectedNames: selectedNames, selectionCount: selection.count)
    }

    static func summary(selectedNames: [String], selectionCount: Int) -> String {
        guard selectionCount > 0 else { return "Aucun tag" }
        guard !selectedNames.isEmpty else {
            return "\(selectionCount) \(selectionCount == 1 ? "tag" : "tags")"
        }

        let visibleNames = selectedNames.prefix(2)
        let hiddenCount = max(selectionCount - visibleNames.count, 0)
        let names = visibleNames.joined(separator: ", ")
        return hiddenCount > 0 ? "\(names) +\(hiddenCount)" : names
    }

    static func normalizedName(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func duplicate(named name: String, in tags: [Tag]) -> Tag? {
        tags.first { $0.name.caseInsensitiveCompare(normalizedName(name)) == .orderedSame }
    }

    static func hasValidLength(_ name: String) -> Bool {
        (1...30).contains(normalizedName(name).count)
    }

    static func createdTagIds(from selection: Set<String>) -> [String]? {
        selection.isEmpty ? nil : selection.sorted()
    }

    static func updatedTagIds(initial: Set<String>, current: Set<String>) -> [String]? {
        initial == current ? nil : current.sorted()
    }

    static func toggledTag(_ id: String, in selection: Set<String>) -> Set<String> {
        var updated = selection
        if updated.contains(id) {
            updated.remove(id)
        } else if updated.count < AppConfiguration.maxTagsPerTransaction {
            updated.insert(id)
        }
        return updated
    }

    static func selection(afterCreating tag: Tag, current: Set<String>) -> Set<String> {
        current.contains(tag.id) ? current : toggledTag(tag.id, in: current)
    }
}

private struct TagPickerSheet: View {
    @Binding var selection: Set<String>

    @Environment(\.dismiss) private var dismiss
    @Environment(TagStore.self) private var store
    @State private var newTagName = ""
    @State private var createError: String?
    @State private var isCreating = false

    private var normalizedName: String {
        TagPickerField.normalizedName(newTagName)
    }

    private var validationMessage: String? {
        if normalizedName.count > 30 { return "30 caractères maximum" }
        if TagPickerField.duplicate(named: normalizedName, in: store.tags) != nil {
            return "Ce tag existe déjà"
        }
        if !normalizedName.isEmpty, selection.count >= AppConfiguration.maxTagsPerTransaction {
            return "\(AppConfiguration.maxTagsPerTransaction) tags maximum"
        }
        return createError
    }

    private var canCreate: Bool {
        TagPickerField.hasValidLength(normalizedName)
            && TagPickerField.duplicate(named: normalizedName, in: store.tags) == nil
            && selection.count < AppConfiguration.maxTagsPerTransaction
            && !isCreating
    }

    var body: some View {
        NavigationStack {
            List {
                createSection
                tagList
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground)
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Terminé") { dismiss() }
                        .disabled(isCreating)
                }
            }
            .disabled(isCreating)
        }
        .standardSheetPresentation(detents: [.medium, .large])
        .interactiveDismissDisabled(isCreating)
    }

    @ViewBuilder
    private var tagList: some View {
        Section {
            if store.isLoading, !store.hasLoadedOnce {
                ProgressView("Chargement…")
            } else if store.hasError {
                Button {
                    Task { await store.forceRefresh() }
                } label: {
                    Label("Réessayer", systemImage: "arrow.clockwise")
                }
            } else if store.tags.isEmpty {
                Text("Crée ton premier tag ci-dessus.")
                    .foregroundStyle(Color.onSurfaceVariant)
            } else {
                ForEach(store.tags) { tag in
                    let isSelected = selection.contains(tag.id)
                    Button {
                        selection = TagPickerField.toggledTag(tag.id, in: selection)
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.md) {
                            Image(systemName: "tag")
                                .foregroundStyle(isSelected ? Color.pulpePrimary : Color.onSurfaceVariant)
                                .accessibilityHidden(true)
                            Text(tag.name)
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                .font(PulpeTypography.actionIcon)
                                .foregroundStyle(isSelected ? Color.pulpePrimary : Color.outlineVariant)
                                .contentTransition(.symbolEffect(.replace))
                                .accessibilityHidden(true)
                        }
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Rectangle())
                    .plainPressedButtonStyle()
                    .disabled(!isSelected && selection.count >= AppConfiguration.maxTagsPerTransaction)
                    .accessibilityLabel(tag.name)
                    .accessibilityValue(isSelected ? "Sélectionné" : "Non sélectionné")
                }
            }
        } header: {
            HStack {
                Text("Mes tags")
                Spacer()
                Text("\(selection.count) sur \(AppConfiguration.maxTagsPerTransaction)")
                    .monospacedDigit()
            }
        }
    }

    private var createSection: some View {
        Section {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "tag")
                    .foregroundStyle(Color.onSurfaceVariant)

                TextField("Nom du nouveau tag", text: $newTagName)
                    .textInputAutocapitalization(.sentences)
                    .submitLabel(.done)
                    .onSubmit {
                        guard canCreate else { return }
                        Task { await createTag() }
                    }
                    .onChange(of: newTagName) { _, _ in createError = nil }

                if isCreating {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Button {
                        Task { await createTag() }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(PulpeTypography.actionIcon)
                            .foregroundStyle(canCreate ? Color.pulpePrimary : Color.onSurfaceVariant)
                    }
                    .circleIconButtonStyle()
                    .disabled(!canCreate)
                    .accessibilityLabel("Créer et sélectionner")
                }
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        } header: {
            Text("Nouveau tag")
        } footer: {
            if let validationMessage {
                Text(validationMessage)
                    .foregroundStyle(Color.destructivePrimary)
            } else {
                Text("1 à 30 caractères · ajouté à la sélection")
            }
        }
    }

    private func createTag() async {
        guard canCreate else { return }
        isCreating = true
        defer { isCreating = false }

        do {
            let tag = try await store.create(name: normalizedName)
            selection = TagPickerField.selection(afterCreating: tag, current: selection)
            newTagName = ""
        } catch {
            createError = DomainErrorLocalizer.localize(error)
        }
    }
}
