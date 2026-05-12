import Foundation

/// Pure helpers for the edit-transaction flow. Lives in an `enum` namespace so
/// every call site goes through type-checked static methods, and unit tests can
/// exercise validation / shape logic without bootstrapping a SwiftUI view.
enum EditTransactionLogic {
    /// Returns `true` when the transaction was captured in a foreign currency
    /// (i.e. its `originalCurrency` differs from the user's display currency).
    /// Drives the read-only currency picker shown above the amount field.
    static func shouldShowAlternateCurrency(
        for transaction: Transaction,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let txCurrency = transaction.originalCurrency else { return false }
        return txCurrency != userCurrency
    }

    /// Initial amount surfaced in the editor. For FX transactions, prefer the
    /// `originalAmount` so the user edits in the currency they originally used.
    /// Falls back to the converted `transaction.amount` otherwise.
    static func initialAmount(
        for transaction: Transaction,
        userCurrency: SupportedCurrency
    ) -> Decimal {
        if shouldShowAlternateCurrency(for: transaction, userCurrency: userCurrency),
           let originalAmount = transaction.originalAmount {
            return originalAmount
        }
        return transaction.amount
    }

    static func isFormValid(name: String, amount: Decimal?, isLoading: Bool) -> Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    /// Builds the API payload for the update call. When `conversion` is `nil`
    /// the payload omits all currency metadata (mono-currency edit). When
    /// present, it mirrors the conversion onto the wire format so the server
    /// stores both legs (original + converted) and the cached FX rate.
    static func buildUpdate(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        transactionDate: Date,
        conversion: CurrencyConversion?
    ) -> TransactionUpdate {
        guard let conversion else {
            return TransactionUpdate(
                name: name,
                amount: amount,
                kind: kind,
                transactionDate: transactionDate
            )
        }
        return TransactionUpdate(
            name: name,
            amount: conversion.convertedAmount,
            kind: kind,
            transactionDate: transactionDate,
            originalAmount: conversion.originalAmount,
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate
        )
    }
}
