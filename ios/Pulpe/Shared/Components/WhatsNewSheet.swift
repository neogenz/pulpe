import SwiftUI

/// One-shot "what's new" sheet shown after an app update.
///
/// Renders one or more release-note `entries` as a scannable update list. The
/// title always reflects `currentVersion` (not the entries) so an aggregate of
/// several skipped versions still reads as one coherent update.
struct WhatsNewSheet: View {
    let currentVersion: String
    let entries: [WhatsNewEntry]
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxxl) {
                    WhatsNewHeader(currentVersion: currentVersion)

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxxl) {
                        ForEach(entries) { entry in
                            WhatsNewReleaseSection(
                                entry: entry,
                                displaysMetadata: entries.count > 1
                            )
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .padding(.bottom, DesignTokens.Spacing.xxxl)
                }
            }
            .scrollBounceBehavior(.basedOnSize)

            Button("C’est parti", action: onDismiss)
                .primaryButtonStyle()
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.lg)
                .background(Color.sheetBackground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sheetBackground)
    }
}

private struct WhatsNewHeader: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let currentVersion: String

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    PulpeIcon(size: DesignTokens.IconSize.heroBadge)
                        .accessibilityHidden(true)

                    headerCopy
                }
            } else {
                ZStack(alignment: .topTrailing) {
                    headerCopy
                        .padding(
                            .trailing,
                            DesignTokens.IconSize.brand + DesignTokens.Spacing.md
                        )

                    PulpeIcon(size: DesignTokens.IconSize.brand)
                        .accessibilityHidden(true)
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.xxxl)
        .padding(.bottom, DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var headerCopy: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Version \(currentVersion)")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textTertiary)

            Text(AppLocale.string("Nouveau\ndans Pulpe"))
                .font(PulpeTypography.brandTitle)
                .foregroundStyle(Color.textPrimary)

            Text("Seulement ce qui compte vraiment pour toi.")
                .font(PulpeTypography.body)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WhatsNewReleaseSection: View {
    private static let publishedAtFormat = Date.ISO8601FormatStyle()
        .year()
        .month()
        .day()

    let entry: WhatsNewEntry
    let displaysMetadata: Bool

    private var notes: [WhatsNewNote] {
        WhatsNewNote.parse(entry: entry)
    }

    var body: some View {
        let sectionNotes = notes

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
            if displaysMetadata {
                HStack(alignment: .firstTextBaseline) {
                    Text("Version \(entry.version)")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textPrimary)

                    Spacer(minLength: DesignTokens.Spacing.sm)

                    Text(formattedPublishedAt)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)
                }
            }

            ForEach(sectionNotes) { note in
                WhatsNewNoteRow(note: note)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    private var formattedPublishedAt: String {
        guard let date = try? Self.publishedAtFormat.parse(entry.publishedAt) else {
            return entry.publishedAt
        }
        return date.abbreviatedDateFormatted
    }
}

private struct WhatsNewNoteRow: View {
    let note: WhatsNewNote

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let title = note.title {
                Text(title)
                    .font(PulpeTypography.title3)
                    .foregroundStyle(Color.textPrimary)
            }

            if let detail = note.detail {
                Text(detail)
                    .font(PulpeTypography.body)
                    .foregroundStyle(note.title == nil ? Color.textPrimary : Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private struct WhatsNewNote: Identifiable {
    let id: String
    let title: String?
    let detail: AttributedString?

    static func parse(entry: WhatsNewEntry) -> [WhatsNewNote] {
        let notes = entry.body
            .split(whereSeparator: { $0.isNewline })
            .enumerated()
            .compactMap { index, line -> WhatsNewNote? in
                var content = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
                guard !content.isEmpty else { return nil }
                if content.hasPrefix("- ") {
                    content.removeFirst(2)
                }

                return parseLine(content, entryVersion: entry.version, index: index)
            }

        if notes.isEmpty {
            return [WhatsNewNote(
                id: entry.version,
                title: nil,
                detail: attributed(entry.body)
            )]
        }
        return notes
    }

    private static func parseLine(
        _ content: String,
        entryVersion: String,
        index: Int
    ) -> WhatsNewNote {
        guard content.hasPrefix("**") else {
            return WhatsNewNote(
                id: "\(entryVersion)-\(index)",
                title: nil,
                detail: attributed(content)
            )
        }

        let titleStart = content.index(content.startIndex, offsetBy: 2)
        guard let closingMarker = content.range(of: "**", range: titleStart..<content.endIndex) else {
            return WhatsNewNote(
                id: "\(entryVersion)-\(index)",
                title: nil,
                detail: attributed(content)
            )
        }

        let title = String(content[titleStart..<closingMarker.lowerBound])
        var detail = String(content[closingMarker.upperBound...])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if detail.hasPrefix("—") || detail.hasPrefix("-") {
            detail.removeFirst()
            detail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return WhatsNewNote(
            id: "\(entryVersion)-\(index)",
            title: title,
            detail: detail.isEmpty ? nil : attributed(detail)
        )
    }

    private static func attributed(_ content: String) -> AttributedString {
        (try? AttributedString(
            markdown: content,
            options: AttributedString.MarkdownParsingOptions(
                interpretedSyntax: .inlineOnlyPreservingWhitespace
            )
        )) ?? AttributedString(content)
    }
}

#Preview("What's new — single entry") {
    WhatsNewSheet(
        currentVersion: "1.1.0",
        entries: [
            WhatsNewEntry(
                version: "1.1.0",
                title: "Nouveautés de la version 1.1.0",
                body: "- **Lisser une dépense** — Répartis une grosse dépense sur plusieurs mois "
                    + "et vois exactement ce qu’il reste à provisionner.\n"
                    + "- **Reporter une dépense** — Décale une dépense non pointée au mois suivant, en un geste.\n"
                    + "- **Gérer tes transactions** — Pointe, modifie ou supprime une transaction "
                    + "sans quitter ton budget.",
                publishedAt: "2026-07-01"
            )
        ],
        onDismiss: {}
    )
}

#Preview("What's new — multi-entry aggregate") {
    WhatsNewSheet(
        currentVersion: "1.1.0",
        entries: [
            WhatsNewEntry(
                version: "1.1.0",
                title: "Nouveautés de la version 1.1.0",
                body: "- **Lisser une dépense** — Répartis une grosse dépense sur plusieurs mois.",
                publishedAt: "2026-07-01"
            ),
            WhatsNewEntry(
                version: "1.0.4",
                title: "Nouveautés de la version 1.0.4",
                body: "- **Affichage adapté au pays** — Dates et montants suivent automatiquement ta devise.",
                publishedAt: "2026-06-19"
            )
        ],
        onDismiss: {}
    )
}
