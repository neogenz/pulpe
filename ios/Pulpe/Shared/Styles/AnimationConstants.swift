import SwiftUI

/// Animation timing constants for consistent motion design
enum PulpeAnimations {
    // MARK: - Duration

    static let fast: Double = 0.2
    static let normal: Double = 0.35
    static let slow: Double = 0.5

    // MARK: - Spring Configurations

    static let springResponse: Double = 0.5
    static let springDamping: Double = 0.8

    static var defaultSpring: Animation {
        .spring(response: springResponse, dampingFraction: springDamping)
    }

    static var gentleSpring: Animation {
        .spring(response: 0.6, dampingFraction: 0.85)
    }

    static var bouncySpring: Animation {
        .spring(response: 0.4, dampingFraction: 0.65)
    }

    // MARK: - Easing

    static var smoothEaseOut: Animation {
        .easeOut(duration: normal)
    }

    static var smoothEaseInOut: Animation {
        .easeInOut(duration: normal)
    }

    // MARK: - Step Transitions

    static var stepTransition: Animation {
        .spring(response: 0.5, dampingFraction: 0.85)
    }

    static var iconEntrance: Animation {
        .spring(response: 0.5, dampingFraction: 0.7)
    }
}
