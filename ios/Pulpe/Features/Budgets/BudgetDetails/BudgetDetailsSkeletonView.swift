import SwiftUI

/// Skeleton placeholder rendered while `BudgetDetailsView` waits for its first payload.
/// Mirrors the loaded layout region by region so the loading→loaded transition keeps the
/// same anchors: hero zone (figure → three tiles → progress → verdict), then the content
/// zone with the filter rail and the grouped sections.
struct BudgetDetailsSkeletonView: View {
    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(spacing: DesignTokens.Spacing.none) {
                    filterRailSkeleton
                    ForEach(0..<3, id: \.self) { _ in sectionSkeleton }
                    Color.clear.frame(height: DesignTokens.Spacing.lg)
                }
                .padding(.top, DesignTokens.Spacing.lg)
                .contentZone()
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }

    // MARK: - Hero

    /// Same slots and order as `BudgetDetailHero.heroContent`. No rollover line: it is
    /// conditional once loaded, so a placeholder would promise a row that rarely arrives.
    private var heroZone: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.extraLongTextWidth,
                    height: DesignTokens.Skeleton.displayHeight,
                    cornerRadius: DesignTokens.CornerRadius.sm
                )
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonShape(
                        height: DesignTokens.Skeleton.heroTileHeight,
                        cornerRadius: DesignTokens.CornerRadius.card
                    )
                }
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.heroHeight,
                    cornerRadius: DesignTokens.ProgressBar.heroHeight / 2
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.bodyHeight
                )
            }

            SkeletonShape(
                width: DesignTokens.Skeleton.longTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
        // Placeholders on the hero surface: the canvas tint would vanish into it.
        .environment(\.skeletonTint, Color.heroTile)
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .heroZone()
    }

    // MARK: - Filter rail

    /// A horizontal rail like the loaded one: the chips run past the edge and are cut
    /// there, instead of widening the column they sit in.
    private var filterRailSkeleton: some View {
        ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                chipSkeleton(width: DesignTokens.Skeleton.mediumTextWidth)
                ForEach(0..<4, id: \.self) { _ in
                    chipSkeleton(width: DesignTokens.Skeleton.compactTextWidth)
                }
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
            .padding(.horizontal, DesignTokens.Spacing.xxl)
        }
        .scrollDisabled(true)
        .scrollIndicators(.hidden)
        // The rail sits inside the zone's top curve, like the loaded one.
        .padding(.top, DesignTokens.Spacing.lg)
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: DesignTokens.CornerRadius.zone,
                topTrailingRadius: DesignTokens.CornerRadius.zone,
                style: .continuous
            )
        )
        .padding(.top, -DesignTokens.Spacing.lg)
    }

    /// A `PulpeChip` at `.standard` size: label line plus the chip's own padding.
    private func chipSkeleton(width: CGFloat) -> some View {
        SkeletonShape(
            width: width + DesignTokens.ChipMetrics.Standard.horizontalPadding * 2,
            height: DesignTokens.Skeleton.lineHeight
                + DesignTokens.ChipMetrics.Standard.verticalPadding * 2,
            cornerRadius: .infinity
        )
    }

    // MARK: - Section + rows

    /// One `BudgetMixedSection`: header over a single grouped card of divider-separated rows.
    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.sectionHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(0..<3, id: \.self) { index in
                    if index > 0 {
                        Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                    }
                    rowSkeleton
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeRowCard()
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.xxl)
    }

    /// Mirrors `BudgetLineMixedRow`: leading disc rail, name over metadata, amount opposite.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            SkeletonCircle(size: DesignTokens.IconSize.badge)
                .frame(width: DesignTokens.TapTarget.minimum)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            SkeletonShape(
                width: DesignTokens.Skeleton.shortTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }
}
