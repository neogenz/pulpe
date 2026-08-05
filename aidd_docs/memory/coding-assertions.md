# Coding Assertions

## Before push
| Order | Command | Checks |
| --- | --- | --- |
| 1 | Relevant `pnpm test`, `pnpm test:e2e`, or iOS `xcodebuild test` | Behavior changed by the branch. |

CI’s `✅ CI Success` is authoritative; some workspaces do not expose every root Turbo task name.
