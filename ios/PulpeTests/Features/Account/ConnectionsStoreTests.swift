import Foundation
@testable import Pulpe
import Testing

@Suite("ConnectionsStore")
@MainActor
struct ConnectionsStoreTests {
    @Test
    func load_withConnections_exposesThemWithTheirMode() async {
        let store = ConnectionsStore(service: StubMCPConnectionsService(connections: [Self.chatgpt]))

        await store.load()

        #expect(!store.isLoading)
        #expect(store.error == nil)
        #expect(store.connections == [Self.chatgpt])
        #expect(store.connections.first?.mode == .readWrite)
    }

    @Test
    func load_withNoConnection_isEmptyWithoutError() async {
        let store = ConnectionsStore(service: StubMCPConnectionsService(connections: []))

        await store.load()

        #expect(store.connections.isEmpty)
        #expect(store.error == nil)
    }

    @Test
    func load_whenOffline_reportsErrorRatherThanLookingEmpty() async {
        let store = ConnectionsStore(
            service: StubMCPConnectionsService(connections: [Self.chatgpt], failuresBeforeSuccess: 1)
        )

        await store.load()

        #expect(store.error != nil)
        #expect(store.connections.isEmpty)
    }

    @Test
    func revoke_reloadsFromTheServer() async throws {
        let service = StubMCPConnectionsService(connections: [Self.chatgpt])
        let store = ConnectionsStore(service: service)
        await store.load()

        await service.setConnections([])
        try await store.revoke(connectionId: Self.chatgpt.id)

        let revoked = await service.revoked
        let listCalls = await service.listCallCount
        #expect(revoked == [Self.chatgpt.id])
        #expect(listCalls == 2)
        #expect(store.connections.isEmpty)
    }

    @Test
    func revoke_whenTheCutFails_throwsAndKeepsTheConnection() async {
        let service = StubMCPConnectionsService(connections: [Self.chatgpt], revocationFails: true)
        let store = ConnectionsStore(service: service)
        await store.load()

        await #expect(throws: (any Error).self) {
            try await store.revoke(connectionId: Self.chatgpt.id)
        }

        let listCalls = await service.listCallCount
        #expect(listCalls == 1)
        #expect(store.connections == [Self.chatgpt])
    }

    private static let chatgpt = MCPConnection(
        id: "11111111-1111-4111-8111-111111111111",
        clientName: "ChatGPT",
        mode: .readWrite,
        authorizedAt: Date(timeIntervalSince1970: 0)
    )
}

private actor StubMCPConnectionsService: MCPConnectionsServicing {
    private var connections: [MCPConnection]
    private let failuresBeforeSuccess: Int
    private let revocationFails: Bool
    private(set) var listCallCount = 0
    private(set) var revoked: [String] = []

    init(connections: [MCPConnection], failuresBeforeSuccess: Int = 0, revocationFails: Bool = false) {
        self.connections = connections
        self.failuresBeforeSuccess = failuresBeforeSuccess
        self.revocationFails = revocationFails
    }

    func setConnections(_ connections: [MCPConnection]) {
        self.connections = connections
    }

    func getAll() async throws -> [MCPConnection] {
        listCallCount += 1
        if listCallCount <= failuresBeforeSuccess {
            throw URLError(.notConnectedToInternet)
        }
        return connections
    }

    func getActivity(connectionId: String, limit: Int) async throws -> [MCPActivity] {
        []
    }

    func revoke(connectionId: String) async throws {
        if revocationFails {
            throw URLError(.badServerResponse)
        }
        revoked.append(connectionId)
    }
}
