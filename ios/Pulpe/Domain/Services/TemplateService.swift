import Foundation

/// Service for budget template API operations
actor TemplateService {
    static let shared = TemplateService()

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Template CRUD

    /// Get all templates for the current user
    func getAllTemplates() async throws -> [BudgetTemplate] {
        try await apiClient.request(.templates, method: .get)
    }

    /// Get a specific template
    func getTemplate(id: String) async throws -> BudgetTemplate {
        try await apiClient.request(.template(id: id), method: .get)
    }

    /// Create a new template
    func createTemplate(_ data: BudgetTemplateCreate) async throws -> TemplateCreateData {
        let response: BudgetTemplateCreateResponse = try await apiClient.request(
            .templates,
            body: data,
            method: .post
        )
        return response.data
    }

    /// Create template from onboarding data
    func createTemplateFromOnboarding(_ data: BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate {
        let response: BudgetTemplateCreateResponse = try await apiClient.request(
            .templateFromOnboarding,
            body: data,
            method: .post
        )
        return response.data.template
    }

    /// Update a template
    func updateTemplate(id: String, data: BudgetTemplateUpdate) async throws -> BudgetTemplate {
        try await apiClient.request(.template(id: id), body: data, method: .patch)
    }

    /// Delete a template
    func deleteTemplate(id: String) async throws {
        try await apiClient.requestVoid(.template(id: id), method: .delete)
    }

    /// Check template usage
    func checkTemplateUsage(id: String) async throws -> TemplateUsageData {
        let response: TemplateUsageResponse = try await apiClient.request(
            .templateUsage(id: id),
            method: .get
        )
        return response.data
    }

    // MARK: - Template Lines

    /// Get all lines for a template
    func getTemplateLines(templateId: String) async throws -> [TemplateLine] {
        try await apiClient.request(.templateLines(templateId: templateId), method: .get)
    }

    /// Create a template line
    func createTemplateLine(templateId: String, data: TemplateLineCreate) async throws -> TemplateLine {
        try await apiClient.request(.templateLines(templateId: templateId), body: data, method: .post)
    }

    /// Update a template line
    func updateTemplateLine(templateId: String, lineId: String, data: TemplateLineUpdate) async throws -> TemplateLine {
        try await apiClient.request(.templateLine(templateId: templateId, lineId: lineId), body: data, method: .patch)
    }

    /// Delete a template line
    func deleteTemplateLine(templateId: String, lineId: String) async throws {
        try await apiClient.requestVoid(.templateLine(templateId: templateId, lineId: lineId), method: .delete)
    }

    /// Bulk update template lines with optional propagation
    func bulkUpdateTemplateLines(
        templateId: String, operations: TemplateLinesBulkOperations
    ) async throws -> TemplateLinesBulkOperationsResponse {
        try await apiClient.request(
            .templateLinesBulk(templateId: templateId),
            body: operations,
            method: .post
        )
    }

    // MARK: - Helpers

    /// Get the default template
    func getDefaultTemplate() async throws -> BudgetTemplate? {
        let templates = try await getAllTemplates()
        return templates.first { $0.isDefaultTemplate }
    }

    /// Check if template limit is reached
    func isTemplateLimitReached() async throws -> Bool {
        let templates = try await getAllTemplates()
        return templates.count >= AppConfiguration.maxTemplates
    }
}
