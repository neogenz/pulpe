import SwiftUI

struct PreferencesView: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var showPayDayPicker = false
    @State private var saveCheckingToggleTask: Task<Void, Never>?
    @State private var checkingSuccessTrigger = false
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

            checkingSection
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
        .navigationTitle("Préférences")
        .keyboardFieldNavigation(focus: $currencyConverterFocus, order: [.input])
        .sensoryFeedback(.success, trigger: checkingSuccessTrigger)
        .sheet(isPresented: $showPayDayPicker) {
            PayDayPickerSheet()
        }
    }

    // MARK: - Pointage Toggle (PUL-110)

    private var checkingSection: some View {
        Section {
            Toggle(isOn: Binding(
                get: { userSettingsStore.checkingEnabled },
                set: { newValue in
                    saveCheckingToggleTask?.cancel()
                    saveCheckingToggleTask = Task(name: "Preferences.saveCheckingToggle") {
                        await persistCheckingToggle(newValue)
                    }
                }
            )) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Suivi du pointage")
                        .font(PulpeTypography.listRowTitle)
                    Text(
                        "Pointe tes prévisions et transactions après les avoir "
                            + "vérifiées sur ton relevé bancaire."
                    )
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .tint(Color.pulpePrimary)
            .accessibilityLabel("Suivi du pointage")
            .accessibilityHint(
                "Désactive pour masquer les sections À pointer du tableau de bord et du budget."
            )
        } header: {
            Text("POINTAGE")
                .font(PulpeTypography.labelLarge)
        }
        .listRowBackground(Color.surfaceContainerHigh)
    }

    private func persistCheckingToggle(_ newValue: Bool) async {
        await userSettingsStore.updateCheckingEnabled(newValue)
        guard !Task.isCancelled else { return }
        if userSettingsStore.error == nil {
            checkingSuccessTrigger.toggle()
            appState.toastManager.show("Préférence enregistrée", type: .success)
        } else {
            appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
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
