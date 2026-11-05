import SwiftUI

/// V2 state card of the goal detail: an icon disc, a title, one message, an optional
/// grey fact row, then the actions. Épargne accents stay primary/neutral, never
/// amber/red (RG-002).
struct GoalInfoCard<Detail: View, Action: View>: View {
    let icon: String
    let title: String
    let message: String
    @ViewBuilder var detail: () -> Detail
    @ViewBuilder var action: () -> Action

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.accentInk)
                    .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                    .background(Color.accentWash, in: Circle())
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text(message)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .sensitiveAmount()
                }
            }
            detail()
            action()
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
    }
}

extension GoalInfoCard where Detail == EmptyView {
    init(icon: String, title: String, message: String, @ViewBuilder action: @escaping () -> Action) {
        self.init(icon: icon, title: title, message: message, detail: { EmptyView() }, action: action)
    }
}

/// The grey fact row inside a state card (« À 300.00 par mois, tu finis fin décembre »).
private struct GoalCardFactRow: View {
    let text: Text

    var body: some View {
        text
            .font(PulpeTypography.subheadline)
            .foregroundStyle(Color.textPrimary)
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
            .padding(DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
            .sensitiveAmount()
    }
}

/// The empty-state card shown when no prévision is linked to the goal.
struct GoalEmptyGuidanceCard: View {
    var body: some View {
        GoalInfoCard(
            icon: "link",
            title: AppLocale.string("Aucune prévision rattachée"),
            message: AppLocale.string("""
                Rattache une prévision Épargne depuis ton Mois Type ou un budget \
                pour suivre cet objectif ici.
                """)
        ) {
            EmptyView()
        }
        .accessibilityIdentifier("savingsGoalEmptyGuidanceCard")
    }
}

/// The derived-state cards: échéance dépassée, objectif atteint (suggested, then
/// completed), en pause, and the PUL-285 CA8 advisory for future linked lines of a
/// stopped goal. The server owns the flags; this view only renders them and forwards
/// the user-initiated actions (never auto-flips, pilier Contrôle, `docs/SAVINGS.md` §6).
struct GoalDerivedStateCards: View {
    let progress: SavingsGoalProgress
    let status: SavingsGoalStatus
    let currency: SupportedCurrency
    let payDayOfMonth: Int?
    let isMutatingStatus: Bool
    let futureLinesCount: Int
    let onEdit: () -> Void
    let onComplete: () -> Void
    let onReopen: () -> Void
    let onManageFutureLines: () -> Void

    private var saved: String { progress.confirmed.asAmount(for: currency) }

    var body: some View {
        if status == .active, progress.suggestCompletion == true {
            completionCard
        } else if status == .active, progress.isOverdue {
            overdueCard
        }

        if status == .paused {
            pausedCard
        }

        if status == .completed {
            GoalInfoCard(
                icon: "flag.checkered",
                title: AppLocale.string("Objectif atteint"),
                message: AppLocale.string("Tu peux le ré-ouvrir si tu veux continuer à épargner dessus.")
            ) {
                Button("Ré-ouvrir", action: onReopen)
                    .secondaryButtonStyle()
                    .disabled(isMutatingStatus)
            }
        }

        if status != .active, futureLinesCount > 0 {
            GoalInfoCard(
                icon: "calendar.badge.clock",
                title: AppLocale.string("Prévisions liées sur tes mois futurs"),
                message: AppLocale.string("""
                    Cet objectif est arrêté, mais \(futureLinesCount) prévision(s) Épargne \
                    lui restent réservées sur les mois à venir.
                    """)
            ) {
                Button("Gérer ces prévisions", action: onManageFutureLines)
                    .secondaryButtonStyle()
            }
        }
    }

    private var completionCard: some View {
        GoalInfoCard(
            icon: "checkmark.circle",
            title: AppLocale.string("Objectif atteint"),
            message: AppLocale.string("Tu as mis de côté l'équivalent de ta cible. On le marque comme atteint ?"),
            detail: {
                Text("Rien ne bouge sur ton compte : les \(saved) restent de côté.")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .sensitiveAmount()
            },
            action: {
                VStack(spacing: DesignTokens.Spacing.xs) {
                    Button("Marquer comme atteint", action: onComplete)
                        .primaryButtonStyle(isEnabled: !isMutatingStatus)
                        .disabled(isMutatingStatus)
                    Button("Augmenter la cible", action: onEdit)
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.pulpePrimary)
                        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
                        .contentShape(Rectangle())
                        .textLinkButtonStyle()
                }
            }
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalCompletionSuggestionCard")
    }

    private var overdueCard: some View {
        GoalInfoCard(
            icon: "calendar",
            title: AppLocale.string("Échéance dépassée"),
            message: AppLocale.string("Ton échéance est passée. Tu peux la repousser pour continuer à ton rythme."),
            detail: {
                if let finish = progress.estimatedCompletion, progress.confirmedPace > 0 {
                    let pace = progress.confirmedPace.asAmount(for: currency)
                    let month = Formatters.monthNameInText(for: finish.month)
                    GoalCardFactRow(
                        text: Text("À \(pace) par mois, tu finis ")
                            + Text("fin \(month)").bold()
                    )
                    .accessibilityIdentifier("savingsGoalEstimatedCompletion")
                }
            },
            action: {
                Button("Repousser la date", action: onEdit)
                    .secondaryButtonStyle()
            }
        )
    }

    private var pausedCard: some View {
        GoalInfoCard(
            icon: "pause",
            title: AppLocale.string("En pause"),
            message: AppLocale.string("Je ne prévois plus rien pour cet objectif. Tes \(saved) restent de côté."),
            detail: {
                if let resume = resumeFact {
                    GoalCardFactRow(text: resume)
                }
            },
            action: {
                Button("Reprendre l'objectif", action: onReopen)
                    .secondaryButtonStyle()
                    .disabled(isMutatingStatus)
            }
        )
        .accessibilityIdentifier("savingsGoalPausedCard")
    }

    /// « Si tu reprends en novembre / 530.77 par mois jusqu'en décembre 2028 ».
    private var resumeFact: Text? {
        guard let target = progress.targetAmount,
              let deadline = progress.targetDateValue,
              let monthly = SavingsPlanCalculator.suggestedMonthlyContribution(
                  targetAmount: target,
                  targetDate: deadline,
                  payDayOfMonth: payDayOfMonth,
                  initialAmount: progress.confirmed
              ),
              monthly > 0 else { return nil }
        let parts = Calendar.current.dateComponents([.month, .year], from: deadline)
        let end = GoalHeroPresentation.monthYear(month: parts.month ?? 1, year: parts.year ?? 0, capitalized: false)
        let now = Formatters.monthNameInText(for: Calendar.current.component(.month, from: Date()))
        return Text("Si tu reprends en \(now)")
            .font(PulpeTypography.caption)
            .foregroundStyle(Color.textSecondary)
            + Text(verbatim: "\n")
            + Text("\(Text(monthly.asAmount(for: currency)).bold()) par mois jusqu'en \(end)")
    }
}
