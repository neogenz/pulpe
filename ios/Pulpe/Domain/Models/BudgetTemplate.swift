import Foundation

/// Budget template that can be used to create monthly budgets
struct BudgetTemplate: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let description: String?
    let userId: String?
    let isDefault: Bool?
    let createdAt: Date
    let updatedAt: Date

    var isDefaultTemplate: Bool {
        isDefault ?? false
    }
}

/// Template line representing a planned item in a template
struct TemplateLine: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let templateId: String
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let recurrence: TransactionRecurrence
    let description: String
    let createdAt: Date
    let updatedAt: Date
}

// MARK: - Create/Update DTOs

struct BudgetTemplateCreate: Encodable {
    let name: String
    let description: String?
    let isDefault: Bool
    let lines: [TemplateLineCreate]

    init(
        name: String,
        description: String? = nil,
        isDefault: Bool = false,
        lines: [TemplateLineCreate] = []
    ) {
        self.name = name
        self.description = description
        self.isDefault = isDefault
        self.lines = lines
    }
}

struct BudgetTemplateUpdate: Encodable {
    var name: String?
    var description: String?
    var isDefault: Bool?
}

struct TemplateLineCreate: Encodable {
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let recurrence: TransactionRecurrence
    let description: String

    init(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        description: String = ""
    ) {
        self.name = name
        self.amount = amount
        self.kind = kind
        self.recurrence = recurrence
        self.description = description
    }
}

struct TemplateLineUpdate: Encodable {
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var recurrence: TransactionRecurrence?
    var description: String?
}

// MARK: - Bulk Operations

struct TemplateLinesBulkOperations: Encodable {
    var create: [TemplateLineCreate]
    var update: [TemplateLineUpdateWithId]
    var delete: [String]
    var propagateToBudgets: Bool

    init(
        create: [TemplateLineCreate] = [],
        update: [TemplateLineUpdateWithId] = [],
        delete: [String] = [],
        propagateToBudgets: Bool = false
    ) {
        self.create = create
        self.update = update
        self.delete = delete
        self.propagateToBudgets = propagateToBudgets
    }
}

struct TemplateLineUpdateWithId: Encodable {
    let id: String
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var recurrence: TransactionRecurrence?
    var description: String?
}

// MARK: - Response Types

struct BudgetTemplateCreateResponse: Decodable {
    let success: Bool
    let data: TemplateCreateData
}

struct TemplateCreateData: Decodable {
    let template: BudgetTemplate
    let lines: [TemplateLine]
}

struct TemplateUsageResponse: Decodable {
    let success: Bool
    let data: TemplateUsageData
}

struct TemplateUsageData: Decodable {
    let isUsed: Bool
    let budgetCount: Int
    let budgets: [TemplateUsageBudget]
}

struct TemplateUsageBudget: Decodable {
    let id: String
    let month: Int
    let year: Int
    let description: String
}

// MARK: - Onboarding Template Creation

struct BudgetTemplateCreateFromOnboarding: Encodable {
    let name: String
    let description: String?
    let isDefault: Bool
    let monthlyIncome: Decimal?
    let housingCosts: Decimal?
    let healthInsurance: Decimal?
    let leasingCredit: Decimal?
    let phonePlan: Decimal?
    let transportCosts: Decimal?
    let customTransactions: [OnboardingTransaction]

    init(
        name: String = "Mois Standard",
        description: String? = nil,
        isDefault: Bool = true,
        monthlyIncome: Decimal? = nil,
        housingCosts: Decimal? = nil,
        healthInsurance: Decimal? = nil,
        leasingCredit: Decimal? = nil,
        phonePlan: Decimal? = nil,
        transportCosts: Decimal? = nil,
        customTransactions: [OnboardingTransaction] = []
    ) {
        self.name = name
        self.description = description
        self.isDefault = isDefault
        self.monthlyIncome = monthlyIncome
        self.housingCosts = housingCosts
        self.healthInsurance = healthInsurance
        self.leasingCredit = leasingCredit
        self.phonePlan = phonePlan
        self.transportCosts = transportCosts
        self.customTransactions = customTransactions
    }
}

struct OnboardingTransaction: Encodable {
    let amount: Decimal
    let type: TransactionKind
    let name: String
    let description: String?
    let expenseType: TransactionRecurrence
    let isRecurring: Bool
}
