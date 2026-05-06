using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Application.Budget.Dto;

public record BudgetResponseDto(
    Guid Id,
    int Month,
    int Year,
    string Description,
    decimal? EndingBalance,
    Guid? TemplateId,
    Guid UserId,
    decimal? Rollover,
    decimal? Remaining,
    Guid? PreviousBudgetId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record BudgetSparseDto(
    Guid Id,
    int? Month,
    int? Year,
    decimal? TotalExpenses,
    decimal? TotalSavings,
    decimal? TotalIncome,
    decimal? Remaining,
    decimal? Rollover
);

public record BudgetDetailsResponseDto(
    BudgetResponseDto Budget,
    List<BudgetLineResponseDto> BudgetLines,
    List<TransactionResponseDto> Transactions
);

public record BudgetExportDataDto(
    string ExportDate,
    int TotalBudgets,
    List<BudgetWithDetailsDto> Budgets
);

public record BudgetWithDetailsDto(
    Guid Id,
    int Month,
    int Year,
    string Description,
    decimal? EndingBalance,
    Guid? TemplateId,
    Guid UserId,
    decimal? Rollover,
    decimal? Remaining,
    Guid? PreviousBudgetId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    List<BudgetLineResponseDto> BudgetLines,
    List<TransactionResponseDto> Transactions
);

public record BudgetExistsResponseDto(bool HasBudget);

public record BudgetLineResponseDto(
    Guid Id,
    Guid BudgetId,
    Guid? TemplateLineId,
    Guid? SavingsGoalId,
    string Name,
    decimal Amount,
    TransactionRecurrence Recurrence,
    TransactionKind Kind,
    bool IsManuallyAdjusted,
    DateTimeOffset? CheckedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    decimal? OriginalAmount = null,
    SupportedCurrency? OriginalCurrency = null,
    SupportedCurrency? TargetCurrency = null,
    decimal? ExchangeRate = null
);

public record TransactionResponseDto(
    Guid Id,
    Guid BudgetId,
    Guid? BudgetLineId,
    string Name,
    decimal Amount,
    DateTimeOffset TransactionDate,
    string? Category,
    TransactionKind Kind,
    DateTimeOffset? CheckedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    decimal? OriginalAmount = null,
    SupportedCurrency? OriginalCurrency = null,
    SupportedCurrency? TargetCurrency = null,
    decimal? ExchangeRate = null
);
