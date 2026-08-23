import Foundation

/// Protocol for agent connection API operations — enables store testing with mock doubles.
protocol MCPConnectionsServicing: Sendable {
    func getAll() async throws -> [MCPConnection]
    func getActivity(connectionId: String, limit: Int) async throws -> [MCPActivity]
    func revoke(connectionId: String) async throws
}

/// Service for the agent connections a user granted (GET, journal, revocation).
actor MCPConnectionsService: MCPConnectionsServicing {
    static let shared = MCPConnectionsService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    /// Fetch the still-active connections (GET /mcp/connections)
    func getAll() async throws -> [MCPConnection] {
        try await apiClient.request(.mcpConnections, method: .get)
    }

    /// Fetch the newest write gestures of one connection (GET /mcp/connections/:id/activity)
    func getActivity(connectionId: String, limit: Int) async throws -> [MCPActivity] {
        try await apiClient.request(
            .mcpConnectionActivity(id: connectionId, limit: limit),
            method: .get
        )
    }

    /// Cut the access for good (DELETE /mcp/connections/:id)
    func revoke(connectionId: String) async throws {
        try await apiClient.requestVoid(.mcpConnection(id: connectionId), method: .delete)
    }
}
