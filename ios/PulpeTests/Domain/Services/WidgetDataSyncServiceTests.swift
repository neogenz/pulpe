import Foundation
@testable import Pulpe
import Testing

@Suite("WidgetDataSyncService — settings resolution")
struct WidgetDataSyncServiceTests {
    @Test func resolveSettings_bothNil_usesInjectedUserSettingsService() async {
        // Arrange — mock returns EUR + payDay 15 so we can distinguish from defaults.
        let mockService = MockUserSettingsService(
            stubbedGetSettings: UserSettings(
                payDayOfMonth: 15,
                currency: .eur,
                showCurrencySelector: false,
                locale: nil
            )
        )
        let sut = WidgetDataSyncService(userSettingsService: mockService)

        // Act
        let resolved = await sut.resolveSettings(payDayOfMonth: nil, currency: nil)

        // Assert — the injected mock was called, and its stubbed payDay + currency propagated.
        #expect(resolved.payDayOfMonth == 15)
        #expect(resolved.currency == .eur)
        #expect(await mockService.getSettingsCallCount == 1)
    }

    @Test func resolveSettings_payDayNil_currencyExplicit_fetchesPayDayFromSettings() async {
        // Arrange — settings supply the missing payDay; explicit currency still wins.
        let mockService = MockUserSettingsService(
            stubbedGetSettings: UserSettings(
                payDayOfMonth: 25,
                currency: .eur,
                showCurrencySelector: false,
                locale: nil
            )
        )
        let sut = WidgetDataSyncService(userSettingsService: mockService)

        // Act
        let resolved = await sut.resolveSettings(payDayOfMonth: nil, currency: .chf)

        // Assert
        #expect(resolved.payDayOfMonth == 25)
        #expect(resolved.currency == .chf)
        #expect(await mockService.getSettingsCallCount == 1)
    }

    @Test func resolveSettings_bothExplicit_skipsUserSettingsFetch() async {
        // Arrange
        let mockService = MockUserSettingsService()
        let sut = WidgetDataSyncService(userSettingsService: mockService)

        // Act
        let resolved = await sut.resolveSettings(payDayOfMonth: 5, currency: .eur)

        // Assert — caller-provided values short-circuit the settings fetch entirely.
        #expect(resolved.payDayOfMonth == 5)
        #expect(resolved.currency == .eur)
        #expect(await mockService.getSettingsCallCount == 0)
    }
}
