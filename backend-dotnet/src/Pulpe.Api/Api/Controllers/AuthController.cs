using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[Authorize]
public class AuthController : ControllerBase
{
    [HttpGet("validate")]
    public IActionResult Validate()
    {
        var user = HttpContext.GetUser();
        return Ok(new
        {
            success = true,
            user = new { id = user.Id, email = user.Email }
        });
    }
}
