import Foundation
import OSLog

struct CurrencyRate: Codable, Sendable {
    let base: SupportedCurrency
    let target: SupportedCurrency
    let rate: Double
    let date: String
}

actor CurrencyConversionService {
    static let shared = CurrencyConversionService()

    private let apiClient: APIClient
    private var cachedRates: [String: CurrencyRate] = [:]
    private var cacheTimes: [String: Date] = [:]
    private let cacheDuration: TimeInterval

    init(apiClient: APIClient = .shared, cacheDuration: TimeInterval = 86400) {
        self.apiClient = apiClient
        self.cacheDuration = cacheDuration
    }

    func getRate(base: SupportedCurrency, target: SupportedCurrency) async throws -> CurrencyRate {
        let cacheKey = "\(base.rawValue)-\(target.rawValue)"
        let cached = cachedRates[cacheKey]

        if let cached,
           let cacheTime = cacheTimes[cacheKey],
           Date().timeIntervalSince(cacheTime) < cacheDuration {
            return cached
        }

        do {
            let rate: CurrencyRate = try await apiClient.request(.currencyRate(base: base, target: target))
            cachedRates[cacheKey] = rate
            cacheTimes[cacheKey] = Date()
            return rate
        } catch {
            // PUL-99 fallback: API OK -> cache stale -> never block user input.
            // When the fetch fails but we still have an (expired) cached rate,
            // return it instead of propagating the error.
            if let cached {
                let pair = "\(base.rawValue)->\(target.rawValue)"
                Logger.network.warning(
                    "CurrencyConversionService: fetch failed, returning stale cached rate (\(pair))"
                )
                return cached
            }
            throw error
        }
    }

    /// Converts an amount and returns the converted amount with metadata.
    /// If `inputCurrency == baseCurrency`, returns nil (no conversion needed).
    func convert(
        amount: Decimal,
        from inputCurrency: SupportedCurrency,
        to baseCurrency: SupportedCurrency
    ) async throws -> CurrencyConversion? {
        guard inputCurrency != baseCurrency else { return nil }

        let rate = try await getRate(base: inputCurrency, target: baseCurrency)
        // PUL-99: the converted amount is what gets encrypted and persisted.
        // Round to 2 decimals to kill IEEE 754 noise and stay aligned with
        // the webapp (`.toFixed(2)` in currency-converter.service.ts).
        // The exchange rate itself is NOT rounded — RG-009 freezes it as-is.
        let convertedAmount = (amount * Decimal(rate.rate)).rounded(2, .plain)
        return CurrencyConversion(
            convertedAmount: convertedAmount,
            originalAmount: amount,
            originalCurrency: inputCurrency,
            targetCurrency: baseCurrency,
            exchangeRate: Decimal(rate.rate)
        )
    }
}

/// Result of a currency conversion, carrying metadata for API calls
struct CurrencyConversion: Sendable {
    let convertedAmount: Decimal
    let originalAmount: Decimal
    let originalCurrency: SupportedCurrency
    let targetCurrency: SupportedCurrency
    let exchangeRate: Decimal
}
