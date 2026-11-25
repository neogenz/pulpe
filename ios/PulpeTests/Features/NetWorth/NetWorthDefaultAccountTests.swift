import Foundation
import Testing

@testable import Pulpe

/// The default account as « Mon patrimoine » and the preferences show it (PUL-378, phase 8).
/// Amounts follow the contract's jeu d'essai.
@Suite("Default account in Mon patrimoine")
@MainActor
struct NetWorthDefaultAccountTests {
    private static let checking = TestDataFactory.makeAsset(
        id: "checking", name: "Compte courant", latestValue: 5000
    )
    private static let revolut = TestDataFactory.makeAsset(id: "revolut", name: "Revolut", latestValue: 400)
    private static let leasing = TestDataFactory.makeAsset(
        id: "leasing", name: "Leasing", direction: .owe, latestValue: 8000
    )

    private static func store(
        service: MockUserSettingsService = MockUserSettingsService()
    ) -> UserSettingsStore {
        UserSettingsStore(service: service)
    }

    // MARK: - CA47: the badge and the menu

    @Test("CA47: only the default element carries the badge")
    func ca47_badge() {
        #expect(NetWorthDefaultAccount.isDefault(Self.checking, defaultId: "checking"))
        #expect(!NetWorthDefaultAccount.isDefault(Self.revolut, defaultId: "checking"))
        #expect(!NetWorthDefaultAccount.isDefault(Self.revolut, defaultId: nil))
    }

    @Test("CA47: the menu offers « Utiliser par défaut dans le budget », reversed on the default")
    func ca47_menuTitle() {
        #expect(NetWorthDefaultAccount.menuTitle(isDefault: false) == "Utiliser par défaut dans le budget")
        #expect(NetWorthDefaultAccount.menuTitle(isDefault: true) == "Ne plus utiliser par défaut")
    }

    @Test("CA47: choosing Revolut moves the setting off Compte courant, choosing the default clears it")
    func ca47_toggle() {
        #expect(NetWorthDefaultAccount.settingAfterToggle(of: Self.revolut, current: "checking") == "revolut")
        #expect(NetWorthDefaultAccount.settingAfterToggle(of: Self.checking, current: "checking") == nil)
        #expect(NetWorthDefaultAccount.settingAfterToggle(of: Self.leasing, current: nil) == "leasing")
    }

    @Test("CA47: the badge follows the setting, and the preferences read the same element")
    func ca47_followsSetting() async {
        let service = MockUserSettingsService()
        await service.setStubbedUpdateSettings(UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "revolut"
        ))
        let settings = Self.store(service: service)
        await settings.setDefaultAccount("revolut")
        #expect(NetWorthDefaultAccount.isDefault(Self.revolut, defaultId: settings.defaultAccountId))
        #expect(!NetWorthDefaultAccount.isDefault(Self.checking, defaultId: settings.defaultAccountId))
    }

    @Test("The menu entry is offered on an active element only, and only with the flag on")
    func menuEntry_activeOnly() {
        let archived = TestDataFactory.makeAsset(id: "old", archivedAt: TestDataFactory.fixedDate)
        #expect(NetWorthDefaultAccount.offersMenuEntry(for: Self.checking, flagEnabled: true))
        #expect(NetWorthDefaultAccount.offersMenuEntry(for: Self.leasing, flagEnabled: true))
        #expect(!NetWorthDefaultAccount.offersMenuEntry(for: archived, flagEnabled: true))
        #expect(!NetWorthDefaultAccount.offersMenuEntry(for: Self.checking, flagEnabled: false))
        #expect(!NetWorthDefaultAccount.isDefault(archived, defaultId: "old"))
    }

    // MARK: - CA28: absent without the flag or an active element

    @Test("CA28: the preference row is absent with the flag off or no active element")
    func ca28_absent() async {
        let empty = AssetStore(service: MockAssetService())
        #expect(!AccountPickerField.isShown(flagEnabled: true, store: empty))

        let service = MockAssetService()
        service.stubbedNetWorth = TestDataFactory.makeNetWorth(assets: [Self.checking])
        let loaded = AssetStore(service: service)
        await loaded.forceRefresh()
        #expect(AccountPickerField.isShown(flagEnabled: true, store: loaded))
        #expect(!AccountPickerField.isShown(flagEnabled: false, store: loaded))
    }

    // MARK: - CA28, CA34: the setting

    @Test("CA28: the setting is written, then read back, as the server holds it")
    func setting_writeThenRead() async {
        let service = MockUserSettingsService(stubbedGetSettings: UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "savings"
        ))
        let settings = Self.store(service: service)
        #expect(settings.defaultAccountId == nil)
        await settings.forceRefresh()
        #expect(settings.defaultAccountId == "savings")
    }

    @Test("CA28, CA34: choosing Livret then « Aucun » sends the id, then an explicit null")
    func ca34_removeSendsNull() async throws {
        let service = MockUserSettingsService()
        let settings = Self.store(service: service)

        await service.setStubbedUpdateSettings(UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "savings"
        ))
        await settings.setDefaultAccount("savings")
        #expect(settings.defaultAccountId == "savings")
        let first = try #require(await service.lastUpdatePayload)
        #expect(first.defaultAccountId == .some("savings"))

        await service.setStubbedUpdateSettings(UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil
        ))
        await settings.setDefaultAccount(nil)
        #expect(settings.defaultAccountId == nil)
        let second = try #require(await service.lastUpdatePayload)
        #expect(second.defaultAccountId == .some(nil))
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(second)) as? [String: Any]
        #expect(body?["defaultAccountId"] is NSNull)
        #expect(body?["currency"] == nil)
    }

    @Test("Another preference never touches the default account")
    func otherUpdatesOmitIt() async throws {
        let payload = UpdateUserSettings(currency: .eur)
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]
        #expect(body?["defaultAccountId"] == nil)
    }

    @Test("A refused write puts the previous default account back")
    func refusedWriteRollsBack() async {
        let service = MockUserSettingsService(stubbedGetSettings: UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "checking"
        ))
        let settings = Self.store(service: service)
        await settings.forceRefresh()
        await service.setUpdateError(APIError.serverError(message: "boom"))
        await settings.setDefaultAccount("revolut")
        #expect(settings.defaultAccountId == "checking")
        #expect(settings.error != nil)
    }

    // MARK: - CA35: the default element archived or deleted

    @Test("CA35: archiving the default element reads as « Aucun » once settings are reloaded")
    func ca35_archivedDefault() async {
        let service = MockUserSettingsService(stubbedGetSettings: UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "checking"
        ))
        let settings = Self.store(service: service)
        await settings.forceRefresh()
        #expect(settings.defaultAccountId == "checking")

        // The server cleared the setting when the element was archived.
        await service.setStubbedGetSettings(UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil
        ))
        await settings.forceRefresh()
        #expect(settings.defaultAccountId == nil)
    }

    @Test("CA35: until then, an archived or deleted default is never offered")
    func ca35_staleDefaultIsInactive() async {
        let service = MockAssetService()
        service.stubbedNetWorth = TestDataFactory.makeNetWorth(assets: [
            TestDataFactory.makeAsset(id: "checking", archivedAt: TestDataFactory.fixedDate),
            Self.revolut
        ])
        let store = AssetStore(service: service)
        await store.forceRefresh()
        #expect(store.activeAssetId("checking") == nil)
        #expect(store.activeAssetId("gone") == nil)
        #expect(store.activeAssetId("revolut") == "revolut")
        #expect(store.activeAssetId(nil) == nil)
    }

    @Test("Signing out forgets the default account")
    func resetForgetsIt() async {
        let service = MockUserSettingsService(stubbedGetSettings: UserSettings(
            payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil,
            defaultAccountId: "checking"
        ))
        let settings = Self.store(service: service)
        await settings.forceRefresh()
        settings.reset()
        #expect(settings.defaultAccountId == nil)
    }

    @Test("A settings payload decodes with and without defaultAccountId")
    func decoding() throws {
        let with = try JSONDecoder().decode(UserSettings.self, from: Data(#"{"defaultAccountId":"checking"}"#.utf8))
        #expect(with.defaultAccountId == "checking")
        let nulled = try JSONDecoder().decode(UserSettings.self, from: Data(#"{"defaultAccountId":null}"#.utf8))
        #expect(nulled.defaultAccountId == nil)
        let without = try JSONDecoder().decode(UserSettings.self, from: Data(#"{"currency":"CHF"}"#.utf8))
        #expect(without.defaultAccountId == nil)
    }
}
