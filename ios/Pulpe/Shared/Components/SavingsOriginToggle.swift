import SwiftUI

/// Which savings an income is drawn from, once the user says it comes from savings.
/// Copy is contractual: never "avance" nor "emprunt" (see `TightMonthCard`).
enum SavingsOrigin: CaseIterable, Hashable {
    /// A definitive withdrawal from one goal (PUL-329).
    case goal
    /// Covered by the general savings and put back next month (PUL-292).
    case repay
    /// An income drawn from an asset the user owns (Mon patrimoine). Income sheets with assets only.
    case asset

    /// The segments to show: « Tiré de mon patrimoine » only where an asset can be drawn from.
    static func options(offersAsset: Bool) -> [SavingsOrigin] {
        allCases.filter { $0 != .asset || offersAsset }
    }

    var label: String {
        switch self {
        case .goal: AppLocale.string("D'un objectif")
        case .repay: AppLocale.string("À remettre")
        case .asset: AppLocale.string("Tiré de mon patrimoine")
        }
    }

    /// What a segment can hold on a three-segment row at phone width; VoiceOver keeps `label`.
    var segmentLabel: String {
        self == .asset ? AppLocale.string("Mon patrimoine") : label
    }
}

/// The one question both income sheets ask: "does this money come from my savings?",
/// then which savings. Short segment labels on purpose — the former menu wrapped its
/// long label over four lines and the card clipped it.
struct SavingsOriginToggle: View {
    @Binding var isOn: Bool
    @Binding var origin: SavingsOrigin
    /// `false` where « À remettre » has nowhere to route (the widget deep link):
    /// the toggle then means "from a goal" on its own, without a segment.
    let offersRepay: Bool
    /// Adds « Tiré de mon patrimoine »; only the budget sheet has an asset to draw from.
    var offersAsset = false
    let tintColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Toggle(isOn: $isOn) {
                Text("Cet argent vient de mon épargne")
                    .font(PulpeTypography.bodyLarge)
            }
            .tint(tintColor)
            .frame(minHeight: DesignTokens.ListRow.minHeight)

            if isOn && offersRepay {
                SegmentedPicker(
                    selection: $origin,
                    title: nil,
                    options: SavingsOrigin.options(offersAsset: offersAsset)
                ) { Text($0.segmentLabel).accessibilityLabel($0.label) }
                    // `.contain` before the label/value: without it, both propagate
                    // onto the segments and VoiceOver loses their names.
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Provenance de l'épargne")
                    .accessibilityValue(origin.label)

                if origin == .repay {
                    Text("À remettre le mois prochain : je te le rappellerai.")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.bottom, isOn && offersRepay ? DesignTokens.Spacing.md : 0)
        .animation(DesignTokens.Animation.smoothEaseInOut, value: isOn)
        .animation(DesignTokens.Animation.smoothEaseInOut, value: origin)
    }
}

#Preview {
    @Previewable @State var isOn = true
    @Previewable @State var origin: SavingsOrigin = .repay
    SavingsOriginToggle(isOn: $isOn, origin: $origin, offersRepay: true, tintColor: .green)
        .padding()
}
