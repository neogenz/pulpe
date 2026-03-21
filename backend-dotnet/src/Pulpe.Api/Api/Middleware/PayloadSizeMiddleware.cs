namespace Pulpe.Api.Api.Middleware;

public class PayloadSizeMiddleware
{
    private readonly RequestDelegate _next;
    private const long MaxBulkPayloadBytes = 1024 * 1024; // 1MB

    public PayloadSizeMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.Value?.Contains("/bulk-operations") == true)
        {
            var contentLength = context.Request.ContentLength;
            if (contentLength.HasValue && contentLength.Value > MaxBulkPayloadBytes)
            {
                context.Response.StatusCode = StatusCodes.Status413RequestEntityTooLarge;
                return;
            }
        }

        await _next(context);
    }
}
