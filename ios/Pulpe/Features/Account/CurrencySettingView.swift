import SwiftUI

struct CurrencySettingView: View {
    enum ConverterField: Hashable {
        case input
    }

    var converterFocus: FocusState<ConverterField?>.Binding

    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = CurrencySettingViewModel()
    @State private var submitSuccessTrigger = false

    var body: some View {
        if featureFlagsStore.isMultiCurrencyEnabled {
            Section {
                currencyPicker
                converterSection
            } header: {
                Text("DEVISE")
                    .font(PulpeTypography.labelLarge)
            }
            .listRowBackground(Color.surfaceContainerHigh)
            .sensoryFeedback(.success, trigger: submitSuccessTrigger)
            .onChange(of: userSettingsStore.currency) { _, newValue in
                viewModel.syncCurrency(newValue)
            }
            .task {
                viewModel.syncCurrency(userSettingsStore.currency)
            }
        }
    }

    // MARK: - Currency Picker

    private var currencyPicker: some View {
        CapsulePicker(
            selection: Binding(
                get: { viewModel.selectedCurrency },
                set: { newValue in
                    guard newValue != viewModel.selectedCurrency else { return }
                    viewModel.selectedCurrency = newValue
                    viewModel.applyConverterBase(newValue)
                    Task {
                        await viewModel.save(using: userSettingsStore)
                        if userSettingsStore.error == nil {
                            submitSuccessTrigger.toggle()
                            appState.toastManager.show("Devise enregistrée", type: .success)
                        } else {
                            appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
                        }
                    }
                }
            ),
            title: nil
        ) { currency, isSelected in
            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(currency.flag)
                VStack(alignment: .leading, spacing: 0) {
                    Text(currency.rawValue).font(PulpeTypography.labelLarge)
                    Text(currency.nativeName)
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(isSelected ? Color.textOnPrimaryMuted : Color.onSurfaceVariant)
                }
            }
        }
    }

    // MARK: - Converter

    private var converterSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                converterHeaderIcon
                Text("Convertisseur")
                    .font(PulpeTypography.cardTitle)
            }

            converterAmountCard(
                label: "Depuis",
                currency: viewModel.sourceCurrency,
                accessibilityLabel: "Depuis \(viewModel.sourceCurrency.nativeName)"
            ) {
                TextField("0", text: $viewModel.converterInput)
                    .keyboardType(.decimalPad)
                    .focused(converterFocus, equals: .input)
                    .font(PulpeTypography.title3.weight(.semibold))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .tint(Color.pulpePrimary)
            }
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                    .strokeBorder(
                        Color.pulpePrimary.opacity(
                            converterFocus.wrappedValue == .input
                                ? DesignTokens.Opacity.strong
                                : 0
                        ),
                        lineWidth: DesignTokens.BorderWidth.medium
                    )
            }
            .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: converterFocus.wrappedValue)
            .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: viewModel.sourceCurrency)

            converterAmountCard(
                label: "Vers",
                currency: viewModel.targetCurrency,
                accessibilityLabel: "Vers \(viewModel.targetCurrency.nativeName)"
            ) {
                Text(viewModel.convertedAmount)
                    .font(PulpeTypography.title3.weight(.semibold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: viewModel.targetCurrency)

            rateFooter
        }
        .padding(.top, DesignTokens.Spacing.xs)
    }

    @ViewBuilder
    private func converterAmountCard<Content: View>(
        label: String,
        currency: SupportedCurrency,
        accessibilityLabel: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(label)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
            HStack(spacing: DesignTokens.Spacing.md) {
                content()
                Text(currency.compactLabel)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .padding(DesignTokens.Spacing.md)
            .background(Color.surfaceContainerLow)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var converterHeaderIcon: some View {
        Image(systemName: "arrow.left.arrow.right.circle")
            .foregroundStyle(Color.onSurfaceVariant)
            .symbolEffect(.pulse, options: .repeating.speed(0.35), isActive: viewModel.isLoadingRate)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var rateFooter: some View {
        if viewModel.isLoadingRate {
            HStack(alignment: .center, spacing: DesignTokens.Spacing.sm) {
                ProgressView()
                Text("Récupération du cours du jour…")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .accessibilityLabel("Récupération du cours de change en cours")
        } else if viewModel.rateFetchFailed {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "chart.line.downtrend.xyaxis")
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textTertiary)
                    Text(
                        "Le cours affiché n’est pas disponible pour l’instant. "
                            + "Tes montants dans Pulpe restent bien dans ta devise."
                    )
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button {
                    viewModel.reloadRate()
                } label: {
                    Text("Réessayer")
                        .font(PulpeTypography.labelMedium)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .foregroundStyle(Color.pulpePrimary)
                .textLinkButtonStyle()
            }
        } else if let rateInfo = viewModel.rateInfo {
            Text(rateInfo)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
        }
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class CurrencySettingViewModel {
    var selectedCurrency: SupportedCurrency = .chf
    var converterInput = ""
    var sourceCurrency: SupportedCurrency = .chf
    var targetCurrency: SupportedCurrency = .eur

    private(set) var rate: CurrencyRate?
    private(set) var isLoadingRate = false
    private(set) var rateFetchFailed = false
    private var loadRateTask: Task<Void, Never>?

    var convertedAmount: String {
        let trimmed = converterInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "—" }
        guard let rate,
              let inputValue = Decimal(string: trimmed.replacingOccurrences(of: ",", with: ".")) else {
            return "—"
        }
        let converted = inputValue * Decimal(rate.rate)
        return converted.asCurrency(targetCurrency)
    }

    var rateInfo: String? {
        guard let rate else { return nil }
        return "1 \(rate.base.rawValue) = \(String(format: "%.4f", rate.rate)) \(rate.target.rawValue) (\(rate.date))"
    }

    /// Aligne le convertisseur : devise du compte = ligne « Depuis », l’autre devise = « Vers ».
    func applyConverterBase(_ currency: SupportedCurrency) {
        let newTarget: SupportedCurrency = currency == .chf ? .eur : .chf
        // Idempotent: avoid a redundant `loadRate()` round-trip + UI flicker when the picker
        // selection and the optimistic store update fire `applyConverterBase` back-to-back.
        guard sourceCurrency != currency || targetCurrency != newTarget else { return }
        sourceCurrency = currency
        targetCurrency = newTarget
        reloadRate()
    }

    func syncCurrency(_ currency: SupportedCurrency) {
        selectedCurrency = currency
        applyConverterBase(currency)
    }

    func save(using store: UserSettingsStore) async {
        await store.updateCurrency(selectedCurrency)
    }

    /// Cancels any in-flight rate fetch and starts a fresh one. Prevents stale EUR→CHF
    /// responses from overwriting newer CHF→EUR results when the user toggles quickly.
    func reloadRate() {
        loadRateTask?.cancel()
        loadRateTask = Task { [weak self] in
            await self?.loadRate()
        }
    }

    func loadRate() async {
        rateFetchFailed = false
        guard sourceCurrency != targetCurrency else {
            rate = nil
            return
        }
        isLoadingRate = true
        defer { isLoadingRate = false }

        do {
            let fetched = try await CurrencyConversionService.shared.getRate(
                base: sourceCurrency,
                target: targetCurrency
            )
            try Task.checkCancellation()
            rate = fetched
            rateFetchFailed = false
        } catch is CancellationError {
            // Superseded by a newer request — leave state untouched.
        } catch {
            rate = nil
            rateFetchFailed = true
        }
    }
}

#Preview {
    @Previewable @FocusState var converterFocus: CurrencySettingView.ConverterField?
    List {
        CurrencySettingView(converterFocus: $converterFocus)
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .background(Color.surface)
    .environment(AppState())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
