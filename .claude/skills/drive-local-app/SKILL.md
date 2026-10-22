---
name: drive-local-app
description: Drive the local Pulpe webapp in a real Chrome with the dev-browser CLI, to reproduce a UI bug, verify a change or walk a user journey. Covers the install, checking which server really answers on a port, logging in (demo mode, or the seed account and its PIN), French copy, and keeping parallel worktree sessions apart. Use for any browser check of the local webapp.
---

# Drive the local app

`dev-browser` runs Puppeteer scripts against a Chrome it keeps warm between calls, so a
login survives from one command to the next. Its own help is the API reference:
`dev-browser --help`, then `dev-browser help <topic>`. This skill only holds what is
specific to Pulpe and to running several worktrees at once.

## Install, once per machine

```bash
bun add -g dev-browser@1.0.0-rc.4 && bun pm -g trust dev-browser
dev-browser --help | head -1   # must name 1.0.0-rc.4
```

- Always name the version. The npm `latest` tag is still the 0.2 line, whose API differs.
- `~/.bun/bin` must come before nvm on `PATH`. A copy installed with `npm i -g` lives in one
  Node version only and shadows or disappears when nvm switches.

## One browser for every worktree

The daemon and its state (`~/.dev-browser/v1`) are machine-wide: every worktree session
talks to the same Chrome.

- Name pages after the worktree folder (`browser.getPage("<worktree>")`) so two sessions
  never drive the same tab.
- A second account needs its own browser: `-b pulpe-seed`.
- Prefer `--headless`. Headed and headless keep separate profiles, so a login made in one
  is absent from the other.

## Check which app answers

Ports are machine-wide too. Before trusting a page, check that the server on the port
belongs to this worktree:

```bash
lsof -nP -iTCP:4200 -sTCP:LISTEN              # webapp
lsof -nP -a -c bun -iTCP -sTCP:LISTEN         # API candidates: the API runs on bun
lsof -a -p <pid> -d cwd -Fn                   # its folder must be this worktree
```

- `localhost` resolves IPv6 first. A sibling project listening on `[::1]:<port>` answers
  instead of Pulpe, for the webapp as for the API. The API port the webapp calls is
  `.backend.apiUrl` in `frontend/projects/webapp/public/config.json`.
- When the API runs on another port than the one in `frontend/.env`, regenerate the
  webapp config from `frontend/`, then reload the page (a shell variable wins over `.env`):
  `PUBLIC_BACKEND_API_URL=http://localhost:<port>/api/v1 pnpm run generate:config`.
- Open the webapp on `localhost`, not `127.0.0.1`: dev CORS only allows `localhost`
  origins, and the Supabase session is stored per origin.

## Log in

- **Demo:** on `/welcome`, click "Essayer sans compte" (`[data-testid="demo-link"]`). It
  creates a demo user and asks for no PIN in that tab.
- **Seed account** (local Supabase only): the email, password and PIN are in the header of
  `backend-nest/supabase/seed.sql`. Fill `/login`. On `/enter-vault-code`, click the PIN
  field first, then `await page.keyboard.type(pin)`; it submits on its own.
- The vault key lives in the tab's `sessionStorage`. A new named page asks for the PIN
  again, so keep using the same page.
- Profiles keep the login of earlier runs, so `/welcome` or `/login` can land on
  `/enter-vault-code`. On the seed browser, type the PIN: the session is already the seed
  account. On the demo browser nobody knows the PIN: click "Se déconnecter" and start a new
  demo. Signing out only ends that browser's session.

After login the app opens `/dashboard`, the current month. Its detail page: `goto('/budget')`,
then open the month card marked "Actuel".

## French copy

Headless Chrome reports `en-US`. Load the first URL with `?lang=fr`; the choice is stored
(`pulpe-settings-language`) and later pages stay in French.

## Writing scripts

- Quote the heredoc (`<<'EOF'`). Unquoted, the shell expands `$eval`, `$$` and `${...}`
  inside the script.
- Console errors print after the script's result. The data cache logs a dozen debug lines
  per page; add `--quiet-page` unless you are hunting a console error.
- `page.shot()` saves a JPEG under `~/.dev-browser/v1/tmp`; open the image to see it.
