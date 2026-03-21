using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Pulpe.Api.Api.Filters;

public class ResponseWrapperActionFilter : IActionFilter
{
    internal static readonly JsonSerializerOptions CamelCaseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
    };

    public void OnActionExecuting(ActionExecutingContext context) { }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        if (context.Exception is not null || context.Result is null)
            return;

        if (context.Result is not ObjectResult objectResult)
            return;

        var value = objectResult.Value;
        if (value is null)
            return;

        if (HasSuccessProperty(value))
            return;

        var statusCode = objectResult.StatusCode ?? context.HttpContext.Response.StatusCode;
        var wrapped = new WrappedResponse
        {
            Success = true,
            Data = value,
            Timestamp = DateTime.UtcNow,
            Path = context.HttpContext.Request.Path,
            StatusCode = statusCode
        };

        context.Result = new JsonResult(wrapped, CamelCaseOptions) { StatusCode = statusCode };
    }

    private static bool HasSuccessProperty(object value)
    {
        var type = value.GetType();
        return type.GetProperty("Success") is not null || type.GetProperty("success") is not null;
    }
}

public sealed class WrappedResponse
{
    public bool Success { get; init; }
    public object? Data { get; init; }
    public DateTime Timestamp { get; init; }
    public string Path { get; init; } = string.Empty;
    public int StatusCode { get; init; }
}
