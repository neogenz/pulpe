import SwiftUI

struct PreferencesView: View {
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var showPayDayPicker = false
    @State private var remindersEnabled = ReminderPreferences().remindersEnabled
    @State private var reminderTask: Task<Void, Never>?
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
                Toggle("Rappels mensuels", isOn: reminderBinding)
                    .tint(Color.pulpePrimary)
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
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await reconcileReminderState()
        }
        .sheet(isPresented: $showPayDayPicker) {
            PayDayPickerSheet()
        }
    }

    /// User-driven toggle state. A custom `Binding` (not `.onChange`) so the
    /// programmatic revert on denial mutates `remindersEnabled` directly WITHOUT
    /// re-invoking this setter — `.onChange` fired on every write, including the revert,
    /// and double-logged `reminder_toggled`.
    private var reminderBinding: Binding<Bool> {
        Binding(
            get: { remindersEnabled },
            set: { newValue in
                remindersEnabled = newValue  // optimistic; reverted below on denial
                reminderTask?.cancel()  // latest toggle wins; a stale in-flight apply must not land after this one
                reminderTask = Task { await applyReminderPreference(newValue) }
            }
        )
    }

    /// Applies the toggle: schedule on enable (requesting authorization first), cancel
    /// on disable. Latest toggle wins: the binding cancels the previous in-flight task,
    /// and every suspension re-checks cancellation before touching prefs or the toggle —
    /// otherwise a rapid ON→OFF let the stale enable resume last and re-persist `true`
    /// under an OFF toggle, which the next foreground reconcile then "restored".
    /// Analytics fire HERE — after grant/deny resolves — so a denied enable never emits
    /// a phantom `enabled: true`. Permission events fire only when the OS prompt
    /// actually resolved (prior status `.notDetermined`): `requestAuthorization` replays
    /// the stored verdict on every later call, so re-emitting would count toggle churn
    /// as grants/denials — and they fire even if superseded, because the prompt verdict
    /// is a fact regardless of where the toggle landed. On denial, flip the toggle back
    /// so it never claims reminders are on when the system won't deliver them.
    private func applyReminderPreference(_ enabled: Bool) async {
        guard !Task.isCancelled else { return }
        guard enabled else {
            reminderPrefs.setRemindersEnabled(false)
            AnalyticsService.shared.capture(.reminderToggled, properties: ["enabled": false])
            await NotificationScheduler.shared.cancelMonthlyReminder()
            return
        }
        let promptShown = await NotificationScheduler.shared.authorizationStatus() == .notDetermined
        guard !Task.isCancelled else { return }  // don't fire the one-shot OS prompt for a toggle already superseded
        let granted = await NotificationScheduler.shared.requestAuthorization()
        if promptShown {
            AnalyticsService.shared.capture(
                granted ? .notificationPermissionGranted : .notificationPermissionDenied
            )
        }
        guard !Task.isCancelled else { return }
        guard granted else {
            reminderPrefs.setRemindersEnabled(false)
            remindersEnabled = false  // revert; direct write does not re-invoke the binding setter
            return
        }
        reminderPrefs.setRemindersEnabled(true)
        AnalyticsService.shared.capture(.reminderToggled, properties: ["enabled": true])
        await NotificationScheduler.shared.scheduleMonthlyReminder(
            payDay: userSettingsStore.payDayOfMonth ?? 1
        )
    }

    /// Reconciles a stale ON toggle: if reminders were enabled but notifications have
    /// since been revoked in iOS Settings, flip the toggle off so it never lies about
    /// reminders the system won't deliver. Silent — not a user action, no analytics.
    private func reconcileReminderState() async {
        let wasEnabled = reminderPrefs.remindersEnabled
        let isAuthorized = await NotificationScheduler.shared.authorizationStatus() == .authorized
        remindersEnabled = reminderPrefs.reconcileAuthorization(isAuthorized: isAuthorized)

        if wasEnabled, !remindersEnabled {
            await NotificationScheduler.shared.cancelMonthlyReminder()
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
