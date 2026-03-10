import Foundation

struct CurrencyRate: Codable, Sendable {
    let base: String
    let target: String
    let rate: Double
    let date: String
}

actor CurrencyConversionService {
    static let shared = CurrencyConversionService()

    private let apiClient: APIClient
    private var cachedRate: CurrencyRate?
    private var cacheTime: Date?
    private static let cacheDuration: TimeInterval = 86400 // 24h

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getRate(base: String, target: String) async throws -> CurrencyRate {
        if let cached = cachedRate,
           cached.base == base,
           cached.target == target,
           let cacheTime,
           Date().timeIntervalSince(cacheTime) < Self.cacheDuration {
            return cached
        }

        let rate: CurrencyRate = try await apiClient.request(.currencyRate(base: base, target: target))
        cachedRate = rate
        cacheTime = Date()
        return rate
    }

    /// Converts an amount and returns the converted amount with metadata.
    /// If `inputCurrency == baseCurrency`, returns nil (no conversion needed).
    func convert(
        amount: Decimal,
        from inputCurrency: String,
        to baseCurrency: String
    ) async throws -> CurrencyConversion? {
        guard inputCurrency != baseCurrency else { return nil }

        let rate = try await getRate(base: inputCurrency, target: baseCurrency)
        let convertedAmount = amount * Decimal(rate.rate)
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
    let originalCurrency: String
    let targetCurrency: String
    let exchangeRate: Decimal
}
