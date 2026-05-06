using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Pulpe.Application.Common;
using Pulpe.Application.Currency;
using Pulpe.Domain.Currency;
using Pulpe.Application.Transaction;
using Pulpe.Application.Transaction.Dto;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Domain.User;
using Pulpe.Api.Tests.Helpers;
using ICommonBudgetService = Pulpe.Application.Common.IBudgetRecalculationService;
using DomainBudgetLine = Pulpe.Domain.Budget.BudgetLine;
using DomainTransaction = Pulpe.Domain.Transaction.Transaction;

namespace Pulpe.Api.Tests.Application.Transaction;

public class TransactionServiceTests
{
    private readonly ITransactionRepository _txRepo = Substitute.For<ITransactionRepository>();
    private readonly IBudgetRepository _budgetRepo = Substitute.For<IBudgetRepository>();
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly ICommonBudgetService _budgetService = Substitute.For<ICommonBudgetService>();
    private readonly ICurrencyService _currencyService = Substitute.For<ICurrencyService>();
    private readonly TransactionService _sut;

    private readonly AuthenticatedUser _user = TestMocks.MakeUser();
    private readonly byte[] _dek = new byte[32];

    public TransactionServiceTests()
    {
        _sut = new TransactionService(
            _txRepo, _budgetRepo, _encryption, _cache, _budgetService,
            _currencyService, NullLogger<TransactionService>.Instance);

        _encryption.GetUserDek(Arg.Any<string>(), Arg.Any<byte[]>()).Returns(_dek);
        _encryption.TryDecryptAmount(Arg.Any<string?>(), _dek, Arg.Any<decimal>()).Returns(50m);
        _encryption.PrepareAmountData(Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<byte[]>())
            .Returns("encrypted-amount");
        _cache.InvalidateForUser(Arg.Any<string>()).Returns(Task.CompletedTask);
        _budgetService.RecalculateBalances(Arg.Any<Guid>(), Arg.Any<byte[]>())
            .Returns(Task.CompletedTask);
        _currencyService.ComputeOverride(Arg.Any<IFxCarrier>())
            .Returns(new FxOverrideResult(null, null, null, null, false, false, false, false));
    }

    // --- FindOneAsync ---

    [Fact]
    public async Task FindOneAsync_ExistingTransaction_ReturnsDto()
    {
        var tx = TestMocks.MakeTransaction();
        _txRepo.FindById(tx.Id).Returns(tx);

        var result = await _sut.FindOneAsync(tx.Id, _user);
        var dto = result as Pulpe.Application.Transaction.Dto.TransactionResponseDto
            ?? throw new InvalidCastException("Expected TransactionResponseDto");

        dto.Id.Should().Be(tx.Id);
        dto.Amount.Should().Be(50m);
    }

    [Fact]
    public async Task FindOneAsync_NotFound_ThrowsNotFound()
    {
        _txRepo.FindById(Arg.Any<Guid>()).Returns((DomainTransaction?)null);

        await _sut.Invoking(s => s.FindOneAsync(Guid.NewGuid(), _user))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 404);
    }

    // --- CreateAsync ---

    [Fact]
    public async Task CreateAsync_ValidDto_CreatesAndRecalculates()
    {
        var budgetId = Guid.NewGuid();
        var dto = new TransactionCreateDto(
            BudgetId: budgetId,
            Name: "Coffee",
            Amount: 5m,
            Kind: TransactionKind.Expense,
            BudgetLineId: null,
            TransactionDate: DateTimeOffset.UtcNow,
            Category: "Food"
        );
        var created = TestMocks.MakeTransaction(budgetId: budgetId, name: "Coffee");
        _txRepo.Create(Arg.Any<object>()).Returns(created);

        var result = await _sut.CreateAsync(dto, _user);
        var responseDto = result as Pulpe.Application.Transaction.Dto.TransactionResponseDto
            ?? throw new InvalidCastException("Expected TransactionResponseDto");

        responseDto.Name.Should().Be("Coffee");
        await _budgetService.Received(1).RecalculateBalances(budgetId, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- UpdateAsync ---

    [Fact]
    public async Task UpdateAsync_ValidDto_UpdatesAndRecalculates()
    {
        var txId = Guid.NewGuid();
        var budgetId = Guid.NewGuid();
        var dto = new TransactionUpdateDto(Name: "Updated coffee", Amount: null, Kind: null, TransactionDate: null, Category: null);
        var updated = TestMocks.MakeTransaction(id: txId, budgetId: budgetId, name: "Updated coffee");

        _txRepo.Update(txId, Arg.Any<object>()).Returns(updated);

        var result = await _sut.UpdateAsync(txId, dto, _user);
        var responseDto = result as Pulpe.Application.Transaction.Dto.TransactionResponseDto
            ?? throw new InvalidCastException("Expected TransactionResponseDto");

        responseDto.Name.Should().Be("Updated coffee");
        await _budgetService.Received(1).RecalculateBalances(budgetId, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- RemoveAsync ---

    [Fact]
    public async Task RemoveAsync_DeletesTransactionAndRecalculates()
    {
        var txId = Guid.NewGuid();
        var budgetId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(id: txId, budgetId: budgetId);

        _txRepo.FindById(txId).Returns(tx);
        _txRepo.Delete(txId).Returns(Task.CompletedTask);

        await _sut.RemoveAsync(txId, _user);

        await _txRepo.Received(1).Delete(txId);
        await _budgetService.Received(1).RecalculateBalances(budgetId, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- ToggleCheckAsync ---

    [Fact]
    public async Task ToggleCheckAsync_UpdatesAndInvalidatesCache()
    {
        var txId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(id: txId);
        _txRepo.ToggleCheck(txId).Returns(tx);

        var result = await _sut.ToggleCheckAsync(txId, _user);
        var dto = result as Pulpe.Application.Transaction.Dto.TransactionResponseDto
            ?? throw new InvalidCastException("Expected TransactionResponseDto");

        dto.Id.Should().Be(txId);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- FindByBudgetAsync ---

    [Fact]
    public async Task FindByBudgetAsync_ReturnsDecryptedTransactions()
    {
        var budgetId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(budgetId: budgetId);
        _txRepo.FindByBudgetId(budgetId).Returns(new List<DomainTransaction> { tx });

        var result = await _sut.FindByBudgetAsync(budgetId, _user);
        var list = result as List<Pulpe.Application.Transaction.Dto.TransactionResponseDto>
            ?? throw new InvalidCastException("Expected list");

        list.Should().HaveCount(1);
        list[0].BudgetId.Should().Be(budgetId);
    }
}
