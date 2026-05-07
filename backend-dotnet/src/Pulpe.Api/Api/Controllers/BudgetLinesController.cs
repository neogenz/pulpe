using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Application.BudgetLine;
using Pulpe.Application.BudgetLine.Dto;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/budget-lines")]
[Authorize]
public class BudgetLinesController : ControllerBase
{
    private readonly IBudgetLineService _budgetLineService;

    public BudgetLinesController(IBudgetLineService budgetLineService)
    {
        _budgetLineService = budgetLineService;
    }

    [HttpGet("budget/{budgetId:guid}")]
    public async Task<IActionResult> FindByBudget(Guid budgetId)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.FindByBudgetAsync(budgetId, user);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BudgetLineCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.CreateAsync(dto, user);
        return Created(string.Empty, result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.FindOneAsync(id, user);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BudgetLineUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.UpdateAsync(id, dto, user);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reset-from-template")]
    public async Task<IActionResult> ResetFromTemplate(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.ResetFromTemplateAsync(id, user);
        return Ok(result);
    }

    [HttpPost("{id:guid}/toggle-check")]
    public async Task<IActionResult> ToggleCheck(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.ToggleCheckAsync(id, user);
        return Ok(result);
    }

    [HttpPost("{id:guid}/check-transactions")]
    public async Task<IActionResult> CheckTransactions(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.CheckTransactionsAsync(id, user);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var user = HttpContext.GetUser();
        var result = await _budgetLineService.RemoveAsync(id, user);
        return Ok(result);
    }
}
