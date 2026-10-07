# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Panta is a GitHub-centered coding-session tracker: the user declares a session on one repository, and GitHub commits within that time window are the evidence of what happened. `README.md` is the detailed reference for features, routes, endpoints, GitHub App setup, and current limitations. Keep it accurate when behavior changes.

## Commands

```bash
npm install
npm run dev       # Vite dev server + API middleware at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serves dist/ with the same API middleware, in production mode
```

There is no test suite, linter, or formatter configured. Verify changes with `npm run build` and by running the app.

Sign-in needs `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` in the root `.env` (see `.env.example`). Only the server reads them. Never expose them through `VITE_` variables. `npm run preview` runs in production mode, which rejects a non-HTTPS callback URL and sets `Secure` cookies, so local sign-in only works under `npm run dev`.

## Architecture

### Server is a Vite plugin, not a separate process

`vite.config.js` registers `githubAuthApi()` from `server/githubAuth.js`, which mounts one middleware into both the dev and preview servers. There is no standalone backend and no database.

- `githubAuth.js` owns all server state in in-memory `Map`s (login sessions keyed by the `panta_session` cookie, presence, mutuals cache), prunes expired entries on each request, and builds a per-request `context` object (cookies, env, `getSession()`, `writeJson`, `redirect`, cookie helpers). Paths it doesn't handle fall through to `next()`.
- Route handlers in `authRoutes.js` and `githubRoutes.js` take that `context` and return `true` when they handled the request. Dispatch is plain string and regex matching on `"METHOD /path"`. To add a data route, add its path to `isGitHubDataRoute()` and handle it in `handleGitHubDataRoute()`.
- `githubApi.js` is the only module that calls the GitHub REST API. It handles pagination, response shaping, and `GitHubApiError` (status plus message). Route handlers pass that status and message straight to the client. The GitHub access token never leaves the server.
- Restarting the dev server clears every login session and all presence.

### Frontend: one stateful `App.jsx`, no router or state library

- `src/routing.js` holds the route table (`routePaths`), path builders, and `resolveRoute(pathname)`, which returns `{ view, ...params }`. `App.jsx` navigates with `history.pushState` and renders pages with `view === '...'` conditionals. A new route needs entries in both `routing.js` and `App.jsx`.
- `App.jsx` owns essentially all application state: identity, repositories, the active session, the completed session, real sessions, mutuals, and a shared `now` ticker. It also runs the polling effects: active-session commits and the presence heartbeat every 30s, and a mutuals refresh. Pages are presentational and receive data plus callbacks as props.
- Session lifecycle in `App.jsx`: `startSession` creates in-memory `activeSession` state, which is lost on reload. Polling merges in live commits (messages and times only). `finishSession` fetches the final commits with file and line stats and stores the session in `localStorage` under `panta.sessions.<username>`.
- `src/api/*.js` are thin `fetch` wrappers for `/api/*` that turn failures into user-facing `Error` messages.
- `src/dev-data/` contains example sessions and repositories marked `source: 'placeholder'`, plus the real session helpers (`getSessionListItems`, weekly summary) that work on both real and example sessions. `src/analytics/sessionAnalytics.js` computes the totals and breakdowns used by Analytics and, per project, by Projects. Example data is mixed into Overview, Session History, Analytics, and Projects and labeled as examples there. `pages/Projects/projectHistory.js` builds real projects (`getProjects`) only from real completed sessions, grouped by GitHub repo ID, and example projects (`getExampleProjects`) separately. Only the Projects pages see example projects; the session workspace's repository history uses real projects only.

### Code layout

Pages live in feature folders under `src/pages/<Feature>/`, with page-only components in a nested `components/`. Shared components live in `src/components/<area>/`. The Session Workspace is a single page with three phase components: SessionSetup, ActiveSession, and SessionRecap.

### Styles

Plain CSS. Each component and page has a same-named `.css` next to its `.jsx`, but **components never import CSS**. `src/index.css` is an ordered `@import` manifest (tokens, base, shared, components, then pages). Every new stylesheet must be added there in the right cascade position. Color tokens live in `src/styles/tokens.css`.

## Product invariants

These come from the README's design principles. Preserve them in UI and data changes:

- Session time (declared by the user) and GitHub activity (what GitHub observed) are separate measurements. Never derive coding time from commit timestamps, and never add productivity scores.
- A session with zero commits is valid.
- Show values that were never recorded as unavailable, not as `0`.
- Only commits GitHub attributes to the signed-in account are counted.

## Conventions

- Commit subjects follow `Panta: <summary>`, with a descriptive body that groups the major changes.
- The GitHub App should have read-only permissions only (Metadata, Contents, Followers). Don't add features that need write scopes without flagging it.
