import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// The language section of Préférences.
///
/// A `Menu`, not a `CapsulePicker`: that component lays every entry out in one
/// `.frame(maxWidth: .infinity)` row, which holds for two currencies and does not hold
/// for four languages on an iPhone SE.
struct LanguageSettingView: View {
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.openURL) private var openURL
    @State private var saveTask: Task<Void, Never>?

    var body: some View {
        Section {
            languagePicker
            systemLanguageLink
        } header: {
            Text("LANGUE")
                .font(PulpeTypography.labelLarge)
        } footer: {
            Text("""
                Les invites d'iOS — Face ID, photos, partage — suivent la langue du système, \
                pas celle-ci. Les régler redémarre Pulpe.
                """)
        }
        .listRowSettingsBackground()
    }

    // MARK: - Language Picker

    private var languagePicker: some View {
        Menu {
            Picker("Langue de l'app", selection: languageBinding) {
                ForEach(SupportedLocale.allCases) { locale in
                    // Verbatim: "Deutsch" is a name, not a key to translate.
                    Text(verbatim: locale.nativeName).tag(locale)
                }
            }
        } label: {
            ViewThatFits(in: .horizontal) {
                HStack {
                    Text("Langue de l'app")
                    Spacer(minLength: DesignTokens.Spacing.md)
                    selectedLanguage
                }

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Langue de l'app")
                    selectedLanguage
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .accessibilityIdentifier("languageSettingPicker")
        .accessibilityLabel("Langue de l'app")
        .accessibilityValue(Text(verbatim: userSettingsStore.locale.nativeName))
        .accessibilityHint("Ouvre le choix de la langue de l'app")
    }

    private var selectedLanguage: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(verbatim: userSettingsStore.locale.nativeName)
            Image(systemName: "chevron.down")
                .font(PulpeTypography.caption)
                .accessibilityHidden(true)
        }
        .foregroundStyle(Color.onSurfaceVariant)
    }

    private var languageBinding: Binding<SupportedLocale> {
        Binding(
            get: { userSettingsStore.locale },
            set: { newValue in
                let previous = userSettingsStore.locale
                guard newValue != previous else { return }
                saveTask?.cancel()
                saveTask = Task(name: "LanguageSetting.save") {
                    await userSettingsStore.updateLocale(newValue)
                    // After the round trip, so a rejected change is not reported as one.
                    guard userSettingsStore.locale == newValue else { return }
                    AnalyticsService.shared.capture(
                        .languageChanged,
                        properties: ["from": previous.rawValue, "to": newValue.rawValue, "surface": "settings"]
                    )
                }
            }
        )
    }

    // MARK: - System Language

    private var systemLanguageLink: some View {
        Button {
            #if canImport(UIKit)
            guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
            openURL(url)
            #endif
        } label: {
            HStack {
                Text("Langue du système")
                Spacer()
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .accessibilityIdentifier("systemLanguageLink")
        .accessibilityHint("Ouvre les réglages de langue d'iOS")
    }
}
