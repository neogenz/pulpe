import SwiftUI

/// Reusable section header + content wrapper for onboarding steps.
/// Used by ChargesStep, SavingsStep, and IncomeStep.
///
/// Supports an optional collapsible mode: pass `isExpanded:` to show a chevron
/// and toggle content visibility on tap. Existing call sites without `isExpanded` are unaffected.
struct OnboardingSectionHeader<Content: View>: View {
    let title: String
    let icon: String
    private let isCollapsible: Bool
    @Binding var isExpanded: Bool
    @ViewBuilder let content: () -> Content

    /// Always-expanded section (default, backward-compatible)
    init(title: String, icon: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.icon = icon
        self.isCollapsible = false
        self._isExpanded = .constant(true)
        self.content = content
    }

    /// Collapsible section with expand/collapse toggle
    init(
        title: String,
        icon: String,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.icon = icon
        self.isCollapsible = true
        self._isExpanded = isExpanded
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            if isCollapsible {
                Button {
                    withAnimation(DesignTokens.Animation.defaultSpring) {
                        isExpanded.toggle()
                    }
                } label: {
                    headerRow
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .plainPressedButtonStyle()
                .accessibilityLabel(title)
                .accessibilityHint(isExpanded ? "Appuie pour réduire" : "Appuie pour développer")
                .accessibilityAddTraits(.isButton)
            } else {
                headerRow
            }

            if isExpanded {
                content()
            }
        }
    }

    private var headerRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.onboardingSectionIcon)
            Text(title)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)

            if isCollapsible {
                Spacer()
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiaryOnboarding)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .animation(DesignTokens.Animation.defaultSpring, value: isExpanded)
            }
        }
    }
}
