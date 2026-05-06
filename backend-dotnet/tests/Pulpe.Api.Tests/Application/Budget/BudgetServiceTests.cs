using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Pulpe.Application.Budget;
using Pulpe.Application.Budget.Dto;
using Pulpe.Application.Common;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Domain.User;
using Pulpe.Api.Tests.Helpers;
using DomainBudget = Pulpe.Domain.Budget.Budget;
using DomainBudgetLine = Pulpe.Domain.Budget.BudgetLine;
using DomainTransaction = Pulpe.Domain.Transaction.Transaction;

namespace Pulpe.Api.Tests.Application.Budget;

public class BudgetServiceTests
{
    private readonly IBudgetRepository _repo = Substitute.For<IBudgetRepository>();
    private readonly ITransactionRepository _txRepo = Substitute.For<ITransactionRepository>();
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly IUserMetadataService _userMeta = Substitute.For<IUserMetadataService>();
    private readonly BudgetCalculator _calculator;
    private readonly BudgetValidator _validator = new();
    private readonly BudgetService _sut;

    private readonly AuthenticatedUser _user = TestMocks.MakeUser();

    public BudgetServiceTests()
    {
        _calculator = new BudgetCalculator(
            _repo, _txRepo, _encryption, NullLogger<BudgetCalculator>.Instance);

        _sut = new BudgetService(
            _calculator, _validator,
            _repo, _txRepo, _encryption,
            _cache, _userMeta,
            NullLogger<BudgetService>.Instance);

        // Default DEK
        _encryption.GetUserDek(Arg.Any<string>(), Arg.Any<byte[]>()).Returns(new byte[32]);
        _encryption.EnsureUserDek(Arg.Any<string>(), Arg.Any<byte[]>()).Returns(new byte[32]);
        _encryption.TryDecryptAmount(Arg.Any<string?>(), Arg.Any<byte[]>(), Arg.Any<decimal>()).Returns(100m);
        _encryption.EncryptAmount(Arg.Any<decimal>(), Arg.Any<byte[]>()).Returns("encrypted");
        _userMeta.GetPayDayOfMonth(Arg.Any<string>()).Returns(1);
    }

    // --- FindOne ---

    [Fact]
    public async Task FindOne_ExistingBudget_ReturnsBudgetDto()
    {
        var budget = TestMocks.MakeBudget();
        _repo.FindById(budget.Id).Returns(budget);

        var result = await _sut.FindOne(budget.Id, _user);

        result.Data.Should().NotBeNull();
        result.Data!.Id.Should().Be(budget.Id);
        result.Data.Month.Should().Be(budget.Month);
    }

    [Fact]
    public async Task FindOne_NotFound_ThrowsNotFound()
    {
        _repo.FindById(Arg.Any<Guid>()).Returns((DomainBudget?)null);

        await _sut.Invoking(s => s.FindOne(Guid.NewGuid(), _user))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 404);
    }

    // --- Create ---

    [Fact]
    public async Task Create_ValidDto_CreatesBudgetAndRecalculates()
    {
        var templateId = Guid.NewGuid();
        var dto = new BudgetCreateDto(3, 2024, "March", templateId);
        var createdBudget = TestMocks.MakeBudget(month: 3, year: 2024, templateId: templateId);

        _repo.ExistsForPeriod(3, 2024, _user.Id, null).Returns(false);
        _repo.Create(Arg.Any<object>()).Returns(createdBudget);
        _repo.FindById(createdBudget.Id).Returns(createdBudget);
        _repo.FindLinesByBudgetId(createdBudget.Id).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(createdBudget.Id).Returns(new List<DomainTransaction>());
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Create(dto, _user);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Month.Should().Be(3);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    [Fact]
    public async Task Create_DuplicatePeriod_ThrowsConflict()
    {
        var dto = new BudgetCreateDto(3, 2024, "", Guid.NewGuid());
        _repo.ExistsForPeriod(3, 2024, _user.Id, null).Returns(true);

        await _sut.Invoking(s => s.Create(dto, _user))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 409);
    }

    [Fact]
    public async Task Create_InvalidMonth_ThrowsBadRequest()
    {
        var dto = new BudgetCreateDto(13, 2024, "", Guid.NewGuid());

        await _sut.Invoking(s => s.Create(dto, _user))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    // --- Update ---

    [Fact]
    public async Task Update_ValidDto_UpdatesBudgetAndInvalidatesCache()
    {
        var budgetId = Guid.NewGuid();
        var dto = new BudgetUpdateDto(Description: "Updated", Month: null, Year: null);
        var budget = TestMocks.MakeBudget(id: budgetId);

        _repo.Update(budgetId, Arg.Any<object>()).Returns(budget);
        _repo.FindById(budgetId).Returns(budget);
        _repo.FindLinesByBudgetId(budgetId).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(budgetId).Returns(new List<DomainTransaction>());
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Update(budgetId, dto, _user);

        result.Success.Should().BeTrue();
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- Remove ---

    [Fact]
    public async Task Remove_DeletesBudgetAndInvalidatesCache()
    {
        var budgetId = Guid.NewGuid();
        _repo.Delete(budgetId).Returns(Task.CompletedTask);
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Remove(budgetId, _user);

        result.Success.Should().BeTrue();
        await _repo.Received(1).Delete(budgetId);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- FindAll (cache) ---

    [Fact]
    public async Task FindAll_UsesCacheGetOrSet()
    {
        var budgets = new List<DomainBudget> { TestMocks.MakeBudget() };

        _cache.GetOrSet<ApiListResponse<BudgetResponseDto>>(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<Func<Task<ApiListResponse<BudgetResponseDto>>>>())
            .Returns(callInfo =>
            {
                var fetcher = callInfo.ArgAt<Func<Task<ApiListResponse<BudgetResponseDto>>>>(3);
                return fetcher();
            });

        _repo.FindAll(_user.Id).Returns(budgets);
        _userMeta.GetPayDayOfMonth(_user.AccessToken).Returns(1);

        // Stub rollover lookups
        var bId = budgets[0].Id;
        _repo.FindById(bId).Returns(budgets[0]);
        _repo.FindLinesByBudgetId(bId).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(bId).Returns(new List<DomainTransaction>());
        _repo.FindAll(budgets[0].UserId.ToString()).Returns(budgets);

        var result = await _sut.FindAll(_user);

        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(1);
    }

    // --- HasBudgets ---

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HasBudgets_ReturnsRepositoryResult(bool expected)
    {
        _repo.HasBudgets(_user.Id).Returns(expected);
        var result = await _sut.HasBudgets(_user);
        result.Should().Be(expected);
    }

    // --- FindAllSparse: BUDGET_UNKNOWN_SPARSE_FIELDS ---

    [Fact]
    public async Task FindAllSparse_UnknownField_ThrowsBudgetUnknownSparseFields()
    {
        var query = new ListBudgetsQueryDto("unknownField,month", null, null);

        var act = async () => await _sut.FindAllSparse(_user, query);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.Code.Should().Be(ErrorCodes.BudgetUnknownSparseFields);
        ex.Which.StatusCode.Should().Be(400);
        ex.Which.Message.Should().Contain("unknownField");
    }

    [Fact]
    public async Task FindAllSparse_MultipleUnknownFields_MessageContainsAllInvalidNames()
    {
        var query = new ListBudgetsQueryDto("badFieldA,badFieldB,month", null, null);

        var act = async () => await _sut.FindAllSparse(_user, query);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.Code.Should().Be(ErrorCodes.BudgetUnknownSparseFields);
        ex.Which.Message.Should().Contain("badFieldA").And.Contain("badFieldB");
    }
}
