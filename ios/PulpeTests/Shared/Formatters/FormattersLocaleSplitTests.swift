import Foundation
@testable import Pulpe
import Testing

/// The one invariant this whole feature rests on: money is punctuated by the currency,
/// dates are spelled by the language. Wiring either to the other axis is invisible while
/// the app is French-only, and breaks Swiss amounts the day someone picks Italian.
@Suite("Formatters — language / currency split")
struct FormattersLocaleSplitTests {
    private static let march5 = DateComponents(
        calendar: Calendar(identifier: .gregorian), year: 2026, month: 3, day: 5
    ).date

    private static let august1 = DateComponents(
        calendar: Calendar(identifier: .gregorian), year: 2026, month: 8, day: 1
    ).date

    // MARK: - Money follows the currency

    @Test func moneyLocale_isPinnedToTheCurrency() {
        #expect(Formatters.locale(for: .chf).identifier == "fr_CH")
        #expect(Formatters.locale(for: .eur).identifier == "fr_FR")
    }

    /// Measured on it_CH: the grouping separator disappears. Deriving the money locale
    /// from the interface language would drop the Swiss apostrophe on that language alone.
    @Test func swissAmount_keepsItsApostropheWhateverTheLanguage() {
        let rendered = Decimal(1234.5).asCurrency(.chf)

        #expect(rendered.contains(Formatters.swissGroupingSeparator))
        #expect(rendered.contains("CHF"))
    }

    @Test(arguments: SupportedLocale.allCases)
    func currencyFormatter_neverFollowsTheInterfaceLanguage(_ language: SupportedLocale) {
        let uiLocale = AppLocale.uiLocale(for: language)

        let formatter = Formatters.currencyFormatter(for: .chf)

        #expect(formatter.locale.identifier == "fr_CH")
        #expect(formatter.locale.identifier != uiLocale.identifier || language == .fr)
    }

    // MARK: - Dates follow the language

    @Test(arguments: [
        (SupportedLocale.fr, "mars"),
        (.en, "march"),
        (.de, "märz"),
        (.it, "marzo"),
    ])
    func monthName_followsTheLanguage(language: SupportedLocale, expected: String) throws {
        let date = try #require(Self.march5)

        let rendered = Formatters.dateFormatter("MMMM", in: language).string(from: date)

        #expect(rendered.lowercased() == expected)
    }

    /// The cache is keyed on template **and** language. Keyed on the template alone it
    /// would serve the first language asked for, for the rest of the session.
    @Test func dateFormatterCache_doesNotServeAStaleLanguage() throws {
        let date = try #require(Self.march5)

        let first = Formatters.dateFormatter("MMMM", in: .de).string(from: date)
        let second = Formatters.dateFormatter("MMMM", in: .it).string(from: date)
        let third = Formatters.dateFormatter("MMMM", in: .de).string(from: date)

        #expect(first.lowercased() == "märz")
        #expect(second.lowercased() == "marzo")
        #expect(third == first)
    }

    // MARK: - The first of the month is grammar, not locale data

    @Test func dayMonthLabel_french_declinesTheFirst() throws {
        let date = try #require(Self.august1)

        #expect(Formatters.dayMonthLabel(for: date, in: .fr).hasPrefix("1er "))
    }

    @Test func dayMonthLabel_italian_declinesTheFirst() throws {
        let date = try #require(Self.august1)

        #expect(Formatters.dayMonthLabel(for: date, in: .it).hasPrefix("1º "))
    }

    /// German gets its ordinal dot from the date template itself, English writes the plain
    /// number in running text — neither needs the special case French and Italian need.
    @Test func dayMonthLabel_germanAndEnglish_useTheirOwnDateForm() throws {
        let date = try #require(Self.august1)

        let german = Formatters.dayMonthLabel(for: date, in: .de)
        let english = Formatters.dayMonthLabel(for: date, in: .en)

        #expect(german.contains("1.") && german.contains("August"))
        #expect(english.contains("1") && english.contains("August"))
    }

    @Test func dayMonthLabel_otherDays_areNotDeclined() throws {
        let date = try #require(Self.march5)

        let french = Formatters.dayMonthLabel(for: date, in: .fr)

        #expect(french.contains("5"))
        #expect(!french.contains("er"))
    }

    // MARK: - Month subtitles are copy, resolved from the catalog

    @Test func monthSubtitle_resolvesInTheRequestedLanguage() {
        let french = Formatters.monthSubtitle(for: 1, isPositive: true, locale: Locale(identifier: "fr"))
        let german = Formatters.monthSubtitle(for: 1, isPositive: true, locale: Locale(identifier: "de"))

        #expect(french == "Nouveau départ, nouvelles ambitions")
        #expect(german == "Neuer Start, neue Ziele")
    }

    @Test func monthSubtitle_outOfRangeMonth_isEmpty() {
        #expect(Formatters.monthSubtitle(for: 0, isPositive: true).isEmpty)
        #expect(Formatters.monthSubtitle(for: 13, isPositive: false).isEmpty)
    }

    // MARK: - Chart axis: the abbreviation is a word, the digits are money

    /// CLDR abbreviates thousands per language — and not at all in German, which spells
    /// the full number with the Swiss apostrophe when the currency is CHF.
    ///
    /// Italian carries no literal here on purpose: CLDR moved Italian thousands between
    /// unabbreviated and "K" across ICU releases, so an expected string would assert the
    /// runner's ICU version rather than Pulpe's behavior. `compactAxisLabel_rendersInEveryLanguage`
    /// covers it with the property that does hold everywhere.
    @Test(arguments: [
        (SupportedLocale.fr, "15 k"),
        (.en, "15K"),
        (.de, "15’000"),
    ])
    func compactAxisLabel_abbreviationFollowsTheLanguage(language: SupportedLocale, expected: String) {
        // ICU separates "15" from "k" with a no-break space whose exact code point varies
        // by OS release — normalize every space variant before comparing.
        let rendered = Formatters.compactAxisLabel(15000, currency: .chf, language: language)
            .replacingOccurrences(of: "\u{202F}", with: " ")
            .replacingOccurrences(of: "\u{00A0}", with: " ")

        #expect(rendered == expected)
    }

    /// Whatever CLDR decides to abbreviate per language, the label always carries the value.
    @Test func compactAxisLabel_rendersInEveryLanguage() {
        for language in SupportedLocale.allCases {
            let rendered = Formatters.compactAxisLabel(15000, currency: .chf, language: language)

            #expect(rendered.hasPrefix("15"))
        }
    }

    /// EUR digits stay French-punctuated even when the language is English.
    @Test func compactAxisLabel_digitsFollowTheCurrency() {
        #expect(Formatters.compactAxisLabel(1500, currency: .eur, language: .en) == "1,5K")
        #expect(Formatters.compactAxisLabel(1500, currency: .chf, language: .en) == "1.5K")
    }

    @Test func compactAxisLabel_keepsSignAndPlainSmallValues() {
        #expect(Formatters.compactAxisLabel(-15000, currency: .chf, language: .en) == "-15K")
        #expect(Formatters.compactAxisLabel(800, currency: .chf, language: .de) == "800")
    }
}
