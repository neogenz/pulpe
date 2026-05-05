import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("PulpeAuthStorage", .enabled(if: KeychainManager.checkAvailability()))
struct PulpeAuthStorageTests {
    /// Use a unique test service so we never collide with the live SDK key
    /// (`supabase.auth.token`) under `app.pulpe.ios`.
    private static let testService = "app.pulpe.ios.tests.PulpeAuthStorage"

    private func makeStorage() -> PulpeAuthStorage {
        PulpeAuthStorage(service: Self.testService)
    }

    private func uniqueKey() -> String {
        "test-\(UUID().uuidString)"
    }

    @Test func store_thenRetrieve_returnsSameData() throws {
        let storage = makeStorage()
        let key = uniqueKey()
        let value = Data("session-payload".utf8)

        defer { try? storage.remove(key: key) }
        try storage.store(key: key, value: value)

        let retrieved = try storage.retrieve(key: key)
        #expect(retrieved == value)
    }

    @Test func retrieve_missingKey_returnsNil() throws {
        let storage = makeStorage()
        let key = uniqueKey()

        let retrieved = try storage.retrieve(key: key)
        #expect(retrieved == nil)
    }

    @Test func store_overwrites_previousValue() throws {
        let storage = makeStorage()
        let key = uniqueKey()
        let first = Data("first".utf8)
        let second = Data("second".utf8)

        defer { try? storage.remove(key: key) }
        try storage.store(key: key, value: first)
        try storage.store(key: key, value: second)

        let retrieved = try storage.retrieve(key: key)
        #expect(retrieved == second)
    }

    @Test func remove_deletesEntry_subsequentRetrieveIsNil() throws {
        let storage = makeStorage()
        let key = uniqueKey()
        try storage.store(key: key, value: Data("payload".utf8))

        try storage.remove(key: key)

        #expect(try storage.retrieve(key: key) == nil)
    }

    @Test func remove_missingKey_doesNotThrow() throws {
        let storage = makeStorage()
        let key = uniqueKey()

        try storage.remove(key: key)
    }

    @Test func protocolConformance_acceptsAsAuthLocalStorage() {
        let storage: any AuthLocalStorage = makeStorage()
        #expect(storage is PulpeAuthStorage)
    }

    @Test func storesArbitraryBinaryData_notJustUTF8() throws {
        let storage = makeStorage()
        let key = uniqueKey()
        let binary = Data([0x00, 0xFF, 0x10, 0x80, 0x7F])

        defer { try? storage.remove(key: key) }
        try storage.store(key: key, value: binary)

        let retrieved = try storage.retrieve(key: key)
        #expect(retrieved == binary)
    }
}
