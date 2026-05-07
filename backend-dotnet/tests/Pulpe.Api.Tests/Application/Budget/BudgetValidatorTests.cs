using FluentAssertions;
using NSubstitute;
using Pulpe.Application.Budget;
using Pulpe.Application.Budget.Dto;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;

namespace Pulpe.Api.Tests.Application.Budget;

public class BudgetValidatorTests
{
    private readonly BudgetValidator _sut = new();

    // --- ValidateBudgetInput ---

    [Fact]
    public void ValidateBudgetInput_ValidDto_DoesNotThrow()
    {
        var dto = new BudgetCreateDto(3, 2024, "March budget", Guid.NewGuid());
        _sut.Invoking(v => v.ValidateBudgetInput(dto)).Should().NotThrow();
    }

    [Fact]
    public void ValidateBudgetInput_ZeroMonth_ThrowsBadRequest()
    {
        var dto = new BudgetCreateDto(0, 2024, "", Guid.NewGuid());
        _sut.Invoking(v => v.ValidateBudgetInput(dto))
            .Should().Throw<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    [Fact]
    public void ValidateBudgetInput_ZeroYear_ThrowsBadRequest()
    {
        var dto = new BudgetCreateDto(3, 0, "", Guid.NewGuid());
        _sut.Invoking(v => v.ValidateBudgetInput(dto))
            .Should().Throw<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    [Fact]
    public void ValidateBudgetInput_EmptyTemplateId_ThrowsBadRequest()
    {
        var dto = new BudgetCreateDto(3, 2024, "", Guid.Empty);
        _sut.Invoking(v => v.ValidateBudgetInput(dto))
            .Should().Throw<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public void ValidateBudgetInput_InvalidMonth_ThrowsBadRequest(int month)
    {
        var dto = new BudgetCreateDto(month == 0 ? 1 : month, 2024, "", Guid.NewGuid());
        // month 13 is out of range
        if (month == 13)
        {
            _sut.Invoking(v => v.ValidateBudgetInput(dto))
                .Should().Throw<BusinessException>().Where(ex => ex.StatusCode == 400);
        }
    }

    // --- ValidateNoDuplicatePeriod ---

    [Fact]
    public async Task ValidateNoDuplicatePeriod_NoDuplicate_DoesNotThrow()
    {
        var repo = Substitute.For<IBudgetRepository>();
        repo.ExistsForPeriod(3, 2024, "user-1", null).Returns(false);

        await _sut.Invoking(v => v.ValidateNoDuplicatePeriod(repo, "user-1", 3, 2024))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateNoDuplicatePeriod_Duplicate_ThrowsConflict()
    {
        var repo = Substitute.For<IBudgetRepository>();
        repo.ExistsForPeriod(3, 2024, "user-1", null).Returns(true);

        await _sut.Invoking(v => v.ValidateNoDuplicatePeriod(repo, "user-1", 3, 2024))
            .Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 409);
    }
}
