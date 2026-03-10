import Foundation

/// User preferences returned by GET /users/settings
struct UserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: String?
    let showCurrencySelector: Bool?
}

/// Request body for PUT /users/settings
struct UpdateUserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: String?

    init(payDayOfMonth: Int? = nil, currency: String? = nil) {
        self.payDayOfMonth = payDayOfMonth
        self.currency = currency
    }
}
