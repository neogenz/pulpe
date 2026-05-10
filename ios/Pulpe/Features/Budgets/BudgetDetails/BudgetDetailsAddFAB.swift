import SwiftUI

/// Page-local floating action button for adding a budget line.
///
/// Sits bottom-right above the floating tab bar, never moves with content scroll.
/// iOS 26+ uses Liquid Glass with the brand tint for visual parity with
/// `MainTabView.tabBarActionButton`. The two FABs are siblings, not the same
/// component (the Home FAB lives inside the tab bar capsule; this one is page-local).
struct BudgetDetailsAddFAB: View {
    @Environment(\.tabBarClearance) private var tabBarClearance
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(PulpeTypography.sectionIcon)
                .foregroundStyle(Color.white)
                .frame(width: DesignTokens.FrameHeight.tabBar, height: DesignTokens.FrameHeight.tabBar)
        }
        .contentShape(Circle())
        .modifier(BudgetDetailsFABBackground())
        .accessibilityLabel("Ajouter une prévision")
        .padding(.trailing, DesignTokens.Spacing.lg)
        .padding(.bottom, tabBarClearance + DesignTokens.Spacing.md)
    }
}

/// Wraps the FAB body with iOS 26 Liquid Glass when available; pre-iOS 26 falls back
/// to a solid `pulpePrimary` capsule with elevation shadow.
private struct BudgetDetailsFABBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(
                .regular.tint(Color.pulpePrimary).interactive(),
                in: .capsule
            )
        } else {
            content
                .background(Color.pulpePrimary, in: Circle())
                .shadow(DesignTokens.Shadow.elevated)
        }
    }
}
