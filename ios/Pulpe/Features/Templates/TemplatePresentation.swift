import Foundation

/// The words and figures of the model pages, kept pure so the screens only lay them out.
enum TemplatePresentation {
    /// What a model leaves to spend at the start of a month: its incomes minus everything it
    /// plans out (savings included), before any report. The expense part of the split is what
    /// is left of the outflow once the savings are taken out.
    struct Split: Equatable {
        let income: Decimal
        let expenses: Decimal
        let savings: Decimal
        let available: Decimal

        init(lines: [TemplateLine]) {
            // The totals are the shared formula; only the split of the outflow is local.
            let totals = BudgetFormulas.calculateTemplateTotals(lines: lines)
            income = totals.totalIncome
            savings = lines.filter { $0.kind == .saving }.reduce(Decimal.zero) { $0 + $1.amount }
            expenses = totals.totalExpenses - savings
            available = totals.balance
        }
    }

    // MARK: - List

    /// « 3 sur 5 modèles. À droite, ce que chaque modèle laisse à dépenser au départ d'un mois. »
    static func listFooter(count: Int, limit: Int) -> String {
        AppLocale.string("""
            \(count) sur \(limit) modèles. À droite, ce que chaque modèle laisse à dépenser \
            au départ d'un mois.
            """)
    }

    // MARK: - Detail

    /// « Par défaut · a servi à 9 budgets », « Cadeaux et repas · jamais utilisé ».
    static func detailSubtitle(template: BudgetTemplate, usedBudgetCount: Int?) -> String? {
        let usage = usedBudgetCount.map {
            $0 == 0 ? AppLocale.string("jamais utilisé") : AppLocale.string("a servi à \($0) budgets")
        }
        let parts = [template.distinguishingText, usage].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// « Chaque mois », « Chaque mois · liée à l'objectif », « Une fois ».
    static func lineSubtitle(recurrence: TransactionRecurrence, isLinkedToGoal: Bool) -> String {
        let when = recurrence == .fixed ? PendingWording.everyMonth : PendingWording.once
        return isLinkedToGoal ? when + " · " + AppLocale.string("liée à l'objectif") : when
    }

    /// The delete row's fact: why it is blocked, or that nothing stands in the way.
    static func deleteSubtitle(usedBudgetCount: Int?) -> String {
        guard let usedBudgetCount else { return AppLocale.string("Je vérifie s'il est utilisé") }
        return usedBudgetCount == 0
            ? AppLocale.string("Aucun budget ne l'utilise")
            : AppLocale.string("Impossible : il a servi à \(usedBudgetCount) budgets")
    }

    static func deleteMessage(lineCount: Int) -> String {
        AppLocale.string("Aucun budget ne l'utilise. Ses \(lineCount) lignes partent avec lui, sans retour possible.")
    }

    // MARK: - Line edit

    /// The two answers of « Quand ? » on a model line.
    static func whenLabel(_ recurrence: TransactionRecurrence) -> String {
        recurrence == .fixed ? PendingWording.everyMonth : PendingWording.once
    }

    /// « Chaque mois créé avec Mois standard reçoit cette prévision. » / « Seul le prochain mois… ».
    static func whenCaption(recurrence: TransactionRecurrence, templateName: String) -> String {
        recurrence == .fixed
            ? AppLocale.string("Chaque mois créé avec \(templateName) reçoit cette prévision.")
            : AppLocale.string("Cette prévision est notée ponctuelle dans les mois créés avec \(templateName).")
    }

    /// The model's disponible before and after one line is replaced; `nil` when nothing moves.
    static func availableImpact(
        lines: [TemplateLine], lineId: String, amount: Decimal, kind: TransactionKind
    ) -> (before: Decimal, after: Decimal)? {
        guard let line = lines.first(where: { $0.id == lineId }),
              line.amount != amount || line.kind != kind else { return nil }
        let after = lines.map { candidate in
            guard candidate.id == lineId else { return candidate }
            return TemplateLine(
                id: candidate.id,
                templateId: candidate.templateId,
                name: candidate.name,
                amount: amount,
                kind: kind,
                recurrence: candidate.recurrence,
                description: candidate.description,
                createdAt: candidate.createdAt,
                updatedAt: candidate.updatedAt
            )
        }
        return (Split(lines: lines).available, Split(lines: after).available)
    }

    // MARK: - Propagation step

    /// The step's title: « Et novembre ? », or the general form when the current month was not
    /// built from this model.
    static func propagationTitle(monthName: String?) -> String {
        monthName.map { AppLocale.string("Et \($0) ?") } ?? AppLocale.string("Et tes mois déjà créés ?")
    }

    /// What « Le modèle et … » reaches. The backend updates the current month and the
    /// future ones, so more than one budget has to say so.
    static func propagationScope(monthName: String?, budgetCount: Int) -> String {
        guard let monthName else { return AppLocale.string("tes mois déjà créés") }
        return budgetCount > 1 ? AppLocale.string("\(monthName) et les mois suivants déjà créés") : monthName
    }
}
