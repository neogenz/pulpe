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
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
        .navigationTitle("Préférences")
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
