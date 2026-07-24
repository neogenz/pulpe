import SwiftUI

/// Decides + persists whether the "mois un peu juste" card shows (PUL-292, CA1).
/// Pure so the "current-or-future deficit, not dismissed" rule is testable
/// without a view — mirrors `SavingsGoalsIntroGate`. An existing pioche does
/// NOT hide the card: a month can dip back into deficit after a first
/// withdrawal. Dismissal is keyed per budget id in a comma-joined `@AppStorage`
/// string; "Plus tard" silences the card for that month.
enum SavingsWithdrawalCardGate {
    static let storageKey = "dismissedSavingsWithdrawalCardBudgetIds"

    static func shouldPresent(
        available: Decimal,
        isCurrentOrFutureMonth: Bool,
        isDismissed: Bool
    ) -> Bool {
        available < 0 && isCurrentOrFutureMonth && !isDismissed
    }

    static func isDismissed(budgetId: String, in raw: String) -> Bool {
        raw.split(separator: ",").contains(Substring(budgetId))
    }

    static func appendingDismissal(budgetId: String, to raw: String) -> String {
        guard !isDismissed(budgetId: budgetId, in: raw) else { return raw }
        return raw.isEmpty ? budgetId : "\(raw),\(budgetId)"
    }
}

/// Contextual card under the hero when the month runs a deficit (PUL-292, CA1).
/// Presentational only — the parent owns the visibility gate + dismissal
/// persistence (`SavingsWithdrawalCardGate`). Copy is contractual (validated in
/// test user): never "avance" nor "emprunt".
struct TightMonthCard: View {
    let onWithdraw: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Un mois un peu juste ?")
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Tu peux piocher dans ton épargne pour tenir ce mois.")
                Text("Je te rappellerai de la remettre le mois prochain.")
            }
            .font(PulpeTypography.subheadline)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)

            Button(action: onWithdraw) {
                Text("Piocher dans mon épargne")
            }
            .primaryButtonStyle()

            Button("Plus tard", action: onDismiss)
                .textLinkButtonStyle()
                .frame(maxWidth: .infinity)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground()
        .accessibilityElement(children: .contain)
    }
}

#Preview {
    TightMonthCard(onWithdraw: {}, onDismiss: {})
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
}
