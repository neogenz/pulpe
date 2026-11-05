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
            .localizedNavigationTitle("Jour de paie")
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
            Text("Ton mois commence le…")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)

            Text("""
                Le jour où ta paie arrive, en général. Chaque budget va de ce jour \
                à la veille du mois suivant.
                """)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
        }
    }

    // MARK: - Day Grid

    private var dayGrid: some View {
        LazyVGrid(columns: Self.gridColumns, spacing: DesignTokens.Spacing.md) {
            ForEach(1...31, id: \.self) { day in
                dayCell(day)
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
                .foregroundStyle(isSelected ? Color.accentInk : Color.textPrimary)
                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                .background(isSelected ? Color.accentWash : Color.surface, in: Circle())
                .overlay {
                    Circle().strokeBorder(
                        isSelected ? Color.pulpePrimary : Color.outlineVariant,
                        lineWidth: isSelected ? DesignTokens.BorderWidth.thick : DesignTokens.BorderWidth.thin
                    )
                }
                .frame(maxWidth: .infinity)
                .contentShape(Circle())
                .animation(DesignTokens.Animation.defaultSpring, value: isSelected)
        }
        .plainPressedButtonStyle()
        .accessibilityLabel("Jour \(day)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Hint Card

    private var hintCard: some View {
        let day = viewModel?.selectedDay ?? 1
        let bounds = PayDayPeriod.bounds(payDay: day)
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Ton budget «\u{00A0}\(PayDayPeriod.monthName)\u{00A0}»")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondary)

            if let bounds {
                Text("\(bounds.start) \u{2192} \(bounds.end)")
                    .font(PulpeTypography.title3)
                    .foregroundStyle(Color.textPrimary)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
            }
            Text("Le 1er : le budget suit le mois du calendrier.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DesignTokens.Spacing.lg)
        .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
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
                    appState.toastManager.show(AppLocale.string("Jour de paie enregistré"), type: .success)
                    currentMonthStore.setPayDay(userSettingsStore.payDayOfMonth)
                    dashboardStore.setPayDay(userSettingsStore.payDayOfMonth)
                    async let refreshMonth: Void = currentMonthStore.forceRefresh()
                    async let refreshList: Void = budgetListStore.forceRefresh()
                    async let refreshDashboard: Void = dashboardStore.forceRefresh()
                    _ = await (refreshMonth, refreshList, refreshDashboard)
                    dismiss()
                } else {
                    appState.toastManager.show(AppLocale.string("Erreur lors de la sauvegarde"), type: .error)
                }
            }
        } label: {
            if viewModel?.isSaving == true {
                ProgressView()
            } else {
                if let day = viewModel?.selectedDay {
                    Text("Commencer le \(day)")
                } else {
                    Text("Commencer le 1er")
                }
            }
        }
        .primaryButtonStyle(isEnabled: true)
        .disabled(viewModel?.isSaving == true)
    }
}

/// The budget period a pay day opens, for the current calendar month: « 25 oct. » and « 24 nov. ».
enum PayDayPeriod {
    static var monthName: String {
        let month = Calendar.current.component(.month, from: Date())
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    /// `nil` for the 1st: the budget follows the calendar month.
    static func bounds(payDay: Int?) -> (start: String, end: String)? {
        let now = Date()
        let calendar = Calendar.current
        guard let period = BudgetPeriodCalculator.formatPeriod(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now),
            payDayOfMonth: payDay
        ) else { return nil }
        let parts = period.components(separatedBy: " - ")
        guard parts.count == 2 else { return nil }
        return (parts[0], parts[1])
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
            return AppLocale.string("1er du mois")
        }
        return AppLocale.string("Le \(day)")
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
