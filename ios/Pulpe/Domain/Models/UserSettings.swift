import Foundation

/// User preferences returned by GET /users/settings
struct UserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
}

/// Request body for PUT /users/settings
struct UpdateUserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
}
