import SwiftUI

/// Horizontal tag rail shared by forms and line details.
struct TagChips: View {
    let names: [String]
    var maxVisible: Int?

    var visibleNames: ArraySlice<String> {
        names.prefix(maxVisible ?? names.count)
    }

    var hiddenCount: Int {
        names.count - visibleNames.count
    }

    var accessibilityLabel: String {
        "Tags : \(names.joined(separator: ", "))"
    }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                ForEach(Array(visibleNames.enumerated()), id: \.offset) { _, name in
                    PulpeChip(label: name, style: .muted)
                }
                if hiddenCount > 0 {
                    PulpeChip(label: "+\(hiddenCount)", style: .muted)
                        .accessibilityLabel("\(hiddenCount) tags supplémentaires")
                }
            }
        }
        .scrollIndicators(.hidden)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    static func names(for ids: [String]?, namesById: [String: String]) -> [String] {
        ids?.compactMap { namesById[$0] } ?? []
    }
}
