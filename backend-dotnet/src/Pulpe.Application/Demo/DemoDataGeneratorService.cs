using Microsoft.Extensions.Logging;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Infrastructure.Services.Demo;

public sealed class DemoDataGeneratorService
{
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<DemoDataGeneratorService> _logger;

    // Fixed 32-byte demo key — same hex as NestJS DEMO_CLIENT_KEY_BUFFER
    public static readonly byte[] DemoClientKeyBuffer = Convert.FromHexString(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    public DemoDataGeneratorService(IEncryptionService encryptionService, ILogger<DemoDataGeneratorService> logger)
    {
        _encryptionService = encryptionService;
        _logger = logger;
    }

    public async Task SeedDemoData(string userId, SupabaseRestClient supabase)
    {
        _logger.LogInformation("Starting demo data generation for user {UserId}", userId);

        var dek = await _encryptionService.EnsureUserDek(userId, DemoClientKeyBuffer);

        var templates = await CreateTemplates(userId, supabase);
        _logger.LogInformation("Templates created for user {UserId}: {Count}", userId, templates.Count);

        var templateLines = await CreateTemplateLines(templates, supabase, dek);
        _logger.LogInformation("Template lines created for user {UserId}: {Count}", userId, templateLines.Count);

        var budgets = await CreateBudgets(userId, templates, supabase);
        _logger.LogInformation("Budgets created for user {UserId}: {Count}", userId, budgets.Count);

        var budgetLines = await CreateBudgetLines(budgets, templateLines, supabase, dek);
        _logger.LogInformation("Budget lines created for user {UserId}: {Count}", userId, budgetLines.Count);

        var transactions = await CreateTransactions(budgets, supabase, dek);
        _logger.LogInformation("Transactions created for user {UserId}: {Count}", userId, transactions.Count);

        await RecalculateAllBudgetBalances(budgets, supabase, dek);
        _logger.LogInformation("Budget balances recalculated for user {UserId}", userId);

        _logger.LogInformation("Demo data generation completed for user {UserId}", userId);
    }

    private static async Task<List<DemoTemplateRow>> CreateTemplates(string userId, SupabaseRestClient supabase)
    {
        var payload = new[]
        {
            new { user_id = userId, name = "Mois Standard", description = "Mon budget mensuel habituel avec toutes mes depenses recurrentes", is_default = true },
            new { user_id = userId, name = "Mois Vacances", description = "Budget special pour les mois avec voyages et sorties supplementaires", is_default = false },
            new { user_id = userId, name = "Mois Economies Renforcees", description = "Focus sur l'epargne avec reduction des depenses variables", is_default = false },
            new { user_id = userId, name = "Mois de Fetes", description = "Budget adapte pour les periodes de fetes avec cadeaux et repas", is_default = false },
        };

        var builder = supabase.From("template").Insert(payload).Select();
        var result = await supabase.Execute<List<DemoTemplateRow>>(builder);
        if (result.Error is not null)
            throw new InvalidOperationException($"Failed to create templates: {result.Error.Message}");

        return result.Data ?? new List<DemoTemplateRow>();
    }

    private async Task<List<DemoTemplateLineRow>> CreateTemplateLines(
        List<DemoTemplateRow> templates, SupabaseRestClient supabase, byte[] dek)
    {
        var allLines = new List<object>();
        allLines.AddRange(GetStandardMonthLines(templates[0].Id, dek));
        allLines.AddRange(GetVacationMonthLines(templates[1].Id, dek));
        allLines.AddRange(GetSavingsMonthLines(templates[2].Id, dek));
        allLines.AddRange(GetHolidayMonthLines(templates[3].Id, dek));

        var builder = supabase.From("template_line").Insert(allLines).Select();
        var result = await supabase.Execute<List<DemoTemplateLineRow>>(builder);
        if (result.Error is not null)
            throw new InvalidOperationException($"Failed to create template lines: {result.Error.Message}");

        return result.Data ?? new List<DemoTemplateLineRow>();
    }

    private List<object> GetStandardMonthLines(string templateId, byte[] dek) =>
    [
        Line(templateId, "Salaire net", 6500, "income", "fixed", dek),
        Line(templateId, "Freelance design", 800, "income", "one_off", dek),
        Line(templateId, "Loyer", 1850, "expense", "fixed", dek),
        Line(templateId, "Charges", 180, "expense", "fixed", dek),
        Line(templateId, "Assurance maladie", 385, "expense", "fixed", dek),
        Line(templateId, "Abonnement mobile", 69, "expense", "fixed", dek),
        Line(templateId, "Internet & TV", 89, "expense", "fixed", dek),
        Line(templateId, "Abonnement CFF", 185, "expense", "fixed", dek),
        Line(templateId, "Assurance RC/Menage", 35, "expense", "fixed", dek),
        Line(templateId, "Netflix & Spotify", 38, "expense", "fixed", dek),
        Line(templateId, "Salle de sport", 99, "expense", "fixed", dek),
        Line(templateId, "Courses alimentaires", 600, "expense", "one_off", dek),
        Line(templateId, "Restaurants/Sorties", 400, "expense", "one_off", dek),
        Line(templateId, "Shopping vetements", 200, "expense", "one_off", dek),
        Line(templateId, "Essence/Parking", 150, "expense", "one_off", dek),
        Line(templateId, "Pharmacie/Sante", 80, "expense", "one_off", dek),
        Line(templateId, "Coiffeur/Beaute", 120, "expense", "one_off", dek),
        Line(templateId, "Divers/Imprevus", 150, "expense", "one_off", dek),
        Line(templateId, "Epargne logement", 1000, "saving", "fixed", dek),
        Line(templateId, "3eme pilier", 580, "saving", "fixed", dek),
        Line(templateId, "Fonds d'urgence", 300, "saving", "fixed", dek),
    ];

    private List<object> GetVacationMonthLines(string templateId, byte[] dek) =>
    [
        Line(templateId, "Salaire net", 6500, "income", "fixed", dek),
        Line(templateId, "13eme salaire", 2500, "income", "one_off", dek),
        Line(templateId, "Loyer", 1850, "expense", "fixed", dek),
        Line(templateId, "Charges", 180, "expense", "fixed", dek),
        Line(templateId, "Assurance maladie", 385, "expense", "fixed", dek),
        Line(templateId, "Abonnements divers", 281, "expense", "fixed", dek),
        Line(templateId, "Billets d'avion", 800, "expense", "one_off", dek),
        Line(templateId, "Hotel (7 nuits)", 1200, "expense", "one_off", dek),
        Line(templateId, "Budget vacances", 1500, "expense", "one_off", dek),
        Line(templateId, "Assurance voyage", 85, "expense", "one_off", dek),
        Line(templateId, "3eme pilier", 580, "saving", "fixed", dek),
    ];

    private List<object> GetSavingsMonthLines(string templateId, byte[] dek) =>
    [
        Line(templateId, "Salaire net", 6500, "income", "fixed", dek),
        Line(templateId, "Vente Anibis", 200, "income", "one_off", dek),
        Line(templateId, "Loyer", 1850, "expense", "fixed", dek),
        Line(templateId, "Charges", 180, "expense", "fixed", dek),
        Line(templateId, "Assurance maladie", 385, "expense", "fixed", dek),
        Line(templateId, "Abonnements essentiels", 154, "expense", "fixed", dek),
        Line(templateId, "Courses (budget serre)", 400, "expense", "one_off", dek),
        Line(templateId, "Transport", 185, "expense", "fixed", dek),
        Line(templateId, "Minimum vital", 200, "expense", "one_off", dek),
        Line(templateId, "Epargne logement", 1700, "saving", "fixed", dek),
        Line(templateId, "3eme pilier", 580, "saving", "fixed", dek),
        Line(templateId, "Investissement ETF", 400, "saving", "fixed", dek),
        Line(templateId, "Fonds d'urgence", 400, "saving", "fixed", dek),
    ];

    private List<object> GetHolidayMonthLines(string templateId, byte[] dek) =>
    [
        Line(templateId, "Salaire net", 6500, "income", "fixed", dek),
        Line(templateId, "Prime de fin d'annee", 3000, "income", "one_off", dek),
        Line(templateId, "Loyer", 1850, "expense", "fixed", dek),
        Line(templateId, "Charges", 180, "expense", "fixed", dek),
        Line(templateId, "Assurances diverses", 420, "expense", "fixed", dek),
        Line(templateId, "Abonnements", 281, "expense", "fixed", dek),
        Line(templateId, "Cadeaux famille", 800, "expense", "one_off", dek),
        Line(templateId, "Cadeaux amis", 400, "expense", "one_off", dek),
        Line(templateId, "Repas de fetes", 600, "expense", "one_off", dek),
        Line(templateId, "Decorations", 150, "expense", "one_off", dek),
        Line(templateId, "Sorties festives", 500, "expense", "one_off", dek),
        Line(templateId, "Tenue de soiree", 350, "expense", "one_off", dek),
        Line(templateId, "Epargne logement", 1000, "saving", "fixed", dek),
        Line(templateId, "3eme pilier", 580, "saving", "fixed", dek),
    ];

    private object Line(string templateId, string name, decimal amount, string kind, string recurrence, byte[] dek) =>
        new
        {
            template_id = templateId,
            name,
            amount = _encryptionService.EncryptAmount(amount, dek),
            kind,
            recurrence,
            description = ""
        };

    private static async Task<List<DemoBudgetRow>> CreateBudgets(
        string userId, List<DemoTemplateRow> templates, SupabaseRestClient supabase)
    {
        var currentDate = DateTime.UtcNow;
        var budgets = new List<object>();

        for (var i = -6; i <= 5; i++)
        {
            var date = currentDate.AddMonths(i);
            var month = date.Month;
            var year = date.Year;
            var (template, description) = SelectTemplateForMonth(month, templates);

            budgets.Add(new
            {
                user_id = userId,
                month,
                year,
                description,
                template_id = template.Id,
                ending_balance = (string?)null
            });
        }

        var builder = supabase.From("monthly_budget").Insert(budgets).Select();
        var result = await supabase.Execute<List<DemoBudgetRow>>(builder);
        if (result.Error is not null)
            throw new InvalidOperationException($"Failed to create budgets: {result.Error.Message}");

        return result.Data ?? new List<DemoBudgetRow>();
    }

    private static (DemoTemplateRow Template, string Description) SelectTemplateForMonth(int month, List<DemoTemplateRow> templates)
    {
        if (month == 12) return (templates[3], "Budget des fetes de fin d'annee");
        if (month == 7 || month == 8) return (templates[1], "Budget vacances d'ete");
        if (month == 3 || month == 9) return (templates[2], "Focus sur l'epargne ce mois-ci");
        return (templates[0], "Budget mensuel standard");
    }

    private async Task<List<DemoBudgetLineRow>> CreateBudgetLines(
        List<DemoBudgetRow> budgets, List<DemoTemplateLineRow> templateLines,
        SupabaseRestClient supabase, byte[] dek)
    {
        var linesToCreate = new List<object>();

        foreach (var budget in budgets)
        {
            var relevantLines = templateLines.Where(tl => tl.TemplateId == budget.TemplateId);
            foreach (var tl in relevantLines)
            {
                var actualAmount = !string.IsNullOrEmpty(tl.Amount)
                    ? _encryptionService.DecryptAmount(tl.Amount, dek)
                    : 0m;

                linesToCreate.Add(new
                {
                    budget_id = budget.Id,
                    template_line_id = tl.Id,
                    name = tl.Name,
                    amount = _encryptionService.EncryptAmount(actualAmount, dek),
                    kind = tl.Kind,
                    recurrence = tl.Recurrence,
                    is_manually_adjusted = false,
                    checked_at = (string?)null
                });
            }
        }

        var builder = supabase.From("budget_line").Insert(linesToCreate).Select();
        var result = await supabase.Execute<List<DemoBudgetLineRow>>(builder);
        if (result.Error is not null)
            throw new InvalidOperationException($"Failed to create budget lines: {result.Error.Message}");

        return result.Data ?? new List<DemoBudgetLineRow>();
    }

    private async Task<List<DemoTransactionRow>> CreateTransactions(
        List<DemoBudgetRow> budgets, SupabaseRestClient supabase, byte[] dek)
    {
        var currentDate = DateTime.UtcNow;
        var transactionsToCreate = new List<object>();

        foreach (var budget in budgets)
        {
            var budgetDate = new DateTime(budget.Year, budget.Month, 1);
            if (budgetDate > currentDate) continue;

            var isCurrentMonth = budget.Month == currentDate.Month && budget.Year == currentDate.Year;
            var daysInMonth = DateTime.DaysInMonth(budget.Year, budget.Month);
            var maxDay = isCurrentMonth ? currentDate.Day : daysInMonth;

            if (maxDay >= 5)
                transactionsToCreate.Add(BuildTransaction(budget, 5, "Migros - Courses", 127.85m, "Alimentation", dek));
            if (maxDay >= 10)
                transactionsToCreate.Add(BuildTransaction(budget, 10, "Restaurant Molino", 78.50m, "Restaurants", dek));
            if (maxDay >= 15)
                transactionsToCreate.Add(BuildTransaction(budget, 15, "Coop - Courses", 94.20m, "Alimentation", dek));
        }

        if (transactionsToCreate.Count == 0)
            return new List<DemoTransactionRow>();

        var builder = supabase.From("transaction").Insert(transactionsToCreate).Select();
        var result = await supabase.Execute<List<DemoTransactionRow>>(builder);
        if (result.Error is not null)
            throw new InvalidOperationException($"Failed to create transactions: {result.Error.Message}");

        return result.Data ?? new List<DemoTransactionRow>();
    }

    private object BuildTransaction(DemoBudgetRow budget, int day, string name, decimal amount, string category, byte[] dek) =>
        new
        {
            budget_id = budget.Id,
            budget_line_id = (string?)null,
            name,
            amount = _encryptionService.EncryptAmount(amount, dek),
            kind = "expense",
            category,
            transaction_date = new DateTime(budget.Year, budget.Month, day).ToString("O"),
            checked_at = (string?)null
        };

    private async Task RecalculateAllBudgetBalances(List<DemoBudgetRow> budgets, SupabaseRestClient supabase, byte[] dek)
    {
        var sorted = budgets.OrderBy(b => b.Year).ThenBy(b => b.Month).ToList();

        foreach (var budget in sorted)
        {
            var linesResult = await supabase.Execute<List<DemoBudgetLineRow>>(
                supabase.From("budget_line").Select().Eq("budget_id", budget.Id));

            var txResult = await supabase.Execute<List<DemoTransactionRow>>(
                supabase.From("transaction").Select().Eq("budget_id", budget.Id));

            var lines = (linesResult.Data ?? new List<DemoBudgetLineRow>())
                .Select(l => new FinancialItemWithId(
                    Guid.Parse(l.Id),
                    l.Kind,
                    string.IsNullOrEmpty(l.Amount) ? 0m : _encryptionService.DecryptAmount(l.Amount, dek)))
                .ToList();

            var txs = (txResult.Data ?? new List<DemoTransactionRow>())
                .Select(t => new TransactionWithBudgetLineId(
                    string.IsNullOrEmpty(t.BudgetLineId) ? null : Guid.Parse(t.BudgetLineId),
                    t.Kind,
                    string.IsNullOrEmpty(t.Amount) ? 0m : _encryptionService.DecryptAmount(t.Amount, dek)))
                .ToList();

            var metrics = BudgetFormulas.CalculateAllMetrics(lines, txs);
            var encryptedBalance = _encryptionService.EncryptAmount(metrics.EndingBalance, dek);

            var updateBuilder = supabase.From("monthly_budget")
                .Eq("id", budget.Id)
                .Update(new { ending_balance = encryptedBalance });
            await supabase.Execute<object>(updateBuilder);
        }
    }

    // Internal row types for Supabase deserialization
    internal sealed class DemoTemplateRow
    {
        public string Id { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsDefault { get; set; }
    }

    internal sealed class DemoTemplateLineRow
    {
        public string Id { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Amount { get; set; }
        public TransactionKind Kind { get; set; }
        public TransactionRecurrence Recurrence { get; set; }
        public string? Description { get; set; }
    }

    internal sealed class DemoBudgetRow
    {
        public string Id { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public int Month { get; set; }
        public int Year { get; set; }
        public string? Description { get; set; }
        public string? TemplateId { get; set; }
        public string? EndingBalance { get; set; }
    }

    internal sealed class DemoBudgetLineRow
    {
        public string Id { get; set; } = string.Empty;
        public string BudgetId { get; set; } = string.Empty;
        public string? TemplateLineId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Amount { get; set; }
        public TransactionKind Kind { get; set; }
        public TransactionRecurrence Recurrence { get; set; }
        public bool IsManuallyAdjusted { get; set; }
        public string? CheckedAt { get; set; }
    }

    internal sealed class DemoTransactionRow
    {
        public string Id { get; set; } = string.Empty;
        public string BudgetId { get; set; } = string.Empty;
        public string? BudgetLineId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Amount { get; set; }
        public TransactionKind Kind { get; set; }
        public string? Category { get; set; }
        public string? TransactionDate { get; set; }
        public string? CheckedAt { get; set; }
    }
}
