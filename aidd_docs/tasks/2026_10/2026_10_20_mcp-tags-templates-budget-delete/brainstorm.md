# Agent tools for tags and templates, and deleting a future budget

The Pulpe MCP connector exposes fifteen tools (PUL-349). Its scope explicitly left out tags, template editing and budget deletion. The user wants an agent to (1) list their expenses and attach the right tags, creating, renaming or deleting tags when needed, and (2) manage templates end to end: CRUD, duplicate a template under a new name to tweak one envelope, create a budget from a template, and change a forecast or an allocated expense over the next N months. Separately, deleting a monthly budget exists in the API (`DELETE /budgets/:id`) and in the iOS service layer, but no screen on any platform calls it and the agent cannot do it either.

The work splits into three independent deliveries, each with its own ticket and pull request.

## What Is Clear

- The agent client owns the "recap before writing" step. The MCP side only has to make bulk tagging cheap (one call for many movements) and flag rename and delete as destructive so the client asks for confirmation.
- The agent may create, rename and delete tags.
- Changing a forecast "over N months" has two modes, and both are needed: edit the template line and propagate, or edit the matching forecasts in the budgets of an explicit month range without touching the template.
- When the user does not say which mode or range applies, the tool asks (elicitation) instead of guessing.
- Manually adjusted forecasts keep their protection against propagation, as today.
- The target of "modify my expense X over the next 3 months" can be an envelope (forecast) or an allocated expense (a movement attached to a forecast). The tool changes whichever one matches; when the match is ambiguous, it asks.
- Duplicating a template serves lasting variants: copy "Mois standard" as "Mois été", lower one envelope, create July and August from it.
- "Create a budget from a template" already exists as `create_month_from_template`; it stays as is.
- Only future budgets can be deleted, at first.
- When a future budget carries links to other budgets (a share of a spread expense, a savings-goal contribution), deletion asks for explicit confirmation, in every UI and through the agent.
- Budget deletion ships on the API, the web app, iOS, Android and the MCP connector.

## Still Open

- How the backend recomputes the rollover chain and spread or savings-goal state after a budget disappears is unverified; the plan must confirm it before choosing between blocking and cascading.
