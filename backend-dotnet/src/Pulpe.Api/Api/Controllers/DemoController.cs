using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pulpe.Application.Demo;
using Pulpe.Infrastructure.Services.Demo;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/demo")]
public class DemoController : ControllerBase
{
    private readonly IDemoService _demoService;
    private readonly IWebHostEnvironment _env;

    public DemoController(IDemoService demoService, IWebHostEnvironment env)
    {
        _demoService = demoService;
        _env = env;
    }

    [HttpPost("session")]
    [EnableRateLimiting("demo")]
    public async Task<IActionResult> CreateSession([FromBody] DemoSessionRequest body)
    {
        var result = await _demoService.CreateSessionAsync(body.TurnstileToken);
        return Ok(result);
    }

    [HttpPost("cleanup")]
    public async Task<IActionResult> Cleanup()
    {
        if (_env.IsProduction())
            return Forbid();

        await _demoService.CleanupAsync();
        return Ok(new { success = true });
    }
}

public sealed class DemoSessionRequest
{
    public string TurnstileToken { get; init; } = string.Empty;
}
