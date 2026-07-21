import Foundation

struct Tag: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let createdAt: Date
    let updatedAt: Date
}
