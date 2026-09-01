import SwiftUI

/// Reusable segmented picker for CaseIterable enums — the app's single 1-of-N
/// control, rendered by the native `.segmented` picker style so track, thumb,
/// ink, and selection animation stay aligned with the OS across releases.
/// `itemLabel` must return plain `Text` (emoji allowed): `UISegmentedControl`
/// flattens anything richer into extra segments.
struct SegmentedPicker<T: CaseIterable & Hashable>: View where T.AllCases: RandomAccessCollection {
    private enum Selection {
        case required(Binding<T>)
        case optional(Binding<T?>)
    }

    private let selection: Selection
    let title: String?
    let itemLabel: (T) -> Text
    let itemAccessibilityLabel: ((T) -> String)?

    init(
        selection: Binding<T>,
        title: String?,
        itemAccessibilityLabel: ((T) -> String)? = nil,
        itemLabel: @escaping (T) -> Text
    ) {
        self.selection = .required(selection)
        self.title = title
        self.itemLabel = itemLabel
        self.itemAccessibilityLabel = itemAccessibilityLabel
    }

    /// Optional selection keeps a required choice visibly undecided until the
    /// person taps a segment. Existing non-optional call sites keep their binding.
    init(
        selection: Binding<T?>,
        title: String?,
        itemAccessibilityLabel: ((T) -> String)? = nil,
        itemLabel: @escaping (T) -> Text
    ) {
        self.selection = .optional(selection)
        self.title = title
        self.itemLabel = itemLabel
        self.itemAccessibilityLabel = itemAccessibilityLabel
    }

    private var optionalSelection: Binding<T?> {
        switch selection {
        case .required(let binding):
            Binding(
                get: { binding.wrappedValue },
                set: { newValue in
                    guard let newValue else { return }
                    binding.wrappedValue = newValue
                }
            )
        case .optional(let binding):
            binding
        }
    }

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

            Picker(title ?? "", selection: optionalSelection) {
                ForEach(T.allCases, id: \.self) { item in
                    if let itemAccessibilityLabel {
                        itemLabel(item)
                            .tag(Optional(item))
                            .accessibilityLabel(itemAccessibilityLabel(item))
                    } else {
                        itemLabel(item).tag(Optional(item))
                    }
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel(title ?? "")
            .sensoryFeedback(.selection, trigger: optionalSelection.wrappedValue)
        }
    }
}
