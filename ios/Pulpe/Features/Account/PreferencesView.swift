import SwiftUI

struct PreferencesView: View {
    var body: some View {
        List {
            PayDaySettingView()
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Préférences")
    }
}

#Preview {
    NavigationStack {
        PreferencesView()
            .environment(AppState())
            .environment(UserSettingsStore())
            .environment(CurrentMonthStore())
            .environment(BudgetListStore())
            .environment(DashboardStore())
    }
}
