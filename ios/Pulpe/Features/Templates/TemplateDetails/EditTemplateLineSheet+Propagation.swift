import SwiftUI

/// What saving a model line does to the budgets already built from the model.
enum PropagationChoice: Equatable {
    /// The model and the months already created (the backend updates the current and the
    /// future budgets, except the prévisions changed by hand).
    case templateAndMonths
    case templateOnly
}

/// The step's content, computed from the current month's ledger so the view only lays it out.
struct TemplateLinePropagation: Equatable {
    /// The current month's name when it was built from this line and still follows it.
    let monthName: String?
    /// Budgets the backend updates: the current one and the future ones.
    let budgetCount: Int
    let lineName: String
    let newAmount: Decimal
    /// What the month holds for the line today.
    let monthAmount: Decimal?
    /// The month's disponible before and after, when it follows the line.
    let available: (before: Decimal, after: Decimal)?

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.monthName == rhs.monthName && lhs.budgetCount == rhs.budgetCount
            && lhs.lineName == rhs.lineName && lhs.newAmount == rhs.newAmount
            && lhs.monthAmount == rhs.monthAmount
            && lhs.available?.before == rhs.available?.before && lhs.available?.after == rhs.available?.after
    }

    /// The line as the user is about to save it.
    struct Edit {
        let name: String
        let amount: Decimal
        let kind: TransactionKind
    }

    /// `monthLine` is the current month's line made from the model line, `nil` when the
    /// month was not built from it or the line was changed by hand there.
    static func make(
        monthLine: BudgetLine?,
        monthName: String?,
        ledger: MonthLedger?,
        budgetCount: Int,
        edit: Edit
    ) -> TemplateLinePropagation {
        let (lineName, newAmount, kind) = (edit.name, edit.amount, edit.kind)
        guard let monthLine, let monthName else {
            return TemplateLinePropagation(
                monthName: nil, budgetCount: budgetCount, lineName: lineName,
                newAmount: newAmount, monthAmount: nil, available: nil
            )
        }
        let impact = ledger.map {
            MovementImpact.between($0, $0.replacing(lineId: monthLine.id, amount: newAmount, kind: kind))
        }
        return TemplateLinePropagation(
            monthName: monthName,
            budgetCount: budgetCount,
            lineName: lineName,
            newAmount: newAmount,
            monthAmount: monthLine.amount,
            available: impact.map { ($0.before, $0.after) }
        )
    }

    // MARK: - Copy

    func intro(templateName: String, currency: SupportedCurrency) -> String {
        let amount = newAmount.asAmount(for: currency)
        guard let monthName else {
            return AppLocale.string("Les mois que tu créeras ensuite partiront de \(amount) dans tous les cas.")
        }
        return AppLocale.string("""
            \(monthName.capitalized) a été créé avec \(templateName). \
            Les mois que tu créeras ensuite partiront de \(amount) dans tous les cas.
            """)
    }

    var title: String { TemplatePresentation.propagationTitle(monthName: monthName) }

    func bothTitle() -> String {
        monthName.map { AppLocale.string("Le modèle et \($0)") }
            ?? AppLocale.string("Le modèle et tes mois déjà créés")
    }

    func bothDetail(currency: SupportedCurrency) -> String {
        let amount = newAmount.asAmount(for: currency)
        let scope = TemplatePresentation.propagationScope(monthName: monthName, budgetCount: budgetCount)
        var detail = AppLocale.string("\(lineName) passe à \(amount) dans \(scope).")
        if let available {
            let before = available.before.asAmount(for: currency)
            let after = available.after.asAmount(for: currency)
            detail += " " + (available.before == available.after
                ? AppLocale.string("Disponible inchangé.")
                : AppLocale.string("Disponible : \(before) → \(after)"))
        }
        return detail
    }

    func templateOnlyDetail(currency: SupportedCurrency) -> String {
        guard let monthName, let monthAmount else {
            return AppLocale.string("Tes mois déjà créés gardent leur montant. Disponible inchangé.")
        }
        let kept = monthAmount.asAmount(for: currency)
        let name = monthName.capitalized
        return budgetCount > 1
            ? AppLocale.string("\(name) et les mois suivants gardent leur montant. Disponible inchangé.")
            : AppLocale.string("\(name) garde \(kept). Disponible inchangé.")
    }
}

extension EditTemplateLineSheet {
    var propagation: TemplateLinePropagation {
        let monthLine = currentMonthStore.budgetLines.first {
            $0.templateLineId == templateLine.id && !$0.isManuallyAdjusted
        }
        let month = currentMonthStore.budget.map { Formatters.monthNameInText(for: $0.month) }
        let ledger = MonthLedger(
            lines: currentMonthStore.budgetLines,
            transactions: currentMonthStore.transactions,
            rollover: currentMonthStore.budget?.rollover.orZero ?? 0
        )
        return .make(
            monthLine: monthLine,
            monthName: month,
            ledger: ledger,
            budgetCount: propagationBudgetCount,
            edit: .init(
                name: pendingUpdate?.name ?? templateLine.name,
                amount: pendingUpdate?.amount ?? templateLine.amount,
                kind: pendingUpdate?.kind ?? templateLine.kind
            )
        )
    }

    /// The second step (V2 `Modele-propager`): the same sheet, a back chevron, two answers.
    var propagationStep: some View {
        let propagation = propagation
        let currency = userSettingsStore.currency
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text(propagation.intro(templateName: templateName, currency: currency))
                        .font(PulpeTypography.bannerText)
                        .foregroundStyle(Color.textPrimary)
                        .sensitiveAmount()
                    ChoiceCard(
                        title: propagation.bothTitle(),
                        detail: propagation.bothDetail(currency: currency),
                        isSelected: propagationChoice == .templateAndMonths
                    ) { propagationChoice = .templateAndMonths }
                    .accessibilityIdentifier("templatePropagateBothChoice")
                    ChoiceCard(
                        title: AppLocale.string("Le modèle seulement"),
                        detail: propagation.templateOnlyDetail(currency: currency),
                        isSelected: propagationChoice == .templateOnly
                    ) { propagationChoice = .templateOnly }
                    .accessibilityIdentifier("templatePropagateTemplateOnlyChoice")
                    Text("Une prévision que tu as changée à la main dans un mois ne bouge jamais.")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)

                    if let error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) { self.error = nil }
                    }

                    Button {
                        Task {
                            if propagationChoice == .templateAndMonths {
                                await saveAndPropagateToBudgets()
                            } else {
                                await saveTemplateOnly()
                            }
                        }
                    } label: {
                        Text(propagationChoice == .templateAndMonths
                            ? AppLocale.string("Enregistrer pour les deux")
                            : AppLocale.string("Enregistrer pour le modèle"))
                    }
                    .primaryButtonStyle(isEnabled: !isLoading)
                    .disabled(isLoading)
                    .accessibilityIdentifier("templatePropagateSaveButton")
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.sheetBackground)
            .navigationTitle(propagation.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Retour", systemImage: "chevron.left") {
                        pendingUpdate = nil
                        error = nil
                        withAnimation(DesignTokens.Animation.smoothEaseOut) { step = .edit }
                    }
                }
            }
            .loadingOverlay(isLoading)
        }
        .standardSheetPresentation()
    }
}
