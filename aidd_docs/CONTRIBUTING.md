# Contributing to this project's AI context

How to add or change the context AI assistants rely on here. For authoring AIDD skills, agents, rules, and templates, see the [framework guide](https://github.com/ai-driven-dev/framework/blob/main/CONTRIBUTING.md).

## Changing project memory

Add or edit a file under `aidd_docs/memory/`. See [`memory/README.md`](memory/README.md) for what belongs there and how it loads.

## Adding AI content

- Use the AIDD generator skills for skills, rules, agents, commands, and hooks so every configured tool receives the correct shape.
- Review changes to AI behavior with the same care as application code.

## House conventions

- Use lowercase kebab-case names and keep one durable concern per memory file.
- Memory stores current, non-derivable decisions and gotchas. Path-specific coding constraints belong in `.claude/rules/`; product and design truth stays in its existing canonical document.
- Link to code or canonical documentation instead of copying schemas, file trees, or long procedures.
