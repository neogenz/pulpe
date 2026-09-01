import SwiftUI

/// Reusable segmented picker for CaseIterable enums — the app's single 1-of-N
/// control, rendered by the native `.segmented` picker style so track, thumb,
/// ink, and selection animation stay aligned with the OS across releases.
/// `itemLabel` must return plain `Text` (emoji allowed): `UISegmentedControl`
/// flattens anything richer into extra segments.
struct SegmentedPicker<T: CaseIterable & Hashable>: View where T.AllCases: RandomAccessCollection {
    @Binding var selection: T
    let title: String?
    let itemLabel: (T) -> Text

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let title {
                Text(title)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
                    // The Picker below carries the same title as its own accessibility
                    // label; without this, VoiceOver announces it twice.
                    .accessibilityHidden(true)
            }

            Picker(title ?? "", selection: $selection) {
                ForEach(T.allCases, id: \.self) { item in
                    itemLabel(item).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .sensoryFeedback(.selection, trigger: selection)
        }
    }
}
