import SwiftUI
import WidgetKit

struct CurrentMonthWidgetView: View {
    var entry: CurrentMonthEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.redactionReasons) private var redactionReasons

    /// Sous redaction `.privacy` (device verrouillé), le `Text` visuel est expurgé
    /// mais un `accessibilityLabel` explicite ne l'est pas forcément — VoiceOver
    /// ne doit pas prononcer le solde à travers l'écran de verrouillage.
    private var spokenAvailable: String? {
        redactionReasons.contains(.privacy) ? nil : entry.available.asCurrency(entry.currency)
    }

    var body: some View {
        content
            .containerBackground(.background, for: .widget)
            .widgetURL(deepLink)
    }

    /// Tap destination for the whole widget. Accessory (Lock Screen) families are a
    /// single tap target — `Link` only works in system families — so routing must go
    /// through `.widgetURL`. Opens the current budget when known, else add-expense.
    private var deepLink: URL {
        if let id = entry.budgetId { return DeepLinks.budget(id: id) }
        return DeepLinks.addExpense
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemSmall:
            dataGated(smallWidgetView)
        case .systemMedium:
            dataGated(mediumWidgetView)
        case .accessoryRectangular:
            accessoryRectangularView
        case .accessoryCircular:
            accessoryCircularView
        case .accessoryInline:
            accessoryInlineView
        default:
            dataGated(smallWidgetView)
        }
    }

    /// System (Home Screen) families share the "no data → open app" empty state.
    /// Accessory families render their own compact empty copy inline.
    @ViewBuilder
    private func dataGated(_ view: some View) -> some View {
        if entry.hasData { view } else { emptyView }
    }

    private var smallWidgetView: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text("Disponible")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textSecondary)

            Text(entry.available.asCompactCurrency(entry.currency))
                .font(PulpeTypography.amountXL)
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(entry.available >= 0 ? Color.pulpePrimary : Color.financialOverBudget)
                .privacySensitive()

            Text(entry.monthName)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)

            Spacer()

            Link(destination: DeepLinks.addExpense) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: DesignTokens.IconSize.badge))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .accessibilityLabel("Ajouter une dépense")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Budget \(entry.monthName)")
        .accessibilityValue("\(entry.available.asCurrency(entry.currency)) disponible")
    }

    private var mediumWidgetView: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Disponible à dépenser")
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(Color.textSecondary)

                Text(entry.available.asCompactCurrency(entry.currency))
                    .font(PulpeTypography.amountLarge)
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .foregroundStyle(entry.available >= 0 ? Color.pulpePrimary : Color.financialOverBudget)
                    .privacySensitive()

                Text(entry.monthName)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Budget \(entry.monthName)")
            .accessibilityValue("\(entry.available.asCurrency(entry.currency)) disponible à dépenser")

            Spacer()

            Link(destination: DeepLinks.addExpense) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: DesignTokens.IconSize.widgetAction))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .accessibilityLabel("Ajouter une dépense")
        }
        .padding(DesignTokens.Spacing.lg)
    }

    // MARK: - Lock Screen accessory families
    //
    // Accessory widgets render in the Lock Screen's monochrome, vibrant style: the
    // system flattens custom foreground colors, so these views lean on
    // `.widgetAccentable()` + semantic system fonts rather than the app's color /
    // typography tokens (which only read correctly on Home Screen families). The
    // amount stays `.privacySensitive()` so it redacts when the device is locked —
    // it must not sit in the clear on a lock screen for a finance app.

    private var accessoryRectangularView: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Disponible")
                .font(.caption2)
                .widgetAccentable()
            if entry.hasData {
                Text(entry.available.asCompactCurrency(entry.currency))
                    .font(.headline)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .privacySensitive()
                Text(entry.monthName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Text("Ouvre Pulpe")
                    .font(.caption)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rectangularAccessibilityLabel)
    }

    private var rectangularAccessibilityLabel: String {
        guard entry.hasData else { return "Pulpe, ouvre l'app" }
        guard let amount = spokenAvailable else { return "Disponible à dépenser, \(entry.monthName)" }
        return "Disponible à dépenser \(amount), \(entry.monthName)"
    }

    private var accessoryCircularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Text("dispo")
                    .font(.caption2)
                    .widgetAccentable()
                if entry.hasData {
                    Text(entry.available.asCompactAmount(for: entry.currency))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                        .privacySensitive()
                } else {
                    Image(systemName: "banknote")
                        .font(.caption)
                }
            }
            .padding(2)
        }
        .accessibilityLabel(circularAccessibilityLabel)
    }

    private var circularAccessibilityLabel: String {
        guard entry.hasData else { return "Pulpe" }
        guard let amount = spokenAvailable else { return "Disponible" }
        return "Disponible \(amount)"
    }

    private var accessoryInlineView: some View {
        // Inline renders as one line above the clock; the system styles font + color
        // and provides the leading icon slot. Content is text + one SF Symbol only.
        Label {
            if entry.hasData {
                Text("\(entry.available.asCompactCurrency(entry.currency)) dispo")
                    .privacySensitive()
            } else {
                Text("Ouvre Pulpe")
            }
        } icon: {
            Image(systemName: "banknote")
        }
    }

    private var emptyView: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Brand mark, not an SF Symbol: the empty state is the widget's only
            // branded surface (imageset duplicated into the appex catalog — the
            // app's Resources aren't compiled into this target).
            Image("PulpeIcon")
                .resizable()
                .scaledToFit()
                .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                .accessibilityHidden(true)

            Text("Ouvre Pulpe")
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.textSecondary)

            Text("Ton disponible s'affichera ici")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
