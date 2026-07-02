import Foundation
import SwiftUI

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
        let converted = inputValue * rate.rate
        return converted.asCurrency(targetCurrency)
    }

    var rateInfo: String? {
        guard let rate else { return nil }
        // PUL-114: rate is Decimal end-to-end. Format via Decimal.formatted to
        // preserve precision (no Double bridge through %.4f).
        let rateText = rate.rate.formatted(
            .number.precision(.fractionLength(4)).locale(Formatters.locale(for: rate.base))
        )
        return "1 \(rate.base.rawValue) = \(rateText) \(rate.target.rawValue) (\(rate.date))"
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
