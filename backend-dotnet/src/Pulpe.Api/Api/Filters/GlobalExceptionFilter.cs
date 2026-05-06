using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Pulpe.Domain.Common;

namespace Pulpe.Api.Api.Filters;

public class GlobalExceptionFilter : IExceptionFilter
{
    private readonly ILogger<GlobalExceptionFilter> _logger;
    private readonly IWebHostEnvironment _env;

    private static readonly HashSet<string> SensitiveFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "token", "secret", "authorization", "auth",
        "clientKey", "client_key", "newClientKey", "new_client_key",
        "oldClientKey", "old_client_key", "recoveryKey", "recovery_key",
        "accessToken", "access_token", "refreshToken", "refresh_token"
    };

    public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public void OnException(ExceptionContext context)
    {
        var errorResponse = BuildErrorResponse(context.Exception, context.HttpContext);

        if (errorResponse.StatusCode >= 500)
        {
            _logger.LogError(context.Exception, "SERVER ERROR: {Message} [{Code}] {Method} {Path}",
                SanitizeMessage(errorResponse.Message), errorResponse.Code,
                errorResponse.Method, errorResponse.Path);
        }
        else
        {
            _logger.LogWarning("CLIENT ERROR: {Message} [{Code}] {Method} {Path}",
                SanitizeMessage(errorResponse.Message), errorResponse.Code,
                errorResponse.Method, errorResponse.Path);
        }

        context.Result = new JsonResult(errorResponse, ResponseWrapperActionFilter.CamelCaseOptions)
        {
            StatusCode = errorResponse.StatusCode
        };

        context.ExceptionHandled = true;
    }

    private ErrorResponse BuildErrorResponse(Exception exception, HttpContext ctx)
    {
        return exception switch
        {
            BusinessException bex => new ErrorResponse
            {
                Success = false,
                StatusCode = bex.StatusCode,
                Timestamp = DateTime.UtcNow,
                Path = ctx.Request.Path,
                Method = ctx.Request.Method,
                Message = bex.Message,
                Error = "BusinessException",
                Code = bex.Code,
                Context = new { },
                Details = bex.Details
            },
            ValidationException vex => new ErrorResponse
            {
                Success = false,
                StatusCode = 422,
                Timestamp = DateTime.UtcNow,
                Path = ctx.Request.Path,
                Method = ctx.Request.Method,
                Message = "Validation failed",
                Error = "ValidationException",
                Code = ErrorCodes.ValidationFailed,
                Context = new { },
                Details = vex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })
            },
            BadHttpRequestException httpEx => new ErrorResponse
            {
                Success = false,
                StatusCode = httpEx.StatusCode,
                Timestamp = DateTime.UtcNow,
                Path = ctx.Request.Path,
                Method = ctx.Request.Method,
                Message = httpEx.Message,
                Error = httpEx.GetType().Name,
                Code = $"HTTP_{httpEx.StatusCode}",
                Context = new { },
                Details = null
            },
            _ => new ErrorResponse
            {
                Success = false,
                StatusCode = 500,
                Timestamp = DateTime.UtcNow,
                Path = ctx.Request.Path,
                Method = ctx.Request.Method,
                Message = _env.IsDevelopment() ? exception.Message : "An unexpected error occurred",
                Error = _env.IsDevelopment() ? exception.GetType().Name : "InternalServerError",
                Code = ErrorCodes.Unknown,
                Context = new { },
                Details = null
            }
        };
    }

    /// <summary>
    /// Removes sensitive field values from a message string to prevent accidental logging of secrets.
    /// </summary>
    private static string SanitizeMessage(string message)
    {
        if (string.IsNullOrEmpty(message)) return message;

        foreach (var field in SensitiveFields)
        {
            if (message.Contains(field, StringComparison.OrdinalIgnoreCase))
            {
                // Redact any value following the field name in common patterns like "field=value" or "field: value"
                message = System.Text.RegularExpressions.Regex.Replace(
                    message,
                    $@"(?i){System.Text.RegularExpressions.Regex.Escape(field)}\s*[=:]\s*\S+",
                    $"{field}=[REDACTED]");
            }
        }

        return message;
    }
}

public sealed class ErrorResponse
{
    public bool Success { get; init; }
    public int StatusCode { get; init; }
    public DateTime Timestamp { get; init; }
    public string Path { get; init; } = string.Empty;
    public string Method { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Error { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public object? Context { get; init; }
    public object? Details { get; init; }
}
