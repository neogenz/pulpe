# Ralph Agent Instructions

## Your Task

You are an autonomous AI coding agent running in a loop. Each iteration, you implement ONE user story from the PRD.

**CRITICAL: Start executing immediately. Do NOT ask questions, do NOT present options, do NOT wait for confirmation. Read the PRD, pick the next story, and implement it.**

## Project Context

This is an **iOS SwiftUI app** (Pulpe — personal finance). The task is to harmonize the UI to match the Design Architecture (DA).

**Key reference files (READ progress.txt FIRST for the full cheat sheet):**
- `ios/Pulpe/Shared/Design/DesignTokens.swift` — spacing, radius, shadow tokens
- `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` — all semantic colors
- `ios/Pulpe/Shared/Styles/Typography.swift` — PulpeTypography
- `ios/Pulpe/Shared/Extensions/View+Extensions.swift` — .pulpeCard(), .pulpeSectionHeader()
- `memory-bank/DA.md` — Direction Artistique (brand guidelines)

**NEVER touch:** `Shared/Components/CustomTabBar.swift`

## Execution Sequence

1. **Read Context**
   - Read the PRD (prd.json) to understand all user stories
   - Read progress.txt to see patterns and learnings from previous iterations
   - Identify the **highest priority** story where `passes: false`

2. **Check Git Branch**
   - Verify you're on the correct branch (see `branchName` in prd.json)
   - If not, checkout the branch: `git checkout <branchName>` or create it

3. **Read Design System First**
   - Before modifying ANY view, read the relevant design system files
   - Check what tokens exist (colors, typography, spacing)
   - Check progress.txt replacement cheat sheet

4. **Implement ONE Story**
   - Focus on implementing ONLY the selected story
   - Follow the acceptance criteria exactly
   - Make minimal changes to achieve the goal
   - ZERO hardcoded values: use DesignTokens, Color+Pulpe, PulpeTypography

5. **Verify Quality**
   - Build check: `xcodegen generate && xcodebuild build -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO`
   - If build fails, fix the issue before proceeding
   - Verify no .red, .green, .white, .black, .stroke() remain in modified files

6. **Commit Changes**
   - Stage changed files specifically (not `git add .`)
   - Commit with format: `feat(ios): [STORY-ID] - [Title]`
   - Example: `feat(ios): US-013 - Harmonize LoginView`

7. **Update PRD**
   - Update prd.json to mark the story as `passes: true`
   - Add any notes about the implementation

8. **Log Learnings**
   - Append to progress.txt with format:

```
## [Date] - [Story ID]: [Title]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
---
```

## Codebase Patterns

Check the TOP of progress.txt for patterns discovered by previous iterations:
- Follow existing patterns
- Add new patterns when you discover them
- Update patterns if they're outdated

## Stop Condition

**If ALL stories have `passes: true`**, output this exact text:

<promise>COMPLETE</promise>

This signals the loop to stop.

## Critical Rules

- NEVER implement more than ONE story per iteration
- NEVER skip the build verification step
- NEVER commit if build is failing
- NEVER touch CustomTabBar.swift
- NEVER use .red, Color.red, .green, Color.green in views
- NEVER use .white/.black hardcoded in views (use DA semantic tokens)
- NEVER use .stroke()/.border() on form inputs
- ALWAYS check progress.txt for patterns FIRST
- ALWAYS read design system files before modifying views
- ALWAYS update prd.json after implementing
- ALWAYS append learnings to progress.txt
- ALWAYS verify build compiles after changes
