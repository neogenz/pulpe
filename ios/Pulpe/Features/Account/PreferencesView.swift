import SwiftUI

struct PreferencesView: View {
    @State private var showPayDayPicker = false

    var body: some View {
        List {
            Section {
                Button {
                    showPayDayPicker = true
                } label: {
                    PayDaySettingRow()
                }
                .buttonStyle(.plain)
            } header: {
                Text("PR\u{00C9}F\u{00C9}RENCES")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Pr\u{00E9}f\u{00E9}rences")
        .sheet(isPresented: $showPayDayPicker) {
            PayDayPickerSheet()
        }
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
