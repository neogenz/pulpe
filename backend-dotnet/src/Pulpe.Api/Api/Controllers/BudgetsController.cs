using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Application.Budget.Dto;
using Pulpe.Application.Budget;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/budgets")]
[Authorize]
public class BudgetsController : ControllerBase
{
    private readonly IBudgetService _budgetService;

    public BudgetsController(IBudgetService budgetService)
    {
        _budgetService = budgetService;
    }

    [HttpGet]
    public async Task<IActionResult> FindAll([FromQuery] ListBudgetsQueryDto query)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.FindAllAsync(user, query);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BudgetCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.CreateAsync(dto, user);
        return Created(string.Empty, result);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAll()
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.ExportAllAsync(user);
        return Ok(result);
    }

    [HttpGet("exists")]
    public async Task<IActionResult> CheckExists()
    {
        var user = HttpContext.GetUser();
        var hasBudget = await _budgetService.HasBudgetsAsync(user);
        return Ok(new { hasBudget });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.FindOneAsync(id, user);
        return Ok(result);
    }

    [HttpGet("{id:guid}/details")]
    public async Task<IActionResult> FindOneWithDetails(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.FindOneWithDetailsAsync(id, user);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BudgetUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.UpdateAsync(id, dto, user);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetService.RemoveAsync(id, user);
        return Ok(result);
    }
}
