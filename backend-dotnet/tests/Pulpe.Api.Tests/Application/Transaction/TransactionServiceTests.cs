using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Pulpe.Application.Common;
using Pulpe.Infrastructure.Services.Transaction;
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
    private readonly TransactionService _sut;

    private readonly object _supabase = new();
    private readonly AuthenticatedUser _user = TestMocks.MakeUser();
    private readonly byte[] _dek = new byte[32];

    public TransactionServiceTests()
    {
        _sut = new TransactionService(
            _txRepo, _budgetRepo, _encryption, _cache, _budgetService,
            NullLogger<TransactionService>.Instance);

        _encryption.GetUserDek(Arg.Any<string>(), Arg.Any<byte[]>()).Returns(_dek);
        _encryption.TryDecryptAmount(Arg.Any<string?>(), _dek, Arg.Any<decimal>()).Returns(50m);
        _encryption.PrepareAmountData(Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<byte[]>())
            .Returns("encrypted-amount");
        _cache.InvalidateForUser(Arg.Any<string>()).Returns(Task.CompletedTask);
        _budgetService.RecalculateBalances(Arg.Any<Guid>(), Arg.Any<object>(), Arg.Any<byte[]>())
            .Returns(Task.CompletedTask);
    }

    // --- FindOne ---

    [Fact]
    public async Task FindOne_ExistingTransaction_ReturnsDto()
    {
        var tx = TestMocks.MakeTransaction();
        _txRepo.FindById(tx.Id, _supabase).Returns(tx);

        var result = await _sut.FindOne(tx.Id, _user, _supabase);

        result.Id.Should().Be(tx.Id);
        result.Amount.Should().Be(50m);
    }

    [Fact]
    public async Task FindOne_NotFound_ThrowsNotFound()
    {
        _txRepo.FindById(Arg.Any<Guid>(), _supabase).Returns((DomainTransaction?)null);

        await _sut.Invoking(s => s.FindOne(Guid.NewGuid(), _user, _supabase))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 404);
    }

    // --- Create ---

    [Fact]
    public async Task Create_ValidDto_CreatesAndRecalculates()
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
        _txRepo.Create(Arg.Any<object>(), _supabase).Returns(created);

        var result = await _sut.Create(dto, _user, _supabase);

        result.Name.Should().Be("Coffee");
        await _budgetService.Received(1).RecalculateBalances(budgetId, _supabase, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- Update ---

    [Fact]
    public async Task Update_ValidDto_UpdatesAndRecalculates()
    {
        var txId = Guid.NewGuid();
        var budgetId = Guid.NewGuid();
        var dto = new TransactionUpdateDto(Name: "Updated coffee", Amount: null, Kind: null, TransactionDate: null, Category: null);
        var updated = TestMocks.MakeTransaction(id: txId, budgetId: budgetId, name: "Updated coffee");

        _txRepo.Update(txId, Arg.Any<object>(), _supabase).Returns(updated);

        var result = await _sut.Update(txId, dto, _user, _supabase);

        result.Name.Should().Be("Updated coffee");
        await _budgetService.Received(1).RecalculateBalances(budgetId, _supabase, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- Remove ---

    [Fact]
    public async Task Remove_DeletesTransactionAndRecalculates()
    {
        var txId = Guid.NewGuid();
        var budgetId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(id: txId, budgetId: budgetId);

        _txRepo.FindById(txId, _supabase).Returns(tx);
        _txRepo.Delete(txId, _supabase).Returns(Task.CompletedTask);

        await _sut.Remove(txId, _user, _supabase);

        await _txRepo.Received(1).Delete(txId, _supabase);
        await _budgetService.Received(1).RecalculateBalances(budgetId, _supabase, _user.ClientKey);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- ToggleCheck ---

    [Fact]
    public async Task ToggleCheck_UpdatesAndInvalidatesCache()
    {
        var txId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(id: txId);
        _txRepo.ToggleCheck(txId, _supabase).Returns(tx);

        var result = await _sut.ToggleCheck(txId, _user, _supabase);

        result.Id.Should().Be(txId);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- FindAll ---

    [Fact]
    public async Task FindAll_ReturnsDecryptedTransactions()
    {
        var tx1 = TestMocks.MakeTransaction();
        var tx2 = TestMocks.MakeTransaction();
        _txRepo.Search(string.Empty, _user.Id, _supabase, null)
            .Returns((new List<DomainTransaction> { tx1, tx2 }, new List<DomainBudgetLine>()));

        var result = await _sut.FindAll(_user, _supabase);

        result.Should().HaveCount(2);
    }

    // --- FindByBudgetId ---

    [Fact]
    public async Task FindByBudgetId_ReturnsDecryptedTransactions()
    {
        var budgetId = Guid.NewGuid();
        var tx = TestMocks.MakeTransaction(budgetId: budgetId);
        _txRepo.FindByBudgetId(budgetId, _supabase).Returns(new List<DomainTransaction> { tx });

        var result = await _sut.FindByBudgetId(budgetId, _user, _supabase);

        result.Should().HaveCount(1);
        result[0].BudgetId.Should().Be(budgetId);
    }
}
