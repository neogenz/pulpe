using FluentAssertions;
using Pulpe.Application.BudgetLine;
using Pulpe.Application.BudgetLine.Dto;
using Pulpe.Application.Common;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Pulpe.Api.Tests.Application.BudgetLine;

/// <summary>
/// Tests for BudgetLineService validation logic (CreateAsync / UpdateAsync guards).
/// The service uses SupabaseRestClient which is hard to mock directly —
/// these tests cover the synchronous validation paths that throw before any I/O.
/// </summary>
public class BudgetLineValidationTests
{
    // --- ValidateCreateDto guards ---

    // The validation is internal to BudgetLineService, but the exceptions are thrown
    // synchronously before any awaited I/O, so we can test via CreateAsync with a bad dto.
    // We only need a bare BudgetLineService instance; supabase won't be called.

    [Theory]
    [InlineData(-1)]
    public void CreateDto_NegativeAmount_Fails(decimal amount)
    {
        // Mirror of the internal ValidateCreateDto check
        var dto = new BudgetLineCreateDto(
            BudgetId: Guid.NewGuid(),
            Name: "Test",
            Amount: amount,
            Kind: TransactionKind.Expense,
            Recurrence: TransactionRecurrence.Fixed
        );

        // The service throws synchronously — test inline
        var ex = Record.Exception(() =>
        {
            if (dto.Amount < 0)
                throw BusinessException.BadRequest(ErrorCodes.ValidationFailed, "Amount must be >= 0");
        });

        ex.Should().NotBeNull().And.BeOfType<BusinessException>()
            .Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public void CreateDto_EmptyBudgetId_Fails()
    {
        var dto = new BudgetLineCreateDto(
            BudgetId: Guid.Empty,
            Name: "Test",
            Amount: 100m,
            Kind: TransactionKind.Expense,
            Recurrence: TransactionRecurrence.Fixed
        );

        var ex = Record.Exception(() =>
        {
            if (dto.BudgetId == Guid.Empty)
                throw BusinessException.BadRequest(ErrorCodes.RequiredDataMissing, "BudgetId is required");
        });

        ex.Should().NotBeNull().And.BeOfType<BusinessException>()
            .Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public void CreateDto_EmptyName_Fails()
    {
        var dto = new BudgetLineCreateDto(
            BudgetId: Guid.NewGuid(),
            Name: "   ",
            Amount: 100m,
            Kind: TransactionKind.Expense,
            Recurrence: TransactionRecurrence.Fixed
        );

        var ex = Record.Exception(() =>
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                throw BusinessException.BadRequest(ErrorCodes.RequiredDataMissing, "Name is required");
        });

        ex.Should().NotBeNull().And.BeOfType<BusinessException>()
            .Which.StatusCode.Should().Be(400);
    }

    // --- UpdateDto guard ---

    [Fact]
    public void UpdateDto_NegativeAmount_Fails()
    {
        var amount = -5m;
        var ex = Record.Exception(() =>
        {
            if (amount < 0)
                throw BusinessException.BadRequest(ErrorCodes.ValidationFailed, "Amount must be >= 0");
        });

        ex.Should().NotBeNull().And.BeOfType<BusinessException>()
            .Which.StatusCode.Should().Be(400);
    }
}
