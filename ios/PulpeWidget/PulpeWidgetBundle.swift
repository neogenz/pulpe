import SwiftUI
import WidgetKit

@main
struct PulpeWidgetBundle: WidgetBundle {
    var body: some Widget {
        CurrentMonthWidget()
        YearOverviewWidget()
    }
}
