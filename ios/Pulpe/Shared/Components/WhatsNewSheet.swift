import SwiftUI

/// One-shot "what's new" sheet shown after an app update.
///
/// Renders one or more release-note `entries` as markdown bullet lists. The
/// title always reflects `currentVersion` (not the entries) so an aggregate of
/// several skipped versions still reads as "the new version". When more than one
/// entry is shown, each block gets a small version/date header so the aggregate
/// reads as distinct releases rather than one merged wall of text.
struct WhatsNewSheet: View {
    private static let publishedAtFormat = Date.ISO8601FormatStyle()
        .year()
        .month()
        .day()

    let currentVersion: String
    let entries: [WhatsNewEntry]
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    Text("Nouveautés de la version \(currentVersion)")
                        .font(.title2.bold())
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ForEach(entries) { entry in
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            if entries.count > 1 {
                                Text(
                                    "Version \(entry.version) · "
                                        + formattedPublishedAt(entry.publishedAt)
                                )
                                    .font(PulpeTypography.labelLarge)
                                    .foregroundStyle(Color.onSurfaceVariant)
                            }
                            Text(attributedBody(for: entry))
                                .font(.body)
                                .foregroundStyle(Color.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.xl)
            }

            Button("Compris", action: onDismiss)
                .primaryButtonStyle()
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Parses the entry body as markdown, preserving the newlines that separate
    /// bullets (`.inlineOnlyPreservingWhitespace` keeps line breaks while still
    /// interpreting inline `**bold**`). Falls back to the raw string if parsing
    /// throws, so a malformed payload never blanks the sheet.
    private func attributedBody(for entry: WhatsNewEntry) -> AttributedString {
        (try? AttributedString(
            markdown: entry.body,
            options: AttributedString.MarkdownParsingOptions(
                interpretedSyntax: .inlineOnlyPreservingWhitespace
            )
        )) ?? AttributedString(entry.body)
    }

    private func formattedPublishedAt(_ publishedAt: String) -> String {
        guard let date = try? Self.publishedAtFormat.parse(publishedAt) else {
            return publishedAt
        }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

#Preview("What's new — single entry") {
    WhatsNewSheet(
        currentVersion: "0.37.0",
        entries: [
            WhatsNewEntry(
                version: "0.37.0",
                title: "Nouveautés de la version 0.37.0",
                body: "- **Lisser une dépense** — Répartis une grosse dépense sur plusieurs mois.\n"
                    + "- **Reporter une dépense** — Décale une dépense au mois suivant en un tap.",
                publishedAt: "2026-07-01"
            )
        ],
        onDismiss: {}
    )
}

#Preview("What's new — multi-entry aggregate") {
    WhatsNewSheet(
        currentVersion: "0.37.0",
        entries: [
            WhatsNewEntry(
                version: "0.37.0",
                title: "Nouveautés de la version 0.37.0",
                body: "- **Lisser une dépense** — Répartis une grosse dépense sur plusieurs mois.",
                publishedAt: "2026-07-01"
            ),
            WhatsNewEntry(
                version: "0.36.0",
                title: "Nouveautés de la version 0.36.0",
                body: "- **Objectifs d'épargne** — Fixe un montant cible et suis ta progression.",
                publishedAt: "2026-06-15"
            )
        ],
        onDismiss: {}
    )
}
