import Foundation

enum FeedbackRating: Int, CaseIterable, Codable, Hashable, Identifiable, Sendable {
    case needsImprovement = 1
    case difficult = 2
    case okay = 3
    case good = 4
    case veryGood = 5

    var id: Int { rawValue }

    var accessibilityLabel: String {
        switch self {
        case .needsImprovement: AppLocale.string("À améliorer")
        case .difficult: AppLocale.string("Difficile")
        case .okay: AppLocale.string("Correct")
        case .good: AppLocale.string("Bien")
        case .veryGood: AppLocale.string("Très bien")
        }
    }
}

enum FeedbackArea: String, CaseIterable, Codable, Hashable, Identifiable, Sendable {
    case onboarding
    case budgetClarity
    case currentMonth
    case futurePlanning
    case homeClarity

    var id: String { rawValue }

    var title: String {
        switch self {
        case .onboarding: AppLocale.string("Création de mon premier budget")
        case .budgetClarity: AppLocale.string("Clarté de l'interface")
        case .currentMonth: AppLocale.string("Gestion du budget du mois")
        case .futurePlanning: AppLocale.string("Planification des prochains mois")
        case .homeClarity: AppLocale.string("Clarté de l'accueil")
        }
    }
}

struct FeedbackSubmission: Codable, Equatable, Sendable {
    let overallRating: FeedbackRating
    let onboarding: FeedbackRating?
    let budgetClarity: FeedbackRating?
    let currentMonth: FeedbackRating?
    let futurePlanning: FeedbackRating?
    let homeClarity: FeedbackRating?
    let comment: String?
    let appVersion: String
    let iosVersion: String

    init(
        overallRating: FeedbackRating,
        ratings: [FeedbackArea: FeedbackRating] = [:],
        comment: String? = nil,
        appVersion: String,
        iosVersion: String
    ) {
        self.overallRating = overallRating
        onboarding = ratings[.onboarding]
        budgetClarity = ratings[.budgetClarity]
        currentMonth = ratings[.currentMonth]
        futurePlanning = ratings[.futurePlanning]
        homeClarity = ratings[.homeClarity]
        self.comment = comment
        self.appVersion = appVersion
        self.iosVersion = iosVersion
    }
}
