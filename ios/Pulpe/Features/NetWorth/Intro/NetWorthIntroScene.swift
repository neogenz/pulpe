import SwiftUI

/// The animated example card above each page of the explainer. It only shows and animates
/// `NetWorthIntroSample`; every total comes from there. Each page is its own view, so turning a
/// page starts its animation from scratch with fresh state.
struct NetWorthIntroScene: View {
    let step: NetWorthIntroStep
    let currency: SupportedCurrency

    var body: some View {
        Group {
            switch step {
            case .overview: OverviewScene(currency: currency)
            case .netWorth: NetWorthScene(currency: currency)
            case .update: UpdateScene(currency: currency)
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    /// One sentence per page; amounts are read in full, never as the animated digits.
    private var accessibilityLabel: String {
        let sample = NetWorthIntroSample.self
        switch step {
        case .overview:
            return AppLocale.string("""
                Exemple : compte courant, épargne, placements et voiture réunis, \
                \(sample.gross.asCurrency(currency)) en tout.
                """)
        case .netWorth:
            return AppLocale.string("""
                Exemple : \(sample.gross.asCurrency(currency)) moins un crédit de \
                \(sample.debt.asCurrency(currency)), fortune nette \(sample.netBefore.asCurrency(currency)).
                """)
        case .update:
            return AppLocale.string("""
                Exemple : l'épargne passe de \(sample.savingsBefore.asCurrency(currency)) à \
                \(sample.savingsAfter.asCurrency(currency)), la fortune nette monte à \
                \(sample.netAfter.asCurrency(currency)).
                """)
        }
    }
}

// MARK: - Timeline

/// Shared timing of the three pages: one flag flips on appear, every element animates to its
/// end state on its own beat. Reduce Motion shows the end state at once and only fades.
private struct IntroTimeline {
    let isPlaying: Bool
    let reduceMotion: Bool

    /// Gap between two beats of a page.
    private let beat = DesignTokens.Animation.quickSnap

    /// `true` once the element should show its end state.
    var isSettled: Bool { isPlaying || reduceMotion }

    func animation(at beatIndex: Double) -> SwiftUI.Animation {
        if reduceMotion { return .easeOut(duration: DesignTokens.Animation.fast) }
        return DesignTokens.Animation.entranceSpring.delay(beatIndex * beat)
    }

    func delay(of beatIndex: Double) -> Double { beatIndex * beat }
}

private struct ExampleHeader: View {
    let title: String?

    var body: some View {
        HStack {
            if let title {
                Text(title)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textSecondary)
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            PulpeChip(label: AppLocale.string("Exemple"), style: .tinted(surface: .accentWash, foreground: .accentInk))
        }
    }
}

/// A big amount whose digits roll from `from` to `to`.
private struct RollingAmount: View {
    let from: Decimal
    let to: Decimal
    let currency: SupportedCurrency
    let isSettled: Bool
    let animation: SwiftUI.Animation

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
            Text(verbatim: (isSettled ? to : from).asAmount(for: currency))
                .font(PulpeTypography.bigAmount)
                .contentTransition(.numericText(countsDown: to < from))
            Text(verbatim: currency.symbol)
                .font(PulpeTypography.bigCurrencySuffix)
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(DesignTokens.TextScale.floor)
        .animation(animation, value: isSettled)
    }
}

private struct SampleIcon: View {
    let systemImage: String

    var body: some View {
        Image(systemName: systemImage)
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.accentInk)
            .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
            .background(Color.accentWash, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm))
    }
}

// MARK: - 1 · Tout au même endroit

/// Four scattered things slide into one card, and the total rolls up to their sum.
private struct OverviewScene: View {
    let currency: SupportedCurrency

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false

    private var timeline: IntroTimeline { IntroTimeline(isPlaying: isPlaying, reduceMotion: reduceMotion) }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            ExampleHeader(title: AppLocale.string("Tout ce que j'ai"))
            RollingAmount(
                from: 0,
                to: NetWorthIntroSample.gross,
                currency: currency,
                isSettled: timeline.isSettled,
                animation: timeline.animation(at: 3)
            )
            .foregroundStyle(Color.textPrimary)

            ForEach(Array(NetWorthIntroSample.assets.enumerated()), id: \.element.id) { index, line in
                HStack(spacing: DesignTokens.Spacing.md) {
                    SampleIcon(systemImage: line.systemImage)
                    Text(line.name)
                        .font(PulpeTypography.bodyLarge)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    Text(verbatim: line.value.asAmount(for: currency))
                        .font(PulpeTypography.bodyLarge)
                        .monospacedDigit()
                }
                .foregroundStyle(Color.textPrimary)
                .opacity(isPlaying ? 1 : 0)
                .offset(timeline.isSettled ? .zero : scatter(index))
                .rotationEffect(.degrees(timeline.isSettled ? 0 : tilt(index)))
                .animation(timeline.animation(at: Double(index)), value: isPlaying)
            }
        }
        .onAppear { isPlaying = true }
    }

    /// Each row starts off in its own corner: left/right alternate, the first two above.
    private func scatter(_ index: Int) -> CGSize {
        let distance = DesignTokens.Spacing.sectionGap
        return CGSize(width: index.isMultiple(of: 2) ? -distance : distance, height: index < 2 ? -distance : distance)
    }

    private func tilt(_ index: Int) -> Double {
        index.isMultiple(of: 2) ? -DesignTokens.Motion.introRowTilt : DesignTokens.Motion.introRowTilt
    }
}

// MARK: - 2 · En un coup d'œil

/// What I have, what I owe eating into the bar, then the one figure left.
private struct NetWorthScene: View {
    let currency: SupportedCurrency

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false

    private var timeline: IntroTimeline { IntroTimeline(isPlaying: isPlaying, reduceMotion: reduceMotion) }
    private var debtShare: CGFloat {
        CGFloat(truncating: (NetWorthIntroSample.debt / NetWorthIntroSample.gross) as NSNumber)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            ExampleHeader(title: nil)
            figureRow(
                label: Text("Ce que j'ai"),
                amount: NetWorthIntroSample.gross.asAmount(for: currency),
                dot: .pulpePrimary,
                ink: .textPrimary
            )
            .opacity(isPlaying ? 1 : 0)
            .animation(timeline.animation(at: 0), value: isPlaying)

            figureRow(
                label: Text("Ce que je dois") + Text(verbatim: " · ").foregroundStyle(Color.textSecondary)
                    + Text("Crédit").foregroundStyle(Color.textSecondary),
                amount: "−" + NetWorthIntroSample.debt.asAmount(for: currency),
                dot: .financialOverBudget,
                ink: .financialOverBudget
            )
            .opacity(isPlaying ? 1 : 0)
            .animation(timeline.animation(at: 1), value: isPlaying)

            GeometryReader { proxy in
                ZStack(alignment: .trailing) {
                    Capsule().fill(Color.pulpePrimary)
                    Rectangle()
                        .fill(Color.financialOverBudget)
                        .frame(width: proxy.size.width * debtShare)
                        .scaleEffect(x: timeline.isSettled ? 1 : 0, anchor: .trailing)
                        .animation(timeline.animation(at: 2), value: isPlaying)
                }
                .clipShape(Capsule())
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
            .padding(.vertical, DesignTokens.Spacing.xs)

            VStack(spacing: DesignTokens.Spacing.xxs) {
                Text("Fortune nette")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.heroInkSecondary)
                RollingAmount(
                    from: NetWorthIntroSample.gross,
                    to: NetWorthIntroSample.netBefore,
                    currency: currency,
                    isSettled: timeline.isSettled,
                    animation: timeline.animation(at: 4)
                )
                .foregroundStyle(Color.heroInk)
            }
            .frame(maxWidth: .infinity)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.heroSurface, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))
            .opacity(isPlaying ? 1 : 0)
            .scaleEffect(timeline.isSettled ? 1 : DesignTokens.Animation.settleScale)
            .animation(timeline.animation(at: 3), value: isPlaying)
        }
        .onAppear { isPlaying = true }
    }

    private func figureRow(label: Text, amount: String, dot: Color, ink: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.compactGap) {
            Circle().fill(dot).frame(width: DesignTokens.Spacing.compactGap, height: DesignTokens.Spacing.compactGap)
            label
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(verbatim: amount)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(ink)
                .monospacedDigit()
        }
    }
}

// MARK: - 3 · Garde-la à jour

/// The pencil is pressed, one value changes, the net worth follows; then the budget hint.
private struct UpdateScene: View {
    let currency: SupportedCurrency

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false

    private var timeline: IntroTimeline { IntroTimeline(isPlaying: isPlaying, reduceMotion: reduceMotion) }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            ExampleHeader(title: AppLocale.string("Fortune nette"))
            RollingAmount(
                from: NetWorthIntroSample.netBefore,
                to: NetWorthIntroSample.netAfter,
                currency: currency,
                isSettled: timeline.isSettled,
                animation: timeline.animation(at: 3)
            )
            .foregroundStyle(Color.textPrimary)

            updatedRow
            budgetHint
                .opacity(isPlaying ? 1 : 0)
                .offset(y: timeline.isSettled ? 0 : DesignTokens.Spacing.sm)
                .animation(timeline.animation(at: 6), value: isPlaying)
        }
        .onAppear { isPlaying = true }
    }

    private var updatedRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            SampleIcon(systemImage: "cylinder.split.1x2")
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Épargne")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Text(timeline.isSettled ? "Mis à jour aujourd'hui" : "Mis à jour il y a 2 mois")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(timeline.isSettled ? Color.accentInk : Color.textSecondary)
                    .contentTransition(.opacity)
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(verbatim: (timeline.isSettled ? NetWorthIntroSample.savingsAfter : NetWorthIntroSample.savingsBefore)
                .asAmount(for: currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .contentTransition(.numericText())
            Image(systemName: "pencil")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textOnPrimary)
                .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                .background(Color.pulpePrimary, in: Circle())
                .keyframeAnimator(initialValue: 1.0, trigger: isPlaying) { content, scale in
                    content.scaleEffect(reduceMotion ? 1 : scale)
                } keyframes: { _ in
                    LinearKeyframe(1.0, duration: timeline.delay(of: 2))
                    SpringKeyframe(DesignTokens.Animation.settleScale, duration: DesignTokens.Animation.fast)
                    SpringKeyframe(1.0, duration: DesignTokens.Animation.fast)
                }
        }
        .padding(DesignTokens.Spacing.md)
        .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input))
        .animation(timeline.animation(at: 3), value: isPlaying)
    }

    private var budgetHint: some View {
        HStack(spacing: DesignTokens.Spacing.compactGap) {
            Image(systemName: "arrow.up.arrow.down")
                .foregroundStyle(Color.accentInk)
            let amount = NetWorthIntroSample.budgetSuggestion.asAmount(for: currency)
            Text("\(amount) mis de côté dans ton budget → je te propose +\(amount) ici.")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                .strokeBorder(
                    Color.accentInk.opacity(DesignTokens.Opacity.heavy),
                    style: StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [DesignTokens.Spacing.xs])
                )
        }
    }
}
