import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
struct CurrencyConversionServiceTests {
    private let baseURL: URL

    init() {
        self.baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")
    }

    // MARK: - Decimal rounding

    @Test
    func convert_roundsConvertedAmountToTwoDecimals() async throws {
        // Arrange: rate 0.93 triggers IEEE 754 noise unless we round explicitly.
        // Raw multiply: Decimal(100) * Decimal(Double(0.93)) = 92.99999999999999...
        InterceptingURLProtocol.requestHandler = Self.rateHandler(rate: 0.93)
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT()

        // Act
        let conversion = try await sut.convert(amount: 100, from: .eur, to: .chf)

        // Assert
        let result = try #require(conversion)
        #expect(result.convertedAmount == Decimal(string: "93.00"))
        // RG-009: exchange rate is frozen as-is, never rounded
        #expect(result.exchangeRate == Decimal(0.93))
        #expect(result.originalAmount == 100)
        #expect(result.originalCurrency == .eur)
        #expect(result.targetCurrency == .chf)
    }

    // MARK: - Stale cache fallback

    @Test
    func getRate_whenFetchFailsAndCacheIsStale_returnsStaleCachedRate() async throws {
        // Arrange: cacheDuration = 0 so the next call is always "expired".
        // First call seeds the cache with rate 0.95.
        InterceptingURLProtocol.requestHandler = Self.rateHandler(rate: 0.95)
        let sut = makeSUT(cacheDuration: 0)
        _ = try await sut.getRate(base: .eur, target: .chf)

        // Second call: API throws, cache is "expired" but present -> must fall back.
        InterceptingURLProtocol.requestHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        // Act
        let staleRate = try await sut.getRate(base: .eur, target: .chf)

        // Assert: PUL-99 fallback — never block the user when API fails + cache exists
        #expect(staleRate.rate == 0.95)
        #expect(staleRate.base == .eur)
        #expect(staleRate.target == .chf)
    }

    @Test
    func getRate_whenFetchFailsWithNoCache_throws() async {
        // Arrange: no prior successful call, so cache is empty.
        InterceptingURLProtocol.requestHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let sut = makeSUT()

        // Act + Assert: with no cached rate, the error must propagate.
        await #expect(throws: (any Error).self) {
            _ = try await sut.getRate(base: .eur, target: .chf)
        }
    }

    // MARK: - Helpers

    private func makeSUT(cacheDuration: TimeInterval = 86400) -> CurrencyConversionService {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)

        let apiClient = APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: { "test-token" },
            clientKeyProvider: { nil }
        )

        return CurrencyConversionService(apiClient: apiClient, cacheDuration: cacheDuration)
    }

    private static func rateHandler(
        rate: Double
    ) -> @Sendable (URLRequest) throws -> (HTTPURLResponse, Data) {
        { request in
            let json = """
            {"success":true,"data":{"base":"EUR","target":"CHF","rate":\(rate),"date":"2026-04-19"}}
            """
            let body = Data(json.utf8)
            return (makeHTTPResponse(for: request, statusCode: 200), body)
        }
    }
}
