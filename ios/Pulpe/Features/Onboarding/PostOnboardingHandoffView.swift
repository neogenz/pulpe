import SwiftUI

/// One-time teaching screen shown once, right after a user finishes onboarding
/// (fresh `.pinSetup` path). Its single job is to hand the user a reason and a
/// habit to come back for — Pulpe's retention loop lives entirely in "pointer",
/// and a budget created but never re-opened is the core churn we're fighting.
///
/// It teaches two things and asks for nothing (no notification permission here —
/// that is primed later, only after the user's first real pointer):
///   1. the return ritual — "pointe tes dépenses"
///   2. the passive surface — pin the Lock Screen widget
///
/// Presented as a `fullScreenCover` over the dashboard so it never touches the
/// auth / PIN / session-resume state machine.
struct PostOnboardingHandoffView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            Spacer(minLength: 0)

            VStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "checklist")
                    .font(.largeTitle)
                    .foregroundStyle(Color.pulpePrimary)

                Text("Une dernière chose")
                    .font(PulpeTypography.stepTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text("Ton budget est une prévision. Pour qu'il reste juste, tu le fais vivre en deux gestes.")
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: DesignTokens.Spacing.lg) {
                handoffRow(
                    icon: "checkmark.circle",
                    title: AppLocale.string("Pointe tes dépenses"),
                    message: AppLocale.string(
                        """
                        Dès que tu dépenses, pointe-le en un tap. 10 secondes, \
                        et ton « disponible à dépenser » reste toujours juste.
                        """
                    )
                )
                handoffRow(
                    icon: "lock.rectangle.on.rectangle",
                    title: AppLocale.string("Garde-le sous les yeux"),
                    message: AppLocale.string(
                        """
                        Ajoute le widget Pulpe à ton écran verrouillé : \
                        tu vois ton disponible sans même ouvrir l'app.
                        """
                    )
                )
            }

            Spacer(minLength: 0)

            Button(action: onContinue) {
                Text("C'est parti")
            }
            .primaryButtonStyle()
            .accessibilityHint("Ferme cet écran et ouvre ton mois en cours")
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.vertical, DesignTokens.Spacing.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            Color.onboardingFormBase.ignoresSafeArea()
        }
    }

    private func handoffRow(icon: String, title: String, message: String) -> some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.pulpePrimary)
                .frame(width: DesignTokens.IconSize.listRow)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(title)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text(message)
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(message)")
    }
}

#Preview {
    PostOnboardingHandoffView(onContinue: {})
}
