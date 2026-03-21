using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/debug")]
public class DebugController : ControllerBase
{
    private readonly ILogger<DebugController> _logger;
    private readonly IWebHostEnvironment _env;

    public DebugController(ILogger<DebugController> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    [HttpGet("test-error/{type}")]
    public IActionResult TestError(string type)
    {
        if (!_env.IsDevelopment()) return NotFound();
        return type switch
        {
            "business" => throw new BusinessException(ErrorCodes.Unknown, "Test business error", 400),
            "not-found" => throw new BusinessException(ErrorCodes.BudgetNotFound, "Test not found", 404),
            "forbidden" => throw new BusinessException(ErrorCodes.AuthUnauthorized, "Test forbidden", 403),
            _ => throw new Exception("Test generic error")
        };
    }

    [HttpPost("test-service-error")]
    public IActionResult TestServiceError([FromBody] object? body)
    {
        if (!_env.IsDevelopment()) return NotFound();
        throw new InvalidOperationException("Test service error from body");
    }

    [HttpGet("test-log-levels")]
    public IActionResult TestLogLevels()
    {
        if (!_env.IsDevelopment()) return NotFound();
        _logger.LogDebug("Debug log test");
        _logger.LogInformation("Info log test");
        _logger.LogWarning("Warning log test");
        _logger.LogError("Error log test");
        return Ok(new { message = "Log levels tested" });
    }
}
