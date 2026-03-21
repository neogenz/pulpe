using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Pulpe.Api.Application.Budget;
using Pulpe.Api.Application.Budget.Dto;
using Pulpe.Api.Application.Common;
using Pulpe.Api.Domain.Budget;
using Pulpe.Api.Domain.Common;
using Pulpe.Api.Domain.Encryption;
using Pulpe.Api.Domain.Transaction;
using Pulpe.Api.Domain.User;
using Pulpe.Api.Tests.Helpers;
using DomainBudget = Pulpe.Api.Domain.Budget.Budget;
using DomainBudgetLine = Pulpe.Api.Domain.Budget.BudgetLine;
using DomainTransaction = Pulpe.Api.Domain.Transaction.Transaction;

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

    private readonly object _supabase = new();
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
        _repo.FindById(budget.Id, _supabase).Returns(budget);

        var result = await _sut.FindOne(budget.Id, _user, _supabase);

        result.Data.Should().NotBeNull();
        result.Data!.Id.Should().Be(budget.Id);
        result.Data.Month.Should().Be(budget.Month);
    }

    [Fact]
    public async Task FindOne_NotFound_ThrowsNotFound()
    {
        _repo.FindById(Arg.Any<Guid>(), _supabase).Returns((DomainBudget?)null);

        await _sut.Invoking(s => s.FindOne(Guid.NewGuid(), _user, _supabase))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 404);
    }

    // --- Create ---

    [Fact]
    public async Task Create_ValidDto_CreatesBudgetAndRecalculates()
    {
        var templateId = Guid.NewGuid();
        var dto = new BudgetCreateDto(3, 2024, "March", templateId);
        var createdBudget = TestMocks.MakeBudget(month: 3, year: 2024, templateId: templateId);

        _repo.ExistsForPeriod(3, 2024, _user.Id, _supabase, null).Returns(false);
        _repo.Create(Arg.Any<object>(), _supabase).Returns(createdBudget);
        _repo.FindById(createdBudget.Id, _supabase).Returns(createdBudget);
        _repo.FindLinesByBudgetId(createdBudget.Id, _supabase).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(createdBudget.Id, _supabase).Returns(new List<DomainTransaction>());
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Create(dto, _user, _supabase);

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Month.Should().Be(3);
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    [Fact]
    public async Task Create_DuplicatePeriod_ThrowsConflict()
    {
        var dto = new BudgetCreateDto(3, 2024, "", Guid.NewGuid());
        _repo.ExistsForPeriod(3, 2024, _user.Id, _supabase, null).Returns(true);

        await _sut.Invoking(s => s.Create(dto, _user, _supabase))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 409);
    }

    [Fact]
    public async Task Create_InvalidMonth_ThrowsBadRequest()
    {
        var dto = new BudgetCreateDto(13, 2024, "", Guid.NewGuid());

        await _sut.Invoking(s => s.Create(dto, _user, _supabase))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    // --- Update ---

    [Fact]
    public async Task Update_ValidDto_UpdatesBudgetAndInvalidatesCache()
    {
        var budgetId = Guid.NewGuid();
        var dto = new BudgetUpdateDto(Description: "Updated", Month: null, Year: null);
        var budget = TestMocks.MakeBudget(id: budgetId);

        _repo.Update(budgetId, Arg.Any<object>(), _supabase).Returns(budget);
        _repo.FindById(budgetId, _supabase).Returns(budget);
        _repo.FindLinesByBudgetId(budgetId, _supabase).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(budgetId, _supabase).Returns(new List<DomainTransaction>());
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Update(budgetId, dto, _user, _supabase);

        result.Success.Should().BeTrue();
        await _cache.Received(1).InvalidateForUser(_user.Id);
    }

    // --- Remove ---

    [Fact]
    public async Task Remove_DeletesBudgetAndInvalidatesCache()
    {
        var budgetId = Guid.NewGuid();
        _repo.Delete(budgetId, _supabase).Returns(Task.CompletedTask);
        _cache.InvalidateForUser(_user.Id).Returns(Task.CompletedTask);

        var result = await _sut.Remove(budgetId, _user, _supabase);

        result.Success.Should().BeTrue();
        await _repo.Received(1).Delete(budgetId, _supabase);
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

        _repo.FindAll(_user.Id, _supabase).Returns(budgets);
        _userMeta.GetPayDayOfMonth(_user.AccessToken).Returns(1);

        // Stub rollover lookups
        var bId = budgets[0].Id;
        _repo.FindById(bId, _supabase).Returns(budgets[0]);
        _repo.FindLinesByBudgetId(bId, _supabase).Returns(new List<DomainBudgetLine>());
        _txRepo.FindByBudgetId(bId, _supabase).Returns(new List<DomainTransaction>());
        _repo.FindAll(budgets[0].UserId.ToString(), _supabase).Returns(budgets);

        var result = await _sut.FindAll(_user, _supabase);

        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(1);
    }

    // --- HasBudgets ---

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task HasBudgets_ReturnsRepositoryResult(bool expected)
    {
        _repo.HasBudgets(_user.Id, _supabase).Returns(expected);
        var result = await _sut.HasBudgets(_user, _supabase);
        result.Should().Be(expected);
    }
}
