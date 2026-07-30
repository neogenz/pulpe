import SwiftUI

/// Tag metadata rendered as full names in details or as a compact count on dense rows.
struct TagChips: View {
    enum Presentation: Equatable {
        case names
        case count
    }

    let names: [String]
    var presentation: Presentation = .names
    /// `.count` only. Prepends the `·` separator when the count shares its line with
    /// preceding text. The separator lives here rather than at the call site so it can
    /// never drift in size or ink from the count it separates.
    var followsText = false

    var accessibilityLabel: String {
        "Tags : \(names.joined(separator: ", "))"
    }

    var countLabel: String {
        "\(names.count)"
    }

    @ViewBuilder
    var body: some View {
        if !names.isEmpty {
            switch presentation {
            case .names:
                ScrollView(.horizontal) {
                    HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                        ForEach(Array(names.enumerated()), id: \.offset) { _, name in
                            PulpeChip(label: name, style: .outlined)
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityLabel)

            case .count:
                // A count is a metadata reading, not an actionable filter, so it
                // reads as tertiary ink rather than borrowing the chip shape —
                // on a dense row a capsule claims more attention than the amount.
                // Callers must place it on an existing line: without the capsule
                // there is no shape to justify a line of its own, and alone in a
                // stack it reads as an orphan glyph floating in the row's air.
                HStack(spacing: DesignTokens.Spacing.xs) {
                    if followsText {
                        Text("·")
                    }
                    Image(systemName: "tag")
                    Text(countLabel)
                }
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityLabel)
            }
        }
    }

    static func names(for ids: [String]?, namesById: [String: String]) -> [String] {
        ids?.compactMap { namesById[$0] } ?? []
    }
}
