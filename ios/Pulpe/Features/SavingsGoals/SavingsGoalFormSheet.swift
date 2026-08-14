// swiftlint:disable file_length type_body_length
import SwiftUI

/// Create / edit a savings goal (PUL-12). `goal == nil` → create.
/// In edit mode it also drives status changes (Actif / En pause / Atteint —
/// COMPLETED is reversible) and deletion through an exhaustive impact preview.
/// Target amount is in the account currency (no currency selector in v1, CA27).
struct SavingsGoalFormSheet: View {
    let goal: SavingsGoal?
    private let onUpdate: ((SavingsGoalUpdate) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(SavingsGoalStore.self) private var store

    @State private var name: String
    @State private var amount: Decimal?
    @State private var initialAmount: Decimal?
    @State private var startDate: Date
    @State private var hasStartDate: Bool
    @State private var targetDate: Date
    @State private var hasTargetDate: Bool
    @State private var status: SavingsGoalStatus
    @State private var isLoading = false
    @State private var error: Error?
    @State private var showDeletionSheet = false
    @State private var submitSuccessTrigger = 0
    // PUL-285 CA6 — opt-in « décomposer en mensualités », création uniquement.
    @State private var decomposeEnabled = true
    @State private var monthlyContributionOverride: Decimal?
    @FocusState private var focusedField: AmountDescriptionField?

    private let currency: SupportedCurrency
    private let payDayOfMonth: Int?
    private let accentColor = TransactionKind.saving.color
    private let planningTargetDates: ClosedRange<Date>
    private let allowedTargetDates: ClosedRange<Date>

    init(
        goal: SavingsGoal?,
        userCurrency: SupportedCurrency,
        payDayOfMonth: Int? = nil,
        onUpdate: ((SavingsGoalUpdate) -> Void)? = nil
    ) {
        self.goal = goal
        self.currency = userCurrency
        self.payDayOfMonth = payDayOfMonth
        self.onUpdate = onUpdate
        _name = State(initialValue: goal?.name ?? "")
        _status = State(initialValue: goal?.status ?? .active)

        let amount = goal?.targetAmount
        _amount = State(initialValue: amount)
        _initialAmount = State(initialValue: goal?.initialAmount)

        let now = Date()
        let calendar = Calendar.current
        let defaultDate = Calendar.current.date(byAdding: .year, value: 1, to: now) ?? now
        _startDate = State(initialValue: goal?.startDateValue ?? now)
        _hasStartDate = State(initialValue: goal?.startDate != nil)
        _targetDate = State(initialValue: goal?.targetDateValue ?? defaultDate)
        _hasTargetDate = State(initialValue: goal?.targetDate != nil)
        planningTargetDates = Self.targetDateRange(goal: nil, now: now, calendar: calendar)
        allowedTargetDates = Self.targetDateRange(goal: goal, now: now, calendar: calendar)
    }

    nonisolated static func targetDateRange(
        goal: SavingsGoal?,
        now: Date,
        calendar: Calendar
    ) -> ClosedRange<Date> {
        let today = calendar.startOfDay(for: now)
        let monthComponents = calendar.dateComponents([.year, .month], from: today)
        let currentMonth = calendar.date(from: monthComponents) ?? today
        let lastPeriodStart = calendar.date(byAdding: .month, value: 119, to: currentMonth) ?? currentMonth
        let nextPeriodStart = calendar.date(byAdding: .month, value: 1, to: lastPeriodStart) ?? lastPeriodStart
        let planningMaximum = calendar.date(byAdding: .day, value: -1, to: nextPeriodStart) ?? lastPeriodStart
        let existingTarget = goal?.targetDate.flatMap {
            SavingsGoalDateFormatter.parse($0, timeZone: calendar.timeZone)
        }

        return min(today, existingTarget ?? today)...max(planningMaximum, existingTarget ?? planningMaximum)
    }

    nonisolated static func targetDateUpdate(
        for date: Date,
        isEnabled: Bool = true,
        original goal: SavingsGoal,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String?? {
        let value = isEnabled
            ? SavingsGoalDateFormatter.string(from: date, timeZone: timeZone)
            : nil
        return value == goal.targetDate ? nil : .some(value)
    }

    nonisolated static func startDateUpdate(
        for date: Date,
        isEnabled: Bool,
        original goal: SavingsGoal,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String?? {
        let value = isEnabled
            ? SavingsGoalDateFormatter.string(from: date, timeZone: timeZone)
            : nil
        return value == goal.startDate ? nil : .some(value)
    }

    nonisolated static func targetAmountUpdate(
        for value: Decimal?,
        original goal: SavingsGoal
    ) -> Decimal?? {
        value == goal.targetAmount ? nil : .some(value)
    }

    /// Diffs the edited initial amount against the goal's current one (both
    /// normalized to 0 for `nil`) so an untouched field omits the PATCH key
    /// (unchanged) while a cleared field sends explicit `0` (erasure).
    nonisolated static func initialAmountUpdate(for value: Decimal?, original goal: SavingsGoal) -> Decimal? {
        let normalized = value ?? 0
        return normalized == (goal.initialAmount ?? 0) ? nil : normalized
    }

    // Kept explicit so a deadline reconciliation reuses the complete form PATCH.
    // swiftlint:disable:next function_parameter_count
    nonisolated static func editPayload(
        name: String,
        targetAmount: Decimal?,
        initialAmount: Decimal?,
        startDate: Date,
        hasStartDate: Bool,
        targetDate: Date,
        hasTargetDate: Bool,
        status: SavingsGoalStatus,
        original goal: SavingsGoal
    ) -> SavingsGoalUpdate {
        SavingsGoalUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            targetAmount: targetAmountUpdate(for: targetAmount, original: goal),
            targetDate: targetDateUpdate(for: targetDate, isEnabled: hasTargetDate, original: goal),
            status: status,
            initialAmount: initialAmountUpdate(for: initialAmount, original: goal),
            startDate: startDateUpdate(for: startDate, isEnabled: hasStartDate, original: goal)
        )
    }

    nonisolated static func isTargetDateSubmittable(
        _ date: Date,
        original goal: SavingsGoal?,
        planningRange: ClosedRange<Date>,
        calendar: Calendar
    ) -> Bool {
        if planningRange.contains(date) { return true }
        guard let existingTarget = goal?.targetDate.flatMap({
            SavingsGoalDateFormatter.parse($0, timeZone: calendar.timeZone)
        }) else { return false }
        return calendar.isDate(date, inSameDayAs: existingTarget)
    }

    private var isEditing: Bool { goal != nil }

    var body: some View {
        SheetFormContainer(
            title: isEditing
                ? AppLocale.string("Modifier l'objectif")
                : AppLocale.string("Nouvel objectif"),
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.description]
        ) {
            nameField
            initialAmountField
            targetAmountField
            startDateField
            targetDateField
            if !isEditing && hasTargetDate && hasRemainingToSave {
                decomposeSection
            } else if Self.showsManualMonthlyContribution(
                isEditing: isEditing,
                hasTargetDate: hasTargetDate,
                targetAmount: amount
            ) {
                manualMonthlySection
            }
            if isEditing {
                CapsulePicker(selection: $status, title: AppLocale.string("Statut")) { item, _ in
                    Text(item.label)
                }
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
            if isEditing {
                deleteButton
            }
        }
        .sheet(isPresented: $showDeletionSheet) {
            if let goal {
                GoalDeletionSheet(
                    goal: goal,
                    currency: currency,
                    onDeleted: deletionDidCommit
                )
                .standardSheetPresentation(detents: [.large])
            }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Fields

    private var nameField: some View {
        FormTextField(
            hint: AppLocale.string("Maison, vacances, voiture…"),
            text: $name,
            label: AppLocale.string("Nom de l'objectif"),
            accessibilityLabel: AppLocale.string("Nom de l'objectif d'épargne"),
            focusBinding: $focusedField,
            field: .description
        )
        .accessibilityIdentifier("savingsGoalNameField")
    }

    /// Second amount field (PUL-293), same `CurrencyField` component already
    /// used for the monthly-contribution override below — its own internal
    /// focus keeps it out of `focusOrder` without a new field enum case.
    private var initialAmountField: some View {
        CurrencyField(
            value: $initialAmount,
            label: AppLocale.string("Montant de départ (optionnel)"),
            currency: currency,
            visualStyle: .flat
        )
    }

    private var targetAmountField: some View {
        CurrencyField(
            value: $amount,
            label: AppLocale.string("Cible (optionnelle)"),
            currency: currency,
            visualStyle: .flat
        )
    }

    private var startDateField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Toggle("Début (optionnel)", isOn: $hasStartDate)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
                .tint(accentColor)
            if hasStartDate {
                DatePicker(
                    "Date de début",
                    selection: $startDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var targetDateField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Toggle("Échéance (optionnelle)", isOn: $hasTargetDate)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
                .tint(accentColor)
            if hasTargetDate {
                DatePicker(
                    "Date d'échéance",
                    selection: $targetDate,
                    in: allowedTargetDates,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
                .accessibilityIdentifier("savingsGoalTargetDatePicker")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Suggestion « reste à épargner ÷ mois restants » (payDay-aware, ceil au
    /// centime). Le montant de départ est déjà acquis : décomposer la cible
    /// entière sur-provisionnerait la prévision récurrente générée.
    /// Recalculée tant que l'utilisateur n'a pas saisi son propre montant.
    private var suggestedMonthly: Decimal? {
        guard let amount, amount > 0 else { return nil }
        return SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: amount,
            targetDate: targetDate,
            payDayOfMonth: payDayOfMonth,
            startDate: hasStartDate ? startDate : nil,
            initialAmount: initialAmount ?? 0
        )
    }

    /// Le montant de départ couvre déjà la cible ⇒ plus rien à décomposer.
    private var hasRemainingToSave: Bool {
        guard let amount, amount > 0 else { return false }
        return amount - (initialAmount ?? 0) > 0
    }

    private var decomposeSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Toggle(isOn: $decomposeEnabled) {
                Text("Décomposer en mensualités")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .tint(accentColor)

            if decomposeEnabled {
                // Override falls back to the live suggestion; clearing the field
                // hands control back to it (matches the webapp override model).
                CurrencyField(
                    value: Binding(
                        get: { monthlyContributionOverride ?? suggestedMonthly },
                        set: { newValue in
                            monthlyContributionOverride =
                                (newValue == nil || newValue == suggestedMonthly) ? nil : newValue
                        }
                    ),
                    label: AppLocale.string("Épargne mensuelle"),
                    currency: currency,
                    visualStyle: .flat
                )
                Text(Self.decomposeContributionHint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var manualMonthlySection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            CurrencyField(
                value: $monthlyContributionOverride,
                label: AppLocale.string("Épargne mensuelle (optionnelle)"),
                currency: currency,
                visualStyle: .flat
            )
            Text(Self.manualMonthlyContributionHint(hasTargetDate: hasTargetDate))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Buttons

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            isEditing ? Text("Enregistrer") : Text("Créer l'objectif")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
        .accessibilityIdentifier("savingsGoalFormSubmit")
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            showDeletionSheet = true
        } label: {
            Text("Supprimer l'objectif")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.destructivePrimary)
                .frame(maxWidth: .infinity)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .disabled(isLoading)
    }
}

private extension SavingsGoalFormSheet {
    // MARK: - Logic

    private func save() async {
        guard canSubmit else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil

        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let startDateString = hasStartDate ? SavingsGoalDateFormatter.string(from: startDate) : nil
        let targetDateString = hasTargetDate ? SavingsGoalDateFormatter.string(from: targetDate) : nil

        if let goal {
            guard let onUpdate else {
                assertionFailure("SavingsGoalFormSheet edit requires an onUpdate callback")
                return
            }
            onUpdate(
                Self.editPayload(
                    name: name,
                    targetAmount: amount,
                    initialAmount: initialAmount,
                    startDate: startDate,
                    hasStartDate: hasStartDate,
                    targetDate: targetDate,
                    hasTargetDate: hasTargetDate,
                    status: status,
                    original: goal
                )
            )
            dismiss()
            return
        }

        do {
            _ = try await store.create(
                SavingsGoalCreate(
                    name: trimmedName,
                    targetAmount: amount,
                    targetDate: targetDateString,
                    status: .active,
                    monthlyContribution: creationContribution,
                    initialAmount: initialAmount,
                    startDate: startDateString
                )
            )
            toastManager.show(AppLocale.string("Objectif créé"))
            submitSuccessTrigger += 1
            dismiss()
        } catch {
            self.error = error
        }
    }

    private func deletionDidCommit(warning: String?) {
        showDeletionSheet = false
        if let warning {
            toastManager.show(warning, type: .error)
        } else {
            toastManager.show(AppLocale.string("Objectif supprimé"))
            submitSuccessTrigger += 1
        }
        dismiss()
    }
}

extension SavingsGoalFormSheet {
    nonisolated static func isFormSubmittable(
        name: String,
        targetAmount: Decimal?,
        startDate: Date?,
        targetDate: Date?,
        calendar: Calendar = .current
    ) -> Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if let targetAmount, targetAmount <= 0 { return false }
        guard let startDate, let targetDate else { return true }
        return calendar.startOfDay(for: startDate) <= calendar.startOfDay(for: targetDate)
    }

    nonisolated static func isMonthlyContributionSubmittable(
        isEditing: Bool,
        decomposeEnabled: Bool,
        hasRemainingToSave: Bool,
        contribution: Decimal?
    ) -> Bool {
        isEditing || !decomposeEnabled || !hasRemainingToSave || (contribution ?? 0) > 0
    }

    nonisolated static func showsManualMonthlyContribution(
        isEditing: Bool,
        hasTargetDate: Bool,
        targetAmount: Decimal?
    ) -> Bool {
        !isEditing && (!hasTargetDate || targetAmount == nil)
    }

    nonisolated static func manualMonthlyContributionHint(hasTargetDate: Bool) -> String {
        hasTargetDate
            ? AppLocale.string("Ce montant sera prévu chaque mois, jusqu'à l'échéance.")
            : AppLocale.string("Ce montant alimentera ton pot chaque mois, sans échéance imposée.")
    }

    /// Two complete sentences, keyed separately: neither is a fragment a
    /// translator has to reassemble, and each fits the line budget.
    static var decomposeContributionHint: String {
        AppLocale.string("Pré-rempli avec cible ÷ mois restants.")
            + " " + AppLocale.string("Ce montant sera prévu sur chacun de tes budgets, jusqu'à l'échéance.")
    }
}

private extension SavingsGoalFormSheet {
    var creationContribution: Decimal? {
        if hasTargetDate, hasRemainingToSave, decomposeEnabled {
            return monthlyContributionOverride ?? suggestedMonthly
        }
        return hasTargetDate && amount != nil ? nil : monthlyContributionOverride
    }

    var canSubmit: Bool {
        let contribution = monthlyContributionOverride ?? suggestedMonthly
        let targetDateIsValid = !hasTargetDate || Self.isTargetDateSubmittable(
                targetDate,
                original: goal,
                planningRange: planningTargetDates,
                calendar: .current
            )
        let usesManualContribution = Self.showsManualMonthlyContribution(
            isEditing: isEditing,
            hasTargetDate: hasTargetDate,
            targetAmount: amount
        )
        let monthlyContributionIsValid = usesManualContribution
            ? monthlyContributionOverride.map { $0 > 0 } ?? true
            : hasTargetDate
            ? Self.isMonthlyContributionSubmittable(
                isEditing: isEditing,
                decomposeEnabled: decomposeEnabled,
                hasRemainingToSave: hasRemainingToSave,
                contribution: contribution
            )
            : isEditing || monthlyContributionOverride.map { $0 > 0 } ?? true
        return Self.isFormSubmittable(
            name: name,
            targetAmount: amount,
            startDate: hasStartDate ? startDate : nil,
            targetDate: hasTargetDate ? targetDate : nil
        )
            && targetDateIsValid
            && monthlyContributionIsValid
            && !isLoading
    }
}
