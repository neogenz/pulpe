import SwiftUI

struct CurrencySettingView: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @State private var viewModel = CurrencySettingViewModel()

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
                    viewModel.selectedCurrency = newValue
                    Task {
                        await viewModel.save(using: userSettingsStore)
                        if userSettingsStore.error == nil {
                            appState.toastManager.show("Devise enregistrée", type: .success)
                        } else {
                            appState.toastManager.show("Erreur lors de la sauvegarde", type: .error)
                        }
                    }
                }
            ),
            title: "Devise"
        ) { currency in
            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(currency.flag)
                VStack(alignment: .leading, spacing: 0) {
                    Text(currency.rawValue).font(PulpeTypography.labelLarge)
                    Text(currency.nativeName).font(PulpeTypography.caption2).foregroundStyle(Color.onSurfaceVariant)
                }
            }
        }
    }

    // MARK: - Converter

    @ViewBuilder
    private var converterSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Header
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "arrow.left.arrow.right.circle")
                    .foregroundStyle(Color.onSurfaceVariant)
                Text("Convertisseur")
                    .font(PulpeTypography.cardTitle)
            }

            // Input row
            HStack {
                TextField("0", text: $viewModel.converterInput)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                Text(viewModel.sourceCurrency.compactLabel)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }

            // Swap button
            Button { viewModel.swapCurrencies() } label: {
                HStack { Spacer(); Image(systemName: "arrow.up.arrow.down"); Spacer() }
                    .padding(.vertical, DesignTokens.Spacing.sm)
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .accessibilityLabel("Inverser les devises")

            // Result card
            HStack {
                Text(viewModel.convertedAmount)
                    .font(PulpeTypography.title3.weight(.semibold))
                    .monospacedDigit()
                Spacer()
                Text(viewModel.targetCurrency.compactLabel)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .padding(DesignTokens.Spacing.md)
            .background(Color.surfaceContainerLow)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm))

            if let rateInfo = viewModel.rateInfo {
                Text(rateInfo)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.surfaceContainerHigh)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
        .task { await viewModel.loadRate() }
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

    var convertedAmount: String {
        guard let rate,
              let inputValue = Decimal(string: converterInput.replacingOccurrences(of: ",", with: ".")) else {
            return "-"
        }
        let converted = inputValue * Decimal(rate.rate)
        return converted.asCurrency(targetCurrency)
    }

    var rateInfo: String? {
        guard let rate else { return nil }
        return "1 \(rate.base.rawValue) = \(String(format: "%.4f", rate.rate)) \(rate.target.rawValue) (\(rate.date))"
    }

    func syncCurrency(_ currency: SupportedCurrency) {
        selectedCurrency = currency
    }

    func save(using store: UserSettingsStore) async {
        await store.updateCurrency(selectedCurrency)
    }

    func swapCurrencies() {
        let temp = sourceCurrency
        sourceCurrency = targetCurrency
        targetCurrency = temp
        Task { await loadRate() }
    }

    func loadRate() async {
        guard sourceCurrency != targetCurrency else {
            rate = nil
            return
        }
        isLoadingRate = true
        defer { isLoadingRate = false }

        do {
            rate = try await CurrencyConversionService.shared.getRate(
                base: sourceCurrency,
                target: targetCurrency
            )
        } catch {
            rate = nil
        }
    }
}

#Preview {
    List {
        CurrencySettingView()
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .background(Color.surface)
    .environment(AppState())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
