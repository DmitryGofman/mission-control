# Mission Control — Project Management App
## Technical Specification & Build Backbone

> Single-project MVP (no AI) → multi-project + AI agent in later phases.
> This document is the source of truth for rebuilding the app in a real codebase.

---

## 1. Product thesis

A generic task tracker is commoditized (Monday, Jira, Notion already do it). **The differentiator is a built-in AI agent** that understands the project, asks clarifying questions, and moves work forward through natural language — not another board to click around in.

Strategy: ship a **rock-solid task manager first** (this MVP), validate it in real use, then layer the agent on top once the data model and backend are proven. Build the boring foundation well so the interesting part has something to stand on.

---

## 2. Scope by phase

### Phase 1 — MVP (current build)
- Single project.
- Tasks with: assembly (מכלול), title, priority, status, assignee, controller, due date, notes.
- Three views: status board (Kanban), by-person, by-assembly.
- Add / edit / delete tasks.
- Live KPI counts per status.
- Built-in audit log (every add/edit/delete recorded with timestamp).
- Persistent storage (browser for the prototype; database in the coded version).
- Hebrew RTL, mobile-responsive.
- **No AI.**

### Phase 2 — Backend + multi-project
- Real backend (API + database), replacing browser storage.
- Multiple projects with a project switcher.
- One shared team/assignee/assembly config per project.
- Auth (even single-user login to start).
- Audit log persisted server-side.

### Phase 3 — AI agent (the real value)
- Natural-language command bar: "Alon finished the prototype assembly, but found a cable issue — log it as a blocker."
- Agent parses intent → proposes structured actions → asks clarifying questions when data is missing → applies on confirmation.
- Agent can answer questions about project state ("what's stuck for Dima?").
- Every agent action flows through the same audit log.

---

## 3. Data model

### Task
| field | type | notes |
|---|---|---|
| `id` | int / uuid | primary key |
| `projectId` | int / uuid | Phase 2+ (omit in Phase 1) |
| `asm` | enum | assembly — see config list |
| `task` | string | title, required |
| `pri` | enum | `גבוה` / `בינוני` / `נמוך` |
| `status` | enum | `בעבודה` / `תקוע` / `לבדיקה` / `בוצע` |
| `who` | enum | assignee (from people list) |
| `ctrl` | string | controller / reviewer (free text) |
| `due` | string | target date "DD.M.YY"; migrate to ISO date in coded version |
| `notes` | string | long text |
| `createdAt` | datetime | Phase 2 |
| `updatedAt` | datetime | Phase 2 |

### AuditLogEntry
| field | type | notes |
|---|---|---|
| `ts` | string/datetime | timestamp |
| `action` | string | e.g. "נוספה משימה", "עודכן שדה", "נמחקה משימה" |
| `detail` | string | human-readable change description |
| `taskId` | int | Phase 2: link to task |
| `actor` | string | Phase 2: user; Phase 3: "agent" when AI-driven |

### Config (per project in Phase 2)
- **statuses**: `בעבודה`, `תקוע`, `לבדיקה`, `בוצע` (each with a color).
- **assemblies (מכלול)**: כללי, פרופיל אב, Sbru, אלקטרוני, תחנה קדמית, תחנה אחורית, פולו/פוקר, בומרנג, בייסבול, בלנדר (each with a distinct color).
- **people**: דימה, אלון, ליאב, אמיתי, אופק.
- **priorities**: גבוה, בינוני, נמוך (each with a color).

---

## 4. Color tokens

Background `#0B0E14` · Panel `#141A24` · Panel-2 `#1B2230` · Line `#283041` · Ink `#E6EDF3` · Muted `#8B97A8` · Gold accent `#E8B84B`.

Status: בוצע `#3FB950` · בעבודה `#E8C547` · תקוע `#F85149` · לבדיקה `#F778BA`.

Assemblies: כללי `#5A6573` · פרופיל אב `#E8B84B` · Sbru `#58A6FF` · אלקטרוני `#3FB950` · תחנה קדמית `#F778BA` · תחנה אחורית `#BC8CFF` · פולו/פוקר `#F0883E` · בומרנג `#56D4DD` · בייסבול `#DB6D28` · בלנדר `#A5D6A7`.

Text color on a colored chip is chosen by luminance (dark text on light chips, white on dark).

---

## 5. Views

1. **Board (מפת משימות)** — four columns by status, in order: בעבודה, תקוע, לבדיקה, בוצע. Cards show priority badge, title, assembly pill, assignee, due date.
2. **By person (לפי איש צוות)** — dropdown selector; shows that person's tasks + per-status mini-stats.
3. **By assembly (לפי מכלול)** — same pattern, filtered by assembly.

Tapping any card/row opens the **edit modal**. The **+ משימה חדשה** FAB opens the **add modal** (same component, add mode).

---

## 6. Architecture (coded version)

```
┌─────────────┐     HTTPS      ┌──────────────┐
│  Frontend   │ ─────────────► │   Backend    │
│  React/Vite │ ◄───────────── │  API server  │
└─────────────┘    JSON        └──────┬───────┘
                                      │
                              ┌───────▼───────┐
                              │   Database    │  tasks, audit_log,
                              │ (Postgres/    │  projects, config
                              │  SQLite)      │
                              └───────────────┘
        Phase 3 only:
        Backend also calls the AI provider (server-side, key never in browser)
        for the agent command endpoint.
```

### Recommended stack (suggestion, not mandatory)
- **Frontend:** React + Vite. Keep the component structure from the MVP.
- **Backend:** Node (Express/Fastify) or Python (FastAPI). One thin API.
- **DB:** SQLite to start (zero-config), Postgres when multi-user.
- **Hosting:** Vercel/Netlify (frontend) + Railway/Render/Fly (backend), or one full-stack host.

### Why the AI must live server-side
The browser cannot safely hold an API key. The Phase 3 agent endpoint (`POST /api/agent`) runs on the backend: it receives the user's message + current task state, calls the AI provider, returns `{ reply, actions[], needsClarification }`, and the frontend applies actions after showing them to the user.

---

## 7. API surface (Phase 2+)

```
GET    /api/projects                 list projects
POST   /api/projects                 create project
GET    /api/projects/:id/tasks       list tasks
POST   /api/projects/:id/tasks       create task
PATCH  /api/tasks/:id                update task (partial)
DELETE /api/tasks/:id                delete task
GET    /api/projects/:id/log         audit log
POST   /api/agent                    (Phase 3) natural-language command
```

Every create/update/delete writes an audit_log row server-side.

---

## 8. Agent contract (Phase 3 — reference)

Request: `{ message, projectId, conversationHistory[] }`
Response (strict JSON):
```json
{
  "reply": "short Hebrew summary or one clarifying question",
  "actions": [ { "type": "add"|"update"|"delete", "id": <int?>, "fields": { } } ],
  "needsClarification": true | false
}
```
Rules: if critical info is missing (e.g. a due date was requested but not given) → `needsClarification: true`, empty `actions`, ask exactly one focused question. Never invent data. Match tasks by title/assembly when no id is given; if ambiguous, ask. The frontend shows proposed actions and applies them; agent actions are logged with `actor: "agent"`.

---

## 9. Build order checklist

**Phase 1 (done in prototype):**
- [x] Data model + seed data
- [x] Board / by-person / by-assembly views
- [x] Add / edit / delete
- [x] KPI counts
- [x] Audit log
- [x] Mobile responsive + RTL

**Phase 2:**
- [ ] Stand up backend + DB, port the data model
- [ ] Replace browser storage with API calls
- [ ] Project switcher + per-project config
- [ ] Basic auth
- [ ] Server-side audit log

**Phase 3:**
- [ ] `/api/agent` endpoint (server-side AI call)
- [ ] Command bar UI with proposed-action confirmation
- [ ] Clarifying-question loop
- [ ] Agent actions in audit log

---

## 10. Open decisions (revisit before Phase 2)
- Dates: keep "DD.M.YY" strings or move to ISO + locale formatting? (Recommend ISO internally.)
- Are assemblies/people fixed per project, or editable in-app? (Recommend editable config screen in Phase 2.)
- Single-user or real team accounts? (MVP single-user; design schema so team is an easy add.)
- Should the agent auto-apply or always confirm first? (Recommend confirm-first until trusted.)
