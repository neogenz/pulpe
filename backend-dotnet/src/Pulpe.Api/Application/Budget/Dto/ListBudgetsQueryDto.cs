namespace Pulpe.Api.Application.Budget.Dto;

public record ListBudgetsQueryDto(string? Fields, int? Limit, int? Year);
