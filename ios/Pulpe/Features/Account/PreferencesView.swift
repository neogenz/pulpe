import SwiftUI

struct PreferencesView: View {
    @State private var showPayDayPicker = false
    @FocusState private var currencyConverterFocus: CurrencySettingView.ConverterField?

    var body: some View {
        List {
            CurrencySettingView(converterFocus: $currencyConverterFocus)

            Section {
                Button {
                    showPayDayPicker = true
                } label: {
                    PayDaySettingRow()
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } header: {
                Text("JOUR DE PAIE")
                    .font(PulpeTypography.labelLarge)
            }
            .listRowBackground(Color.surfaceContainerHigh)
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
        .navigationTitle("Préférences")
        .keyboardFieldNavigation(focus: $currencyConverterFocus, order: [.input])
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
            .environment(FeatureFlagsStore())
    }
}
