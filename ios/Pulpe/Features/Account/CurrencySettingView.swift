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
            .onAppear {
                viewModel.syncCurrency(userSettingsStore.currency)
            }
        }
    }

    // MARK: - Currency Picker

    private var currencyPicker: some View {
        Picker("Devise", selection: Binding(
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
        )) {
            ForEach(SupportedCurrency.allCases) { currency in
                Text(currency.rawValue).tag(currency)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Converter

    @ViewBuilder
    private var converterSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                TextField("Montant", text: $viewModel.converterInput)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)

                Text(viewModel.sourceCurrency.rawValue)
                    .foregroundStyle(.secondary)

                Button {
                    viewModel.swapCurrencies()
                } label: {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.body.weight(.medium))
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
                .tint(.pulpePrimary)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
                .accessibilityLabel("Inverser les devises")

                Text(viewModel.convertedAmount)
                    .font(PulpeTypography.labelLarge)
                    .monospacedDigit()
                    .frame(minWidth: 80, alignment: .trailing)

                Text(viewModel.targetCurrency.rawValue)
                    .foregroundStyle(.secondary)
            }

            if let rateInfo = viewModel.rateInfo {
                Text(rateInfo)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }
        }
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
