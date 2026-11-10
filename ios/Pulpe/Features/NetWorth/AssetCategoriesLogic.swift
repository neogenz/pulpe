import Foundation

/// What the categories sheet needs to refuse a delete and say why, away from the view.
enum AssetCategoriesLogic {
    /// Active and archived assets alike: the API refuses a category that still holds either.
    static func blockingAssetNames(categoryId: String, in assets: [Asset]) -> [String] {
        assets.filter { $0.categoryId == categoryId }.map(\.name)
    }

    static func notEmptyMessage(names: [String], locale: Locale = AppLocale.currentUILocale) -> String {
        let formatter = ListFormatter()
        formatter.locale = locale
        let list = formatter.string(from: names) ?? names.joined(separator: ", ")
        return AppLocale.string("Déplace d'abord \(list) vers une autre catégorie.", locale: locale)
    }
}
