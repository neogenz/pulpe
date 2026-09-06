import Foundation

/// The agents branched on this account: who is connected, what they did, and
/// the cut. Kept separate from the views because the detail screen revokes and
/// the list screen has to reflect it.
@Observable @MainActor
final class ConnectionsStore {
    private(set) var connections: [MCPConnection] = []
    private(set) var isLoading = true
    private(set) var error: Error?

    private let service: any MCPConnectionsServicing

    init(service: any MCPConnectionsServicing = MCPConnectionsService.shared) {
        self.service = service
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            connections = try await service.getAll()
        } catch is CancellationError {
            return
        } catch {
            // An empty list means "no agent has access". A failure must never
            // borrow that face, or a network blip reads as a reassurance.
            connections = []
            self.error = error
        }
    }

    func activity(for connectionId: String, limit: Int = 50) async throws -> [MCPActivity] {
        try await service.getActivity(connectionId: connectionId, limit: limit)
    }

    /// Cuts the access, then reloads: the server list is the only truth about
    /// who is still connected. Throws so a failed cut can never look like one.
    func revoke(connectionId: String) async throws {
        try await service.revoke(connectionId: connectionId)
        await load()
    }
}
