import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct CurrencySettingView: View {
    enum ConverterField: Hashable {
        case input
    }

    private struct ConverterValueRowModel {
        var title: String
        var caption: String?
        var currency: SupportedCurrency
        var isOutput: Bool
        var inputAccessibilityLabel: String?
    }

    var converterFocus: FocusState<ConverterField?>.Binding

    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = CurrencySettingViewModel()
    @State private var submitSuccessTrigger = false
    @State private var isConverterExpanded = false
    @State private var saveCurrencyTask: Task<Void, Never>?
    @State private var saveSelectorToggleTask: Task<Void, Never>?

    var body: some View {
        if featureFlagsStore.isMultiCurrencyEnabled {
            Section {
                currencyPicker
                currencySelectorToggle
                converterDisclosure
            } header: {
                Text("DEVISE")
                    .font(PulpeTypography.labelLarge)
            }
            .listRowBackground(Color.surfaceContainerHigh)
            .sensoryFeedback(.success, trigger: submitSuccessTrigger)
            .onChange(of: userSettingsStore.currency) { _, newValue in
                viewModel.syncCurrency(newValue)
                if isConverterExpanded {
                    viewModel.reloadRate()
                }
            }
            .onChange(of: isConverterExpanded) { _, expanded in
                if expanded {
                    viewModel.reloadRate()
                } else {
                    converterFocus.wrappedValue = nil
                }
            }
            .task {
                viewModel.syncCurrency(userSettingsStore.currency)
            }
        }
    }

    // MARK: - Currency Picker

    private var currencyPicker: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("On l'utilise pour afficher tous tes montants.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
                .fixedSize(horizontal: false, vertical: true)

            CapsulePicker(
                selection: Binding(
                    get: { viewModel.selectedCurrency },
                    set: { newValue in
                        guard newValue != viewModel.selectedCurrency else { return }
                        viewModel.selectedCurrency = newValue
                        viewModel.applyConverterBase(newValue)
                        if isConverterExpanded {
                            viewModel.reloadRate()
                        }
                        saveCurrencyTask?.cancel()
                        saveCurrencyTask = Task(name: "CurrencySetting.saveCurrency") {
                            await persistCurrencyChange()
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
        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
    }

    // MARK: - Currency Selector Toggle

    private var currencySelectorToggle: some View {
        Toggle(isOn: Binding(
            get: { userSettingsStore.showCurrencySelector },
            set: { newValue in
                saveSelectorToggleTask?.cancel()
                saveSelectorToggleTask = Task(name: "CurrencySetting.saveSelectorToggle") {
                    await persistSelectorToggle(newValue)
                }
            }
        )) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Saisir dans une autre devise")
                    .font(PulpeTypography.listRowTitle)
                Text(
                    "Un sélecteur de devise apparaît à côté du montant. "
                        + "Pulpe convertit au cours du jour."
                )
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Color.pulpePrimary)
        .accessibilityLabel("Saisir dans une autre devise")
        .accessibilityHint(
            "Active pour pouvoir entrer une dépense en EUR ou CHF, peu importe ta devise principale."
        )
    }

    // MARK: - Persistence

    private func persistCurrencyChange() async {
        await viewModel.save(using: userSettingsStore)
        guard !Task.isCancelled else { return }
        if userSettingsStore.error == nil {
            submitSuccessTrigger.toggle()
            appState.toastManager.show("Devise enregistrée", type: .success)
            announceForVoiceOver("Devise enregistrée")
            // Reload widget timelines so they stop rendering the previous currency.
            await WidgetDataSyncService.shared.syncAll(
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                currency: userSettingsStore.currency
            )
        } else {
            appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
            announceForVoiceOver("Erreur lors de la sauvegarde")
        }
    }

    private func persistSelectorToggle(_ newValue: Bool) async {
        await userSettingsStore.updateShowCurrencySelector(newValue)
        guard !Task.isCancelled else { return }
        if userSettingsStore.error == nil {
            submitSuccessTrigger.toggle()
            appState.toastManager.show("Préférence enregistrée", type: .success)
            announceForVoiceOver("Préférence enregistrée")
        } else {
            appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
            announceForVoiceOver("Erreur lors de la sauvegarde")
        }
    }

    private func announceForVoiceOver(_ message: String) {
        #if canImport(UIKit)
        UIAccessibility.post(notification: .announcement, argument: message)
        #endif
    }

    // MARK: - Converter

    private var converterDisclosure: some View {
        DisclosureGroup(isExpanded: $isConverterExpanded) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text(
                    "« Depuis » reprend la devise du compte ; « Vers » affiche l’équivalent calculé."
                )
                .font(PulpeTypography.caption2)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

                converterInputRow
                    .animation(
                        reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                        value: viewModel.sourceCurrency
                    )

                converterOutputRow
                    .animation(
                        reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
                        value: viewModel.targetCurrency
                    )

                rateFooter
            }
            .padding(.top, DesignTokens.Spacing.xs)
        } label: {
            Label {
                Text("Convertisseur")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)
            } icon: {
                Image(systemName: "arrow.left.arrow.right.circle")
                    .foregroundStyle(Color.onSurfaceVariant)
                    .symbolEffect(.pulse, options: .repeating.speed(0.35), isActive: viewModel.isLoadingRate)
                    .accessibilityHidden(true)
            }
        }
        .tint(Color.pulpePrimary)
    }

    private var converterInputRow: some View {
        converterValueRow(
            ConverterValueRowModel(
                title: "Depuis",
                caption: nil,
                currency: viewModel.sourceCurrency,
                isOutput: false,
                inputAccessibilityLabel: "Depuis \(viewModel.sourceCurrency.nativeName)"
            )
        ) {
            TextField("0", text: $viewModel.converterInput)
                .keyboardType(.decimalPad)
                .focused(converterFocus, equals: .input)
                .font(PulpeTypography.title3.weight(.semibold))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .tint(Color.pulpePrimary)
        }
    }

    private var converterOutputRow: some View {
        converterValueRow(
            ConverterValueRowModel(
                title: "Vers",
                caption: String(localized: "Calcul automatique"),
                currency: viewModel.targetCurrency,
                isOutput: true,
                inputAccessibilityLabel: nil
            )
        ) {
            Text(viewModel.convertedAmount)
                .font(PulpeTypography.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .contentTransition(.numericText())
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    @ViewBuilder
    private func converterValueRow<Content: View>(
        _ model: ConverterValueRowModel,
        @ViewBuilder valueContent: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(model.title)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                if let caption = model.caption {
                    Text(caption)
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.textTertiary)
                }
            }

            HStack(spacing: DesignTokens.Spacing.md) {
                valueContent()
                Text(model.currency.compactLabel)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .padding(DesignTokens.Spacing.md)
            .background(Color.surfaceContainerLow, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm))
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                    .strokeBorder(Color.onSurfaceVariant.opacity(0.22), lineWidth: DesignTokens.BorderWidth.thin)
            }
        }
        .modifier(
            ConverterRowAccessibilityModifier(
                isOutput: model.isOutput,
                inputCombinedLabel: model.inputAccessibilityLabel,
                outputCurrencyName: model.currency.nativeName,
                amountDescription: model.isOutput ? viewModel.convertedAmount : nil
            )
        )
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
                        "Impossible de récupérer le cours du jour. "
                            + "Tes montants déjà enregistrés restent intacts."
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

// MARK: - Accessibility

private struct ConverterRowAccessibilityModifier: ViewModifier {
    let isOutput: Bool
    let inputCombinedLabel: String?
    let outputCurrencyName: String
    let amountDescription: String?

    @ViewBuilder
    func body(content: Content) -> some View {
        if isOutput {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(String(localized: "Équivalent \(outputCurrencyName)"))
                .accessibilityValue(amountDescription ?? "—")
                .accessibilityHint(String(localized: "Montant calculé automatiquement, non modifiable."))
        } else {
            content
                .accessibilityElement(children: .combine)
                .accessibilityLabel(inputCombinedLabel ?? "")
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
    /// Ne déclenche pas de réseau : la vue appelle `reloadRate()` lorsque le panneau convertisseur est ouvert.
    func applyConverterBase(_ currency: SupportedCurrency) {
        let newTarget: SupportedCurrency = currency == .chf ? .eur : .chf
        // Idempotent: avoid a redundant `loadRate()` round-trip + UI flicker when the picker
        // selection and the optimistic store update fire `applyConverterBase` back-to-back.
        guard sourceCurrency != currency || targetCurrency != newTarget else { return }
        sourceCurrency = currency
        targetCurrency = newTarget
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
