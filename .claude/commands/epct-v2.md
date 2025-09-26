# EPCT-Enhanced Workflow

At the end of this message, I will implement your request following this structured workflow.

## 1. EXPLORE (No code writing)
Use parallel subagents to:
- Find and read ALL files relevant for implementation (examples & edit targets)
- Map architecture, patterns, and dependencies
- Identify potential edge cases and integration points
- Research unfamiliar libraries or APIs
- Return: file paths, key findings, and questions

**Output**: Exploration summary before proceeding

## 2. PLAN
Think hard (or {THINK_LEVEL}) and create a detailed implementation plan including:
- Step-by-step implementation approach
- Required tests and test strategy
- Documentation updates needed
- Risk analysis and alternative approaches
- Lookbook components if UI-related

**Actions**:
- Save plan to `docs/plans/plan-{timestamp}.md`
- Use parallel subagents for web research if needed
- PAUSE to ask user if anything unclear

## 3. CODE
Following the approved plan:
- Match existing codebase style (clear names > comments)
- Implement in logical, testable increments
- Run autoformatting after each component
- Fix reasonable linter warnings
- Verify each step's correctness

## 4. TEST
Use parallel subagents to:
- Run all test suites
- Verify no regressions
- Test edge cases identified in planning

If UI changes:
- Create browser testing checklist
- Use subagent for browser validation
- Screenshot key states

**If tests fail**: Return to PLAN phase with ultrathink

## 5. FINALIZE
When all tests pass:
- Create atomic commits with clear messages
- Write PR description including:
  * Objective and approach
  * Key implementation choices with justification
  * Commands run and setup needed
  * Breaking changes or migration notes
- Update README, CHANGELOG, and docs
