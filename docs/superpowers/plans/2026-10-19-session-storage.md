# Session Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store sessions in Postgres. Running sessions resume after a reload with paused time excluded, the browser warns before leaving during a session, and Settings can delete history and the account.

**Architecture:** A `pg` pool is created inside the existing middleware (`server/githubAuth.js`) and passed to a new `server/sessionRoutes.js` through the request context. SQL lives in `server/sessionStore.js`. Field whitelisting and the DB-row-to-client mapping live in the pure module `server/sessionRecords.js`. On the client, `src/api/sessions.js` wraps the routes, and `App.jsx` swaps its `localStorage` reads and writes for those calls.

**Tech Stack:** Node 22, `pg` (new dependency), Neon Postgres, React 19, Vite 7, `node:test` (built in, for pure modules only).

**Spec:** `docs/superpowers/specs/2026-10-19-session-storage-design.md`

## Global Constraints

- `DATABASE_URL` is server-only. It is never read through `import.meta.env` or a `VITE_` variable.
- Rows are keyed by `canonicalGitHubUserId(session.user)` (a string; store it as `bigint`). Never key by username.
- Pause threshold: a gap of more than `90_000` ms since `last_seen_at` is added to `paused_ms`. The constant is `PAUSE_AFTER_MS` in `server/sessionRecords.js`.
- The server's clock (Postgres `now()`) stamps `started_at`, `ended_at`, and `last_seen_at`. The client never sends them, except in the one-time import of already-completed sessions.
- Stored commit fields: `sha, message, timestamp, author{name,login}, committer{name,login}, branches[], htmlUrl, additions, deletions, totalChanges, files[]`. Stored file fields: `filename, status, additions, deletions, changes`. Nothing else, and never `patch`.
- Stored repository fields: `id, name, full_name, owner{login}, private, html_url`.
- A value that was never recorded stays `null` and is not coerced to `0`.
- The GitHub App stays read-only (Metadata, Contents, Followers).
- UI copy follows CLAUDE.md: short labels, one-line states, `…`, curly quotes and apostrophes, one note per page, destructive actions confirm, `--workspace-*` tokens only.
- There is no linter or formatter. Every task ends with `npm run build` passing, and `npm test` too from Task 1 on.
- Commit subjects use `Panta: <summary>` with a descriptive body. End with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The first heartbeat lands before `GET /api/sessions` on load.** The gap must be applied exactly once. `touchActiveSession` is a single `UPDATE` that sets `last_seen_at = now()`, so the second caller sees a small gap. Pinned by the manual check in Task 4, step 6.
2. **A second tab still shows a session that was finished in another tab.** The heartbeat response says the session is gone, and the tab drops it. Pinned in Task 7, step 9.
3. **The import payload contains `patch`, unknown fields, wrong types, or example sessions (`source: 'placeholder'`).** Unknown fields are dropped, wrong types become `null`, and example sessions are skipped. Pinned by unit tests in Task 1.
4. **A legacy `localStorage` session has no `pausedMs` and no `duration`.** Its duration is `endedAt - startedAt`, not `NaN` or `0`. Pinned by unit tests in Task 6.
5. **Finish is clicked twice, or sent for a session that's already completed.** The second call returns 404 and changes nothing. Pinned by the `WHERE status = 'active'` clause and the manual check in Task 4, step 6.

---

### Task 1: Test runner and the `sessionRecords` module

**Files:**
- Modify: `package.json` (add `"test": "node --test"`)
- Create: `server/sessionRecords.js`
- Test: `server/sessionRecords.test.js`

**Interfaces:**
- Produces:
  - `PAUSE_AFTER_MS = 90_000`
  - `sanitizeRepository(value) -> {id, name, full_name, owner:{login}, private, html_url} | null`. Returns `null` if `id` or `name` is missing.
  - `sanitizeCommits(value) -> Commit[]`. Returns `[]` for a non-array. When `files` is not an array on the input, it is left `undefined`, because `Array.isArray(commit.files)` is how the UI tells "details not recorded" apart.
  - `sanitizeActivity(value) -> {commits, filesChanged, additions, deletions} | null`. Each field is a finite number or `null`.
  - `sanitizeGoal(value) -> string | null`. Trimmed and capped at 2000 characters. An empty string becomes `null`.
  - `sanitizeImportedSession(value) -> ImportRow | null`. Returns `null` unless `status === 'completed'`, `source !== 'placeholder'`, `id` is a string of at most 100 characters, `startedAt` and `endedAt` parse with `endedAt >= startedAt`, and the repository sanitizes.
  - `toClientSession(row) -> { id, source:'github', status, repository, goal, startedAt, endedAt, duration, pausedMs, activity, commits, activityStatus, activityError, activityCheckedAt }`. Timestamps become ISO strings, and `duration` and `pausedMs` become numbers or `null`.

- [ ] **Step 1: Write the failing tests** in `server/sessionRecords.test.js` with `node:test` and `node:assert/strict`:
  - `sanitizeCommits drops patch and unknown fields`: input file `{filename:'a.js', status:'modified', additions:1, deletions:2, changes:3, patch:'@@', contents:'x'}` and commit extra `{tree:'…'}`. Assert `deepEqual(result[0].files[0], {filename:'a.js', status:'modified', additions:1, deletions:2, changes:3})` and `!('tree' in result[0])`.
  - `sanitizeCommits keeps files undefined when not recorded`: `sanitizeCommits([{sha:'1', message:'m'}])[0].files === undefined`.
  - `sanitizeActivity keeps unrecorded values null`: `sanitizeActivity({commits:2})` deep-equals `{commits:2, filesChanged:null, additions:null, deletions:null}`. `sanitizeActivity('x') === null`.
  - `sanitizeRepository whitelists fields`: an input with `description` and `language` returns only the six fields, with `owner` reduced to `{login}`.
  - `sanitizeImportedSession skips examples and bad rows`: `source:'placeholder'` → `null`. `status:'active'` → `null`. `endedAt` before `startedAt` → `null`. A valid row → non-null, with `goal` trimmed.
  - `toClientSession maps a row`: a row with `started_at: new Date('2026-10-19T10:00:00Z')`, `paused_ms: '60000'` (pg returns bigint as a string) gives `startedAt === '2026-10-19T10:00:00.000Z'` and `pausedMs === 60000`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL, cannot find module `./sessionRecords.js`.
- [ ] **Step 3:** Implement the exports above in `server/sessionRecords.js`. Write a numeric helper that returns `Number.isFinite(n) ? n : null` for counts in the activity summary. Use `Number(x) || 0` for per-commit and per-file line counts, matching `server/githubApi.js:226-245`.
- [ ] **Step 4:** Run `npm test` and `npm run build`. Expected: all tests PASS and the build succeeds.
- [ ] **Step 5: Commit** with the subject `Panta: add session record sanitizers and a node test runner`.

### Task 2: Database connection and schema

**Files:**
- Modify: `package.json` (add the `pg` dependency with `npm install pg`)
- Create: `server/db.js`
- Modify: `.env.example`, `render.yaml` (`DATABASE_URL`, `sync: false`), `docs/setup.md` (a Neon section)

**Interfaces:**
- Produces:
  - `createDatabase(env) -> { query(text, params) -> Promise<pg.QueryResult>, transaction(fn: (client) => Promise<T>) -> Promise<T>, ready: Promise<void> }`. It throws synchronously if `env.DATABASE_URL` is missing, with the message `DATABASE_URL is not set. See docs/setup.md.`
  - The pool uses `ssl: { rejectUnauthorized: true }` unless the URL host is `localhost`, and `max: 5`.
  - `ready` runs the schema once.

- [ ] **Step 1: Write the schema** as a SQL string in `server/db.js`. Every statement uses `IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  github_user_id bigint NOT NULL,
  id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  repository jsonb NOT NULL,
  goal text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  paused_ms bigint NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  duration_ms bigint,
  activity jsonb,
  commits jsonb NOT NULL DEFAULT '[]',
  activity_status text,
  activity_error text,
  activity_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (github_user_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active ON sessions (github_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sessions_by_start ON sessions (github_user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS accounts (
  github_user_id bigint PRIMARY KEY,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2:** Implement `createDatabase`. `transaction` runs `BEGIN`, then `COMMIT`, and runs `ROLLBACK` on a throw, on one checked-out client.
- [ ] **Step 3:** Document the setup.
  - `docs/setup.md`: create a Neon project, add a `dev` branch, put its pooled connection string in the root `.env` as `DATABASE_URL`, and put the `main` branch string in Render's `DATABASE_URL`.
  - `.env.example`: add a commented `DATABASE_URL=`.
- [ ] **Step 4: Verify** with `node --env-file=.env -e "import('./server/db.js').then(async m => { const db = m.createDatabase(process.env); await db.ready; console.log((await db.query('select count(*) from sessions')).rows); process.exit(0) })"`. Expected: `[ { count: '0' } ]`. Run it a second time and expect the same output with no error, which shows the schema is idempotent. Then run `npm run build`, which should pass.
- [ ] **Step 5: Commit** with the subject `Panta: add the Postgres connection and session schema`.

### Task 3: Session store (SQL)

**Files:**
- Create: `server/sessionStore.js`

**Interfaces:**
- Consumes: the `db` returned by `createDatabase` (Task 2), and `PAUSE_AFTER_MS` plus the sanitizers (Task 1).
- Produces: all functions take `(db, userId, …)`, where `userId` is a string, and return raw rows. Routes map rows with `toClientSession`.
  - `touchActiveSession(db, userId) -> Row | null`. It is one statement:

```sql
UPDATE sessions SET
  paused_ms = paused_ms + CASE WHEN now() - last_seen_at > make_interval(secs => $2 / 1000.0)
    THEN (extract(epoch FROM now() - last_seen_at) * 1000)::bigint ELSE 0 END,
  last_seen_at = now(), updated_at = now()
WHERE github_user_id = $1 AND status = 'active' RETURNING *
```

  - `listSessions(db, userId) -> { active: Row | null, completed: Row[] }`. It calls `touchActiveSession` first, then selects completed rows ordered by `started_at DESC`.
  - `startSession(db, userId, { id, repository, goal }) -> Row`. It inserts with `started_at = now()` and `last_seen_at = now()`. On Postgres error code `23505` it throws `new SessionConflictError()`, exported as a class.
  - `updateGoal(db, userId, id, goal) -> Row | null`
  - `cancelActiveSession(db, userId, id) -> boolean`. It deletes only where `status = 'active'`.
  - `finishSession(db, userId, id) -> Row | null`. It calls `touchActiveSession`, then runs `UPDATE … SET status='completed', ended_at=now(), duration_ms = (extract(epoch FROM now() - started_at) * 1000)::bigint - paused_ms, activity_status='loading', last_seen_at=NULL WHERE … AND id=$2 AND status='active' RETURNING *`. It runs in one transaction.
  - `saveActivity(db, userId, id, { activity, commits, activityStatus, activityError }) -> Row | null`. It updates only where `status = 'completed'` and sets `activity_checked_at = now()`. `activityStatus` must be `'complete'` or `'error'`.
  - `deleteSession(db, userId, id) -> boolean`
  - `deleteCompletedSessions(db, userId) -> number`
  - `importSessions(db, userId, rows: ImportRow[]) -> { imported: number }`. It runs in one transaction:
    1. `INSERT INTO accounts … ON CONFLICT DO NOTHING`;
    2. `SELECT imported_at … FOR UPDATE`. If it's not null, throw `new AlreadyImportedError()`;
    3. insert the rows with `ON CONFLICT DO NOTHING`;
    4. set `imported_at = now()`.

    `duration_ms` comes from the row's `duration` if it's finite, else `ended - started`. `paused_ms` is `0`.
  - `deleteAccountData(db, userId) -> void`. It deletes from `sessions` and `accounts` in one transaction.

- [ ] **Step 1:** Implement the functions with parameterized queries only. Bind JSON with `JSON.stringify` and a `::jsonb` cast.
- [ ] **Step 2: Verify** with a scratch script, not committed, using a fake `userId` `'1'` against the dev branch:
  1. start a session;
  2. start a second one and expect `SessionConflictError`;
  3. run `UPDATE sessions SET last_seen_at = now() - interval '5 minutes'`;
  4. call `touchActiveSession` and expect `paused_ms` ≈ 300000;
  5. call it again and expect no change;
  6. finish and expect `duration_ms` ≈ elapsed minus 300000;
  7. finish again and expect `null`;
  8. import twice and expect `AlreadyImportedError` on the second;
  9. delete the account data and expect zero rows.
- [ ] **Step 3:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 4: Commit** with the subject `Panta: add the session store`.

### Task 4: Session routes, heartbeat touch, and wiring

**Files:**
- Create: `server/sessionRoutes.js`
- Modify: `server/githubAuth.js` (create the db, add `db` and `readJsonBody` to the context, dispatch to `handleSessionRoute`)
- Modify: `server/githubRoutes.js:60-79` (the heartbeat touches the active session)
- Modify: `CLAUDE.md` (the "no database" and "Server is a Vite plugin" lines also mention `server/index.js`, `db.js`, and the session routes), `README.md` endpoint list

**Interfaces:**
- Consumes: the Task 3 store functions and `toClientSession`/sanitizers from Task 1.
- Produces:
  - `isSessionRoute(pathname) -> boolean` matches `/api/sessions`, `/api/sessions/import`, `/api/sessions/:id`, `/api/sessions/:id/finish`, `/api/sessions/:id/activity`, and `/api/account`.
  - `handleSessionRoute(context) -> Promise<boolean>`
  - `context.readJsonBody(limitBytes = 1_000_000) -> Promise<any>` rejects with a 413 or 400 that the route turns into JSON.
  - Response contracts (all bodies JSON, errors `{ error }`):
    - `GET /api/sessions` → `200 { active: Session | null, sessions: Session[] }`
    - `POST /api/sessions` body `{ id, repository, goal }` → `201 { session }` or `409`
    - `PATCH /api/sessions/:id` body `{ goal }` → `200 { session }` or `404`
    - `DELETE /api/sessions/:id` → `204` or `404`. It deletes either an active session (cancel) or a completed one.
    - `POST /api/sessions/:id/finish` → `200 { session }` or `404`
    - `PUT /api/sessions/:id/activity` body `{ activity, commits, activityStatus, activityError }` → `200 { session }` or `404`
    - `DELETE /api/sessions` → `200 { deleted: number }`
    - `POST /api/sessions/import` body `{ sessions: [] }` with a 5 MB limit → `200 { imported }` or `409`
    - `DELETE /api/account`: handled in Task 5
    - Heartbeat `POST /api/presence/heartbeat` → `200 { ok: true, activeSession: { id, pausedMs } | null }`

- [ ] **Step 1:** In `githubAuth.js`, create `const db = createDatabase(env)` once in `createGitHubAuthMiddleware`, and log `db.ready` failures with `console.error`. Add `db` and `readJsonBody` to the context. Dispatch in this order: `isSessionRoute`, then the GitHub data routes, then auth.
- [ ] **Step 2:** Implement `handleSessionRoute`.
  - With no session → `401 { error: 'Sign in with GitHub to load your sessions.' }`.
  - A DB error (anything that isn't a typed store error) → `503 { error: 'Panta couldn’t reach its database. Try again.' }`.
  - A wrong method → `405` with `Allow`, matching `githubRoutes.js`.
  - Path IDs are `decodeURIComponent` and must match `^[A-Za-z0-9_-]{1,100}$`.
- [ ] **Step 3:** In the heartbeat handler, after setting presence, call `touchActiveSession`. Respond with `activeSession`. A DB failure still returns `{ ok: true, activeSession: undefined }`, so presence never breaks. The client treats `undefined` as "unknown, keep state".
- [ ] **Step 4:** Update the `CLAUDE.md` architecture bullets and the `README.md` endpoint list.
- [ ] **Step 5:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 6: Verify manually** with `npm run dev`, signed in, from devtools `fetch`:
  1. `POST /api/sessions` then `GET` shows `active`;
  2. a second `POST` → 409;
  3. `POST …/finish` twice → 200 then 404;
  4. `curl -s localhost:5173/api/sessions` without a cookie → 401;
  5. reload the page right after setting `last_seen_at` back 5 minutes in SQL, and confirm `pausedMs` rises by about 300000 exactly once.
- [ ] **Step 7: Commit** with the subject `Panta: add session API routes`.

### Task 5: Delete account (server)

**Files:**
- Modify: `server/githubApi.js` (add `revokeAppGrant`)
- Modify: `server/sessionRoutes.js` (`DELETE /api/account`)
- Modify: `server/githubAuth.js` (expose `endUserLoginSessions(githubUserId)` on the context)

**Interfaces:**
- Produces:
  - `revokeAppGrant({ clientId, clientSecret, accessToken }) -> Promise<boolean>` sends `DELETE https://api.github.com/applications/${clientId}/grant` with `Authorization: Basic base64(clientId:clientSecret)`, the body `{ access_token }`, the `Accept: application/vnd.github+json` header, and a 10 s timeout. It returns `true` on 204 and `false` on any other status or error. It never throws.
  - `context.endUserLoginSessions(githubUserId) -> number` deletes every `sessions` Map entry whose `canonicalGitHubUserId(entry.user)` matches, and their presence entries.
  - `DELETE /api/account` → `200 { revoked: boolean }` with `Set-Cookie: clearSessionCookie`. If `deleteAccountData` throws, it returns `503` and does not revoke or sign out.

- [ ] **Step 1:** Implement the order `deleteAccountData` → `revokeAppGrant` → `endUserLoginSessions` → respond.
- [ ] **Step 2:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 3: Verify manually.** Sign in on two browsers, call `DELETE /api/account` in one, and check:
  - the response is `{ revoked: true }`;
  - the other browser's next `/api/auth/me` returns 401;
  - github.com/settings/applications no longer lists Panta's authorization;
  - the rows are gone in SQL.
- [ ] **Step 4: Commit** with the subject `Panta: add account deletion`.

### Task 6: Client session API and duration helpers

**Files:**
- Create: `src/api/sessions.js`
- Modify: `src/sessions/sessionHelpers.js`
- Test: `src/sessions/sessionHelpers.test.js`
- Modify (use the helpers): `src/components/navigation/SidebarNav.jsx:110`, `src/pages/Overview/OverviewPage.jsx:50`, `src/pages/SessionWorkspace/components/ActiveSession/ActiveSession.jsx:34`, `src/pages/SessionWorkspace/components/SessionRecap/SessionRecap.jsx:20`, `src/analytics/sessionAnalytics.js:52`, `src/components/analytics/WorkCalendar.jsx:44`

**Interfaces:**
- Produces:
  - `getSessionDurationMs(session) -> number | null`. It returns `session.duration` if that's finite and ≥ 0. Otherwise it returns `endedAt - startedAt - (pausedMs || 0)` if the timestamps are valid and the result is ≥ 0. Otherwise it returns `null`.
  - `getActiveElapsedMs(session, now) -> number` is `max(0, now - startedAt - (session.pausedMs || 0))`.
  - `getSessionDurationMinutes(session)` now uses `getSessionDurationMs`, floors it, and returns `0` when it's `null`, which keeps the current behavior.
  - `src/api/sessions.js`: `listSessions()`, `createSession({id, repository, goal})`, `updateSessionGoal(id, goal)`, `deleteSession(id)`, `finishSession(id)`, `saveSessionActivity(id, fields)`, `deleteAllSessions()`, `importSessions(sessions)`, and `deleteAccount() -> { revoked }`. Each returns the parsed payload's `session`/`sessions`/etc. and throws `Error` with the server's `error` text, following the `src/api/github.js` pattern. A thrown error carries `.status` so `App.jsx` can tell 401 and 409 apart.

- [ ] **Step 1: Write the failing tests:**
  - `legacy session without pausedMs or duration`: `{startedAt:'2026-10-19T10:00:00Z', endedAt:'2026-10-19T11:00:00Z'}` → `3_600_000`.
  - `pausedMs is subtracted`: the same session with `pausedMs: 600_000` → `3_000_000`.
  - `stored duration wins`: `duration: 120_000` → `120_000`.
  - `invalid timestamps give null`.
  - `getActiveElapsedMs subtracts pausedMs`: `getActiveElapsedMs({startedAt:'2026-10-19T10:00:00Z', pausedMs:60_000}, Date.parse('2026-10-19T10:10:00Z'))` → `540_000`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL, functions not exported.
- [ ] **Step 3:** Implement the helpers and `src/api/sessions.js`, then replace the six `endedAt - startedAt` or `now - startedAt` call sites listed above.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** with the subject `Panta: add the session API client and pause-aware durations`.

### Task 7: App.jsx on the server, resume, and leave warning

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/api/presence.js` (`sendPresenceHeartbeat` returns the payload)
- Modify: `README.md` (the storage table at ~line 134, Current Limitations at ~257, a new "What Panta stores" section with the spec's list), `docs/features.md` (Session Workspace resume, leave warning)

**Interfaces:**
- Consumes: the `src/api/sessions.js` functions and helpers from Task 6, and the heartbeat contract from Task 4.

- [ ] **Step 1: Load.** In `loadWorkspace`, replace `readStoredSessions` with `listSessions()`. Set `realSessions` from `sessions`, and `activeSession` from `active` (spread `{ activitySyncStatus: 'loading', activityError: '' }` onto it so polling restarts). Keep re-fetching completed sessions with `activityStatus === 'loading'`. If `listSessions` fails, show the error through the existing `repositoriesError` style. The exact surface is the builder's call, kept to one line.
- [ ] **Step 2: Import.** After a successful load, read the legacy `panta.sessions.<username>` key (keep `readStoredSessions` for this only). If it's non-empty, call `importSessions`. On success or a 409, remove the key and reload the list. On any other error, keep the key for the next load.
- [ ] **Step 3: Start and cancel.** `startSession` calls `createSession` and sets state from the returned session. While it's pending, the setup's start button shows its in-progress state. On a 409, call `listSessions` and adopt the existing active session. `cancelSession` calls `deleteSession(id)`, then clears state.
- [ ] **Step 4: Finish.** `finishSession` calls `finishSession(id)`. If that fails, keep the session active and set `activityError` to the error message (one line; `endingSession.current` resets). On success, use the returned row's `endedAt` and `duration`, fetch activity, then `saveSessionActivity`. `retrieveSessionActivity` also ends with `saveSessionActivity`, with `activityStatus: 'complete' | 'error'`.
- [ ] **Step 5: Goals and deletes.**
  - `updateActiveGoal` and `updateSessionGoal` update state immediately and call `updateSessionGoal` after a 600 ms debounce per session ID.
  - `deleteSession` and `deleteSessionHistory` call the API first, and update state only on success.
- [ ] **Step 6:** Remove the `localStorage` write effect (`App.jsx:130-138`).
- [ ] **Step 7: Heartbeat.** Use the heartbeat result:
  - when `activeSession` is `{ id, pausedMs }` matching the current ID, set `pausedMs`;
  - when it's `null` while one is shown and not ending, drop the session and reload the list (it was finished or cancelled elsewhere);
  - when it's `undefined`, do nothing;
  - when the heartbeat returns 401, call `loadWorkspace()`, which leads to the sign-in page.
- [ ] **Step 8: Leave warning.** Add a `beforeunload` listener that runs `event.preventDefault(); event.returnValue = ''`. It's registered in an effect only while `activeSession` is set.
- [ ] **Step 9: Verify manually** under `npm run dev`:
  1. start a session, reload, and confirm the same elapsed time is shown;
  2. close the tab for more than 2 minutes, reopen, and confirm the gap is excluded;
  3. make a commit during the gap and confirm it's listed;
  4. finish, then open a private window, sign in, and see the session;
  5. with two tabs open, finish in one, and confirm the other drops it within 30 s;
  6. confirm closing the tab prompts only while a session is running;
  7. put sessions in the legacy key, load, and confirm they're imported once and the key is removed.

  Run `npm run build`, which should pass.
- [ ] **Step 10: Commit** with the subject `Panta: store sessions on the server and resume active sessions`.

### Task 8: Settings: history, account deletion, storage note

**Files:**
- Modify: `src/pages/Settings/SettingsPage.jsx`, `src/pages/Settings/SettingsPage.css` (only if the new row needs it; tokens only)
- Modify: `src/App.jsx:535` (pass `onDeleteAccount`)
- Modify: `src/components/auth/AuthControl.jsx:4-11` (add `revoke_failed`)
- Modify: `docs/features.md` (Settings)

**Interfaces:**
- Consumes: `deleteAccount()` from Task 6.
- Produces: `SettingsPage` gets the prop `onDeleteAccount: () => Promise<{ revoked: boolean }>`.

- [ ] **Step 1: Copy, exact:**
  - The Sign out row's `detail` becomes `null`, dropping "stay in this browser".
  - Delete history `detail`: `Removes ${formatCount(n, 'session')} saved in Panta. This can’t be undone.`, or `No saved sessions.` when there are none.
  - The Session history group ends with `<p className="settings-note">Panta stores commit messages, times, and file and line stats. Never code.</p>`.
  - The new row in the same danger group has the label `Delete account` and the detail `Deletes your sessions and disconnects GitHub. This can’t be undone.` The confirm buttons are `Keep account` and `Delete account`, with the pending label `Deleting…`. The error line is `Couldn’t delete your account. Try again.`
  - The rename of the group title is the builder's call, for example "Data".
- [ ] **Step 2: Behavior.** In `App.jsx`, `onDeleteAccount` calls `deleteAccount()`, removes every `localStorage` key that starts with `panta.sessions.`, then runs `window.location.assign(revoked ? '/' : '/?auth_error=revoke_failed')`. The full reload resets all state.
- [ ] **Step 3:** Add `revoke_failed: 'Account deleted. Revoke Panta in your GitHub settings.'` to `AUTH_MESSAGES`.
- [ ] **Step 4:** Run `npm run build`, which should pass. Then verify manually:
  - Delete history clears Session History, and a reload confirms it;
  - Delete account confirms, signs out, and lands on sign-in;
  - with `revokeAppGrant` temporarily forced to `false`, the notice shows;
  - the note is the page's only note;
  - `:focus-visible` works on the new buttons.
- [ ] **Step 5: Commit** with the subject `Panta: add account deletion and the storage note to Settings`.
