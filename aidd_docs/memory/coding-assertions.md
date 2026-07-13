# Coding Assertions

## Before commit
| Order | Command | Checks |
| --- | --- | --- |
| 1 | `pnpm quality` | Required repo gate; typecheck, lint, architecture lint, and formatting where wired. |
| 2 | Lefthook | Filters the gate to changed workspaces and runs strict SwiftLint for staged Swift. |

## Before push
| Order | Command | Checks |
| --- | --- | --- |
| 1 | Relevant `pnpm test`, `pnpm test:e2e`, or iOS `xcodebuild test` | Behavior changed by the branch. |

CI’s `✅ CI Success` is authoritative; some workspaces do not expose every root Turbo task name.
