import SwiftUI

struct PayDaySettingView: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @State private var viewModel: PayDaySettingViewModel?

    var body: some View {
        Section {
            payDayPicker
            if let viewModel, viewModel.hasChanges {
                actionButtons
            }
        } header: {
            Text("PR\u{00C9}F\u{00C9}RENCES")
                .font(PulpeTypography.labelLarge)
        } footer: {
            Text(hintText)
                .font(PulpeTypography.caption)
        }
        .listRowBackground(Color.surfaceContainerHigh)
        .onChange(of: userSettingsStore.payDayOfMonth) { _, newValue in
            if viewModel == nil {
                viewModel = PayDaySettingViewModel(currentPayDay: newValue)
            } else {
                viewModel?.syncInitialDay(newValue)
            }
        }
        .onAppear {
            if viewModel == nil {
                viewModel = PayDaySettingViewModel(currentPayDay: userSettingsStore.payDayOfMonth)
            }
        }
    }

    // MARK: - Subviews

    private var payDayPicker: some View {
        let selectedDay = Binding<Int>(
            get: { viewModel?.selectedDay ?? 0 },
            set: { viewModel?.selectDay($0 == 0 ? nil : $0) }
        )

        return Picker("Jour de paie", selection: selectedDay) {
            Text("Calendrier standard").tag(0)
            ForEach(2...31, id: \.self) { day in
                Text("\(day)").tag(day)
            }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        HStack {
            Button("Annuler") {
                viewModel?.reset()
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)

            Spacer()

            Button("Sauvegarder") {
                Task {
                    await viewModel?.save(using: userSettingsStore)
                    if userSettingsStore.error == nil {
                        viewModel?.commitSave()
                        appState.toastManager.show("Jour de paie enregistr\u{00E9}", type: .success)
                        currentMonthStore.setPayDay(userSettingsStore.payDayOfMonth)
                        dashboardStore.setPayDay(userSettingsStore.payDayOfMonth)
                        async let refreshMonth: Void = currentMonthStore.forceRefresh()
                        async let refreshList: Void = budgetListStore.forceRefresh()
                        async let refreshDashboard: Void = dashboardStore.forceRefresh()
                        _ = await (refreshMonth, refreshList, refreshDashboard)
                    } else {
                        appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(.pulpePrimary)
            .disabled(viewModel?.isSaving ?? false)
        }
    }

    // MARK: - Hint Text

    private var hintText: String {
        guard let day = viewModel?.selectedDay, day > 1 else {
            return "Le budget suit le calendrier mensuel standard."
        }
        let calendar = Calendar.current
        let now = Date()
        let exampleMonth = calendar.component(.month, from: now)
        let exampleYear = calendar.component(.year, from: now)
        guard let period = BudgetPeriodCalculator.formatPeriod(
            month: exampleMonth, year: exampleYear, payDayOfMonth: day
        ) else {
            return "Le budget suit le calendrier mensuel standard."
        }
        let monthName = Formatters.monthYear.monthSymbols[exampleMonth - 1].capitalized
        return "Ton budget \u{00AB} \(monthName) \u{00BB} couvrira du \(period)."
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class PayDaySettingViewModel {
    private(set) var selectedDay: Int?
    private(set) var isSaving = false
    private(set) var hasChanges = false

    private var initialDay: Int?

    init(currentPayDay: Int?) {
        self.initialDay = currentPayDay
        self.selectedDay = currentPayDay
    }

    func selectDay(_ day: Int?) {
        selectedDay = day
        hasChanges = selectedDay != initialDay
    }

    func save(using store: UserSettingsStore) async {
        isSaving = true
        defer { isSaving = false }
        await store.updatePayDay(selectedDay)
    }

    /// Call after a successful save to update the baseline and hide buttons
    func commitSave() {
        initialDay = selectedDay
        hasChanges = false
    }

    func reset() {
        selectedDay = initialDay
        hasChanges = false
    }

    /// Update baseline when the store changes externally (e.g., async load completing)
    /// and the user hasn't started editing yet.
    func syncInitialDay(_ day: Int?) {
        guard !hasChanges else { return }
        initialDay = day
        selectedDay = day
    }
}

#Preview {
    List {
        PayDaySettingView()
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .background(Color.surface)
    .environment(AppState())
    .environment(UserSettingsStore())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
    .environment(DashboardStore())
}
