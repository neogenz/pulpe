import Foundation

/// The interface language, and the one place that turns it into a `Locale`.
///
/// Lives in `Shared/` rather than `Core/` because `Formatters` depends on it and the
/// widget target compiles `Shared/`, not `Core/`.
enum AppLocale {
    private enum Key {
        static let locale = "pulpe-app-locale"
    }

    /// The app group, so the widget process renders in the language chosen in the app.
    /// It has no `UserSettingsStore` and no network of its own.
    nonisolated(unsafe) private static let defaults =
        UserDefaults(suiteName: WidgetDataCoordinator.appGroupId) ?? .standard

    /// The last language the user confirmed. Readable before the settings request
    /// answers, which is what lets a cold start paint in the right language.
    /// Falls back to French for a fresh install and for any value this binary does
    /// not ship — a server that learns a fifth language must not crash an old client.
    static var current: SupportedLocale {
        SupportedLocale(rawValue: defaults.string(forKey: Key.locale) ?? "") ?? .fallback
    }

    static func persist(_ locale: SupportedLocale) {
        defaults.set(locale.rawValue, forKey: Key.locale)
    }

    static func clearPersisted() {
        defaults.removeObject(forKey: Key.locale)
    }

    /// Composes the language onto the current locale instead of building an identifier
    /// from it, so the region and any `@rg=` override survive the switch: a user on
    /// `en_US@rg=chzzzz` who picks German lands on `de_US@rg=chzzzz` and keeps the Swiss
    /// calendar and measurement conventions they had asked for.
    static func uiLocale(
        for locale: SupportedLocale,
        basedOn current: Locale = .autoupdatingCurrent
    ) -> Locale {
        var components = Locale.Components(locale: current)
        components.languageComponents.languageCode = Locale.LanguageCode(locale.rawValue)
        return Locale(components: components)
    }

    static var currentUILocale: Locale {
        uiLocale(for: current)
    }

    /// Resolves a catalog key outside the SwiftUI tree — notifications, widget timeline
    /// entries, `.navigationTitle`.
    ///
    /// Trap: `String(localized: "…", locale: x)` does **not** change the lookup language.
    /// It only formats the interpolations, so the code compiles, runs, and returns
    /// French. Setting `locale` on the *resource* is the only thing that switches the
    /// language, and it is the documented way.
    static func string(_ key: String.LocalizationValue, locale: Locale = currentUILocale) -> String {
        var resource = LocalizedStringResource(key)
        resource.locale = locale
        return String(localized: resource)
    }
}
