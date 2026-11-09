import Foundation

/// Words the V2 redesign has not settled yet. Each one keeps the app's current word, and
/// lives here so flipping a word is a one-line change rather than a hunt across screens.
enum PendingWording {
    /// What a movement without a prévision is called when it labels a row or a section.
    static var unplanned: String { AppLocale.string("Hors prévision") }

    /// The answer to "C'était prévu dans ton budget ?" when no prévision covers the movement.
    static var unplannedAnswer: String { AppLocale.string("Non, c'est un imprévu") }

    /// The third answer of "Quand ?" on a new prévision, beside « Mensuel » and « Ponctuel »
    /// (`TransactionRecurrence.label`).
    static var spread: String { AppLocale.string("Lissé") }
}
