import SwiftUI

/// Create / edit a savings goal (PUL-12). `goal == nil` → create.
/// In edit mode it also drives status changes (Actif / En pause / Atteint —
/// COMPLETED is reversible) and deletion (the backend unlinks prévisions; none
/// are deleted). Target amount is in the account currency (no currency selector
/// in v1, CA27).
struct SavingsGoalFormSheet: View {
    let goal: SavingsGoal?

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(SavingsGoalStore.self) private var store

    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var initialAmount: Decimal?
    @State private var targetDate: Date
    @State private var status: SavingsGoalStatus
    @State private var isLoading = false
    @State private var error: Error?
    @State private var showDeleteConfirmation = false
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

    init(goal: SavingsGoal?, userCurrency: SupportedCurrency, payDayOfMonth: Int? = nil) {
        self.goal = goal
        self.currency = userCurrency
        self.payDayOfMonth = payDayOfMonth
        _name = State(initialValue: goal?.name ?? "")
        _status = State(initialValue: goal?.status ?? .active)

        let amount = goal?.targetAmount
        _amount = State(initialValue: amount)
        let amountString = amount.map {
            Formatters.amountInput(for: userCurrency).string(from: $0 as NSDecimalNumber) ?? ""
        } ?? ""
        _amountText = State(initialValue: amountString)
        _initialAmount = State(initialValue: goal?.initialAmount)

        let now = Date()
        let calendar = Calendar.current
        let defaultDate = Calendar.current.date(byAdding: .year, value: 1, to: now) ?? now
        _targetDate = State(initialValue: goal?.targetDateValue ?? defaultDate)
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
        let existingTarget = goal.flatMap {
            SavingsGoalDateFormatter.parse($0.targetDate, timeZone: calendar.timeZone)
        }

        return min(today, existingTarget ?? today)...max(planningMaximum, existingTarget ?? planningMaximum)
    }

    nonisolated static func targetDateUpdate(
        for date: Date,
        original goal: SavingsGoal,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String? {
        let dateString = SavingsGoalDateFormatter.string(from: date, timeZone: timeZone)
        return dateString == goal.targetDate ? nil : dateString
    }

    /// Diffs the edited initial amount against the goal's current one (both
    /// normalized to 0 for `nil`) so an untouched field omits the PATCH key
    /// (unchanged) while a cleared field sends explicit `0` (erasure).
    nonisolated static func initialAmountUpdate(for value: Decimal?, original goal: SavingsGoal) -> Decimal? {
        let normalized = value ?? 0
        return normalized == (goal.initialAmount ?? 0) ? nil : normalized
    }

    nonisolated static func isTargetDateSubmittable(
        _ date: Date,
        original goal: SavingsGoal?,
        planningRange: ClosedRange<Date>,
        calendar: Calendar
    ) -> Bool {
        if planningRange.contains(date) { return true }
        guard let existingTarget = goal.flatMap({
            SavingsGoalDateFormatter.parse($0.targetDate, timeZone: calendar.timeZone)
        }) else { return false }
        return calendar.isDate(date, inSameDayAs: existingTarget)
    }

    private var isEditing: Bool { goal != nil }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty
            && Self.isTargetDateSubmittable(
                targetDate,
                original: goal,
                planningRange: planningTargetDates,
                calendar: .current
            )
            && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: isEditing ? "Modifier l'objectif" : "Nouvel objectif",
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: currency,
                accentColor: accentColor
            )
            nameField
            initialAmountField
            dateField
            if !isEditing && hasRemainingToSave {
                decomposeSection
            }
            if isEditing {
                CapsulePicker(selection: $status, title: "Statut") { item, _ in
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
        .confirmationDialog(
            "Supprimer cet objectif ?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                Task { await deleteGoal() }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Tes prévisions rattachées seront déliées, jamais supprimées.")
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Fields

    private var nameField: some View {
        FormTextField(
            hint: "Maison, vacances, voiture…",
            text: $name,
            label: "Nom de l'objectif",
            accessibilityLabel: "Nom de l'objectif d'épargne",
            focusBinding: $focusedField,
            field: .description
        )
    }

    /// Second amount field (PUL-293), same `CurrencyField` component already
    /// used for the monthly-contribution override below — its own internal
    /// focus keeps it out of `focusOrder` without a new field enum case.
    private var initialAmountField: some View {
        CurrencyField(
            value: $initialAmount,
            label: "Montant de départ (optionnel)",
            currency: currency,
            visualStyle: .flat
        )
    }

    private var dateField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Échéance")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
            DatePicker(
                "Échéance",
                selection: $targetDate,
                in: allowedTargetDates,
                displayedComponents: .date
            )
            .labelsHidden()
            .datePickerStyle(.compact)
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
                    label: "Épargne mensuelle",
                    currency: currency,
                    visualStyle: .flat
                )
                Text("Pré-rempli avec cible ÷ mois restants. Cette prévision récurrente sera ajoutée à ton Mois Type.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Buttons

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            Text(isEditing ? "Enregistrer" : "Créer l'objectif")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            showDeleteConfirmation = true
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

    // MARK: - Logic

    private func save() async {
        guard let amount else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil

        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let dateString = SavingsGoalDateFormatter.string(from: targetDate)

        do {
            if let goal {
                _ = try await store.update(
                    id: goal.id,
                    data: SavingsGoalUpdate(
                        name: trimmedName,
                        targetAmount: amount,
                        targetDate: Self.targetDateUpdate(for: targetDate, original: goal),
                        status: status,
                        initialAmount: Self.initialAmountUpdate(for: initialAmount, original: goal)
                    )
                )
                toastManager.show("Objectif modifié")
            } else {
                let contribution = monthlyContributionOverride ?? suggestedMonthly ?? 0
                _ = try await store.create(
                    SavingsGoalCreate(
                        name: trimmedName,
                        targetAmount: amount,
                        targetDate: dateString,
                        status: .active,
                        monthlyContribution: decomposeEnabled && hasRemainingToSave
                            && contribution > 0
                            ? contribution
                            : nil,
                        initialAmount: initialAmount
                    )
                )
                toastManager.show("Objectif créé")
            }
            submitSuccessTrigger += 1
            dismiss()
        } catch {
            self.error = error
        }
    }

    private func deleteGoal() async {
        guard let goal else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            try await store.delete(id: goal.id)
            toastManager.show("Objectif supprimé")
            submitSuccessTrigger += 1
            dismiss()
        } catch {
            self.error = error
        }
    }
}
