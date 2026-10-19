# Session storage: database, resumable sessions, account deletion

Date: 2026-10-19

## Intent

Panta keeps completed sessions in the browser's `localStorage` and the active session only in React state. History is tied to one browser, and a reload or closed tab loses a running session. Panta is now deployed (Vercel frontend, Render API) and public as a portfolio piece, so sessions need to live on the server.

This work adds a database for sessions only, makes a running session survive a reload or closed tab, warns before leaving with a session running, and lets the user delete their data and their account from Settings.

## Goals

1. Completed sessions are stored server-side per GitHub user and appear on any browser after sign-in.
2. A running session is stored server-side. After a reload, closed tab, crash, or re-sign-in, the user is put back into it.
3. The session clock pauses while no Panta tab is open and resumes when the user comes back.
4. Leaving the site with a session running triggers the browser's leave-site confirmation.
5. Settings can delete stored session history and delete the account.
6. Existing `localStorage` history is imported once, so no one loses sessions.

## Non-goals

- Persisting login sessions. Login sessions, presence, and the mutuals cache stay in memory. Render's sleep still signs users out, and they sign in again and resume.
- Real-time sync between two open tabs.
- Storing example sessions or example repositories. They stay in `src/dummy-data/`.
- Offline support.
- Changes to the planned read-only demo mode. The demo keeps using example data and never touches the database.

## Anti-goals (failure even if it works)

- Storing code, diffs, patches, or file contents. Only commit metadata and stats are stored (see "What is stored").
- Storing the GitHub access token in the database.
- Deriving session time from commit timestamps. Session time is the declared time minus pauses.
- Adding GitHub App permissions beyond read-only Metadata, Contents, and Followers.
- Losing a finished session because a save failed.

## What is stored

This applies to every repository, public or private.

- **Session:** client session ID, GitHub user ID, start time, end time, paused time, goal (user-written), status, activity sync status and error, and the time activity was last checked.
- **Repository reference:** GitHub repo ID, `name`, `full_name`, owner login, the `private` flag, and `html_url`. No description and no other repository details.
- **Per commit:** SHA, message, timestamp, author and committer name and login, branch names, `html_url`, additions, deletions, and total changes.
- **Per file in a commit:** path (`filename`), status, additions, deletions, and changes. No `patch`, no contents.
- **Activity summary:** commits, files changed, additions, and deletions. A value that was never recorded is stored as `NULL`, never `0`.

The server whitelists these fields when it writes. Anything else the client sends is dropped. This enforces the anti-goal, not just the client's good behavior.

Rows are keyed by the GitHub numeric user ID (`canonicalGitHubUserId(session.user)`), never the username, which can change.

## How it gets made (decided)

### Database

- Hosted Postgres on **Neon's free tier**. Render's free disk is ephemeral, which rules out SQLite. Render's free Postgres expires after 30 days.
- Accessed with the plain `pg` driver, with no ORM. Connection string in `DATABASE_URL`. It is server-only and never exposed through a `VITE_` variable.
- `DATABASE_URL` is required to run. Local development uses a separate Neon branch (documented in `docs/setup.md`).

### Schema (shape, not final SQL)

One `sessions` table:

| column | notes |
|---|---|
| `github_user_id` | bigint, part of the primary key |
| `id` | text, the client-generated session ID, part of the primary key |
| `status` | `'active'` or `'completed'` |
| `repository` | jsonb, whitelisted fields above |
| `goal` | text, nullable |
| `started_at` | timestamptz |
| `ended_at` | timestamptz, null while active |
| `paused_ms` | bigint, default 0 |
| `last_seen_at` | timestamptz, used only while active |
| `duration_ms` | bigint, null while active |
| `activity` | jsonb, nullable (summary) |
| `commits` | jsonb array, whitelisted fields above |
| `activity_status`, `activity_error`, `activity_checked_at` | mirror today's client fields |
| `created_at`, `updated_at` | timestamptz |

- Primary key `(github_user_id, id)`.
- A partial unique index allows at most one `active` row per user.
- An index on `(github_user_id, started_at desc)`.

There is also a small `accounts` table: `github_user_id` (PK), `imported_at` (timestamptz, nullable), and `created_at`. It exists only to make the import one-time.
- Delete account removes this row too. A stale browser could therefore re-import after an account deletion. This is accepted and listed in Current Limitations, because keeping a record after deletion would contradict "delete my data".
- The schema is created idempotently (`CREATE TABLE IF NOT EXISTS …`) when the server starts.

### Pausing and resuming

- **The pause rule:** a pause is any stretch longer than 90 seconds (the presence window) with no heartbeat from an open Panta tab. The server applies one function, `touchActiveSession(user, now)`. Let `gap = now - last_seen_at`. If `gap > 90s`, add `gap` to `paused_ms`. Either way, set `last_seen_at = now`. A quick reload is not a pause.
- The function runs on every heartbeat (`POST /api/presence/heartbeat`), on `GET /api/sessions`, and at finish. Because the heartbeat applies the rule itself, the order of the first heartbeat and the load doesn't matter.
- Cases this counts as paused: a laptop asleep with the tab open, a frozen background tab, a dropped network, and time on the sign-in page after a login expires mid-session. Panta can't tell these apart from a closed tab, and in each the user isn't working in Panta. (Confirmed by the owner.)
- If a session request returns 401 mid-session, the client goes to the sign-in page as it does today. The session resumes after sign-in.
- Elapsed time shown anywhere (the Active Session timer, the sidebar, Overview) is `now - started_at - paused_ms`.
- **The server's clock is the only clock.** The server stamps `started_at` on `POST /api/sessions` and `ended_at` on finish. The client never sends either.
- **Finishing has two steps** so that a closed tab or a failed fetch can't resurrect a finished session:
  1. `POST /api/sessions/:id/finish` runs `touchActiveSession`, stamps `ended_at`, sets `duration_ms = ended_at - started_at - paused_ms`, `status = 'completed'`, and `activity_status = 'loading'`. It returns the row. From then on the session is finished, whatever happens next.
  2. The client fetches the GitHub activity for `started_at`–`ended_at` as today, then sends `PUT /api/sessions/:id/activity` with the commits and summary. It's the same call when activity is retried later.
- **Commits made during a pause count.** The GitHub activity window stays the wall-clock `started_at` to `ended_at`. Session time and GitHub activity remain separate measurements, and the existing note already explains the difference. No new note.
- A resumed session has no expiry. The user can finish or cancel it as today.
- Resume is automatic. On load, the active session is restored into state and polling restarts. There is no "Resume?" prompt.

### Leaving the site

- A `beforeunload` handler is registered only while `activeSession` is set. Browsers show their own generic text; custom text isn't possible.
- In-app navigation is a single-page app and never unloads, so no extra prompt is needed. Sign out already confirms when a session is running.

### API (session cookie auth, all scoped to the signed-in GitHub user ID)

- `GET /api/sessions` returns the user's completed sessions and the active session, if any. It applies the resume rule to the active session.
- `POST /api/sessions` starts an active session. Returns 409 if one already exists.
- `PATCH /api/sessions/:id` updates the goal (active or completed).
- `POST /api/sessions/:id/finish` ends the active session (step 1 above).
- `PUT /api/sessions/:id/activity` stores the commits and activity summary for a completed session (step 2). It is also used for retries.
- `DELETE /api/sessions/:id` deletes one session, as the Session Detail delete does today.
- `DELETE /api/sessions` deletes all completed sessions (Delete history). It does not touch the active session.
- `POST /api/sessions/import` performs the one-time `localStorage` import. It is idempotent on `(github_user_id, id)` and skips IDs that already exist. The first successful import sets `imported_at` on the user's `accounts` row, and later imports return 409, so another browser's stale copy can't bring deleted sessions back. A 409 also makes the client remove its local key.
- `DELETE /api/account`: see below.

The routes are registered the same way as the existing data routes (`isGitHubDataRoute` and `handleGitHubDataRoute`, or a sibling `sessionRoutes.js` dispatched from `githubAuth.js`). Database errors return 503 with a user-facing message.

### Client changes

- `src/api/sessions.js` wraps the routes above, matching the style of `src/api/*.js`.
- `App.jsx`:
  - `startSession` calls `POST`.
  - `cancelSession` deletes the active row.
  - `updateActiveGoal` and `updateSessionGoal` call `PATCH`; debouncing is the builder's call.
  - `finishSession` calls `POST …/finish`, then fetches activity and calls `PUT …/activity`. `retrieveSessionActivity` calls `PUT …/activity`.
  - `deleteSession` and `deleteSessionHistory` call `DELETE`.
  - `loadWorkspace` loads from `GET /api/sessions` in place of `readStoredSessions`.
- The `localStorage` effect that writes `panta.sessions.<username>` is removed.
- **Import:** after sign-in, if `panta.sessions.<username>` has sessions, they are POSTed to `/import`. The key is removed once the server confirms.
- **Save failure:**
  - If `POST …/finish` fails, the session stays active in the UI with a one-line error and a retry. Nothing is lost, because the row is still active on the server.
  - If `PUT …/activity` fails, the session is already completed server-side with `activity_status = 'loading'`. The existing load-time path that re-fetches `loading` sessions retries it. No `localStorage` copy is needed.

### Settings

- The Sign out row's detail no longer says sessions stay "in this browser". Saved sessions now stay in Panta.
- Delete history removes completed sessions from the database. The copy changes from "saved in this browser" to "saved in Panta".
- The Session history group gets one line stating what is stored. It is the page's only note. Suggested copy: "Panta stores commit messages, times, and file and line stats. Never code." The same statement, with the full list from "What is stored", goes in the README.
- A new **Delete account** row in the danger group, with a confirmation step like Delete history. It:
  1. deletes every session row and the `accounts` row for the user, active session included. If this fails, nothing else happens and Settings shows a one-line error;
  2. revokes the user's GitHub authorization for the app (`DELETE /applications/{client_id}/grant` with app basic auth). This needs no extra app permissions. It is best-effort: if GitHub errors or times out, the deletion still stands;
  3. ends **every** in-memory login session for that GitHub user ID, not just this cookie, and clears presence for them;
  4. removes the user's `panta.sessions.*` keys from `localStorage`;
  5. returns to the sign-in page.

  If the revoke failed, the sign-in page shows one line: "Account deleted. Revoke Panta in your GitHub settings." The endpoint reports this with a `{ revoked: false }` flag in its response.

  The GitHub App installation itself remains on the user's GitHub account. The existing "Manage on GitHub" link is where it's removed.

### Docs

Update the following:
- `README.md`: the storage table, Current Limitations, and a short "What Panta stores" section with the list above.
- `docs/features.md`: Settings and the Session Workspace resume.
- `docs/setup.md`: Neon setup, `DATABASE_URL` locally and on Render.
- `CLAUDE.md`: the "no database" architecture lines.
- `.env.example` and `render.yaml`: `DATABASE_URL`.

## Left to the builder

- Final SQL, connection pooling settings, and how the schema bootstrap is organized.
- Whether session routes live in `githubRoutes.js` or a new `sessionRoutes.js`.
- Debouncing goal edits.
- Whether to send a `sendBeacon` on unload to tighten `last_seen_at`.
- How a second open tab notices the session was finished elsewhere. Acceptable minimum: the heartbeat response says whether the active session still exists, and the tab drops it if not.
- Loading and error UI details, within the CLAUDE.md copy rules (one-line states, no new panels).

## Verification

There is no test suite. Verify with `npm run build` and by running the app against a Neon dev branch:
- start a session, reload, and confirm it resumes with the same elapsed time;
- close the tab for more than 2 minutes, reopen, and confirm the gap is excluded;
- confirm commits made during the gap are listed;
- finish, check the session in a second browser;
- confirm the leave-site prompt appears only while a session is running;
- confirm the import moves existing `localStorage` sessions exactly once;
- confirm Delete history and Delete account remove the rows, and that Delete account signs out and revokes the grant;
- inspect a stored row to confirm no `patch` or extra fields.
