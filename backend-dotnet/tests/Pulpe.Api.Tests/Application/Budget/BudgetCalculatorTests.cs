using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Pulpe.Application.Budget;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Api.Tests.Helpers;
using DomainBudget = Pulpe.Domain.Budget.Budget;
using DomainBudgetLine = Pulpe.Domain.Budget.BudgetLine;
using DomainTransaction = Pulpe.Domain.Transaction.Transaction;

namespace Pulpe.Api.Tests.Application.Budget;

public class BudgetCalculatorTests
{
    private readonly IBudgetRepository _repo = Substitute.For<IBudgetRepository>();
    private readonly ITransactionRepository _txRepo = Substitute.For<ITransactionRepository>();
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly BudgetCalculator _sut;

    private readonly byte[] _clientKey = new byte[32];
    private readonly byte[] _dek = new byte[32];

    public BudgetCalculatorTests()
    {
        _sut = new BudgetCalculator(_repo, _txRepo, _encryption, NullLogger<BudgetCalculator>.Instance);
        _encryption.GetUserDek(Arg.Any<string>(), _clientKey).Returns(_dek);
        _encryption.EnsureUserDek(Arg.Any<string>(), _clientKey).Returns(_dek);
        _encryption.EncryptAmount(Arg.Any<decimal>(), _dek).Returns("encrypted");
    }

    // --- CalculateEndingBalance ---

    [Fact]
    public async Task CalculateEndingBalance_NoLinesNoTx_ReturnsZero()
    {
        var budget = TestMocks.MakeBudget();
        _repo.FindById(budget.Id).Returns(budget);
        _repo.FindLinesByBudgetId(budget.Id).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(budget.Id).Returns(new List<DomainTransaction>());

        var result = await _sut.CalculateEndingBalance(budget.Id, _clientKey);

        result.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateEndingBalance_WithIncomeAndExpense_ReturnsCorrectBalance()
    {
        var budget = TestMocks.MakeBudget();
        var incomeLineId = Guid.NewGuid();
        var expenseLineId = Guid.NewGuid();

        var lines = new List<DomainBudgetLine>
        {
            new() { Id = incomeLineId, BudgetId = budget.Id, Name = "Salary", Amount = "enc-3000", Kind = TransactionKind.Income, Recurrence = TransactionRecurrence.Fixed, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = expenseLineId, BudgetId = budget.Id, Name = "Rent", Amount = "enc-1000", Kind = TransactionKind.Expense, Recurrence = TransactionRecurrence.Fixed, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow }
        };

        _repo.FindById(budget.Id).Returns(budget);
        _repo.FindLinesByBudgetId(budget.Id).Returns(lines);
        _txRepo.FindByBudgetId(budget.Id).Returns(new List<DomainTransaction>());

        // Decrypt: income line → 3000, expense line → 1000
        _encryption.TryDecryptAmount("enc-3000", _dek, 0m).Returns(3000m);
        _encryption.TryDecryptAmount("enc-1000", _dek, 0m).Returns(1000m);

        var result = await _sut.CalculateEndingBalance(budget.Id, _clientKey);

        result.Should().Be(2000m); // 3000 income - 1000 expense
    }

    [Fact]
    public async Task CalculateEndingBalance_BudgetNotFound_ThrowsNotFound()
    {
        _repo.FindById(Arg.Any<Guid>()).Returns((DomainBudget?)null);

        await _sut.Invoking(c => c.CalculateEndingBalance(Guid.NewGuid(), _clientKey))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 404);
    }

    // --- RecalculateAndPersist ---

    [Fact]
    public async Task RecalculateAndPersist_UpdatesEndingBalance()
    {
        var budget = TestMocks.MakeBudget();
        _repo.FindById(budget.Id).Returns(budget);
        _repo.FindLinesByBudgetId(budget.Id).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(budget.Id).Returns(new List<DomainTransaction>());
        _repo.UpdateEndingBalance(budget.Id, "encrypted").Returns(Task.CompletedTask);

        await _sut.RecalculateAndPersist(budget.Id, _clientKey);

        await _repo.Received(1).UpdateEndingBalance(budget.Id, "encrypted");
    }

    // --- GetRollover ---

    [Fact]
    public async Task GetRollover_SingleBudget_ReturnsZeroRollover()
    {
        var budget = TestMocks.MakeBudget();
        _repo.FindById(budget.Id).Returns(budget);
        _repo.FindAll(budget.UserId.ToString()).Returns(new List<DomainBudget> { budget });

        var result = await _sut.GetRollover(budget.Id, 1, _clientKey);

        result.Rollover.Should().Be(0m);
    }

    [Fact]
    public async Task GetRollover_NoBudgets_ReturnsZeroResult()
    {
        var budget = TestMocks.MakeBudget();
        _repo.FindById(budget.Id).Returns(budget);
        _repo.FindAll(budget.UserId.ToString()).Returns(new List<DomainBudget>());

        var result = await _sut.GetRollover(budget.Id, 1, _clientKey);

        result.Rollover.Should().Be(0m);
        result.EndingBalance.Should().Be(0m);
    }
}
