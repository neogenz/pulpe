using Microsoft.Extensions.Logging;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Application.Common;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;
using PgClient = global::Supabase.Postgrest.Client;

namespace Pulpe.Application.Demo;

public sealed class DemoDataGeneratorService
{
    private readonly IEncryptionService _encryptionService;
    private readonly ISupabaseClientFactory _clientFactory;
    private readonly ILogger<DemoDataGeneratorService> _logger;

    public static readonly byte[] DemoClientKeyBuffer = Convert.FromHexString(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    public DemoDataGeneratorService(
        IEncryptionService encryptionService,
        ISupabaseClientFactory clientFactory,
        ILogger<DemoDataGeneratorService> logger)
    {
        _encryptionService = encryptionService;
        _clientFactory = clientFactory;
        _logger = logger;
    }

    public async Task SeedDemoData(string userId)
    {
        _logger.LogInformation("Starting demo data generation for user {UserId}", userId);

        var client = _clientFactory.CreateAdminClient();
        var dek = await _encryptionService.EnsureUserDek(userId, DemoClientKeyBuffer);

        var templates = await CreateTemplates(userId, client);
        _logger.LogInformation("Templates created for user {UserId}: {Count}", userId, templates.Count);

        var templateLines = await CreateTemplateLines(templates, client, dek);
        _logger.LogInformation("Template lines created for user {UserId}: {Count}", userId, templateLines.Count);

        var budgets = await CreateBudgets(userId, templates, client);
        _logger.LogInformation("Budgets created for user {UserId}: {Count}", userId, budgets.Count);

        var budgetLines = await CreateBudgetLines(budgets, templateLines, client, dek);
        _logger.LogInformation("Budget lines created for user {UserId}: {Count}", userId, budgetLines.Count);

        var transactions = await CreateTransactions(budgets, client, dek);
        _logger.LogInformation("Transactions created for user {UserId}: {Count}", userId, transactions.Count);

        await RecalculateAllBudgetBalances(budgets, client, dek);
        _logger.LogInformation("Budget balances recalculated for user {UserId}", userId);

        _logger.LogInformation("Demo data generation completed for user {UserId}", userId);
    }

    private static async Task<List<DemoTemplateRow>> CreateTemplates(string userId, PgClient client)
    {
        var rows = new List<DemoTemplateRow>
        {
            new() { UserId = userId, Name = "Mois Standard", Description = "Mon budget mensuel habituel avec toutes mes depenses recurrentes", IsDefault = true },
            new() { UserId = userId, Name = "Mois Vacances", Description = "Budget special pour les mois avec voyages et sorties supplementaires", IsDefault = false },
            new() { UserId = userId, Name = "Mois Economies Renforcees", Description = "Focus sur l'epargne avec reduction des depenses variables", IsDefault = false },
            new() { UserId = userId, Name = "Mois de Fetes", Description = "Budget adapte pour les periodes de fetes avec cadeaux et repas", IsDefault = false },
        };

        var result = await client.Table<DemoTemplateRow>().Insert(rows);
        return result.Models;
    }

    private async Task<List<DemoTemplateLineRow>> CreateTemplateLines(
        List<DemoTemplateRow> templates, PgClient client, byte[] dek)
    {
        var allLines = new List<DemoTemplateLineRow>();
        allLines.AddRange(GetStandardMonthLines(templates[0].Id.ToString(), dek));
        allLines.AddRange(GetVacationMonthLines(templates[1].Id.ToString(), dek));
        allLines.AddRange(GetSavingsMonthLines(templates[2].Id.ToString(), dek));
        allLines.AddRange(GetHolidayMonthLines(templates[3].Id.ToString(), dek));

        var result = await client.Table<DemoTemplateLineRow>().Insert(allLines);
        return result.Models;
    }

    private List<DemoTemplateLineRow> GetStandardMonthLines(string templateId, byte[] dek) =>
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

    private List<DemoTemplateLineRow> GetVacationMonthLines(string templateId, byte[] dek) =>
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

    private List<DemoTemplateLineRow> GetSavingsMonthLines(string templateId, byte[] dek) =>
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

    private List<DemoTemplateLineRow> GetHolidayMonthLines(string templateId, byte[] dek) =>
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

    private DemoTemplateLineRow Line(string templateId, string name, decimal amount, string kind, string recurrence, byte[] dek) =>
        new()
        {
            TemplateId = templateId,
            Name = name,
            Amount = _encryptionService.EncryptAmount(amount, dek),
            Kind = kind,
            Recurrence = recurrence,
            Description = string.Empty
        };

    private static async Task<List<DemoBudgetRow>> CreateBudgets(
        string userId, List<DemoTemplateRow> templates, PgClient client)
    {
        var currentDate = DateTime.UtcNow;
        var budgets = new List<DemoBudgetRow>();

        for (var i = -6; i <= 5; i++)
        {
            var date = currentDate.AddMonths(i);
            var month = date.Month;
            var year = date.Year;
            var (template, description) = SelectTemplateForMonth(month, templates);

            budgets.Add(new DemoBudgetRow
            {
                UserId = userId,
                Month = month,
                Year = year,
                Description = description,
                TemplateId = template.Id.ToString()
            });
        }

        var result = await client.Table<DemoBudgetRow>().Insert(budgets);
        return result.Models;
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
        PgClient client, byte[] dek)
    {
        var linesToCreate = new List<DemoBudgetLineRow>();

        foreach (var budget in budgets)
        {
            var relevantLines = templateLines.Where(tl => tl.TemplateId == budget.Id.ToString());
            foreach (var tl in relevantLines)
            {
                var actualAmount = !string.IsNullOrEmpty(tl.Amount)
                    ? _encryptionService.DecryptAmount(tl.Amount, dek)
                    : 0m;

                linesToCreate.Add(new DemoBudgetLineRow
                {
                    BudgetId = budget.Id.ToString(),
                    TemplateLineId = tl.Id.ToString(),
                    Name = tl.Name ?? string.Empty,
                    Amount = _encryptionService.EncryptAmount(actualAmount, dek),
                    Kind = tl.Kind ?? string.Empty,
                    Recurrence = tl.Recurrence ?? string.Empty,
                    IsManuallyAdjusted = false
                });
            }
        }

        var result = await client.Table<DemoBudgetLineRow>().Insert(linesToCreate);
        return result.Models;
    }

    private async Task<List<DemoTransactionRow>> CreateTransactions(
        List<DemoBudgetRow> budgets, PgClient client, byte[] dek)
    {
        var currentDate = DateTime.UtcNow;
        var transactionsToCreate = new List<DemoTransactionRow>();

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
            return [];

        var result = await client.Table<DemoTransactionRow>().Insert(transactionsToCreate);
        return result.Models;
    }

    private DemoTransactionRow BuildTransaction(DemoBudgetRow budget, int day, string name, decimal amount, string category, byte[] dek) =>
        new()
        {
            BudgetId = budget.Id.ToString(),
            Name = name,
            Amount = _encryptionService.EncryptAmount(amount, dek),
            Kind = "expense",
            Category = category,
            TransactionDate = new DateTime(budget.Year, budget.Month, day).ToString("O")
        };

    private async Task RecalculateAllBudgetBalances(
        List<DemoBudgetRow> budgets, PgClient client, byte[] dek)
    {
        var sorted = budgets.OrderBy(b => b.Year).ThenBy(b => b.Month).ToList();

        foreach (var budget in sorted)
        {
            var linesResponse = await client.Table<DemoBudgetLineRow>()
                .Filter("budget_id", Operator.Equals, budget.Id.ToString())
                .Get();

            var txResponse = await client.Table<DemoTransactionRow>()
                .Filter("budget_id", Operator.Equals, budget.Id.ToString())
                .Get();

            var lines = linesResponse.Models
                .Select(l => new FinancialItemWithId(
                    Guid.TryParse(l.Id.ToString(), out var lineId) ? lineId : Guid.Empty,
                    Enum.TryParse<TransactionKind>(l.Kind, true, out var lk) ? lk : TransactionKind.Expense,
                    string.IsNullOrEmpty(l.Amount) ? 0m : _encryptionService.DecryptAmount(l.Amount, dek)))
                .ToList();

            var txs = txResponse.Models
                .Select(t => new TransactionWithBudgetLineId(
                    string.IsNullOrEmpty(t.BudgetLineId) ? null : Guid.TryParse(t.BudgetLineId, out var tid) ? tid : (Guid?)null,
                    Enum.TryParse<TransactionKind>(t.Kind, true, out var tk) ? tk : TransactionKind.Expense,
                    string.IsNullOrEmpty(t.Amount) ? 0m : _encryptionService.DecryptAmount(t.Amount, dek)))
                .ToList();

            var metrics = BudgetFormulas.CalculateAllMetrics(lines, txs);
            var encryptedBalance = _encryptionService.EncryptAmount(metrics.EndingBalance, dek);

            await client.Table<DemoBudgetRow>()
                .Filter("id", Operator.Equals, budget.Id.ToString())
                .Set(r => r.EndingBalance, encryptedBalance)
                .Update();
        }
    }

    [Table("template")]
    internal sealed class DemoTemplateRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("is_default")]
        public bool IsDefault { get; set; }
    }

    [Table("template_line")]
    internal sealed class DemoTemplateLineRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("template_id")]
        public string TemplateId { get; set; } = string.Empty;

        [Column("name")]
        public string? Name { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("kind")]
        public string? Kind { get; set; }

        [Column("recurrence")]
        public string? Recurrence { get; set; }

        [Column("description")]
        public string? Description { get; set; }
    }

    [Table("monthly_budget")]
    internal sealed class DemoBudgetRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("month")]
        public int Month { get; set; }

        [Column("year")]
        public int Year { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("template_id")]
        public string? TemplateId { get; set; }

        [Column("ending_balance")]
        public string? EndingBalance { get; set; }
    }

    [Table("budget_line")]
    internal sealed class DemoBudgetLineRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("budget_id")]
        public string BudgetId { get; set; } = string.Empty;

        [Column("template_line_id")]
        public string? TemplateLineId { get; set; }

        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("kind")]
        public string Kind { get; set; } = string.Empty;

        [Column("recurrence")]
        public string Recurrence { get; set; } = string.Empty;

        [Column("is_manually_adjusted")]
        public bool IsManuallyAdjusted { get; set; }

        [Column("checked_at")]
        public string? CheckedAt { get; set; }
    }

    [Table("transaction")]
    internal sealed class DemoTransactionRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("budget_id")]
        public string BudgetId { get; set; } = string.Empty;

        [Column("budget_line_id")]
        public string? BudgetLineId { get; set; }

        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("kind")]
        public string Kind { get; set; } = string.Empty;

        [Column("category")]
        public string? Category { get; set; }

        [Column("transaction_date")]
        public string? TransactionDate { get; set; }

        [Column("checked_at")]
        public string? CheckedAt { get; set; }
    }
}
