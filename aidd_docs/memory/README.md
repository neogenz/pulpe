# memory/ - Project Memory

Structured context the AI assistant reads at the start of a session, so it does not rediscover the project each time.

## How it loads

- The files at the root of `memory/` are referenced by the `<aidd_project_memory>` block in the AI context file and load every session.
- `internal/` and `external/` are listed there too, but load on demand, only when relevant.

## Files

The list below is refreshed automatically by the memory hook. Do not edit it by hand.

<!-- files:start -->
- [api.md](api.md)
- [architecture.md](architecture.md)
- [auth.md](auth.md)
- [codebase-map.md](codebase-map.md)
- [coding-assertions.md](coding-assertions.md)
- [database.md](database.md)
- [deployment.md](deployment.md)
- [design.md](design.md)
- [forms.md](forms.md)
- [integration.md](integration.md)
- [mobile.md](mobile.md)
- [navigation.md](navigation.md)
- [package.md](package.md)
- [project-brief.md](project-brief.md)
- [testing.md](testing.md)
- [vcs.md](vcs.md)
<!-- files:end -->

## How to maintain it

- One file per concern (architecture, database, vcs, ...).
- Capture the macro and the non-derivable. Point to the code, do not copy it.
- Keep each file small, well under 200 lines.
- Update a file when the underlying reality changes.
- Current state only. Never personal notes or future TODOs.

## Subdirectories

- `internal/`: AIDD workflow traces (the capability profile, audit notes, learn captures).
- `external/`: external references the project pulls in (specs, design docs).
