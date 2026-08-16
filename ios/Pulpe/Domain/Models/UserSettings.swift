import Foundation

/// User preferences returned by GET /users/settings
struct UserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?
    let locale: SupportedLocale?
}

extension UserSettings {
    /// Hand-written so an unknown language degrades instead of failing the whole payload.
    /// The web app can ship a fifth language before this binary does; a strict enum decode
    /// would then turn every settings fetch into an error on an app already installed.
    /// Declared in an extension to keep the memberwise initializer.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        payDayOfMonth = try container.decodeIfPresent(Int.self, forKey: .payDayOfMonth)
        currency = try container.decodeIfPresent(SupportedCurrency.self, forKey: .currency)
        showCurrencySelector = try container.decodeIfPresent(Bool.self, forKey: .showCurrencySelector)
        locale = try? container.decodeIfPresent(SupportedLocale.self, forKey: .locale)
    }
}

/// Request body for PUT /users/settings
struct UpdateUserSettings: Codable, Sendable {
    let payDayOfMonth: Int?
    let currency: SupportedCurrency?
    let showCurrencySelector: Bool?
    let locale: SupportedLocale?

    /// Every field defaults to `nil` so the synthesized `Encodable` omits the keys the
    /// caller did not set — that is what keeps a PUT from resetting the preferences it
    /// was not asked to touch.
    init(
        payDayOfMonth: Int? = nil,
        currency: SupportedCurrency? = nil,
        showCurrencySelector: Bool? = nil,
        locale: SupportedLocale? = nil
    ) {
        self.payDayOfMonth = payDayOfMonth
        self.currency = currency
        self.showCurrencySelector = showCurrencySelector
        self.locale = locale
    }
}
