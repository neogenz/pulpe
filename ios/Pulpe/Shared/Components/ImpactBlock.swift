import SwiftUI

/// What an action does to a figure, shown before the user validates (V2 `impact`):
/// a caption title, then the "before" figure struck through in `ink3` → the "after" figure,
/// and an optional note. Without `before`, only the "after" figure is shown.
struct ImpactBlock: View {
    /// The block's mood: `.neutral` when the figure does not move, `.over` (ocre) when the
    /// action lowers it, `.ok` (green) when it raises it.
    enum Tone {
        case neutral, over, ok

        fileprivate var fill: Color {
            switch self {
            case .neutral: .sunk
            case .over: .overWash
            case .ok: .accentWash
            }
        }

        fileprivate var titleColor: Color {
            switch self {
            case .neutral: .textSecondary
            case .over: .financialOverBudget
            case .ok: .accentInk
            }
        }
    }

    let title: String
    let before: Decimal?
    let after: Decimal
    let currency: SupportedCurrency
    var note: String?
    var tone: Tone = .neutral
    /// `false` when nothing moves: the title and the note say it, no figure to repeat.
    var showsFigures = true
    /// `false` when the note carries no figure, so it stays readable under hidden amounts.
    var noteHasAmount = true
    @Environment(\.amountsHidden) private var amountsHidden

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(title)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(tone.titleColor)

            if showsFigures {
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    if let before {
                        Text(before.asAmount(for: currency))
                            .strikethrough(true, color: Color.textTertiary)
                            .foregroundStyle(Color.textTertiary)
                        Image(systemName: "arrow.right")
                            .font(PulpeTypography.metricMini)
                            .foregroundStyle(Color.textSecondary)
                            .accessibilityHidden(true)
                    }
                    Text(after.asAmount(for: currency))
                        .foregroundStyle(Color.textPrimary)
                }
                .font(PulpeTypography.impactAmount)
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .lineLimit(1)
                .sensitiveAmount()
            }

            if let note {
                Text(note)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount(noteHasAmount)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg - DesignTokens.BorderWidth.thick)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.fill, in: .rect(cornerRadius: DesignTokens.CornerRadius.inset))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        var parts = [title]
        if showsFigures, !amountsHidden {
            if let before {
                parts.append(AppLocale.string("avant") + " " + before.asCurrency(currency))
            }
            parts.append(AppLocale.string("après") + " " + after.asCurrency(currency))
        }
        if let note, !(amountsHidden && noteHasAmount) { parts.append(note) }
        return parts.joined(separator: ", ")
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.lg) {
        ImpactBlock(
            title: "Ton disponible de novembre",
            before: 1248.50,
            after: 1108.50,
            currency: .chf
        )
        ImpactBlock(
            title: "Ton disponible de novembre",
            before: nil,
            after: 1108.50,
            currency: .chf,
            note: "Rien ne change"
        )
    }
    .padding()
    .background(Color.surface)
}

extension ImpactBlock {
    /// The block for a computed impact: its tone follows the move, and a figure that does not
    /// move is not repeated. `tone` pins the mood when the move is planned, not a surprise
    /// (setting money aside for a goal reads neutral, not as an overrun).
    init(
        title: String,
        impact: MovementImpact,
        currency: SupportedCurrency,
        tone pinned: Tone? = nil,
        note: String? = nil,
        noteHasAmount: Bool = true
    ) {
        let computed: Tone = switch impact.tone {
        case .neutral: .neutral
        case .over: .over
        case .ok: .ok
        }
        let tone = pinned ?? computed
        self.init(
            title: title,
            before: impact.before,
            after: impact.after,
            currency: currency,
            note: note,
            tone: tone,
            showsFigures: impact.tone != .neutral,
            noteHasAmount: noteHasAmount
        )
    }
}
