# Panta

> Your work, over time.

*From the Greek philosophical idea **panta rhei** — "everything flows."*

Panta is a GitHub-centered developer activity tracker built around focused coding sessions.

Instead of measuring productivity through keystrokes, IDE activity, or artificial productivity scores, Panta lets developers define when they are working and uses GitHub as the observable record of what happened during that period.

## How It Works

A session represents a focused period of work on a single GitHub repository.

**Choose a repository → Start a session → Work → End the session → Review the recap**

1. You choose one of the GitHub repositories Panta can access.
2. You start a session, optionally with a goal. Panta records the start time.
3. While the session runs, Panta checks the repository for new commits every 30 seconds.
4. When you end the session, Panta records the end time and retrieves the commits for the full session window, including files changed and lines added and deleted.

Panta keeps two concepts separate:

- **Session time** — the period of work declared by the developer.
- **GitHub activity** — what GitHub can observe during that period.

A session is valid even when no commits were made. Work that has not been pushed to GitHub is not visible to Panta, and commit timestamps are not treated as a measurement of coding time. Commits are matched to the signed-in GitHub account, so commits that GitHub does not associate with that account are not counted.

## The Session Workspace

Sessions run inside the Session Workspace (`/session-workspace`, labeled **Start a session** in the navigation). It is one page with three phases:

1. **Session Setup** — browse, search, filter, and sort the repositories Panta can access; select one; optionally describe what you are working on; start the session. A side panel shows your Panta history with the selected repository, or your recent work across repositories when none is selected.
2. **Active Session** — an elapsed-time timer, the repository and goal, the GitHub sync status, and the commits detected so far. You can open the repository on GitHub or end the session.
3. **Session Recap** — the session duration and time range, the repository and goal, the commit, file, and line totals from the final sync, and the commits made during the session. From here you can view the session in Session History or start another session.

## Features

### Overview

A dashboard with a greeting, the active session (when one is running), a shortcut to start a session, and recent sessions. The weekly totals and "week at a glance" chart currently use the example data in `src/dev-data/`, and the "Coding now" panel is a placeholder.

### Session History

A searchable list of completed sessions with repository, status, and sort filters. Each session has a detail page with its duration, GitHub activity totals, and commits (including author and changed files when available).

### Projects

A project is a GitHub repository that has become part of your Panta work history. Projects are derived from your completed sessions — a repository appears here only after you complete a session in it — and are grouped by GitHub repository ID.

Each project card shows the total session time, a 14-day activity strip, the number of sessions and commits, and when you last worked in it. Projects can be sorted by last worked, total time, or number of sessions. A project's page shows its totals and the sessions recorded for it, each linking to its Session History entry.

### Analytics

Aggregated views of completed sessions over 7 days, 30 days, 90 days, or all time:

- session count, total time, project count, and commits
- daily session time
- time by project (repository)
- session patterns: average, longest, and shortest session, and most active day
- recorded GitHub activity: commits, files changed, and lines added and deleted
- the latest completed sessions

Values that were never recorded are shown as unavailable rather than zero. Analytics includes the example sessions from `src/dev-data/` and marks the page when they are part of the totals.

### Socials

A collapsible sidebar section listing your GitHub mutuals (people you follow who also follow you), grouped as online or offline based on recent Panta presence.

### Profile and Settings

Profile shows your GitHub identity. Its development-history section is not yet connected to Session History.

Settings shows your account and GitHub connection, links to the GitHub App installation page to manage repository access, and lets you disconnect (sign out).

## Routes

| Route | View |
| --- | --- |
| `/` | Overview |
| `/session-workspace` | Session Workspace (Setup → Active Session → Recap) |
| `/session-history` | Session History |
| `/session-history/:id` | Session detail |
| `/projects` | Projects |
| `/projects/:owner/:repo` | Project detail |
| `/analytics` | Analytics |
| `/profile` | Profile |
| `/settings` | Settings |

Any other path renders the Not Found view. Signed-out users see the authentication page regardless of the route.

Routing is implemented in `src/routing.js` and `src/App.jsx` with the History API; there is no router library.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite 7, JavaScript, plain CSS |
| Server | Node.js middleware mounted into the Vite dev and preview servers |
| GitHub Integration | GitHub REST API, GitHub App user authorization (OAuth) |
| Authentication | HTTP-only session cookie, server-side GitHub access tokens |

## Architecture

### Server

The server layer lives in `server/` and is registered as a Vite plugin in `vite.config.js`. It runs inside `npm run dev` and `npm run preview`; there is no separate server process.

| Module | Responsibility |
| --- | --- |
| `githubAuth.js` | Middleware entry point and Vite plugin. Owns the in-memory login sessions and presence state, parses cookies, and dispatches `/api/*` requests. |
| `authRoutes.js` | GitHub sign-in (`/api/auth/github`), the OAuth callback, the current-user check (`/api/auth/me`), logout, and the redirect to the GitHub App installation page (`/api/auth/github/install`). |
| `githubRoutes.js` | Authenticated data routes: accessible repositories, live and final session commits, presence heartbeats, and GitHub mutuals. |
| `githubApi.js` | All requests to the GitHub REST API, including pagination, response shaping, and GitHub error and rate-limit handling. |

Data routes used by the frontend:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/github/repositories` | Repositories the signed-in user can access through the app |
| `GET /api/github/repos/:owner/:repo/active-session-commits` | Commits during an active session (polled every 30 seconds) |
| `GET /api/github/repos/:owner/:repo/session-commits` | Final commits for a completed session, with file and line details |
| `POST /api/presence/heartbeat` | Marks the signed-in user as present (sent every 30 seconds) |
| `GET /api/social/people-following` | GitHub mutuals with online/offline presence |

### Authentication Flow

1. **Continue with GitHub** opens `/api/auth/github`, which sets a short-lived state cookie and redirects to GitHub.
2. GitHub redirects back to `/api/auth/github/callback`. The server verifies the state, exchanges the code for a user access token, and loads the GitHub profile.
3. The server stores the token and profile in memory and sets an HTTP-only `panta_session` cookie.
4. The browser calls `/api/auth/me` to load the signed-in user. All GitHub requests go through the server; the access token is never sent to the browser.

A login session lasts up to 8 hours or until the GitHub token expires, whichever comes first.

### Data and Persistence

Panta does not use a database.

| Data | Where it lives | Lifetime |
| --- | --- | --- |
| Login session and GitHub access token | Server memory, keyed by the `panta_session` cookie | Until logout, expiry, or a server restart |
| Active coding session | React state in the browser | Lost on page reload |
| Completed coding sessions | Browser `localStorage` (`panta.sessions.<username>`) | Per browser; kept across reloads and sign-outs |
| Presence | Server memory | 90-second online window; cleared on restart |
| Repositories and commits | GitHub, fetched on demand | — |

### Development Data

`src/dev-data/` contains illustrative example data: four example repositories and five example sessions marked as examples (`source: 'placeholder'`). Their commits and activity totals are made up and were never retrieved from GitHub. They keep Overview, Session History, and Analytics populated during development and are labeled as examples wherever they appear. They are not used for Projects and are not a mock of the GitHub API.

The folder also contains the session list and summary helpers (`index.js`) and the analytics calculation (`sessionAnalytics.js`), which operate on both real and example sessions.

## Project Structure

```text
panta/
├── index.html
├── vite.config.js            # Vite config; registers the server middleware
├── package.json
├── .env.example
├── server/
│   ├── githubAuth.js         # Middleware entry, sessions, presence, Vite plugin
│   ├── authRoutes.js         # OAuth sign-in, callback, me, logout, install link
│   ├── githubRoutes.js       # Repository, commit, presence, and mutuals routes
│   └── githubApi.js          # GitHub REST API client
└── src/
    ├── main.jsx              # Entry point and render error boundary
    ├── App.jsx               # Application state, routing, and page composition
    ├── routing.js            # Route table and path helpers
    ├── index.css             # Ordered stylesheet import manifest
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
    │       ├── ActiveSessionCard.jsx (+ .css)         # Used by Overview and Session History
    │       └── SessionCommitList.jsx (+ .css)
    ├── dev-data/
    │   ├── index.js
    │   ├── repositories.js
    │   ├── sessions.js
    │   └── sessionAnalytics.js
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
        ├── Profile/ProfilePage.jsx (+ .css)
        ├── Settings/SettingsPage.jsx (+ .css)
        ├── Authentication/AuthenticationPage.jsx (+ .css)
        ├── NotFoundPage.jsx
        └── NotFoundPage.css
```

`(+ .css)` marks a component or page with a stylesheet of the same name next to it.

### Styles

Styles are plain CSS. Each component, page, and Session Workspace phase has its own stylesheet next to its JSX, and `src/styles/` holds the global layers. Components do not import CSS themselves: `src/index.css` imports every stylesheet in a fixed order (tokens, base, shared, components, then pages) so the cascade order stays explicit. Add new stylesheets to that list.

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm
- A GitHub account
- Credentials for the Panta GitHub App (see [GitHub App Configuration](#github-app-configuration))

### Installation

```bash
git clone https://github.com/lanixiligan/panta.git
cd panta
npm install
```

### Environment Variables

Copy the example file and fill in the GitHub App credentials:

```bash
cp .env.example .env
```

```ini
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:5173/api/auth/github/callback
GITHUB_APP_SLUG=panta-by-lanix-iligan
```

`GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` are required for sign-in. `GITHUB_APP_SLUG` defaults to `panta-by-lanix-iligan` and also accepts the full GitHub App URL.

These values are read by the server only. Keep them in the root `.env` file (ignored by Git) and never in frontend `VITE_` variables.

Use the existing **Panta by Lanix Iligan** GitHub App. In **GitHub → Settings → Developer settings → GitHub Apps → Panta by Lanix Iligan → Edit**, copy the **Client ID** (not the App ID) into `GITHUB_APP_CLIENT_ID`. Under **Client secrets**, generate a client secret and put it in `GITHUB_APP_CLIENT_SECRET`. The secret is shown only once, so store it securely. Panta obtains user access through OAuth; no personal access token is needed.

### Run the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

### Build and Preview

```bash
npm run build
npm run preview
```

`npm run preview` serves the production build with the same API middleware. Preview runs in production mode, where the server only accepts an HTTPS `GITHUB_CALLBACK_URL` and marks cookies `Secure`, so sign-in with the local `http://` callback works under `npm run dev` only.

## GitHub App Configuration

Panta signs users in through the **Panta by Lanix Iligan** GitHub App (**GitHub → Settings → Developer settings → GitHub Apps**).

Register this callback URL as a user authorization callback URL in the app, and keep `GITHUB_CALLBACK_URL` identical to it:

```text
http://localhost:5173/api/auth/github/callback
```

GitHub requires the callback URL used by the app to match its registered callback ([user authorization callback URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url)). See GitHub's guide to [generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) for the Client ID and client secret fields.

### Repository Access

Repository access is controlled by the GitHub App installation. **Settings → Manage repository access** opens the app's installation page on GitHub (through `/api/auth/github/install`, using `GITHUB_APP_SLUG`), where you choose which repositories Panta can access.

For session setup, the server requests the repositories the signed-in user can access through the app. This can include public and private repositories owned by the user, collaborator repositories, and organization repositories when the app is installed for them. The list is paginated, and only repository metadata needed by the interface is returned to the browser. A repository appears only when both the signed-in user and the app installation can access it.

Enable these **read-only permissions** in the GitHub App settings:

- **Metadata: Read-only** — list accessible repositories and read repository metadata.
- **Contents: Read-only** — list commits and read commit details for session activity.
- **Followers: Read-only** (user permission) — list the people the user follows and their followers for the Socials section.

Do not grant write permissions for the current workflow. GitHub may require the installation or authorization to be reviewed again after permissions change.

### Socials and Presence

The Socials section loads `GET /user/following` and `GET /user/followers` on the server, follows pagination for both, and intersects the lists by GitHub user ID. A mutual is shown as online when a recent Panta heartbeat exists, and offline otherwise; offline does not indicate whether the person has a Panta account. The relationship list is cached for five minutes, while presence refreshes separately. Signed-in clients send heartbeats every 30 seconds, and an account counts as online for 90 seconds after its latest heartbeat. Presence is in-memory and process-local, so a server restart clears it.

To check Socials locally, sign in to the same Panta server from two isolated browser profiles with separate GitHub accounts that follow each other. Each account should show the other as online. After one account logs out, or 90 seconds after its tab is closed, it should appear offline.

See GitHub's documentation for [listing repositories for the authenticated user](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user), [listing commits](https://docs.github.com/en/rest/commits/commits#list-commits), [listing people the authenticated user follows](https://docs.github.com/en/rest/users/followers#list-the-people-the-authenticated-user-follows), and [choosing GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

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
- The server runs as Vite middleware; there is no standalone production server.
- Live polling retrieves commit messages and times only; file and line totals are retrieved when the session ends.
- The Overview weekly totals and week chart, and the Profile development history, are not yet connected to real session history.

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
