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
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
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
