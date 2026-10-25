import SwiftUI

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
    .currentMonthPreviewEnvironment()
}

/// The open iPhone Duo's inner display: regular width, cards reflowed into two columns.
#Preview("Regular width", traits: .fixedLayout(width: 820, height: 1000)) {
    NavigationStack {
        CurrentMonthView()
    }
    .environment(\.horizontalSizeClass, .regular)
    .currentMonthPreviewEnvironment()
}

private extension View {
    func currentMonthPreviewEnvironment() -> some View {
        environment(AppState())
            .environment(CurrentMonthStore())
            .environment(BudgetListStore())
            .environment(UserSettingsStore())
            .environment(SavingsGoalStore())
            .environment(TagStore())
            .environment(ToastManager())
            .environment(AppVersionStore())
            .environment(WhatsNewStore())
    }
}
