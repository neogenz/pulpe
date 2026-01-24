import SwiftUI
import TipKit

/// Custom tip style for onboarding tips
/// X button dismisses the entire tour instead of just the current tip
struct OnboardingTipStyle: TipViewStyle {
    func makeBody(configuration: Configuration) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Image + Title + X button
            HStack(alignment: .center, spacing: 10) {
                configuration.image?
                    .font(.system(size: 22))
                    .foregroundStyle(.tint)

                configuration.title
                    .font(.headline)

                Spacer()

                Button {
                    ProductTips.dismissEntireTour()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
            }

            // Message
            configuration.message?
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Actions: primary (last/rightmost) vs secondary (others)
            // UX convention: primary action on the right
            if !configuration.actions.isEmpty {
                HStack(spacing: 10) {
                    let actions = Array(configuration.actions)
                    let lastIndex = actions.count - 1

                    ForEach(Array(actions.enumerated()), id: \.element.id) { index, action in
                        if index == lastIndex {
                            // Primary action (rightmost)
                            Button(action: action.handler) {
                                action.label()
                                    .font(.subheadline.weight(.medium))
                            }
                            .buttonStyle(.borderedProminent)
                        } else {
                            // Secondary action(s)
                            Button(action: action.handler) {
                                action.label()
                                    .font(.subheadline.weight(.medium))
                            }
                            .buttonStyle(.bordered)
                            .tint(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
    }
}
