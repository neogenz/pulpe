import Foundation

/// An AI assistant the user allowed to reach their budget through the MCP connector.
struct MCPConnection: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let clientName: String
    let mode: MCPAccessMode
    let authorizedAt: Date
}

/// What the user granted at consent time. Never widened afterwards.
enum MCPAccessMode: String, Codable, Sendable {
    case read
    case readWrite = "read_write"

    var label: String {
        switch self {
        case .read: AppLocale.string("Lecture seule")
        case .readWrite: AppLocale.string("Lecture et écriture")
        }
    }
}

/// One write gesture of an agent: the tool it called, never what it wrote.
/// The server sends no amount and no label, so nothing here can leak one.
struct MCPActivity: Codable, Sendable, Identifiable, Equatable {
    let tool: String
    let outcome: Outcome
    let createdAt: Date

    enum Outcome: String, Codable, Sendable {
        case ok
        case error
    }

    var id: String { "\(tool)-\(createdAt.timeIntervalSince1970)" }
}
