import SwiftUI

/// Create / edit a savings goal (PUL-12). `goal == nil` → create.
/// Target amount is in the account currency (no currency selector in v1, CA27).
struct SavingsGoalFormSheet: View {
    let goal: SavingsGoal?
    private let onUpdate: ((SavingsGoalUpdate) -> Void)?
    private let onCreate: ((SavingsGoal) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(SavingsGoalStore.self) private var store
    @Environment(BudgetListStore.self) private var budgetListStore: BudgetListStore?
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var initialAmount: Decimal?
    @State private var startDate: Date
    @State private var hasStartDate: Bool
    @State private var targetDate: Date
    @State private var hasTargetDate: Bool
    @State private var isLoading = false
    @State private var error: Error?
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
        initialName: String? = nil,
        onUpdate: ((SavingsGoalUpdate) -> Void)? = nil,
        onCreate: ((SavingsGoal) -> Void)? = nil
    ) {
        self.goal = goal
        self.currency = userCurrency
        self.payDayOfMonth = payDayOfMonth
        self.onUpdate = onUpdate
        self.onCreate = onCreate
        _name = State(initialValue: goal?.name ?? initialName ?? "")

        let amount = goal?.targetAmount
        _amount = State(initialValue: amount)
        _amountText = State(initialValue: amount.map { "\($0)" } ?? "")
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

    private var isEditing: Bool { goal != nil }

    var body: some View {
        SheetFormContainer(
            title: isEditing
                ? AppLocale.string("Modifier l'objectif")
                : AppLocale.string("Nouvel objectif"),
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: AppLocale.string("ta cible, à mettre de côté"),
                currency: currency,
                caption: AppLocale.string("ta cible, à mettre de côté")
            )
            nameField
            FormCard {
                targetDateField
                FormRowDivider()
                initialAmountField
                FormRowDivider()
                startDateField
            }
            if !isEditing && hasTargetDate && hasRemainingToSave {
                decomposeSection
            } else if Self.showsManualMonthlyContribution(
                isEditing: isEditing,
                hasTargetDate: hasTargetDate,
                targetAmount: amount
            ) {
                manualMonthlySection
            }
            if !isEditing { availabilityImpact }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
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

    /// Montant de départ (PUL-293): already saved, so the plan only covers what is left.
    private var initialAmountField: some View {
        inlineAmountRow(AppLocale.string("Montant de départ"), value: $initialAmount)
    }

    private var startDateField: some View {
        optionalDateRow(
            AppLocale.string("Début"),
            isOn: $hasStartDate,
            date: $startDate,
            range: Date.distantPast...Date.distantFuture,
            emptyLabel: AppLocale.string("Ce mois-ci")
        )
    }

    private var targetDateField: some View {
        optionalDateRow(
            AppLocale.string("Échéance"),
            isOn: $hasTargetDate,
            date: $targetDate,
            range: allowedTargetDates,
            emptyLabel: AppLocale.string("Aucune"),
            pickerIdentifier: "savingsGoalTargetDatePicker"
        )
    }

    /// An optional date: « Aucune » until tapped, then a compact picker and a way back to none.
    private func optionalDateRow(
        _ title: String,
        isOn: Binding<Bool>,
        date: Binding<Date>,
        range: ClosedRange<Date>,
        emptyLabel: String,
        pickerIdentifier: String = ""
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            if isOn.wrappedValue {
                DatePicker(title, selection: date, in: range, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .accessibilityIdentifier(pickerIdentifier)
                Button {
                    isOn.wrappedValue = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.textTertiary)
                }
                .iconButtonStyle()
                .accessibilityLabel(AppLocale.string("Retirer : \(title)"))
            } else {
                Button {
                    isOn.wrappedValue = true
                } label: {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Text(emptyLabel)
                        RowChevron()
                    }
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textSecondary)
                }
                .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
                .plainPressedButtonStyle()
                .accessibilityLabel("\(title), \(emptyLabel)")
            }
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }

    private func inlineAmountRow(_ title: String, value: Binding<Decimal?>) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            TextField(
                Decimal.zero.asAmount(for: currency),
                value: value,
                format: .number.precision(.fractionLength(0...2))
            )
            .font(PulpeTypography.rowAmount)
            .keyboardType(.decimalPad)
            .multilineTextAlignment(.trailing)
            .monospacedDigit()
            .frame(minWidth: DesignTokens.Control.inlineAmountFieldMinWidth, minHeight: DesignTokens.TapTarget.minimum)
            .accessibilityLabel(title)
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
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
            FormCard {
                Toggle(isOn: $decomposeEnabled) {
                    Text("Décomposer en mensualités")
                        .font(PulpeTypography.rowTitleRegular)
                        .foregroundStyle(Color.textPrimary)
                }
                .tint(accentColor)
                .frame(minHeight: DesignTokens.ListRow.minHeight)

                if decomposeEnabled {
                    FormRowDivider()
                    // Override falls back to the live suggestion; clearing the field
                    // hands control back to it (matches the webapp override model).
                    inlineAmountRow(
                        AppLocale.string("Chaque mois"),
                        value: Binding(
                            get: { monthlyContributionOverride ?? suggestedMonthly },
                            set: { newValue in
                                monthlyContributionOverride =
                                    (newValue == nil || newValue == suggestedMonthly) ? nil : newValue
                            }
                        )
                    )
                }
            }
            if decomposeEnabled {
                hint(Self.decomposeContributionHint)
            }
        }
    }

    private var manualMonthlySection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            FormCard {
                inlineAmountRow(AppLocale.string("Chaque mois"), value: $monthlyContributionOverride)
            }
            hint(Self.manualMonthlyContributionHint(hasTargetDate: hasTargetDate))
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .padding(.horizontal, DesignTokens.Spacing.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// « Ton disponible de <mois> » A → A − the monthly share, when the plan starts this month,
    /// plus the months up to the échéance that have no budget yet.
    @ViewBuilder
    private var availabilityImpact: some View {
        let payDay = userSettingsStore.payDayOfMonth
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDay)
        let (month, year) = (current.month, current.year)
        let budgets = budgetListStore?.budgets ?? []
        let startsNow = !hasStartDate
            || BudgetPeriodCalculator.periodForDate(startDate, payDayOfMonth: payDay) == current
        if startsNow,
           let contribution = creationContribution, contribution > 0,
           let before = budgets.first(where: { $0.month == month && $0.year == year })?.remaining {
            ImpactBlock(
                title: GoalMonthAvailability.title(month: month),
                impact: MovementImpact(before: before, after: before - contribution, lineBefore: nil, lineAfter: nil),
                currency: currency,
                tone: .neutral,
                note: hasTargetDate ? Self.monthsWithoutBudgetNote(until: targetDate, budgets: budgets) : nil
            )
        }
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
                    original: goal
                )
            )
            dismiss()
            return
        }

        do {
            let created = try await store.create(
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
            onCreate?(created)
            toastManager.show(AppLocale.string("Objectif créé"))
            submitSuccessTrigger += 1
            dismiss()
        } catch {
            self.error = error
        }
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
