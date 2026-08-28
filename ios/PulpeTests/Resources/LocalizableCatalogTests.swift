import Foundation
import Testing

/// Every translation of a key carries the format specifiers of its source string.
/// `%@` where the caller passes an `Int` is a SIGSEGV inside `String(localized:)`,
/// and nothing else checks it: the catalog compiles either way, and only the
/// device language that hits the bad row crashes (build 10, English, the PIN pad).
@Suite("Localizable catalog")
struct LocalizableCatalogTests {
    struct Mismatch: CustomStringConvertible, Equatable {
        let key: String
        let locale: String
        let found: [String]
        let expected: [String]

        var description: String { "\(key) [\(locale)]: \(found) expected \(expected)" }
    }

    /// Specifier types of a format string, sorted, positional prefixes dropped:
    /// `%1$lld` and `%lld` fill the same slot. `%%` is a literal percent sign.
    static func specifiers(_ format: String) -> [String] {
        format
            .replacingOccurrences(of: "%%", with: "")
            .matches(of: /%(?:\d+\$)?(lld|ld|d|@|f|s|u)/)
            .map { String($0.1) }
            .sorted()
    }

    /// Every localized value whose specifiers differ from the key's. Plural and
    /// device variations are checked one by one; a locale using substitutions is
    /// checked through its variations, with `%arg` standing for the substituted
    /// argument's own specifier.
    static func mismatches(in catalog: Data) throws -> [Mismatch] {
        let root = try JSONSerialization.jsonObject(with: catalog) as? [String: Any]
        let strings = root?["strings"] as? [String: Any] ?? [:]
        var result: [Mismatch] = []
        for (key, entry) in strings {
            let expected = specifiers(key)
            let localizations = (entry as? [String: Any])?["localizations"] as? [String: Any] ?? [:]
            for (locale, localization) in localizations {
                guard let localization = localization as? [String: Any] else { continue }
                for value in formats(of: localization) {
                    let found = specifiers(value)
                    if found != expected {
                        result.append(Mismatch(key: key, locale: locale, found: found, expected: expected))
                    }
                }
            }
        }
        return result.sorted { ($0.key, $0.locale) < ($1.key, $1.locale) }
    }

    private static func formats(of localization: [String: Any]) -> [String] {
        if let substitutions = localization["substitutions"] as? [String: Any] {
            return substitutions.values.flatMap { substitution -> [String] in
                guard let substitution = substitution as? [String: Any],
                      let specifier = substitution["formatSpecifier"] as? String else { return [] }
                return values(under: substitution).map { $0.replacingOccurrences(of: "%arg", with: "%\(specifier)") }
            }
        }
        return values(under: localization)
    }

    /// Every `stringUnit.value` below a node, whatever the variation nesting.
    private static func values(under node: [String: Any]) -> [String] {
        if let unit = node["stringUnit"] as? [String: Any], let value = unit["value"] as? String {
            return [value]
        }
        return node.values.compactMap { $0 as? [String: Any] }.flatMap(values(under:))
    }

    // MARK: - Pure comparison

    @Test func specifiers_ignorePositionsAndLiteralPercents() {
        #expect(Self.specifiers("%1$lld chiffres sur %2$lld saisis") == ["lld", "lld"])
        #expect(Self.specifiers("%lld sur %lld") == ["lld", "lld"])
        #expect(Self.specifiers("100%% de %@") == ["@"])
        #expect(Self.specifiers("Aucun spécificateur").isEmpty)
    }

    @Test func mismatches_reportTheTranslationWhoseSlotChangedType() throws {
        let catalog = """
        {"sourceLanguage":"fr","strings":{
          "Carte %lld sur %lld":{"localizations":{
            "en":{"stringUnit":{"state":"translated","value":"Card %@ of %@"}},
            "de":{"stringUnit":{"state":"translated","value":"Karte %1$lld von %2$lld"}}}},
          "%lld jours":{"localizations":{
            "it":{"variations":{"plural":{
              "one":{"stringUnit":{"state":"translated","value":"%lld giorno"}},
              "other":{"stringUnit":{"state":"translated","value":"%lld giorni"}}}}}}}}}
        """
        let found = try Self.mismatches(in: Data(catalog.utf8))

        let expected = Mismatch(key: "Carte %lld sur %lld", locale: "en", found: ["@", "@"], expected: ["lld", "lld"])
        #expect(found == [expected])
    }

    @Test func mismatches_checkSubstitutionVariationsWithTheirArgument() throws {
        let catalog = """
        {"sourceLanguage":"fr","strings":{
          "%lld chiffres sur %lld saisis":{"localizations":{
            "it":{"stringUnit":{"state":"translated","value":"%#@digits@"},
                  "substitutions":{"digits":{"argNum":1,"formatSpecifier":"lld","variations":{"plural":{
                    "one":{"stringUnit":{"state":"translated","value":"%arg cifra su %2$lld inserita"}},
                    "other":{"stringUnit":{"state":"translated","value":"%arg cifre su %2$@ inserite"}}}}}}}}}}}
        """
        let found = try Self.mismatches(in: Data(catalog.utf8))

        #expect(found.map(\.found) == [["@", "lld"]])
    }

    // MARK: - The shipped catalog

    @Test func shippedCatalog_hasNoSpecifierMismatch() throws {
        let catalog = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Resources
            .deletingLastPathComponent() // PulpeTests
            .deletingLastPathComponent() // ios
            .appendingPathComponent("Pulpe/Resources/Localizable.xcstrings")
        let found = try Self.mismatches(in: Data(contentsOf: catalog))

        #expect(found.isEmpty, Comment(rawValue: found.map(\.description).joined(separator: "\n")))
    }
}
