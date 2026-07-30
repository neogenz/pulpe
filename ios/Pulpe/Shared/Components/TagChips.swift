import SwiftUI

/// Tag metadata rendered as full names in details or as a compact count on dense rows.
struct TagChips: View {
    enum Presentation: Equatable {
        case names
        case count
    }

    let names: [String]
    var presentation: Presentation = .names

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
                HStack(spacing: DesignTokens.Spacing.xs) {
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
