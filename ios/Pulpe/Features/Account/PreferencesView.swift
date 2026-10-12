import SwiftUI

struct PreferencesView: View {
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var showPayDayPicker = false
    @State private var remindersEnabled = ReminderPreferences().remindersEnabled
    @State private var weeklyRecapEnabled = ReminderPreferences().weeklyRecapEnabled
    @State private var diagnosticSharingEnabled =
        AnalyticsService.shared.isDiagnosticSharingEnabled
    @State private var reminderTask: Task<Void, Never>?
    @State private var weeklyRecapTask: Task<Void, Never>?
    @FocusState private var currencyConverterFocus: CurrencySettingView.ConverterField?

    private let reminderPrefs = ReminderPreferences()

    var body: some View {
        List {
            CurrencySettingView(converterFocus: $currencyConverterFocus)

            LanguageSettingView()

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
            .listRowSettingsBackground()

            Section {
                Toggle("Rappels mensuels", isOn: reminderBinding)
                    .tint(Color.pulpePrimary)
                Toggle("Récap du lundi", isOn: weeklyRecapBinding)
                    .tint(Color.pulpePrimary)
            } header: {
                Text("RAPPELS")
                    .font(PulpeTypography.labelLarge)
            } footer: {
                Text("""
                    Le jour de paie, un rappel pour pointer tes dépenses. Le lundi matin, le récap \
                    de ta semaine et ce qu'il te reste pour la suivante. Tu peux couper quand tu veux.
                    """)
            }
            .listRowSettingsBackground()

            Section {
                Toggle(
                    "Partager les diagnostics",
                    isOn: diagnosticSharingBinding
                )
                .tint(Color.pulpePrimary)
            } header: {
                Text("DONNÉES ET CONFIDENTIALITÉ")
                    .font(PulpeTypography.labelLarge)
            } footer: {
                // One literal, continued across lines: `"a" + "b"` is a String expression,
                // so `Text` picks its non-localizing overload and the copy never reaches
                // the catalog. Same trap everywhere long copy is wrapped.
                Text("""
                    Associe à ton compte les événements techniques et erreurs pour comprendre \
                    les problèmes et t’aider plus rapidement. Aucun montant ni contenu saisi \
                    n’est collecté.
                    """)
            }
            .listRowSettingsBackground()
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
        .localizedNavigationTitle("Préférences")
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

    /// Same latest-wins shape as `reminderBinding`.
    private var weeklyRecapBinding: Binding<Bool> {
        Binding(
            get: { weeklyRecapEnabled },
            set: { newValue in
                weeklyRecapEnabled = newValue
                weeklyRecapTask?.cancel()
                weeklyRecapTask = Task(name: "PreferencesView.weeklyRecap") {
                    await applyWeeklyRecapPreference(newValue)
                }
            }
        )
    }

    private var diagnosticSharingBinding: Binding<Bool> {
        Binding(
            get: { diagnosticSharingEnabled },
            set: { enabled in
                diagnosticSharingEnabled = enabled
                AnalyticsService.shared.setDiagnosticSharingEnabled(enabled)
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
            captureToggle(.monthly, enabled: false)
            await NotificationScheduler.shared.cancelMonthlyReminder()
            return
        }
        let granted = await authorizeNotifications()
        guard !Task.isCancelled else { return }
        guard granted else {
            reminderPrefs.setRemindersEnabled(false)
            remindersEnabled = false  // revert; direct write does not re-invoke the binding setter
            return
        }
        reminderPrefs.setRemindersEnabled(true)
        captureToggle(.monthly, enabled: true)
        // Settings not loaded yet → don't schedule for a made-up day 1; prefs are on,
        // so the next foreground reschedule heals with the real pay-day.
        guard let payDay = userSettingsStore.payDayOfMonth else { return }
        await NotificationScheduler.shared.scheduleMonthlyReminder(payDay: payDay)
    }

    /// Same contract as `applyReminderPreference`. The recap needs budget figures, so a
    /// fresh snapshot schedules it: the one taken on leaving the app is not guaranteed to
    /// finish.
    private func applyWeeklyRecapPreference(_ enabled: Bool) async {
        guard !Task.isCancelled else { return }
        guard enabled else {
            reminderPrefs.setWeeklyRecapEnabled(false)
            captureToggle(.weeklyRecap, enabled: false)
            await NotificationScheduler.shared.cancelWeeklyRecaps()
            return
        }
        let granted = await authorizeNotifications()
        guard !Task.isCancelled else { return }
        reminderPrefs.setWeeklyRecapEnabled(granted)
        guard granted else {
            weeklyRecapEnabled = false  // revert; direct write skips the binding setter
            return
        }
        captureToggle(.weeklyRecap, enabled: true)
        await WidgetDataSyncService.shared.syncAll()
    }

    private func captureToggle(_ reminder: NotificationScheduler.Reminder, enabled: Bool) {
        AnalyticsService.shared.capture(
            .reminderToggled, properties: ["enabled": enabled, "reminder": reminder.rawValue]
        )
    }

    /// Fires the one-shot OS prompt, unless the toggle was already superseded: then
    /// `false`, and the caller's cancellation check bails before touching anything.
    /// Permission events only when the prompt actually resolved (see above).
    private func authorizeNotifications() async -> Bool {
        let promptShown = await NotificationScheduler.shared.authorizationStatus() == .notDetermined
        guard !Task.isCancelled else { return false }
        let granted = await NotificationScheduler.shared.requestAuthorization()
        if promptShown {
            AnalyticsService.shared.capture(
                granted ? .notificationPermissionGranted : .notificationPermissionDenied
            )
        }
        return granted
    }

    /// Reconciles stale ON toggles: if reminders were enabled but notifications have
    /// since been revoked in iOS Settings, flip the toggles off so they never lie about
    /// reminders the system won't deliver. Silent — not a user action, no analytics.
    private func reconcileReminderState() async {
        let isAuthorized = await NotificationScheduler.shared.authorizationStatus() == .authorized
        remindersEnabled = reminderPrefs.reconcileAuthorization(isAuthorized: isAuthorized)
        weeklyRecapEnabled = reminderPrefs.weeklyRecapEnabled

        if !isAuthorized {
            await NotificationScheduler.shared.cancelAllReminders()
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
