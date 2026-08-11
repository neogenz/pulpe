import SwiftUI

/// Skeleton placeholder rendered while `BudgetDetailsView` waits for its first
/// payload. Mirrors the loaded state's `ScrollView` / `LazyVStack` layout so the
/// loading→loaded transition stays visually stable: hero (eyebrow + amount +
/// progress + pills) → contextual card → filter chips → section header → cards.
struct BudgetDetailsSkeletonView: View {
    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignTokens.Spacing.none) {
                heroSkeleton
                contextualCardSkeleton
                filterBarSkeleton
                sectionSkeleton
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }

    // MARK: - Hero

    private var heroSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
            // Eyebrow ("DISPONIBLE · €")
            SkeletonShape(
                width: DesignTokens.Skeleton.mediumTextWidth,
                height: DesignTokens.Skeleton.captionHeight,
                cornerRadius: DesignTokens.CornerRadius.xs
            )

            // Hero amount — mirrors `PulpeTypography.displayYear` block height
            SkeletonShape(
                width: DesignTokens.Skeleton.extraLongTextWidth,
                height: DesignTokens.Skeleton.displayHeight,
                cornerRadius: DesignTokens.CornerRadius.sm
            )
                .padding(.top, DesignTokens.Spacing.tightGap)

            // Progress bar + percent
            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.heroHeight,
                    cornerRadius: DesignTokens.CornerRadius.progressBar
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.bodyHeight,
                    cornerRadius: DesignTokens.CornerRadius.xs
                )
            }
            .padding(.top, DesignTokens.Spacing.md)

            // Pills row (Revenus · Épargne · Dépenses)
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonShape(
                        width: DesignTokens.Skeleton.mediumTextWidth,
                        height: DesignTokens.Skeleton.chipHeight,
                        cornerRadius: .infinity
                    )
                }
            }
            .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Filter bar

    private var filterBarSkeleton: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.controlHeight,
                    cornerRadius: .infinity
                )

                ForEach(0..<4, id: \.self) { _ in
                    SkeletonShape(
                        width: DesignTokens.Skeleton.shortTextWidth,
                        height: DesignTokens.Skeleton.controlHeight,
                        cornerRadius: .infinity
                    )
                }
            }
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.lg, for: .scrollContent)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var contextualCardSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            SkeletonCircle(size: DesignTokens.IconSize.compact)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.longTextWidth,
                    height: DesignTokens.Skeleton.bodyHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.extraLongTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            Spacer()

            SkeletonShape(
                width: DesignTokens.Spacing.xs,
                height: DesignTokens.Spacing.md,
                cornerRadius: DesignTokens.CornerRadius.xs
            )
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.md)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    // MARK: - Section + rows

    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
            // Section header ("Dépenses · 8")
            SkeletonShape(
                width: DesignTokens.Skeleton.mediumTextWidth,
                height: DesignTokens.Skeleton.lineHeight,
                cornerRadius: DesignTokens.CornerRadius.xs
            )
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(0..<5, id: \.self) { _ in
                rowSkeleton
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }

    /// Mirrors `BudgetLineMixedRow`: PointCircle · (kind tag + name) · amount + suffix · chevron.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.xxs) {
            SkeletonCircle(size: DesignTokens.Checkbox.size)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Spacing.compactGap
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Spacing.lg
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
                    height: DesignTokens.Spacing.compactGap
                )
            }

            SkeletonShape(
                width: DesignTokens.Spacing.tightGap,
                height: DesignTokens.Skeleton.captionHeight,
                cornerRadius: DesignTokens.CornerRadius.xs
            )
                .padding(.leading, DesignTokens.Spacing.xs)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .padding(.leading, DesignTokens.Spacing.xs)
        .padding(.trailing, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
        .overlay {
            // No `.shadow` here unlike its loaded-state neighbors: a skeleton is placeholder
            // chrome, not a real row, so it never had one to begin with — only the dark-mode
            // border, which `pulpeRowCard()` can't provide alone without also adding a light
            // mode shadow this view never had.
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl, style: .continuous)
                .strokeBorder(Color.rowCardBorder, lineWidth: DesignTokens.BorderWidth.hairline)
        }
    }
}
