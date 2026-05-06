using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.User;
using DomainTransaction = Pulpe.Domain.Transaction.Transaction;

namespace Pulpe.Api.Tests.Helpers;

public static class TestMocks
{
    public static AuthenticatedUser MakeUser(string id = "user-123") => new()
    {
        Id = id,
        Email = "test@example.com",
        FirstName = "Test",
        LastName = "User",
        AccessToken = "test-access-token",
        ClientKey = new byte[32]
    };

    public static Budget MakeBudget(
        Guid? id = null,
        int month = 3,
        int year = 2024,
        string? userId = null,
        string? endingBalance = null,
        Guid? templateId = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Month = month,
        Year = year,
        Description = string.Empty,
        UserId = Guid.Parse(userId ?? "00000000-0000-0000-0000-000000000001"),
        EndingBalance = endingBalance,
        TemplateId = templateId,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };

    public static BudgetLine MakeBudgetLine(
        Guid? id = null,
        Guid? budgetId = null,
        TransactionKind kind = TransactionKind.Expense,
        string amount = "encrypted-100",
        string name = "Test Line") => new()
    {
        Id = id ?? Guid.NewGuid(),
        BudgetId = budgetId ?? Guid.NewGuid(),
        Name = name,
        Amount = amount,
        Kind = kind,
        Recurrence = TransactionRecurrence.Fixed,
        IsManuallyAdjusted = false,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };

    public static DomainTransaction MakeTransaction(
        Guid? id = null,
        Guid? budgetId = null,
        TransactionKind kind = TransactionKind.Expense,
        string amount = "encrypted-50",
        string name = "Test Transaction") => new()
    {
        Id = id ?? Guid.NewGuid(),
        BudgetId = budgetId ?? Guid.NewGuid(),
        Name = name,
        Amount = amount,
        Kind = kind,
        TransactionDate = DateTimeOffset.UtcNow,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
}
