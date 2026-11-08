import SwiftUI

/// « Répartition aujourd'hui »: what I have, by asset and category, set against what I owe and
/// my net worth. Every width comes from the API figures (`NetWorthSankey`); a negative net
/// reads in the warning ink with the « Il manque » node, never in red.
struct NetWorthBreakdownCard: View {
    let graph: NetWorthSankey.Graph
    let totals: NetWorthTotals

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var currency: SupportedCurrency { totals.baseCurrency }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Répartition aujourd'hui")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(graph.hasShortfall ? "De ce que j'ai à ce que je dois" : "De ce que j'ai à ma fortune nette")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                GeometryReader { proxy in
                    diagram(width: max(proxy.size.width, DesignTokens.Chart.sankeyMinWidth))
                }
                .frame(minWidth: DesignTokens.Chart.sankeyMinWidth)
                .frame(height: DesignTokens.Chart.sankeyHeight)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(summary)
            if sizeClass == .compact {
                Text(graph.hasShortfall
                    ? "Fais glisser pour voir jusqu'à ce que tu dois"
                    : "Fais glisser pour voir jusqu'à ta fortune nette")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .accessibilityIdentifier("netWorthBreakdown")
    }

    private func diagram(width: CGFloat) -> some View {
        // Headroom above the nodes for the labels of the middle column.
        let headroom = DesignTokens.Chart.sankeyLabelHeadroom
        let size = CGSize(width: width, height: DesignTokens.Chart.sankeyHeight - headroom)
        let result = NetWorthSankeyLayout.layout(graph, in: size)
        return ZStack(alignment: .topLeading) {
            Canvas { context, _ in
                for band in result.bands {
                    context.fill(
                        band.path,
                        with: .color(color(band.targetKind.isDebtSide ? band.targetKind : band.sourceKind)
                            .opacity(DesignTokens.Chart.sankeyBandOpacity))
                    )
                }
                for node in result.nodes {
                    context.fill(Path(node.rect), with: .color(color(node.kind)))
                }
            }
            ForEach(result.nodes, id: \.id) { node in
                label(node, lastColumn: result.columnCount - 1)
            }
        }
        .frame(width: width, height: size.height)
        .padding(.top, headroom)
    }

    @ViewBuilder
    private func label(_ frame: NetWorthSankeyLayout.NodeFrame, lastColumn: Int) -> some View {
        let node = graph.nodes[frame.id]
        let labelWidth = DesignTokens.Chart.sankeyLabelWidth - DesignTokens.Spacing.sm
        let onLeft = frame.column == 0
        let isMiddle = !onLeft && frame.column < lastColumn
        let gap = DesignTokens.Spacing.xs
        let alignment: HorizontalAlignment = onLeft ? .trailing : (isMiddle ? .center : .leading)
        let text = VStack(alignment: alignment, spacing: DesignTokens.Spacing.none) {
            Text(title(of: frame.kind, name: node?.name))
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textPrimary)
            Text((node?.value ?? 0).asCompactCurrency(currency))
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()
        }
        .lineLimit(1)
        .minimumScaleFactor(DesignTokens.TextScale.floor)
        if isMiddle {
            // Bands run on both sides of a middle node: its label sits in the gap above it, on a pill.
            let pill = frame.labelRect ?? .zero
            text
                .padding(.horizontal, DesignTokens.Spacing.xs)
                .frame(width: pill.width, height: pill.height)
                .background(Color.surfaceContainerLowest, in: .capsule)
                .position(x: pill.midX, y: pill.midY)
        } else {
            text
                .frame(width: labelWidth, alignment: onLeft ? .trailing : .leading)
                .position(
                    x: onLeft ? frame.rect.minX - gap - labelWidth / 2 : frame.rect.maxX + gap + labelWidth / 2,
                    y: frame.rect.midY
                )
        }
    }

    private func title(of kind: NetWorthSankey.Kind, name: String?) -> String {
        switch kind {
        case .gross: AppLocale.string("Ce que j'ai")
        case .net: AppLocale.string("Fortune nette")
        case .shortfall: AppLocale.string("Il manque")
        case .asset, .category, .debt: name ?? ""
        }
    }

    private func color(_ kind: NetWorthSankey.Kind) -> Color {
        switch kind {
        case .asset, .category, .gross: Color.pulpePrimary
        case .net: Color.financialIncome
        case .debt, .shortfall: Color.financialOverBudget
        }
    }

    /// A Canvas is invisible to VoiceOver: one sentence carries the figures the API computed.
    private var summary: String {
        guard !amountsHidden else { return AppLocale.string("Répartition aujourd'hui") }
        let gross = totals.gross.asCompactCurrency(currency)
        let debts = totals.debts.asCompactCurrency(currency)
        if graph.hasShortfall {
            return AppLocale.string("Ce que j'ai, \(gross), face à \(debts) dus.")
        }
        let net = totals.net.asCompactCurrency(currency)
        // swiftlint:disable:next line_length
        return AppLocale.string("Répartition de ce que j'ai : fortune brute \(gross), partagée entre \(debts) dus et \(net) de fortune nette.")
    }
}

private extension NetWorthSankey.Kind {
    var isDebtSide: Bool { self == .debt || self == .net || self == .shortfall }
}
