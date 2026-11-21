import SwiftUI

/// The guide of « Comparer avec mes comptes »: three pages, each an animated example above a
/// title and one sentence. A page of the comparison sheet, not a sheet of its own: the parent
/// owns the navigation bar and swaps this view in and out.
///
/// `onFinish` fires once per opening with how it ended; the parent shows the form.
struct ReconcileGuideView: View {
    let source: ReconcileGuideSource
    let currency: SupportedCurrency
    let onFinish: (ReconcileGuideOutcome) -> Void

    @State private var step: ReconcileGuideStep = .compare
    /// Height of the scrolling page, so the example leaves room for its sentence on a small iPhone.
    @State private var pageHeight: CGFloat = 0
    @State private var session: ReconcileGuideSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        source: ReconcileGuideSource,
        currency: SupportedCurrency,
        session: ReconcileGuideSession? = nil,
        onFinish: @escaping (ReconcileGuideOutcome) -> Void
    ) {
        self.source = source
        self.currency = currency
        self.onFinish = onFinish
        _session = State(initialValue: session ?? ReconcileGuideSession(source: source))
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ScrollView {
                let isCompact = ReconcileGuideScene.isCompact(pageHeight)
                VStack(alignment: .leading, spacing: isCompact ? DesignTokens.Spacing.xl : DesignTokens.Spacing.xxl) {
                    ReconcileGuideScene(step: step, currency: currency, pageHeight: pageHeight)
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                        Text(title)
                            .font(PulpeTypography.stepTitle)
                            .foregroundStyle(Color.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                        Text(message)
                            .font(PulpeTypography.bodyLarge)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xs)
            }
            .scrollBounceBehavior(.basedOnSize)
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { pageHeight = $0 }
            // A new scene starts at its top
            .id(step)

            VStack(spacing: DesignTokens.Spacing.lg) {
                StepDots(current: step.rawValue, total: ReconcileGuideStep.allCases.count)
                Button(primaryTitle) { primaryTapped() }
                    .primaryButtonStyle()
                    .accessibilityIdentifier("reconcileGuidePrimary")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .background(Color.sheetBackground)
        .animation(reduceMotion ? nil : DesignTokens.Animation.stepTransition, value: step)
        .toolbar {
            // Same corners as the form that follows: close left, one action right
            // From the replay, close returns to the form like « Passer »; from the first opening it closes the sheet
            ToolbarItem(placement: .cancellationAction) {
                SheetCloseButton(action: source == .help ? { finish(.skipped) } : nil)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Passer") { finish(.skipped) }
                    .accessibilityIdentifier("reconcileGuideSkip")
            }
        }
        // Opaque, so a scrolled page stays under « Passer » and the close button, never behind them.
        .toolbarBackground(Color.sheetBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .trackScreen("Reconcile_Guide")
        .onAppear { session.open() }
        // A swipe down, or any dismissal the buttons did not cause, ends the guide as skipped.
        .onDisappear { finish(.skipped) }
    }

    private var primaryTitle: LocalizedStringKey { step.next == nil ? "Comparer maintenant" : "Suivant" }

    private var title: LocalizedStringKey {
        switch step {
        case .compare: "Vérifie que Pulpe et ta banque disent la même chose"
        case .type: "Tape ce que ta banque affiche"
        case .check: "Pulpe te montre ce qui manque"
        }
    }

    private var message: LocalizedStringKey {
        switch step {
        case .compare: "Tu évites les mauvaises surprises : si un montant manque, Pulpe te le montre."
        case .type: "Ouvre l'app de ta banque et recopie le montant de ton compte."
        case .check: "Coche l'essence de 60 : Pulpe est à jour avec ta banque."
        }
    }

    private func primaryTapped() {
        if let next = step.next {
            step = next
        } else {
            finish(.completed)
        }
    }

    private func finish(_ outcome: ReconcileGuideOutcome) {
        guard let outcome = session.finish(outcome) else { return }
        onFinish(outcome)
    }
}

/// The animated example above each page of the guide. It only shows and animates
/// `ReconcileGuideSample`. Each page is its own view, so turning a page starts its animation
/// from scratch. The drawing is decorative: the page's sentence is what VoiceOver reads.
struct ReconcileGuideScene: View {
    let step: ReconcileGuideStep
    let currency: SupportedCurrency
    /// 0 until measured.
    var pageHeight: CGFloat = 0

    var body: some View {
        Group {
            switch step {
            case .compare: CompareScene(currency: currency)
            case .type: TypeScene(currency: currency, isCompact: Self.isCompact(pageHeight))
            case .check: CheckScene(currency: currency)
            }
        }
        .padding(Self.isCompact(pageHeight) ? DesignTokens.Spacing.lg : DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .center)
        .background(Color.sunk, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.surface))
        .accessibilityHidden(true)
    }

    /// A page as short as an iPhone SE's: the example and the space around it tighten so the sentence under
    /// it shows without scrolling.
    static func isCompact(_ pageHeight: CGFloat) -> Bool {
        pageHeight > 0 && pageHeight < Layout.compactPageHeight
    }

    /// On an iPhone SE the full height would push the page's sentence out of sight.
    private var minHeight: CGFloat {
        pageHeight > 0 ? min(Layout.minHeight, pageHeight * Layout.maxPageShare) : Layout.minHeight
    }

    private enum Layout {
        /// Keeps the title from jumping when a page is shorter than the others.
        static let minHeight: CGFloat = 340
        /// The example never takes more than this share of the page: on an iPhone SE, as tall as the typing
        /// example once tightened, and still short enough for the first scene's two-line title and sentence.
        static let maxPageShare: CGFloat = 0.64
        /// Between an iPhone SE's page (about 430 pt) and an iPhone 17's (about 580 pt).
        static let compactPageHeight: CGFloat = 500
    }
}

// MARK: - Timeline

/// Shared timing of the pages: one flag flips on appear, every element animates to its end
/// state on its own beat. Reduce Motion shows the end state at once.
struct ReconcileGuideTimeline {
    let isPlaying: Bool
    let reduceMotion: Bool

    /// `true` once the element should show its end state.
    var isSettled: Bool { isPlaying || reduceMotion }

    func animation(at beat: Double) -> SwiftUI.Animation {
        if reduceMotion { return .easeOut(duration: DesignTokens.Animation.fast) }
        return DesignTokens.Animation.entranceSpring.delay(beat * DesignTokens.Animation.quickSnap)
    }
}

// MARK: - Building blocks

/// A mini app screen: a header naming whose screen it is, then its content.
private struct SampleScreen<Content: View>: View {
    let isBank: Bool
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if isBank {
                    Image(systemName: "building.columns").foregroundStyle(Color.textSecondary)
                } else {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xs)
                        .fill(Color.pulpePrimary)
                        .frame(width: DesignTokens.Spacing.lg, height: DesignTokens.Spacing.lg)
                }
                Group {
                    if isBank { Text("Ma banque") } else { Text(verbatim: "Pulpe") }
                }
                .foregroundStyle(isBank ? Color.textPrimary : Color.pulpePrimary)
                // One line on a narrow iPhone, so both screens keep the same height.
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
            }
            .font(PulpeTypography.labelLarge)
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.compactGap)
            .frame(maxWidth: .infinity, alignment: .leading)
            Divider().overlay(Color.outlineVariant)
            content.padding(DesignTokens.Spacing.md)
        }
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))
        .pulpeSurfaceCard()
    }
}

private func amountText(_ value: Decimal, currency: SupportedCurrency) -> Text {
    Text(verbatim: value.asAmount(for: currency)).font(PulpeTypography.rowAmount).monospacedDigit()
}

// MARK: - 1 · Vérifie que Pulpe et ta banque disent la même chose

/// The bank and Pulpe side by side, a « ≠ » between them, then the size of the difference.
private struct CompareScene: View {
    let currency: SupportedCurrency

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var isPlaying = false

    private var timeline: ReconcileGuideTimeline {
        .init(isPlaying: isPlaying, reduceMotion: reduceMotion)
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            // Side by side would truncate the amounts at accessibility sizes.
            let layout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(spacing: DesignTokens.Spacing.compactGap))
                : AnyLayout(HStackLayout(spacing: DesignTokens.Spacing.compactGap))
            layout {
                screen(isBank: true, label: "Compte courant", amount: ReconcileGuideSample.bank, beat: 0)
                Text(verbatim: "≠")
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.warningPrimary)
                    .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                    .background(Color.warningPrimary.opacity(DesignTokens.Opacity.accent), in: Circle())
                    .scaleEffect(timeline.isSettled ? 1 : 0)
                    .animation(timeline.animation(at: 2), value: isPlaying)
                screen(isBank: false, label: "Déjà coché", amount: ReconcileGuideSample.pulpe, beat: 1)
            }
            Text(AppLocale.string("\(ReconcileGuideSample.gap.asCompactAmount(for: currency)) de différence"))
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.compactGap)
                .background(Color.warningPrimary.opacity(DesignTokens.Opacity.accent), in: Capsule())
                .opacity(timeline.isSettled ? 1 : 0)
                .animation(timeline.animation(at: 3), value: isPlaying)
        }
        .onAppear { isPlaying = true }
    }

    private func screen(isBank: Bool, label: LocalizedStringKey, amount: Decimal, beat: Double) -> some View {
        SampleScreen(isBank: isBank) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(label)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                amountText(amount, currency: currency)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
            }
        }
        .opacity(timeline.isSettled ? 1 : 0)
        .offset(y: timeline.isSettled ? 0 : DesignTokens.Spacing.sm)
        .animation(timeline.animation(at: beat), value: isPlaying)
    }
}

// MARK: - 2 · Tape ce que ta banque affiche

/// The bank balance lights up, then its digits are typed into « Sur tes comptes » and
/// « Comparer » is pressed.
private struct TypeScene: View {
    let currency: SupportedCurrency
    /// The tallest example: tightened on a short page so its title sits where the other scenes' do.
    let isCompact: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false

    private var timeline: ReconcileGuideTimeline {
        .init(isPlaying: isPlaying, reduceMotion: reduceMotion)
    }
    private var digits: [Character] { Array(String(NSDecimalNumber(decimal: ReconcileGuideSample.bank).intValue)) }

    var body: some View {
        VStack(spacing: isCompact ? DesignTokens.Spacing.xs : DesignTokens.Spacing.md) {
            SampleScreen(isBank: true) {
                HStack {
                    Text("Compte courant")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    amountText(ReconcileGuideSample.bank, currency: currency)
                        .foregroundStyle(Color.textPrimary)
                        .padding(.horizontal, DesignTokens.Spacing.sm)
                        .background(
                            Color.accentWash.opacity(timeline.isSettled ? 1 : 0),
                            in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                        )
                        .animation(timeline.animation(at: 1), value: isPlaying)
                }
            }
            Image(systemName: "arrow.down")
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.pulpePrimary)
                .opacity(timeline.isSettled ? 1 : 0)
                .animation(timeline.animation(at: 2), value: isPlaying)

            SampleScreen(isBank: false) {
                VStack(alignment: .leading, spacing: isCompact ? DesignTokens.Spacing.xs : DesignTokens.Spacing.sm) {
                    Text("Sur tes comptes")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                    HStack(spacing: DesignTokens.Spacing.none) {
                        ForEach(Array(digits.enumerated()), id: \.offset) { index, digit in
                            Text(String(digit))
                                .opacity(timeline.isSettled ? 1 : 0)
                                .animation(timeline.animation(at: 3 + Double(index)), value: isPlaying)
                        }
                        Spacer(minLength: DesignTokens.Spacing.none)
                    }
                    .font(PulpeTypography.rowAmount)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.sm)
                    .frame(minHeight: DesignTokens.IconSize.badge)
                    .overlay {
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                            .strokeBorder(Color.pulpePrimary, lineWidth: DesignTokens.BorderWidth.medium)
                    }
                    Text("Comparer")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textOnPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(Color.pulpePrimary, in: Capsule())
                        .scaleEffect(timeline.isSettled ? 1 : DesignTokens.Animation.settleScale)
                        .animation(timeline.animation(at: 7), value: isPlaying)
                }
            }
        }
        .onAppear { isPlaying = true }
    }
}

// MARK: - 3 · Pulpe te montre ce qui manque

/// The missing expense gets checked, Pulpe's figure drops to the bank's, both sides agree.
private struct CheckScene: View {
    let currency: SupportedCurrency

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPlaying = false

    private var timeline: ReconcileGuideTimeline {
        .init(isPlaying: isPlaying, reduceMotion: reduceMotion)
    }
    private var state: ReconcileGuideCheckState { .init(isSettled: timeline.isSettled) }

    var body: some View {
        SampleScreen(isBank: false) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.compactGap) {
                figureRow("Sur tes comptes", ReconcileGuideSample.bank)
                Divider().overlay(Color.outlineVariant)
                figureRow("Dans Pulpe, déjà coché", state.pulpeFigure)
                .contentTransition(.numericText(countsDown: true))
                .animation(timeline.animation(at: 5), value: isPlaying)

                // Leaves the layout once answered, so no hole stays in the end state
                Group {
                    if !state.isExpenseChecked {
                        Text("Tu vois cette dépense dans l'app de ta banque ?")
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(.opacity)
                    }
                }
                .animation(timeline.animation(at: 4), value: isPlaying)

                expenseRow
                matchedBanner
                    .opacity(state.showsMatched ? 1 : 0)
                    .animation(timeline.animation(at: 6), value: isPlaying)
            }
        }
        .onAppear { isPlaying = true }
    }

    private func figureRow(_ label: LocalizedStringKey, _ amount: Decimal) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            amountText(amount, currency: currency)
                .foregroundStyle(Color.textPrimary)
        }
    }

    private var expenseRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Same circle as the real row's pointing control, drawn at rest
            ZStack {
                Circle()
                    .strokeBorder(Color.pointRing, lineWidth: DesignTokens.Checkbox.ringWidth)
                    .opacity(state.isExpenseChecked ? 0 : 1)
                Circle()
                    .fill(Color.pulpePrimary)
                    .opacity(state.isExpenseChecked ? 1 : 0)
                Image(systemName: "checkmark")
                    .font(.system(size: DesignTokens.Checkbox.glyphSize, weight: .heavy))
                    .foregroundStyle(Color.textOnPrimary)
                    .scaleEffect(state.isExpenseChecked ? 1 : 0)
            }
            .frame(width: DesignTokens.Checkbox.size, height: DesignTokens.Checkbox.size)
            .animation(timeline.animation(at: 3), value: isPlaying)
            Text("Essence · hier")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(verbatim: ReconcileGuideSample.expense.asAmount(for: currency))
                .font(PulpeTypography.bodyLarge)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
        }
    }

    private var matchedBanner: some View {
        HStack(spacing: DesignTokens.Spacing.compactGap) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.pulpePrimary)
            Text("Pareil des deux côtés")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.accentInk)
        }
        .padding(DesignTokens.Spacing.compactGap)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentWash, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input))
    }
}

#Preview {
    NavigationStack {
        ReconcileGuideView(source: .auto, currency: .chf) { _ in }
    }
}
