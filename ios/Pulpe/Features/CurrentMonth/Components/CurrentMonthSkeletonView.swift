import SwiftUI

/// Loading state for the dashboard. Its regions deliberately follow the loaded
/// screen so the transition keeps the same visual anchors.
struct CurrentMonthSkeletonView: View {
    /// Reports the hero zone's bottom edge in screen space so the dashboard's mint surface
    /// stops at the same place while loading as it does once loaded.
    var onHeroSurfaceBottomChange: (CGFloat) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.none) {
                heroZone

                VStack(spacing: DesignTokens.Spacing.lg) {
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

    private var contentActionSkeleton: some View {
        HStack {
            SkeletonShape(
                width: DesignTokens.Skeleton.greetingWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
            Spacer()
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
    }

    private var uncheckedCardSkeleton: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            HStack(spacing: DesignTokens.Spacing.lg) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )

                Spacer()

                SkeletonShape(
                    width: DesignTokens.Spacing.xs,
                    height: DesignTokens.Spacing.md,
                    cornerRadius: DesignTokens.CornerRadius.xs
                )
            }
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            VStack(spacing: DesignTokens.Spacing.md) {
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

                // Two capsules, because the loaded card now offers two: the deferral is a
                // chip like the confirmation, so a bare line here would promise a shape the
                // arriving data does not deliver.
                HStack(spacing: DesignTokens.Spacing.lg) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.TapTarget.minimum,
                        cornerRadius: .infinity
                    )
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.TapTarget.minimum,
                        cornerRadius: .infinity
                    )
                }
            }
            .padding(.top, DesignTokens.Spacing.md)
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
    }

    private var activityCardSkeleton: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth / 2,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.greetingWidth,
                        height: DesignTokens.Spacing.md
                    )
                }

                Spacer()

                SkeletonShape(
                    width: DesignTokens.Skeleton.greetingWidth / 2,
                    height: DesignTokens.TapTarget.minimum,
                    cornerRadius: .infinity
                )
                SkeletonShape(
                    width: DesignTokens.Spacing.xs,
                    height: DesignTokens.Spacing.md,
                    cornerRadius: DesignTokens.CornerRadius.xs
                )
            }
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(0..<3, id: \.self) { _ in
                    activityRowSkeleton
                }
            }
            .padding(.bottom, DesignTokens.Spacing.sm)
        }
    }

    private var activityRowSkeleton: some View {
        HStack {
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
        .padding(.vertical, DesignTokens.Spacing.md)
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
