namespace Pulpe.Api.Domain.Common;

public class BusinessException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public object? Details { get; }
    public Dictionary<string, object>? LoggingContext { get; }

    public BusinessException(
        string code,
        string message,
        int statusCode = 400,
        object? details = null,
        Dictionary<string, object>? loggingContext = null,
        Exception? innerException = null)
        : base(message, innerException)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details;
        LoggingContext = loggingContext;
    }

    public static BusinessException NotFound(string code, string message, object? details = null) =>
        new(code, message, 404, details);

    public static BusinessException BadRequest(string code, string message, object? details = null) =>
        new(code, message, 400, details);

    public static BusinessException Forbidden(string code, string message, object? details = null) =>
        new(code, message, 403, details);

    public static BusinessException Conflict(string code, string message, object? details = null) =>
        new(code, message, 409, details);
}
