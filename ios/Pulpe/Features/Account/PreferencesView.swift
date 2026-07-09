import SwiftUI

struct PreferencesView: View {
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var showPayDayPicker = false
    @State private var remindersEnabled = ReminderPreferences().remindersEnabled
    @FocusState private var currencyConverterFocus: CurrencySettingView.ConverterField?

    private let reminderPrefs = ReminderPreferences()

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

            Section {
                Toggle("Rappels mensuels", isOn: $remindersEnabled)
                    .tint(Color.pulpePrimary)
                    .onChange(of: remindersEnabled) { _, enabled in
                        reminderPrefs.setRemindersEnabled(enabled)
                        AnalyticsService.shared.capture(
                            .reminderToggled,
                            properties: ["enabled": enabled]
                        )
                        Task { await applyReminderPreference(enabled) }
                    }
            } header: {
                Text("RAPPELS")
                    .font(PulpeTypography.labelLarge)
            } footer: {
                Text("Un rappel par mois, le jour de paie, pour pointer tes dépenses. Tu peux couper quand tu veux.")
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

    /// Applies the toggle: schedule on enable (requesting authorization first), cancel
    /// on disable. If the OS denies (or previously denied), flip the toggle back so it
    /// never claims reminders are on when the system won't deliver them.
    private func applyReminderPreference(_ enabled: Bool) async {
        guard enabled else {
            await NotificationScheduler.shared.cancelAll()
            return
        }
        let granted = await NotificationScheduler.shared.requestAuthorization()
        guard granted else {
            reminderPrefs.setRemindersEnabled(false)
            remindersEnabled = false
            return
        }
        await NotificationScheduler.shared.scheduleMonthlyReminder(
            payDay: userSettingsStore.payDayOfMonth ?? 1
        )
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
