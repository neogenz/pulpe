import SwiftUI

/// One-time teaching screen shown once, right after a user finishes onboarding
/// (fresh `.pinSetup` path). Its single job is to hand the user a reason and a
/// habit to come back for — Pulpe's retention loop lives entirely in "pointer",
/// and a budget created but never re-opened is the core churn we're fighting.
///
/// It teaches three things and asks for nothing (no notification permission here —
/// that is primed later, only after the user's first real pointer):
///   1. the two gestures that keep the budget true: add what you spend, tick what has passed
///   2. the passive surface — pin the Lock Screen widget
///
/// Shown by `PostOnboardingHandoffHost` over the tabs, so it never touches the
/// auth / PIN / session-resume state machine.
struct PostOnboardingHandoffView: View {
    let onContinue: () -> Void

    @State private var showWidgetHelp = false
    @State private var hasOpenedWidgetHelp = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Image(systemName: "checklist")
                    .font(PulpeTypography.title2)
                    .foregroundStyle(Color.heroSurface)
                    .frame(width: DesignTokens.Entry.iconDisc, height: DesignTokens.Entry.iconDisc)
                    .background(Color.heroAccentPositive, in: Circle())
                    .accessibilityHidden(true)

                Text("Une dernière chose")
                    .font(PulpeTypography.entryTitle)
                    .foregroundStyle(Color.heroInk)
                    .accessibilityAddTraits(.isHeader)

                Text("Ton budget est une prévision. Voici comment le garder juste.")
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.heroInkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: DesignTokens.Spacing.md) {
                handoffCard(
                    icon: "plus",
                    title: AppLocale.string("Ajoute ce que tu dépenses"),
                    message: AppLocale.string(
                        "Le + vert, sur chaque écran. Dis dans quelle prévision ça tombe, ou que c'est un imprévu."
                    )
                )
                handoffCard(
                    icon: "checkmark",
                    title: AppLocale.string("Pointe ce qui est passé"),
                    message: AppLocale.string(
                        "Quand la dépense apparaît sur ton compte, touche le rond. Ton disponible reste juste."
                    )
                )
                handoffCard(
                    icon: "lock.rectangle.on.rectangle",
                    title: AppLocale.string("Garde-le sous les yeux"),
                    message: AppLocale.string("Le widget d'écran verrouillé montre ton disponible sans ouvrir l'app.")
                )
                Button("Voir les widgets") {
                    showWidgetHelp = true
                    hasOpenedWidgetHelp = true
                }
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.heroAccentPositive)
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Rectangle())
            }

            Spacer(minLength: 0)

            Button {
                AnalyticsService.captureOnboardingHandoffCompleted(widgetHelpOpened: hasOpenedWidgetHelp)
                onContinue()
            } label: {
                Text("Ouvrir mon mois")
                    .font(PulpeTypography.buttonPrimary)
                    .foregroundStyle(Color.heroSurface)
                    .frame(maxWidth: .infinity)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.heroAccentPositive, in: Capsule())
                    .contentShape(Capsule())
            }
            .plainPressedButtonStyle()
            .accessibilityHint("Ferme cet écran et ouvre ton mois en cours")
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.vertical, DesignTokens.Spacing.xxxl)
        .frame(maxWidth: DesignTokens.Entry.columnMaxWidth, maxHeight: .infinity, alignment: .leading)
        .frame(maxWidth: .infinity)
        .background { EntryZoneBackground() }
        .environment(\.colorScheme, .dark)
        .sheet(isPresented: $showWidgetHelp) { WidgetInstructionsSheet() }
    }

    private func handoffCard(icon: String, title: String, message: String) -> some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: icon)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.heroSurface)
                .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                .background(Color.heroAccentPositive, in: Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(title)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.heroInk)
                Text(message)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.heroInkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.heroTile, in: .rect(cornerRadius: DesignTokens.CornerRadius.surface))
        .accessibilityElement(children: .combine)
    }
}

/// The tabs with the handoff over them, once, for a user who JUST finished onboarding and
/// hasn't seen it. Over the tabs rather than in a cover: a cover slid up over the light home,
/// while this follows the forest loader without a frame of the home showing.
struct PostOnboardingHandoffHost<Content: View>: View {
    @Environment(AppState.self) private var appState
    @ViewBuilder let content: () -> Content

    private let flags = PostOnboardingFlagsStore()

    private var showsHandoff: Bool {
        appState.justCompletedOnboarding && !flags.hasSeenPostOnboardingHandoff
    }

    var body: some View {
        ZStack {
            content()
                .accessibilityHidden(showsHandoff)
            if showsHandoff {
                PostOnboardingHandoffView {
                    flags.setHasSeenPostOnboardingHandoff()
                    withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                        appState.justCompletedOnboarding = false
                    }
                }
                .suppressesTips()
                .transition(.opacity)
                // A view leaving a ZStack drops under its siblings unless it keeps its rank:
                // without it the fade-out runs hidden behind the tabs, a hard cut on screen.
                .zIndex(1)
            }
        }
    }
}

/// How to pin the lock-screen widget: iOS has no API to open the gallery, so the sheet says where to press.
private struct WidgetInstructionsSheet: View {
    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ajouter le widget")
                .font(PulpeTypography.statusTitle)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                    Text("\(index + 1)")
                        .font(PulpeTypography.metricLabelBold)
                        .foregroundStyle(Color.accentInk)
                        .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                        .background(Color.accentWash, in: Circle())
                    Text(step)
                        .font(PulpeTypography.onboardingSubtitle)
                        .foregroundStyle(Color.textPrimary)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DesignTokens.Spacing.xxl)
        .intrinsicSheetPresentation()
    }

    private var steps: [String] {
        [
            AppLocale.string("Verrouille ton iPhone, puis appuie longuement sur l'écran."),
            AppLocale.string("Touche Personnaliser, puis l'espace sous l'heure."),
            AppLocale.string("Choisis Pulpe dans la liste des widgets.")
        ]
    }
}

#Preview {
    PostOnboardingHandoffView(onContinue: {})
}

/// Bridges the preview's CTA and the handoff while the first budget is created: the same
/// forest surface, so the climax doesn't drop to a light loader for seconds.
struct BudgetCreationLoadingView: View {
    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ProgressView()
                .tint(Color.heroInk)
                .controlSize(.large)
            Text("Je prépare ton budget…")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.heroInkSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { EntryZoneBackground() }
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .combine)
    }
}
