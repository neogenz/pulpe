import SwiftUI

/// One plain-language sentence under the hero, optionally ending in a named drill-in.
/// The sentence is always `heroInk`; the accent lands on the link alone, and only when the
/// verdict is not "on plan" — the surface never carries the state.
struct HeroVerdictRow: View {
    let sentence: String
    var linkTitle: String?
    var accent: Color = .heroInk
    var action: (() -> Void)?
    var accessibilityLabel: String?
    var accessibilityIdentifier: String?

    var body: some View {
        if let linkTitle, let action {
            Button(action: action) {
                text(linkTitle: linkTitle)
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .contentShape(Rectangle())
            .textLinkButtonStyle()
            .accessibilityLabel(accessibilityLabel ?? "\(sentence) \(linkTitle)")
            .accessibilityIdentifier(accessibilityIdentifier ?? "")
        } else {
            text(linkTitle: nil)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier(accessibilityIdentifier ?? "")
        }
    }

    private func text(linkTitle: String?) -> some View {
        let run = Text(verbatim: linkTitle == nil ? sentence : "\(sentence) ")
            .foregroundStyle(Color.heroInk)
            .font(PulpeTypography.body)
        guard let linkTitle else { return run.multilineTextAlignment(.leading) }
        let link = Text(verbatim: "\(linkTitle) ")
            .foregroundStyle(accent)
            .font(PulpeTypography.listRowTitle.weight(.bold))
            + Text(Image(systemName: "chevron.right"))
            .foregroundStyle(accent)
            .font(PulpeTypography.metricLabel)
        return (run + link).multilineTextAlignment(.leading)
    }
}
