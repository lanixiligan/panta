// Whitelists what Panta stores for a session and maps database rows to the client's session shape.
// Only commit metadata and file and line stats are kept, never code, diffs, or file contents.

// A gap longer than the presence window since the last heartbeat counts as paused time.
export const PAUSE_AFTER_MS = 90_000;

const MAX_GOAL_LENGTH = 2000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// Session IDs appear in API paths, so stored IDs must be ones the routes accept.
export function isValidSessionId(value) {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

// For summary values: anything that isn't a real number was never recorded.
function numberOrNull(value) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

// For per-commit and per-file line counts, matching how githubApi.js shapes them.
function count(value) {
  return Number(value) || 0;
}

function isoOrNull(value) {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function person(value) {
  return isObject(value) ? { name: stringOrNull(value.name), login: stringOrNull(value.login) } : null;
}

export function sanitizeRepository(value) {
  if (!isObject(value) || typeof value.name !== 'string') return null;
  const validId = (typeof value.id === 'number' && Number.isFinite(value.id))
    || (typeof value.id === 'string' && /^\d+$/.test(value.id));
  if (!validId) return null;
  const htmlUrl = typeof value.html_url === 'string' && value.html_url.startsWith('https://github.com/') ? value.html_url : null;
  return {
    id: value.id,
    name: value.name,
    full_name: stringOrNull(value.full_name),
    owner: { login: stringOrNull(isObject(value.owner) ? value.owner.login : value.owner) },
    private: Boolean(value.private),
    html_url: htmlUrl,
  };
}

function sanitizeFile(value) {
  if (!isObject(value) || typeof value.filename !== 'string') return null;
  return {
    filename: value.filename,
    status: stringOrNull(value.status),
    additions: count(value.additions),
    deletions: count(value.deletions),
    changes: count(value.changes),
  };
}

function sanitizeCommit(value) {
  if (!isObject(value) || typeof value.sha !== 'string' || !value.sha) return null;
  const commit = {
    sha: value.sha,
    message: stringOrNull(value.message),
    timestamp: isoOrNull(value.timestamp),
    author: person(value.author),
    committer: person(value.committer),
    branches: Array.isArray(value.branches) ? value.branches.filter((branch) => typeof branch === 'string') : [],
    htmlUrl: stringOrNull(value.htmlUrl),
    additions: count(value.additions),
    deletions: count(value.deletions),
    totalChanges: count(value.totalChanges),
  };
  // Live-polled commits have no file details; the UI reads a missing `files` as "not recorded".
  if (Array.isArray(value.files)) commit.files = value.files.map(sanitizeFile).filter(Boolean);
  return commit;
}

export function sanitizeCommits(value) {
  return Array.isArray(value) ? value.map(sanitizeCommit).filter(Boolean) : [];
}

export function sanitizeActivity(value) {
  if (!isObject(value)) return null;
  return {
    commits: numberOrNull(value.commits),
    filesChanged: numberOrNull(value.filesChanged),
    additions: numberOrNull(value.additions),
    deletions: numberOrNull(value.deletions),
  };
}

export function sanitizeGoal(value) {
  if (typeof value !== 'string') return null;
  const goal = value.trim().slice(0, MAX_GOAL_LENGTH);
  return goal || null;
}

// A completed session from the browser's old localStorage history. Example sessions are never stored.
export function sanitizeImportedSession(value) {
  if (!isObject(value) || value.status !== 'completed' || value.source === 'placeholder') return null;
  if (!isValidSessionId(value.id)) return null;
  const startedAt = isoOrNull(value.startedAt);
  const endedAt = isoOrNull(value.endedAt);
  if (!startedAt || !endedAt || Date.parse(endedAt) < Date.parse(startedAt)) return null;
  const repository = sanitizeRepository(value.repository);
  if (!repository) return null;
  return {
    id: value.id,
    repository,
    goal: sanitizeGoal(value.goal),
    startedAt,
    endedAt,
    duration: numberOrNull(value.duration),
    activity: sanitizeActivity(value.activity),
    commits: sanitizeCommits(value.commits),
    activityStatus: ['complete', 'error', 'loading'].includes(value.activityStatus) ? value.activityStatus : null,
    activityError: stringOrNull(value.activityError),
    activityCheckedAt: isoOrNull(value.activityCheckedAt),
  };
}

// pg returns bigint columns as strings and timestamptz columns as Dates.
export function toClientSession(row) {
  return {
    id: row.id,
    source: 'github',
    status: row.status,
    repository: row.repository,
    goal: row.goal ?? null,
    startedAt: isoOrNull(row.started_at),
    endedAt: isoOrNull(row.ended_at),
    duration: numberOrNull(row.duration_ms),
    pausedMs: numberOrNull(row.paused_ms),
    activity: row.activity ?? null,
    commits: Array.isArray(row.commits) ? row.commits : [],
    activityStatus: row.activity_status ?? null,
    activityError: row.activity_error ?? null,
    activityCheckedAt: isoOrNull(row.activity_checked_at),
  };
}
