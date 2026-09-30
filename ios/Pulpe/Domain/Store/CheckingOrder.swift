/// Presentation-only priority: likely due forecasts, unknown habits, then later habits.
/// Every item remains checkable; actual recorded movements keep their existing priority.
enum CheckingOrder {
    static func rank(expectedDay: Int?, today: Int) -> Int {
        guard let expectedDay, (1...31).contains(expectedDay) else { return 32 }
        return expectedDay <= today ? expectedDay : 32 + expectedDay
    }
}
