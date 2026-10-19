// All SQL for stored sessions. Every function is scoped to one GitHub user ID and returns raw rows;
// routes map them with toClientSession. Postgres's now() is the only clock for session times.
import {
  PAUSE_AFTER_MS,
  isValidSessionId,
  sanitizeActivity,
  sanitizeCommits,
  sanitizeGoal,
  sanitizeImportedSession,
  sanitizeRepository,
} from './sessionRecords.js';

export class SessionConflictError extends Error {
  constructor() {
    super('A session is already running.');
  }
}

export class AlreadyImportedError extends Error {
  constructor() {
    super('Sessions from this browser were already imported.');
  }
}

export class InvalidSessionError extends Error {}

const MAX_ACTIVITY_ERROR_LENGTH = 500;

function assertUserId(userId) {
  if (typeof userId !== 'string' || !/^\d+$/.test(userId)) throw new Error('A numeric GitHub user ID is required.');
}

// A JS null must stay SQL NULL; JSON.stringify(null) would store a jsonb 'null' instead.
function json(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

// Adds the time since the last heartbeat to paused_ms when it exceeds the pause threshold.
// One statement, so a heartbeat and a page load racing each other apply a gap only once.
export async function touchActiveSession(db, userId, executor = db) {
  assertUserId(userId);
  const { rows } = await executor.query(
    `UPDATE sessions SET
       paused_ms = paused_ms + CASE WHEN now() - last_seen_at > $2::bigint * interval '1 millisecond'
         THEN (extract(epoch FROM now() - last_seen_at) * 1000)::bigint ELSE 0 END,
       last_seen_at = now(),
       updated_at = now()
     WHERE github_user_id = $1 AND status = 'active'
     RETURNING *`,
    [userId, PAUSE_AFTER_MS],
  );
  return rows[0] ?? null;
}

export async function listSessions(db, userId) {
  const active = await touchActiveSession(db, userId);
  const { rows } = await db.query(
    `SELECT * FROM sessions WHERE github_user_id = $1 AND status = 'completed' ORDER BY started_at DESC`,
    [userId],
  );
  return { active, completed: rows };
}

export async function startSession(db, userId, { id, repository, goal }) {
  assertUserId(userId);
  if (!isValidSessionId(id)) throw new InvalidSessionError('The session ID is invalid.');
  const storedRepository = sanitizeRepository(repository);
  if (!storedRepository) throw new InvalidSessionError('A GitHub repository is required to start a session.');
  try {
    const { rows } = await db.query(
      `INSERT INTO sessions (github_user_id, id, status, repository, goal, started_at, last_seen_at)
       VALUES ($1, $2, 'active', $3::jsonb, $4, now(), now())
       RETURNING *`,
      [userId, id, json(storedRepository), sanitizeGoal(goal)],
    );
    return rows[0];
  } catch (error) {
    // 23505: unique violation, from the one-active-session index or a reused ID.
    if (error.code === '23505') throw new SessionConflictError();
    throw error;
  }
}

export async function updateGoal(db, userId, id, goal) {
  assertUserId(userId);
  const { rows } = await db.query(
    `UPDATE sessions SET goal = $3, updated_at = now() WHERE github_user_id = $1 AND id = $2 RETURNING *`,
    [userId, id, sanitizeGoal(goal)],
  );
  return rows[0] ?? null;
}

// Marks the session finished first, so a closed tab or failed activity fetch can't bring it back as running.
export async function finishSession(db, userId, id) {
  assertUserId(userId);
  return db.transaction(async (client) => {
    await touchActiveSession(db, userId, client);
    const { rows } = await client.query(
      `UPDATE sessions SET
         status = 'completed',
         ended_at = now(),
         duration_ms = GREATEST(0, (extract(epoch FROM now() - started_at) * 1000)::bigint - paused_ms),
         activity_status = 'loading',
         activity_error = NULL,
         last_seen_at = NULL,
         updated_at = now()
       WHERE github_user_id = $1 AND id = $2 AND status = 'active'
       RETURNING *`,
      [userId, id],
    );
    return rows[0] ?? null;
  });
}

export async function saveActivity(db, userId, id, { activity, commits, activityStatus, activityError }) {
  assertUserId(userId);
  if (!['complete', 'error'].includes(activityStatus)) throw new InvalidSessionError('The activity status must be complete or error.');
  const { rows } = await db.query(
    `UPDATE sessions SET
       activity = $3::jsonb,
       commits = $4::jsonb,
       activity_status = $5,
       activity_error = $6,
       activity_checked_at = now(),
       updated_at = now()
     WHERE github_user_id = $1 AND id = $2 AND status = 'completed'
     RETURNING *`,
    [
      userId,
      id,
      json(sanitizeActivity(activity)),
      json(sanitizeCommits(commits)),
      activityStatus,
      typeof activityError === 'string' && activityError ? activityError.slice(0, MAX_ACTIVITY_ERROR_LENGTH) : null,
    ],
  );
  return rows[0] ?? null;
}

// Deletes one session in either state; deleting the active one is how a session is cancelled.
export async function deleteSession(db, userId, id) {
  assertUserId(userId);
  const { rowCount } = await db.query(`DELETE FROM sessions WHERE github_user_id = $1 AND id = $2`, [userId, id]);
  return rowCount > 0;
}

// Delete history: completed sessions only, never the running one.
export async function deleteCompletedSessions(db, userId) {
  assertUserId(userId);
  const { rowCount } = await db.query(`DELETE FROM sessions WHERE github_user_id = $1 AND status = 'completed'`, [userId]);
  return rowCount;
}

// The one-time move of a browser's localStorage history. After the first import, later ones are refused,
// so a stale copy in another browser can't bring back sessions deleted since.
export async function importSessions(db, userId, sessions) {
  assertUserId(userId);
  const rows = (Array.isArray(sessions) ? sessions : []).map(sanitizeImportedSession).filter(Boolean);
  return db.transaction(async (client) => {
    await client.query(`INSERT INTO accounts (github_user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    const { rows: [account] } = await client.query(
      `SELECT imported_at FROM accounts WHERE github_user_id = $1 FOR UPDATE`,
      [userId],
    );
    if (account.imported_at) throw new AlreadyImportedError();

    let imported = 0;
    for (const row of rows) {
      const durationMs = Number.isFinite(row.duration) && row.duration >= 0
        ? Math.round(row.duration)
        : Date.parse(row.endedAt) - Date.parse(row.startedAt);
      const { rowCount } = await client.query(
        `INSERT INTO sessions (
           github_user_id, id, status, repository, goal, started_at, ended_at, paused_ms, duration_ms,
           activity, commits, activity_status, activity_error, activity_checked_at
         ) VALUES ($1, $2, 'completed', $3::jsonb, $4, $5, $6, 0, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          row.id,
          json(row.repository),
          row.goal,
          row.startedAt,
          row.endedAt,
          durationMs,
          json(row.activity),
          json(row.commits),
          row.activityStatus,
          row.activityError,
          row.activityCheckedAt,
        ],
      );
      imported += rowCount;
    }

    await client.query(`UPDATE accounts SET imported_at = now() WHERE github_user_id = $1`, [userId]);
    return { imported };
  });
}

export async function deleteAccountData(db, userId) {
  assertUserId(userId);
  await db.transaction(async (client) => {
    await client.query(`DELETE FROM sessions WHERE github_user_id = $1`, [userId]);
    await client.query(`DELETE FROM accounts WHERE github_user_id = $1`, [userId]);
  });
}
