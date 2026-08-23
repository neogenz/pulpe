import SwiftUI

/// Loading state of the yearly view. Zones, paddings and row heights follow `budgetList`
/// so the arriving data lands on the anchors already drawn.
struct BudgetListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    sectionHeaderSkeleton

                    VStack(spacing: DesignTokens.Spacing.none) {
                        ForEach(0..<3, id: \.self) { index in
                            if index > 0 { Divider() }
                            monthRowSkeleton
                        }
                        Divider()
                        nextMonthRowSkeleton
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.lg)
                .contentZone()
            }
        }
        .shimmering()
        .background { Color.appBackground.ignoresSafeArea() }
        .accessibilityLabel("Chargement des budgets")
    }

    /// Year chips and the recap, on the forest — the canvas tint would vanish into it.
    private var heroZone: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            yearPickerSkeleton
            yearRecapSkeleton
                .padding(.horizontal, DesignTokens.Spacing.lg)
        }
        .environment(\.skeletonTint, Color.heroTile)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xl)
        .heroZone()
    }

    /// `YearPicker`'s own chips: button radius, tap-target height, `xs` between them.
    private var yearPickerSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(0..<3, id: \.self) { _ in
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.TapTarget.minimum,
                    cornerRadius: DesignTokens.CornerRadius.button
                )
            }
            Spacer(minLength: DesignTokens.Spacing.none)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    /// `YearRecapCard`: eyebrow over the display figure, the metric tile, the verdict.
    /// No progress bar — the loaded card has none.
    private var yearRecapSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Spacing.md
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.longTextWidth,
                    height: DesignTokens.Spacing.sectionGap
                )
            }

            tileSkeleton

            SkeletonShape(
                width: DesignTokens.Skeleton.extraLongTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    private var tileSkeleton: some View {
        SkeletonShape(
            height: DesignTokens.Skeleton.heroTileHeight,
            cornerRadius: DesignTokens.CornerRadius.card
        )
    }

    private var sectionHeaderSkeleton: some View {
        SkeletonShape(
            width: DesignTokens.Skeleton.mediumTextWidth,
            height: DesignTokens.Skeleton.sectionHeight
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// `BudgetMonthRow`: month over caption, the amount block, the chevron slot.
    private var monthRowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            chevronSlot
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }

    /// `NextMonthRow`: month, projected line, and the text link instead of an amount.
    private var nextMonthRowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            SkeletonShape(
                width: DesignTokens.Skeleton.mediumTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }

    /// Holds the width the chevron will take, so the amounts don't shift when data lands.
    private var chevronSlot: some View {
        SkeletonShape(
            width: DesignTokens.Spacing.xs,
            height: DesignTokens.Spacing.md,
            cornerRadius: DesignTokens.CornerRadius.xs
        )
    }
}
