namespace Pulpe.Api.Application.Common;

public record ApiResponse<T>(bool Success, T Data);

public record ApiListResponse<T>(bool Success, List<T> Data);
