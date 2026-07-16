import SwiftUI

/// "Piocher dans son épargne" (PUL-292) — one sheet, two steps inside its own
/// `NavigationStack` (precedent: `SpreadExistingSheet`). Step 1 captures the
/// amount (`HeroAmountField` auto-focus + a deficit quick-fill chip + an
/// optional source name); step 2 previews the two-month couple (M / M+1) and
/// confirms. Submit freezes the FX (RG-009) and replays one idempotency key on
/// retry, then hands the confirmed income line back through `onAdd` — same seam
/// as the additive `AddBudgetLineSheet`.
struct SavingsWithdrawalSheet: View {
    let prefill: SavingsWithdrawalPrefill
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var source: String
    @State private var inputCurrency: SupportedCurrency = .chf
    @State private var path: [Step]
    @State private var isSubmitting = false
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: Field?
    /// Idempotency key minted ONCE per presentation (= per create intent) and
    /// replayed on every submit retry so a double-tap or a post-failure retry
    /// replays the couple instead of duplicating it. `.sheet(item:)` rebuilds
    /// this view per presentation, so a fresh intent always gets a fresh key.
    @State private var groupId = UUID().uuidString.lowercased()

    private let dependencies: SavingsWithdrawalDependencies
    private let conversionService = CurrencyConversionService.shared

    enum Step: Hashable { case preview }
    private enum Field: Hashable { case amount, source }

    init(
        prefill: SavingsWithdrawalPrefill,
        dependencies: SavingsWithdrawalDependencies = .live,
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.prefill = prefill
        self.dependencies = dependencies
        self.onAdd = onAdd
        self._amount = State(initialValue: prefill.amount)
        self._amountText = State(initialValue: prefill.amount.map(Self.plainString) ?? "")
        self._source = State(initialValue: prefill.source ?? "")
        self._path = State(initialValue: prefill.startsAtPreview ? [.preview] : [])
    }

    // MARK: - Derived months (anchored on the viewed month M)

    private var monthM: SpreadMonth {
        SpreadMonth(year: prefill.anchorYear, month: prefill.anchorMonth)
    }

    private var monthNext: SpreadMonth {
        SpreadMonth.from(ordinal: monthM.ordinal + 1)
    }

    private var canContinue: Bool { (amount ?? 0) > 0 }

    var body: some View {
        NavigationStack(path: $path) {
            amountStep
                .navigationDestination(for: Step.self) { step in
                    switch step {
                    case .preview:
                        SavingsWithdrawalPreviewView(
                            amount: amount ?? 0,
                            currency: inputCurrency,
                            monthName: monthM.name,
                            nextMonthName: monthNext.name,
                            isSubmitting: isSubmitting,
                            onConfirm: { Task { await submit() } },
                            onEdit: { if !path.isEmpty { path.removeLast() } }
                        )
                    }
                }
        }
        .standardSheetPresentation(detents: [.large])
        .loadingOverlay(isSubmitting, message: "On met ça en place…")
        // Block swipe-to-dismiss while the couple is created server-side so the
        // sheet can't tear down mid-request (parity with SpreadExistingSheet).
        .interactiveDismissDisabled(isSubmitting)
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear {
            if inputCurrency != userSettingsStore.currency {
                inputCurrency = userSettingsStore.currency
            }
        }
    }

    // MARK: - Step 1 — amount

    private var amountStep: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                if userSettingsStore.showCurrencySelectorEffective {
                    CurrencyAmountPicker(selectedCurrency: $inputCurrency)
                }
                HeroAmountField(
                    amount: $amount,
                    amountText: $amountText,
                    focus: $focusedField,
                    field: .amount,
                    hint: "Combien te manque-t-il ?",
                    currency: inputCurrency,
                    accentColor: .financialSavings
                )
                deficitChip
                FormTextField(
                    hint: "Mon épargne",
                    text: $source,
                    label: "D'où vient l'argent ? (optionnel)",
                    accessibilityLabel: "Source de l'épargne",
                    focusBinding: $focusedField,
                    field: .source
                )
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .pulpeBackground()
        .pulpeStickyBottomCTA { continueButton }
        .navigationTitle("Piocher dans mon épargne")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                SheetCloseButton().disabled(isSubmitting)
            }
        }
        // Reuse the feature's sanctioned autofocus helper (single Task.sleep,
        // single design token) — inline Task.sleep is lint-banned here.
        .afterPushTransition {
            guard !prefill.startsAtPreview else { return }
            focusedField = .amount
        }
    }

    @ViewBuilder
    private var deficitChip: some View {
        if let missing = prefill.missingAmount, missing > 0 {
            Button {
                amount = missing
                amountText = Self.plainString(missing)
                focusedField = nil
            } label: {
                PulpeChip(
                    icon: TransactionKind.savingsIcon,
                    label: "Il te manque \(missing.asCurrency(userSettingsStore.currency))",
                    style: .outlined
                )
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Capsule())
            .plainPressedButtonStyle()
            .accessibilityHint("Remplir avec le montant qui manque ce mois")
        }
    }

    private var continueButton: some View {
        Button {
            focusedField = nil
            path = [.preview]
        } label: {
            Text("Continuer")
        }
        .disabled(!canContinue)
        .primaryButtonStyle(isEnabled: canContinue)
    }

    // MARK: - Submit

    private func submit() async {
        guard let amount, amount > 0, !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let trimmedSource = source.trimmingCharacters(in: .whitespaces)
            let data = SavingsWithdrawalCreate(
                budgetId: prefill.budgetId,
                amount: conversion?.convertedAmount ?? amount,
                incomeName: trimmedSource.isEmpty ? "Mon épargne" : trimmedSource,
                savingName: "Remettre sur ton épargne",
                groupId: groupId,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )
            let response = try await dependencies.createSavingsWithdrawal(data)
            submitSuccessTrigger.toggle()
            onAdd(response.incomeLine)
            toastManager.show("C'est réglé pour ce mois")
            dismiss()
        } catch {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        }
    }

    /// Plain editable string for `HeroAmountField`'s text buffer (no grouping,
    /// dot decimal) — round-trips through `String.parsedAsAmount`.
    private static func plainString(_ value: Decimal) -> String {
        NSDecimalNumber(decimal: value).stringValue
    }
}

/// Injectable server seam so the create call can be stubbed in tests — mirrors
/// `AddBudgetLineDependencies`.
struct SavingsWithdrawalDependencies: Sendable {
    var createSavingsWithdrawal: @Sendable (SavingsWithdrawalCreate) async throws -> SavingsWithdrawalResponse

    static let live = SavingsWithdrawalDependencies(
        createSavingsWithdrawal: { data in
            try await BudgetLineService.shared.createSavingsWithdrawal(data)
        }
    )
}

#Preview {
    SavingsWithdrawalSheet(
        prefill: SavingsWithdrawalPrefill(
            budgetId: "test",
            anchorMonth: 6,
            anchorYear: 2026,
            missingAmount: 320
        )
    ) { _ in }
    .environment(ToastManager())
    .environment(UserSettingsStore())
}
