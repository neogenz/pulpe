import SwiftUI

/// Back, segmented progress and step count (or the currency chip) above every step. The flow
/// owns it, outside the step slide, so it stays put and only the progress advances.
struct OnboardingTopBar: View {
    let state: OnboardingState
    let onBack: () -> Void
    /// The bar renders under a forced dark scheme; the sheet it presents must not inherit it.
    let sheetColorScheme: ColorScheme

    @State private var showCurrencySwap = false

    private var showsCurrencyChip: Bool { [.charges, .savings, .budgetPreview].contains(state.currentStep) }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.heroInk)
                    .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                    .background(Color.heroTile, in: Circle())
            }
            .plainPressedButtonStyle()
            .accessibilityLabel(state.editReturnStep != nil ? "Retour au résumé" : "Retour")

            OnboardingSegmentedProgress(currentStep: state.currentStep, progressSteps: state.progressBarSteps)
            // The slot keeps the chip's width on every step, so the progress bar doesn't
            // shrink the moment the chip replaces the step count.
            ZStack(alignment: .trailing) {
                currencyChipLabel.hidden()
                trailing
            }
        }
        .sheet(isPresented: $showCurrencySwap) {
            OnboardingCurrencySwapSheet(state: state)
                .environment(\.colorScheme, sheetColorScheme)
        }
    }

    private var currencyChipLabel: some View {
        HStack(spacing: DesignTokens.Spacing.xxs) {
            Text(state.currency.rawValue)
            Image(systemName: "chevron.down").font(PulpeTypography.caption2)
        }
        .font(PulpeTypography.labelLarge)
        .foregroundStyle(Color.heroInk)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .background(Color.heroTile, in: Capsule())
    }

    @ViewBuilder
    private var trailing: some View {
        if showsCurrencyChip {
            Button {
                showCurrencySwap = true
            } label: {
                currencyChipLabel
            }
            .plainPressedButtonStyle()
            .accessibilityLabel("Devise actuelle : \(state.currency.nativeName). Toucher pour changer.")
            // Chip and count share the slot: a plain crossfade overlaps their text mid-step.
            .transition(.blurReplace)
        } else if let position = state.progressBarSteps.firstIndex(of: state.currentStep) {
            Text("\(position + 1)/\(state.progressBarSteps.count)")
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .foregroundStyle(Color.heroInk)
                .contentTransition(.numericText())
                .accessibilityHidden(true)
                .transition(.blurReplace)
        }
    }
}
