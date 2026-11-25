# The project memory is linked from CLAUDE.md, not imported

- Date: 2026-11-25
- Status: Accepted

## Context

`CLAUDE.md` (and `AGENTS.md`, a symlink to it) lists the files of `aidd_docs/memory/`. With `@aidd_docs/memory/…` imports, Claude Code loads all of them, about 21 KB, into every session, whatever the task. #789 replaced the imports with markdown links so a session reads only the files its task needs. The aidd-context plugin (2.11) rewrites the list between its `aidd_project_memory` markers as `@` imports in `CLAUDE.md`; it refuses to touch a block holding link lines and its Stop hook reports « not synced » at the end of every turn.

## Decision

Keep the links and drop the `aidd_project_memory` markers, so the plugin leaves `CLAUDE.md` alone. The list of memory files is maintained by hand.

## Alternatives

- Let the plugin write `@` imports: the list stays in sync on its own, but every session pays the 21 KB again, which #789 removed on purpose.
- Keep links inside the markers: the Stop hook blocks every turn end.

## Consequences

Adding or removing a file in `aidd_docs/memory/` means editing the list in `CLAUDE.md` in the same change. Re-running the aidd-context wiring would add the markers back; remove them again.
