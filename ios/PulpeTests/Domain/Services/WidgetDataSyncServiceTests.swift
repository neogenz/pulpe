import Foundation
@testable import Pulpe
import Testing

@Suite("WidgetDataSyncService — currency resolution")
struct WidgetDataSyncServiceTests {
    @Test func resolveCurrency_nil_usesInjectedUserSettingsService() async {
        // Arrange — mock returns EUR so we can distinguish it from the `.chf` default fallback.
        let mockService = MockUserSettingsService(
            stubbedGetSettings: UserSettings(
                payDayOfMonth: 15,
                currency: .eur,
                showCurrencySelector: false
            )
        )
        let sut = WidgetDataSyncService(userSettingsService: mockService)

        // Act
        let resolved = await sut.resolveCurrency(nil)

        // Assert — the injected mock was called, and its stubbed currency propagated.
        #expect(resolved == .eur)
        #expect(await mockService.getSettingsCallCount == 1)
    }

    @Test func resolveCurrency_explicit_skipsUserSettingsFetch() async {
        // Arrange
        let mockService = MockUserSettingsService()
        let sut = WidgetDataSyncService(userSettingsService: mockService)

        // Act
        let resolved = await sut.resolveCurrency(.eur)

        // Assert — caller-provided currency short-circuits the settings fetch entirely.
        #expect(resolved == .eur)
        #expect(await mockService.getSettingsCallCount == 0)
    }
}
