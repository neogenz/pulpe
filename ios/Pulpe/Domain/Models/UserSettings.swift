import Foundation

/// User preferences returned by GET /users/settings
struct UserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?
    let checkingEnabled: Bool?
}

/// Request body for PUT /users/settings
struct UpdateUserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?
    let checkingEnabled: Bool?

    init(
        payDayOfMonth: Int? = nil,
        currency: SupportedCurrency? = nil,
        showCurrencySelector: Bool? = nil,
        checkingEnabled: Bool? = nil
    ) {
        self.payDayOfMonth = payDayOfMonth
        self.currency = currency
        self.showCurrencySelector = showCurrencySelector
        self.checkingEnabled = checkingEnabled
    }
}
