import SwiftUI

/// The one confirmation of a money action (V2 confirm dialog), as a small sheet sized to its
/// content: a question, what it touches, what it does to the disponible, then the choices.
/// Pointing, reporting, deleting a prévision or a month all ask through it.
///
/// Every choice closes the sheet before it runs; "Annuler" only closes it. The presenter
/// clears its pending state in the sheet's `onDismiss`, which covers a swipe down too.
struct ImpactConfirmSheet: View {
    struct Choice {
        let title: String
        var accessibilityIdentifier: String?
        let action: () -> Void
    }

    /// What the action does to the disponible. A neutral `figures` (nothing moves) shows the
    /// title alone; `note` sits inside the block (« Décembre reste à 2'345.70 »).
    struct Impact {
        let title: String
        let figures: MovementImpact
        var note: String?
    }

    let title: String
    var message: String?
    var impact: Impact?
    /// One line under the message, e.g. « Pointer ne change pas ton disponible. »
    var note: String?
    let currency: SupportedCurrency
    /// Red primary: the action removes something.
    var isDestructive = false
    let primary: Choice
    /// A second way to answer (« Non, juste la prévision »), between the primary and "Annuler".
    var secondary: Choice?
    var cancelTitle = AppLocale.string("Annuler")

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.title3)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let message {
                    Text(message)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                        .sensitiveAmount()
                }
                if let note {
                    Text(note)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)

            if let impact {
                ImpactBlock(title: impact.title, impact: impact.figures, currency: currency, note: impact.note)
                    .sensitiveAmount()
            }

            VStack(spacing: DesignTokens.Spacing.sm) {
                choiceButton(primary, identifier: "impactConfirmPrimary")
                    .modifier(PrimaryChoiceStyle(isDestructive: isDestructive))
                if let secondary {
                    choiceButton(secondary, identifier: "impactConfirmSecondary")
                        .secondaryButtonStyle()
                }
                Button(cancelTitle) { dismiss() }
                    .tertiaryButtonStyle()
                    .accessibilityIdentifier("impactConfirmCancel")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.xxl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .intrinsicSheetPresentation()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("impactConfirmSheet")
    }

    private func choiceButton(_ choice: Choice, identifier: String) -> some View {
        Button(choice.title) {
            dismiss()
            choice.action()
        }
        .accessibilityIdentifier(choice.accessibilityIdentifier ?? identifier)
    }
}

private struct PrimaryChoiceStyle: ViewModifier {
    let isDestructive: Bool

    func body(content: Content) -> some View {
        if isDestructive {
            content.destructiveButtonStyle()
        } else {
            content.primaryButtonStyle()
        }
    }
}

#Preview {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            ImpactConfirmSheet(
                title: "Pointer aussi les mouvements ?",
                message: "Courses a encore 1 mouvement à pointer : Migros, 84.30 le 3 novembre.",
                note: "Pointer ne change pas ton disponible.",
                currency: .chf,
                primary: .init(title: "Oui, tout pointer") {},
                secondary: .init(title: "Non, juste la prévision") {}
            )
        }
}
