import Foundation

/// User preferences returned by GET /users/settings
struct UserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?
}

/// Request body for PUT /users/settings
struct UpdateUserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?

    init(payDayOfMonth: Int? = nil, currency: SupportedCurrency? = nil, showCurrencySelector: Bool? = nil) {
        self.payDayOfMonth = payDayOfMonth
        self.currency = currency
        self.showCurrencySelector = showCurrencySelector
    }
}
