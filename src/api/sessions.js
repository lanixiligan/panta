// Wrappers for Panta's stored-session routes. A failed call throws an Error with the server's message and a
// numeric `status` (0 when the server couldn't be reached), so callers can tell 401, 404, and 409 apart.

const SESSIONS_PATH = '/api/sessions';

function requestError(message, status) {
  return Object.assign(new Error(message), { status });
}

function sessionPath(id, suffix = '') {
  return `${SESSIONS_PATH}/${encodeURIComponent(id)}${suffix}`;
}

// The server requires a JSON content type on requests with a body, and reads no body on the others.
// `keepalive` lets a request finish after the page that sent it is gone.
async function request(method, path, body, { keepalive = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw requestError('Could not reach Panta. Check your connection and try again.', 0);
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Reported below with the status.
  }
  if (!response.ok) throw requestError(payload?.error || `Panta couldn’t complete that request (${response.status}).`, response.status);
  if (!payload) throw requestError(`Panta returned an unreadable response (${response.status}).`, response.status);
  return payload;
}

export async function listSessions() {
  const payload = await request('GET', SESSIONS_PATH);
  return {
    active: payload.active ?? null,
    sessions: Array.isArray(payload.sessions) ? payload.sessions : [],
  };
}

export async function createSession({ id, repository, goal }) {
  const { session } = await request('POST', SESSIONS_PATH, { id, repository, goal });
  return session;
}

// Pass { keepalive: true } when the page is going away.
export async function updateSessionGoal(id, goal, { keepalive = false } = {}) {
  const { session } = await request('PATCH', sessionPath(id), { goal }, { keepalive });
  return session;
}

// Deletes a session, as Session Detail does. The running session is discarded with cancelSession.
export async function deleteSession(id) {
  await request('DELETE', sessionPath(id));
}

// Discards the running session. A 404 means it isn't running any more (finished or cancelled elsewhere), and a
// finished session is never deleted this way.
export async function cancelSession(id) {
  await request('POST', sessionPath(id, '/cancel'));
}

export async function finishSession(id) {
  const { session } = await request('POST', sessionPath(id, '/finish'));
  return session;
}

// `fields` is { activity, commits, activityStatus: 'complete' | 'error', activityError }.
export async function saveSessionActivity(id, fields) {
  const { session } = await request('PUT', sessionPath(id, '/activity'), fields);
  return session;
}

// Removes every completed session and returns how many there were.
export async function deleteAllSessions() {
  const { deleted } = await request('DELETE', SESSIONS_PATH);
  return deleted;
}

// The one-time import of sessions from the browser's old localStorage history. Returns how many were stored.
export async function importSessions(sessions) {
  const { imported } = await request('POST', `${SESSIONS_PATH}/import`, { sessions });
  return imported;
}

// `revoked` is false when Panta's GitHub authorization couldn't be revoked, though the data is already gone.
export async function deleteAccount() {
  const { revoked } = await request('DELETE', '/api/account');
  return { revoked: revoked === true };
}
