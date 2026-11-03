import SwiftUI

/// Shared multi-select field for attaching up to ten tags to a form.
struct TagPickerField: View {
    @Binding var selection: Set<String>
    var style: FormRowStyle = .standalone

    @Environment(TagStore.self) private var store
    @State private var isPresented = false

    private var selectedNames: [String] {
        store.tags.filter { selection.contains($0.id) }.map(\.name)
    }

    var body: some View {
        Group {
            switch style {
            case .standalone: standalone
            case .row: row
            }
        }
        .task { await store.loadIfNeeded() }
        .sheet(isPresented: $isPresented) {
            TagPickerSheet(selection: $selection)
        }
    }

    /// One line of a `FormCard`: the title on the left, the selection and a chevron on the right.
    private var row: some View {
        Button {
            isPresented = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Tags")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Text(summary)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(selection.isEmpty ? Color.onSurfaceVariant : Color.textPrimary)
                    .lineLimit(1)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel("Tags")
        .accessibilityValue(summary)
    }

    private var standalone: some View {
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
    }

    private var summary: String {
        Self.summary(selectedNames: selectedNames, selectionCount: selection.count)
    }

    static func summary(selectedNames: [String], selectionCount: Int) -> String {
        guard selectionCount > 0 else { return AppLocale.string("Aucun tag") }
        guard !selectedNames.isEmpty else {
            // Plural variations live in the catalog, one rule set per language —
            // a `== 1` ternary only ever encodes the French rule.
            return AppLocale.string("\(selectionCount) tags")
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

    /// Tags whose name contains the query, ignoring case and accents so that "ecole" finds "École".
    /// An empty query keeps every tag: clearing the field brings the whole list back.
    static func matching(_ query: String, in tags: [Tag]) -> [Tag] {
        let needle = normalizedName(query)
        guard !needle.isEmpty else { return tags }
        return tags.filter { $0.name.localizedStandardContains(needle) }
    }

    static func hasValidLength(_ name: String) -> Bool {
        (1...AppConfiguration.maxTagNameLength).contains(normalizedName(name).count)
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

/// One field that both finds and creates: typing narrows the list, and a name no tag carries
/// becomes a "Créer" row. Picking or creating a tag selects it and clears the field.
private struct TagPickerSheet: View {
    @Binding var selection: Set<String>

    @Environment(\.dismiss) private var dismiss
    @Environment(TagStore.self) private var store
    @State private var query = ""
    @State private var createError: String?
    @State private var isCreating = false
    @FocusState private var isQueryFocused: Bool

    private var normalizedName: String {
        TagPickerField.normalizedName(query)
    }

    private var exactMatch: Tag? {
        TagPickerField.duplicate(named: normalizedName, in: store.tags)
    }

    private var matches: [Tag] {
        TagPickerField.matching(query, in: store.tags)
    }

    private var isFull: Bool {
        selection.count >= AppConfiguration.maxTagsPerTransaction
    }

    /// An exact match is the answer, not a mistake: that tag is right there in the list.
    private var offersCreation: Bool {
        TagPickerField.hasValidLength(normalizedName) && exactMatch == nil && !isFull
    }

    private var validationMessage: String? {
        if normalizedName.count > AppConfiguration.maxTagNameLength {
            return AppLocale.string("\(AppConfiguration.maxTagNameLength) caractères maximum")
        }
        if !normalizedName.isEmpty, exactMatch == nil, isFull {
            return AppLocale.string("\(AppConfiguration.maxTagsPerTransaction) tags maximum")
        }
        return createError
    }

    var body: some View {
        NavigationStack {
            List {
                searchSection
                tagList
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground)
            .localizedNavigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Terminé") { dismiss() }
                        .disabled(isCreating)
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
        .interactiveDismissDisabled(isCreating)
    }

    private var searchSection: some View {
        Section {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.onSurfaceVariant)
                    .accessibilityHidden(true)

                TextField("Rechercher ou créer un tag", text: $query)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .focused($isQueryFocused)
                    .onSubmit { Task { await submit() } }
                    .onChange(of: query) { _, _ in createError = nil }

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.onSurfaceVariant)
                    }
                    .plainPressedButtonStyle()
                    .accessibilityLabel("Effacer")
                }
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(.interaction, Rectangle())
            .onTapGesture { isQueryFocused = true }
        } footer: {
            if let validationMessage {
                Text(validationMessage)
                    .foregroundStyle(Color.destructivePrimary)
            }
        }
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
            } else if store.tags.isEmpty, query.isEmpty {
                Text("Crée ton premier tag ci-dessus.")
                    .foregroundStyle(Color.onSurfaceVariant)
            } else {
                ForEach(matches) { tag in
                    tagRow(tag)
                }
                // After the matches: on a partial match the existing tag is the likelier intent.
                if offersCreation {
                    createRow
                } else if matches.isEmpty {
                    Text("Aucun tag ne correspond")
                        .foregroundStyle(Color.onSurfaceVariant)
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

    private func tagRow(_ tag: Tag) -> some View {
        let isSelected = selection.contains(tag.id)
        return Button {
            selection = TagPickerField.toggledTag(tag.id, in: selection)
            query = ""
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
        .disabled(!isSelected && isFull)
        .accessibilityLabel(tag.name)
        .accessibilityValue(isSelected ? "Sélectionné" : "Non sélectionné")
    }

    private var createRow: some View {
        Button {
            Task { await createTag() }
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                if isCreating {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Color.pulpePrimary)
                        .accessibilityHidden(true)
                }
                Text("Créer « \(normalizedName) »")
                    .foregroundStyle(Color.pulpePrimary)
                Spacer()
            }
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
    }

    /// The return key takes the tag of that exact name, or creates it.
    private func submit() async {
        // Return resigns the field, and several tags in a row is the common case.
        isQueryFocused = true
        guard let exactMatch else {
            await createTag()
            return
        }
        if !selection.contains(exactMatch.id) {
            selection = TagPickerField.toggledTag(exactMatch.id, in: selection)
        }
        query = ""
    }

    private func createTag() async {
        guard offersCreation, !isCreating else { return }
        let name = normalizedName
        isCreating = true

        do {
            let tag = try await store.create(name: name)
            selection = TagPickerField.selection(afterCreating: tag, current: selection)
            // The field stays live during the request: keep anything typed after the submit.
            if normalizedName == name { query = "" }
        } catch {
            createError = DomainErrorLocalizer.localize(error)
        }

        isCreating = false
    }
}
