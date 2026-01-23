---
description: Refresh memory-bank/systemPatterns.md by analyzing current codebase structure and patterns
allowed-tools: Read, Glob, Grep, Edit, Task
---

<role>
You are a documentation specialist for the Pulpe project. Your job is to analyze the current codebase structure and update systemPatterns.md to reflect the actual architecture.
</role>

<objective>
Update memory-bank/systemPatterns.md by scanning the codebase for current patterns, conventions, and architecture decisions.

This ensures the AI context document stays accurate as the codebase evolves.
</objective>

<context>
Current systemPatterns: @memory-bank/systemPatterns.md
Monorepo structure: @CLAUDE.md
</context>

<files_to_analyze>
Key files and directories to scan for patterns:

**Monorepo Structure:**
- `CLAUDE.md` - Root overview
- `turbo.json` - Build orchestration
- `pnpm-workspace.yaml` - Package config

**Frontend (Angular):**
- `frontend/projects/webapp/src/app/core/` - Services, guards, interceptors
- `frontend/projects/webapp/src/app/layout/` - Shell components
- `frontend/projects/webapp/src/app/feature/` - Business domains
- `frontend/projects/webapp/src/app/ui/` - Reusable components
- `frontend/projects/webapp/src/app/pattern/` - Stateful patterns
- `frontend/angular.json` - Angular config

**Backend (NestJS):**
- `backend-nest/src/modules/` - Domain modules structure
- `backend-nest/src/core/` - Core services
- `backend-nest/nest-cli.json` - NestJS config

**Shared:**
- `shared/src/` - Shared schemas and types

**Testing:**
- `*.spec.ts` patterns in frontend
- `*.test.ts` patterns in backend
- `e2e/` structure
</files_to_analyze>

<process>
1. **LOAD CURRENT STATE**
   - Read current `memory-bank/systemPatterns.md`
   - Note existing sections and structure to preserve format

2. **SCAN FRONTEND ARCHITECTURE**
   - List directories in `frontend/projects/webapp/src/app/`
   - Check for new layers or removed layers
   - Identify component patterns (standalone, signals, OnPush)
   - Check for new services in `core/`

3. **SCAN BACKEND ARCHITECTURE**
   - List modules in `backend-nest/src/modules/`
   - Check module structure (controller, service, dto, entities)
   - Identify any new patterns or conventions

4. **SCAN SHARED PACKAGE**
   - Check `shared/src/` for schema patterns
   - Note export conventions

5. **IDENTIFY CHANGES**
   - Compare findings with current systemPatterns.md
   - List new patterns discovered
   - List deprecated patterns to remove
   - Note any structural changes

6. **UPDATE FILE**
   - Preserve existing format and style
   - Add new patterns with clear descriptions
   - Remove outdated patterns
   - Update any changed conventions
   - Keep file under 300 lines

7. **REPORT CHANGES**
   - Summarize what was added
   - Summarize what was removed
   - Summarize what was updated
</process>

<success_criteria>
- systemPatterns.md reflects actual codebase structure
- All layers documented accurately
- No outdated patterns remain
- New patterns clearly described
- File follows existing format
- Changes summarized to user
</success_criteria>

<output>
Modified file:
- `memory-bank/systemPatterns.md` - Updated architecture patterns
</output>
