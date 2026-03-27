import SwiftUI

// MARK: - PayDay Picker Sheet (Revolut-style)

struct PayDayPickerSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: PayDaySettingViewModel?

    private static let gridColumns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    header

                    dayGrid
                        .padding(DesignTokens.Spacing.lg)
                        .background(Color.surface)
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))

                    hintCard
                }
                .padding(.horizontal)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, 100)
            }
            .background(Color.sheetBackground)
            .safeAreaInset(edge: .bottom) {
                continueButton
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, DesignTokens.Spacing.xxl)
                    .background(.ultraThinMaterial)
            }
            .navigationTitle("Jour de paie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation()
        .presentationDragIndicator(.hidden)
        .onAppear {
            let currentDay = userSettingsStore.payDayOfMonth
            viewModel = PayDaySettingViewModel(currentPayDay: currentDay)
        }
        .onChange(of: userSettingsStore.payDayOfMonth) { _, newValue in
            viewModel?.syncInitialDay(newValue)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Le mois commencera un...")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)

            Text(
                "Choisis la date à laquelle tu souhaites commencer " +
                "à suivre tes dépenses et revenus (ton jour de paie, par exemple)."
            )
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
        }
    }

    // MARK: - Day Grid

    private var dayGrid: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("S\u{00E9}lectionne une date")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)

            LazyVGrid(columns: Self.gridColumns, spacing: DesignTokens.Spacing.sm) {
                ForEach(1...31, id: \.self) { day in
                    dayCell(day)
                }
            }
        }
    }

    private func dayCell(_ day: Int) -> some View {
        let isSelected = day == 1
            ? viewModel?.selectedDay == nil
            : viewModel?.selectedDay == day

        return Button {
            withAnimation(DesignTokens.Animation.defaultSpring) {
                viewModel?.selectDay(day == 1 ? nil : day)
            }
        } label: {
            Text("\(day)")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(isSelected ? Color.textOnPrimary : Color.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background {
                    if isSelected {
                        Circle()
                            .fill(Color.pulpePrimary)
                    }
                }
                .contentShape(Circle())
                .animation(DesignTokens.Animation.defaultSpring, value: isSelected)
        }
        .plainPressedButtonStyle()
        .accessibilityLabel("Jour \(day)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Hint Card

    @ViewBuilder
    private var hintCard: some View {
        if let day = viewModel?.selectedDay, day >= 2 {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Ton mois budg\u{00E9}taire")
                    .font(PulpeTypography.labelLargeBold)
                    .foregroundStyle(Color.textPrimary)

                Text(hintPeriod(for: day))
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.surface)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Continue Button

    private var continueButton: some View {
        Button {
            Task {
                guard let viewModel else { return }
                guard viewModel.hasChanges else {
                    dismiss()
                    return
                }
                await viewModel.save(using: userSettingsStore)
                if userSettingsStore.error == nil {
                    viewModel.commitSave()
                    appState.toastManager.show("Jour de paie enregistr\u{00E9}", type: .success)
                    currentMonthStore.setPayDay(userSettingsStore.payDayOfMonth)
                    dashboardStore.setPayDay(userSettingsStore.payDayOfMonth)
                    async let refreshMonth: Void = currentMonthStore.forceRefresh()
                    async let refreshList: Void = budgetListStore.forceRefresh()
                    async let refreshDashboard: Void = dashboardStore.forceRefresh()
                    _ = await (refreshMonth, refreshList, refreshDashboard)
                    dismiss()
                } else {
                    appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
                }
            }
        } label: {
            if viewModel?.isSaving == true {
                ProgressView()
            } else {
                Text("Continuer")
            }
        }
        .primaryButtonStyle(isEnabled: true)
        .disabled(viewModel?.isSaving == true)
    }

    // MARK: - Helpers

    private func hintPeriod(for day: Int) -> String {
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
        let suffix = period.hasSuffix(".") ? "" : "."
        return "Ton budget \u{00AB}\u{00A0}\(monthName)\u{00A0}\u{00BB} couvrira du \(period)\(suffix)"
    }
}

// MARK: - Row for PreferencesView

struct PayDaySettingRow: View {
    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        HStack {
            Text("Jour de paie")
            Spacer()
            Text(displayValue)
                .foregroundStyle(Color.onSurfaceVariant)
            Image(systemName: "chevron.right")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
        }
    }

    private var displayValue: String {
        guard let day = userSettingsStore.payDayOfMonth else {
            return "1er du mois"
        }
        return "Le \(day)"
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

    func commitSave() {
        initialDay = selectedDay
        hasChanges = false
    }

    func reset() {
        selectedDay = initialDay
        hasChanges = false
    }

    func syncInitialDay(_ day: Int?) {
        guard !hasChanges else { return }
        initialDay = day
        selectedDay = day
    }
}

#Preview {
    PayDayPickerSheet()
        .environment(AppState())
        .environment(UserSettingsStore())
        .environment(CurrentMonthStore())
        .environment(BudgetListStore())
        .environment(DashboardStore())
}
