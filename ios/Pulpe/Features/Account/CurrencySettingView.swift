import SwiftUI

struct CurrencySettingView: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel = CurrencySettingViewModel()

    var body: some View {
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
            Text("CHF").tag("CHF")
            Text("EUR").tag("EUR")
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

                Text(viewModel.sourceCurrency)
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

                Text(viewModel.convertedAmount)
                    .font(PulpeTypography.labelLarge)
                    .monospacedDigit()
                    .frame(minWidth: 80, alignment: .trailing)

                Text(viewModel.targetCurrency)
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
    var selectedCurrency = "CHF"
    var converterInput = ""
    var sourceCurrency = "CHF"
    var targetCurrency = "EUR"

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
        return "1 \(rate.base) = \(String(format: "%.4f", rate.rate)) \(rate.target) (\(rate.date))"
    }

    func syncCurrency(_ currency: String) {
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
}
