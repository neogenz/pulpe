import SwiftUI

enum GoalPlanApplyRecapMode: Equatable {
    case adjustment
    case creation
}

/// « On met ton plan à jour ? » (PUL-12+, pilier C) — the apply-on-confirm recap.
///
/// A medium-detent sheet summarising the edited months (uniform → one line, mixed →
/// up to 5 rows + « et N autres »), the projection verdict, and a loading
/// confirm button doing the pessimistic write (`docs/SAVINGS.md` §10.1).
/// Épargne accents only — never amber/red (RG-002).
struct GoalPlanApplyRecapSheet: View {
    var mode: GoalPlanApplyRecapMode = .adjustment
    let changes: [SavingsPlanCalculator.SimulatedMonth]
    let verdict: String
    let currency: SupportedCurrency
    /// Returns `true` on a successful write so the sheet can dismiss itself.
    let onConfirm: () async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirming = false

    private let maxListedRows = 5

    private var isUniform: Bool {
        mode == .adjustment && Set(changes.map(\.simulatedAmount)).count <= 1
    }

    private var listedChanges: [SavingsPlanCalculator.SimulatedMonth] {
        mode == .creation ? changes : Array(changes.prefix(maxListedRows))
    }

    private var summary: String {
        guard mode == .creation else { return "\(changes.count) mois ajustés" }
        return changes.count == 1
            ? "1 prévision Épargne à ajouter"
            : "\(changes.count) prévisions Épargne à ajouter"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    Text(summary)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)

                    diffBlock

                    Text(verdict)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(DesignTokens.Spacing.lg)
            }
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground)
            .navigationTitle(
                mode == .creation ? "Ajouter les épargnes manquantes ?" : "On met ton plan à jour ?"
            )
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) { confirmFooter }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                        .disabled(isConfirming)
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    @ViewBuilder
    private var diffBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if isUniform, let first = changes.first {
                Text("\(first.simulatedAmount.asCurrency(currency))/mois sur \(changes.count) mois")
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.financialSavings)
                    .sensitiveAmount()
            } else {
                ForEach(listedChanges) { simMonth in
                    diffRow(simMonth)
                }
                if mode == .adjustment, changes.count > maxListedRows {
                    Text("et \(changes.count - maxListedRows) autres")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textTertiary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private func diffRow(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        HStack {
            Text("\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year)")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            if mode == .adjustment {
                Text(simMonth.month.plannedAmount.asCompactCurrency(currency))
                    .foregroundStyle(Color.textTertiary)
                    .strikethrough(true, color: Color.textTertiary)
                Image(systemName: "arrow.right")
                    .font(PulpeTypography.caption2)
                    .foregroundStyle(Color.textTertiary)
            }
            Text(simMonth.simulatedAmount.asCompactCurrency(currency))
                .foregroundStyle(Color.financialSavings)
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .sensitiveAmount()
    }

    private var confirmFooter: some View {
        Button {
            confirm()
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if isConfirming { ProgressView().tint(Color.textOnPrimary) }
                Text(mode == .creation ? "Créer les épargnes" : "Mettre à jour")
            }
        }
        .primaryButtonStyle(isEnabled: !isConfirming)
        .disabled(isConfirming)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(.bar)
    }

    private func confirm() {
        isConfirming = true
        Task {
            let succeeded = await onConfirm()
            isConfirming = false
            if succeeded { dismiss() }
        }
    }
}
