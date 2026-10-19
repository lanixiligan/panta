<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="public/logos/panta-logo-kit/panta-wordmark-light.svg">
    <img alt="Panta" src="public/logos/panta-logo-kit/panta-wordmark.svg" width="280">
  </picture>
</h1>

<p align="center"><em>Your work, over time.</em></p>

<p align="center">
  <a href="https://pantarhei-lanixiligan.vercel.app"><strong>Live site</strong></a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="docs/setup.md#deployment">Deployment</a>
</p>

<p align="center">
  <a href="https://github.com/lanixiligan/panta/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lanixiligan/panta/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white">
  <img alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white">
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white">
</p>

Panta is a GitHub-centered tracker for focused coding sessions. You declare when you are working on a repository, and GitHub's commits from that window are the record of what happened.

It doesn't track keystrokes or IDE activity, and it doesn't score your productivity. **You set the session, and GitHub shows what happened.**

> The live site signs in with a GitHub App. It runs on free hosting, so the first load after a quiet period can take up to a minute while the server wakes.

*The name comes from the ancient Greek phrase **panta rhei**, "everything flows."*

## How It Works

A session represents a focused period of work on a single GitHub repository.

**Choose a repository → Start a session → Work → End the session → Review the recap**

1. You choose one of the GitHub repositories Panta can access.
2. You start a session with a goal, what you plan to work on. Panta records the start time. The goal can be edited during the session and afterwards, but not cleared.
3. While the session runs, Panta checks the repository for new commits every 30 seconds.
4. When you end the session, Panta records the end time and retrieves the commits for the full session window, including files changed and lines added and deleted.

Commits are collected from every branch that changed during the session, not only the default branch, so you don't declare a branch up front. Each commit records the branches GitHub found it on.

Panta keeps two concepts separate:

- **Session time** — the period of work declared by the developer.
- **GitHub activity** — what GitHub can observe during that period.

A session is valid even when no commits were made. Work that has not been pushed to GitHub is not visible to Panta, and commit timestamps are not treated as a measurement of coding time. Commits are matched to the signed-in GitHub account, so commits that GitHub does not associate with that account are not counted.

## The Session Workspace

Sessions run inside the Session Workspace (`/session-workspace`, opened from the accent **Session Workspace** button at the foot of the sidebar, which shows the live session instead while one is running). It is one page with three phases:

1. **Session Setup** — browse, search, filter, and sort the repositories Panta can access (the search, filters, and sort are kept in the URL until a session starts); select one; optionally describe what you are working on; start the session. A side panel shows your Panta history with the selected repository, or your recent work across repositories when none is selected.
2. **Active Session** — two columns. On the left, the session you declared: the elapsed-time timer at the top, then the repository and goal (editable), with the actions at the bottom (view the repository on GitHub, cancel without recording anything, or end the session). On the right, GitHub activity: when GitHub was last checked (“Checked 12s ago”), then the commits detected so far, newest first, in a list that fills the page and scrolls on its own. Narrow screens stack the two.
3. **Session Recap** — the same two columns as the active session. On the left, the session you declared: its duration in place of the timer, then the repository, goal, and time range, with **View session** and **Start another session** at the bottom. On the right, GitHub activity from the final sync: the commit count, files and line changes, and the commits made during the session, newest first, in a list that scrolls on its own.

## Features

Each page is described in full in [docs/features.md](docs/features.md).

- **Overview** — a one-screen dashboard with your next step, this week's totals, your latest sessions, and a calendar of when you work.
- **Session History** — a searchable list of completed sessions, filtered by repository and any span of days, with a detail page for each session.
- **Repositories** — the repositories you have worked on, with session time and GitHub activity kept apart.
- **Analytics** — where your time went and when you work, over any range of days.
- **Socials** — which of your GitHub mutuals are online in Panta.
- **Settings** — your account, GitHub connection, and saved session history.

## Routes

| Route | View |
| --- | --- |
| `/` | Overview |
| `/session-workspace` | Session Workspace (Setup → Active Session → Recap) |
| `/session-history` | Session History |
| `/session-history/:id` | Session detail |
| `/repositories` | Repositories (`/projects` still works) |
| `/repositories/:owner/:repo` | Repository detail |
| `/analytics` | Analytics |
| `/settings` | Settings |
| `/preview` | Public example-session preview (no sign-in needed) |

Any other path renders the Not Found view. Signed-out users see the authentication page regardless of the route, except `/preview`, which shows a handcrafted example session in the Session detail layout so visitors can see a recap before signing in. Nothing links to it yet; it will become a read-only demo once the designs are final.

Routing is implemented in `src/routing.js` and `src/App.jsx` with the History API; there is no router library.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite 7, JavaScript, plain CSS |
| Server | Node.js: Vite middleware in development, a standalone server (`npm start`) in production |
| GitHub Integration | GitHub REST API, GitHub App user authorization (OAuth) |
| Authentication | HTTP-only session cookie, server-side GitHub access tokens |

## Architecture

### Server

The server layer lives in `server/` and is registered as a Vite plugin in `vite.config.js`. It runs inside `npm run dev` and `npm run preview`. For deployment, `server/index.js` runs the same middleware as a standalone Node server (`npm start`), serving only `/api/*`.

| Module | Responsibility |
| --- | --- |
| `githubAuth.js` | Middleware entry point and Vite plugin. Owns the in-memory login sessions and presence state, parses cookies, and dispatches `/api/*` requests. |
| `authRoutes.js` | GitHub sign-in (`/api/auth/github`), the OAuth callback, the current-user check (`/api/auth/me`), logout, and the redirect to the GitHub App installation page (`/api/auth/github/install`). |
| `githubRoutes.js` | Authenticated data routes: accessible repositories, live and final session commits, presence heartbeats, and GitHub mutuals. |
| `githubApi.js` | All requests to the GitHub REST API, including pagination, response shaping, and GitHub error and rate-limit handling. |
| `sessionRoutes.js` | Stored-session routes (`/api/sessions*`) and account deletion (`/api/account`) for the signed-in user. |
| `sessionStore.js` | All SQL for stored sessions, including the pause rule and the one-time import. |
| `sessionRecords.js` | What Panta stores for a session (field whitelist) and the mapping to the client's session shape. |
| `db.js` | The Postgres pool (`DATABASE_URL`) and the schema, created on startup. |

Data routes used by the frontend:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/github/repositories` | Repositories the signed-in user can access through the app |
| `GET /api/github/repos/:owner/:repo/active-session-commits` | Commits during an active session across all branches (polled every 30 seconds) |
| `GET /api/github/repos/:owner/:repo/session-commits` | Final commits for a completed session across all branches, with file, line, and branch details |
| `POST /api/presence/heartbeat` | Marks the signed-in user as present and keeps the running session's pause clock current (sent every 30 seconds) |
| `GET /api/social/people-following` | GitHub mutuals with online/offline presence |
| `GET /api/sessions` | The signed-in user's running session and completed sessions |
| `POST /api/sessions` | Starts a session (one running session at a time) |
| `PATCH /api/sessions/:id` | Updates a session's goal |
| `DELETE /api/sessions/:id` | Deletes a completed session, or cancels the running one |
| `POST /api/sessions/:id/finish` | Ends the running session; the server records the end time and duration |
| `PUT /api/sessions/:id/activity` | Stores a completed session's commits and activity summary |
| `DELETE /api/sessions` | Deletes all completed sessions |
| `POST /api/sessions/import` | One-time import of sessions saved in the browser before session storage |
| `DELETE /api/account` | Deletes the user's stored data, revokes Panta's GitHub authorization, and signs them out everywhere |

### Authentication Flow

1. **Continue with GitHub** opens `/api/auth/github`, which sets a short-lived state cookie and redirects to GitHub.
2. GitHub redirects back to `/api/auth/github/callback`. The server verifies the state, exchanges the code for a user access token, and loads the GitHub profile.
3. The server stores the token and profile in memory and sets an HTTP-only `panta_session` cookie.
4. The browser calls `/api/auth/me` to load the signed-in user. All GitHub requests go through the server; the access token is never sent to the browser.

A login session lasts up to 8 hours or until the GitHub token expires, whichever comes first.

### Data and Persistence

Panta does not use a database yet. Now that it is deployed, database development is the next step, starting with the data below that is lost on a restart or tied to one browser.

| Data | Where it lives | Lifetime |
| --- | --- | --- |
| Login session and GitHub access token | Server memory, keyed by the `panta_session` cookie | Until logout, expiry, or a server restart |
| Active coding session | React state in the browser | Lost on page reload |
| Completed coding sessions | Browser `localStorage` (`panta.sessions.<username>`) | Per browser; kept across reloads and sign-outs |
| Presence | Server memory | 90-second online window; cleared on restart |
| Repositories and commits | GitHub, fetched on demand | — |

### Example (Dummy) Data

`src/dummy-data/` contains illustrative example data marked as examples (`source: 'placeholder'`): 25 example repositories, five handcrafted example sessions, and about 150 generated ones (`generatedSessions.js`). The generated sessions are deterministic, never overlap, and are placed over the last 120 days relative to today, so recent-period views always have data. They include sessions with no commits and sessions whose GitHub activity was never recorded. Their commits and activity totals are made up and were never retrieved from GitHub. They keep Overview, Session History, Analytics, and Repositories populated during development and are labeled as examples wherever they appear. Example repositories built from example sessions are kept separate from real ones, so they never affect the repository history shown when starting a session. They are not a mock of the GitHub API.

**Show example data** in the sidebar hides or shows all of it at once: example sessions and example repositories, including those in the session workspace. The choice is remembered in the browser (`localStorage`, `panta.showExamples`) and defaults to shown. Direct links to an example session or repository still open while examples are hidden.

The folder holds only example data; `index.js` exposes it as `getDummySessions()` and `getDummySessionById()`. The session list and weekly summary helpers live in `src/sessions/sessionHelpers.js` and the analytics calculation in `src/analytics/sessionAnalytics.js`; both work on real and example sessions alike.

## Project Structure

```text
panta/
├── index.html
├── vite.config.js            # Vite config; registers the server middleware
├── vercel.json               # Frontend hosting: proxies /api to the API, falls back to index.html
├── render.yaml               # API hosting on Render
├── package.json
├── .env.example
├── server/
│   ├── index.js              # Standalone API server for deployment
│   ├── githubAuth.js         # Middleware entry, sessions, presence, Vite plugin
│   ├── authRoutes.js         # OAuth sign-in, callback, me, logout, install link
│   ├── githubRoutes.js       # Repository, commit, presence, and mutuals routes
│   ├── githubApi.js          # GitHub REST API client
│   ├── sessionRoutes.js      # Stored-session routes
│   ├── sessionStore.js       # Session SQL
│   ├── sessionRecords.js     # Stored-field whitelist and row mapping
│   └── db.js                 # Postgres pool and schema
└── src/
    ├── main.jsx              # Entry point and render error boundary
    ├── App.jsx               # Application state, routing, and page composition
    ├── routing.js            # Route table and path helpers
    ├── index.css             # Ordered stylesheet import manifest
    ├── analytics/
    │   └── sessionAnalytics.js   # Totals and breakdowns for Analytics and Repositories
    ├── api/                  # Browser helpers for Panta's /api endpoints
    │   ├── auth.js
    │   ├── github.js
    │   └── presence.js
    ├── styles/
    │   ├── tokens.css        # Color tokens
    │   ├── base.css          # Fonts, element defaults, app frame
    │   └── shared.css        # Styles shared across pages
    ├── components/
    │   ├── auth/AuthControl.jsx (+ .css)
    │   ├── layout/Footer.jsx (+ .css)
    │   ├── navigation/SidebarNav.jsx (+ .css)        # Navigation, socials, account menu
    │   └── sessions/
    │       └── SessionCommitList.jsx (+ .css)
    ├── dummy-data/           # Example-only data (source: 'placeholder')
    │   ├── index.js
    │   ├── repositories.js
    │   ├── sessions.js
    │   ├── exampleSession.js
    │   └── generatedSessions.js
    ├── sessions/
    │   └── sessionHelpers.js # Session list items, durations, weekly summary
    └── pages/
        ├── Overview/
        │   ├── OverviewPage.jsx (+ .css)
        │   └── components/DashboardSections.jsx (+ .css)
        ├── SessionWorkspace/
        │   ├── SessionWorkspacePage.jsx (+ .css)
        │   └── components/
        │       ├── SessionSetup/SessionSetup.jsx (+ .css)
        │       ├── ActiveSession/ActiveSession.jsx (+ .css)
        │       └── SessionRecap/SessionRecap.jsx (+ .css)
        ├── SessionHistory/
        │   ├── SessionHistoryPage.jsx (+ .css)
        │   └── SessionDetailPage.jsx (+ .css)
        ├── Projects/
        │   ├── ProjectsPage.jsx (+ .css)
        │   ├── ProjectDetailPage.jsx
        │   └── projectHistory.js                      # Derives projects from sessions
        ├── Analytics/AnalyticsPage.jsx (+ .css)
        ├── Settings/SettingsPage.jsx (+ .css)
        ├── Authentication/AuthenticationPage.jsx (+ .css)
        ├── NotFoundPage.jsx
        └── NotFoundPage.css
```

`(+ .css)` marks a component or page with a stylesheet of the same name next to it.

### Styles

Styles are plain CSS. Each component, page, and Session Workspace phase has its own stylesheet next to its JSX, and `src/styles/` holds the global layers. Components do not import CSS themselves: `src/index.css` imports every stylesheet in a fixed order (tokens, base, shared, components, then pages) so the cascade order stays explicit. Add new stylesheets to that list.

## Getting Started

```bash
git clone https://github.com/lanixiligan/panta.git
cd panta
npm install
cp .env.example .env   # add the GitHub App credentials
npm run dev            # http://localhost:5173
```

The environment variables, GitHub App configuration, and deployment steps are in [docs/setup.md](docs/setup.md).

## Design Principles

Panta is built around a simple distinction:

> **The user defines the session. GitHub provides the evidence.**

The session timer represents the period of focused work declared by the developer.

GitHub activity represents what GitHub can actually observe during that period.

These should not be treated as the same measurement.

For example, a developer could spend an hour debugging a problem without creating a commit. That is still a valid coding session, even though GitHub may have little or no activity to report.

Likewise, a commit timestamp should not be interpreted as an exact measurement of how long someone spent coding.

Panta therefore avoids surveillance-style tracking and artificial productivity scores in favor of a simple session history grounded in observable GitHub activity.

## Current Limitations

Panta is under active development. In the current implementation:

- Completed sessions are stored in the browser's `localStorage`, so history is per browser and is not synced across devices.
- An active session exists only in the open page and is lost if the page is reloaded.
- Login sessions and presence are kept in server memory, so restarting the server signs everyone out.
- The API's free hosting sleeps after about 15 minutes with no open tabs, which signs everyone out. While a signed-in tab is open, its 30-second presence heartbeat keeps the server awake.
- Live polling retrieves commit messages and times only; file and line totals are retrieved when the session ends.
- Commit queries cost one GitHub request per branch whose latest commit falls in the session window, plus a one-time lookup of each new branch head. Repositories with many active branches use more of the GitHub rate limit.
- Sessions completed before branch detection was added have no branch information until you use **Check GitHub again** on their detail page.

## Name

**Panta** comes from the Greek philosophical expression *panta rhei*, commonly translated as **"everything flows."**

The name reflects the idea that development is an ongoing process:

**sessions → activity → history → progress**

Individual work periods become part of a larger picture of how a project evolves over time.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Built by [Lanix Iligan](https://github.com/lanixiligan)
