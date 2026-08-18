import SwiftUI

/// Loading state for the dashboard. Its regions deliberately follow the loaded
/// screen so the transition keeps the same visual anchors.
struct CurrentMonthSkeletonView: View {
    /// Reports the hero zone's bottom edge in screen space so the dashboard mint
    /// tracker can stop the surface at the same place while loading as once loaded.
    var onHeroSurfaceBottomChange: (CGFloat) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    contentActionSkeleton
                    uncheckedCardSkeleton
                    activityCardSkeleton
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .shimmering()
        .accessibilityLabel("Préparation de ton tableau de bord")
        .accessibilityIdentifier("homeSkeletonRoot")
    }

    /// No month or avatar placeholder: both live in the navigation bar now, which is
    /// already on screen while this loads.
    private var heroZone: some View {
        CurrentMonthHeroSkeleton()
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xxl)
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: {
            onHeroSurfaceBottomChange($0)
        }
    }

    /// The filled CTA, at its own height: a card-shaped placeholder would hand the slot
    /// over to a pill and shift everything under it.
    private var contentActionSkeleton: some View {
        SkeletonShape(
            height: DesignTokens.FrameHeight.button,
            cornerRadius: .infinity
        )
    }

    private var uncheckedCardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            sectionHeaderSkeleton

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                rowSkeleton

                Divider()

                // Two capsules, because the loaded card offers two: the deferral is a chip
                // like the confirmation, so a bare line here would promise a shape the
                // arriving data does not deliver.
                HStack(spacing: DesignTokens.Spacing.md) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.TapTarget.minimum,
                        cornerRadius: .infinity
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.TapTarget.minimum,
                        cornerRadius: .infinity
                    )
                    Spacer(minLength: DesignTokens.Spacing.none)
                }
            }
            .padding(DesignTokens.Spacing.lg)
            .pulpeRowCard()
        }
    }

    private var activityCardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            sectionHeaderSkeleton

            // The window selector runs the full width once loaded, so it does here too —
            // a narrow placeholder would shift the whole list when the data lands.
            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(height: DesignTokens.TapTarget.minimum, cornerRadius: .infinity)
                SkeletonShape(height: DesignTokens.TapTarget.minimum, cornerRadius: .infinity)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Spacing.md
                )

                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(0..<2, id: \.self) { index in
                        if index > 0 { Divider() }
                        rowSkeleton
                            .padding(.vertical, DesignTokens.Spacing.md)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .pulpeRowCard()
            }
        }
    }

    /// A section's name and its named link, on the page rather than inside the card.
    private var sectionHeaderSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            Spacer()
            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth / 2,
                height: DesignTokens.Spacing.md
            )
        }
    }

    /// Disc, name over metadata, amount opposite — the shape every ledger row now has.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            SkeletonCircle(size: DesignTokens.IconSize.badge)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Spacing.md
                )
            }

            Spacer()

            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth / 2,
                height: DesignTokens.Skeleton.lineHeight
            )
        }
    }
}

private struct CurrentMonthHeroSkeleton: View {
    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Spacing.sectionGap
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Spacing.md
                )
            }

            HStack {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                Spacer()
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Skeleton.lineHeight
                )
            }

            chartSkeleton

            HStack {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.Skeleton.lineHeight
                )
                Spacer()
                SkeletonShape(
                    width: DesignTokens.Spacing.md,
                    height: DesignTokens.Skeleton.lineHeight
                )
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    private var chartSkeleton: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height

            ZStack {
                Path { path in
                    path.move(to: CGPoint(x: 0, y: height * 2 / 3))
                    path.addLine(to: CGPoint(x: width, y: height * 2 / 3))
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    )
                )

                Path { path in
                    path.move(to: CGPoint(x: 0, y: height / 3))
                    path.addCurve(
                        to: CGPoint(x: width * 2 / 3, y: height / 2),
                        control1: CGPoint(x: width / 3, y: height / 3),
                        control2: CGPoint(x: width / 2, y: height / 2)
                    )
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        lineJoin: .round
                    )
                )

                // The projection keeps falling toward the plan line, as the real one does —
                // it never turns back up.
                Path { path in
                    path.move(to: CGPoint(x: width * 2 / 3, y: height / 2))
                    path.addLine(to: CGPoint(x: width, y: height * 2 / 3))
                }
                .stroke(
                    Color.skeletonPlaceholder,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        dash: DesignTokens.Chart.dash
                    )
                )

                // Anchor point where the tracked series hands over to the projection.
                SkeletonCircle(size: DesignTokens.Spacing.md)
                    .position(x: width * 2 / 3, y: height / 2)
            }
        }
        .frame(height: DesignTokens.Chart.dashboardHeight)
        .accessibilityHidden(true)
    }
}
