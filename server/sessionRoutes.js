// Stored-session routes. Every route acts on the signed-in GitHub user's own sessions only.
import { canonicalGitHubUserId, revokeAppGrant } from './githubApi.js';
import { isValidSessionId, toClientSession } from './sessionRecords.js';
import {
  AlreadyImportedError,
  InvalidSessionError,
  SessionConflictError,
  deleteAccountData,
  deleteCompletedSessions,
  deleteSession,
  finishSession,
  importSessions,
  listSessions,
  saveActivity,
  startSession,
  updateGoal,
} from './sessionStore.js';

const SESSIONS_PATH = '/api/sessions';
const ACCOUNT_PATH = '/api/account';
const IMPORT_PATH = '/api/sessions/import';
const SESSION_PATH = /^\/api\/sessions\/([^/]+)$/;
const FINISH_PATH = /^\/api\/sessions\/([^/]+)\/finish$/;
const ACTIVITY_PATH = /^\/api\/sessions\/([^/]+)\/activity$/;
const IMPORT_LIMIT_BYTES = 5_000_000;
const NOT_FOUND = 'That session could not be found.';

// Paths are matched in order; the import path comes before the one-session path it would also match.
const routes = [
  { match: (pathname) => pathname === SESSIONS_PATH, methods: { GET: listAll, POST: start, DELETE: deleteHistory } },
  { match: (pathname) => pathname === IMPORT_PATH, methods: { POST: importLegacy } },
  { match: (pathname) => pathname.match(FINISH_PATH), methods: { POST: finish } },
  { match: (pathname) => pathname.match(ACTIVITY_PATH), methods: { PUT: storeActivity } },
  { match: (pathname) => pathname.match(SESSION_PATH), methods: { PATCH: editGoal, DELETE: remove } },
  { match: (pathname) => pathname === ACCOUNT_PATH, methods: { DELETE: deleteAccount } },
];

export function isSessionRoute(pathname) {
  return routes.some((route) => route.match(pathname));
}

async function listAll({ db, userId }) {
  const { active, completed } = await listSessions(db, userId);
  return [200, { active: active && toClientSession(active), sessions: completed.map(toClientSession) }];
}

async function start({ db, userId, readJsonBody }) {
  const { id, repository, goal } = await readJsonBody();
  return [201, { session: toClientSession(await startSession(db, userId, { id, repository, goal })) }];
}

async function deleteHistory({ db, userId }) {
  return [200, { deleted: await deleteCompletedSessions(db, userId) }];
}

async function importLegacy({ db, userId, readJsonBody }) {
  const { sessions } = await readJsonBody(IMPORT_LIMIT_BYTES);
  return [200, await importSessions(db, userId, sessions)];
}

async function finish({ db, userId, sessionId }) {
  const row = await finishSession(db, userId, sessionId);
  return row ? [200, { session: toClientSession(row) }] : [404, { error: 'That session isn’t running.' }];
}

async function storeActivity({ db, userId, sessionId, readJsonBody }) {
  const row = await saveActivity(db, userId, sessionId, await readJsonBody());
  return row ? [200, { session: toClientSession(row) }] : [404, { error: NOT_FOUND }];
}

async function editGoal({ db, userId, sessionId, readJsonBody }) {
  const { goal } = await readJsonBody();
  const row = await updateGoal(db, userId, sessionId, goal);
  return row ? [200, { session: toClientSession(row) }] : [404, { error: NOT_FOUND }];
}

async function remove({ db, userId, sessionId }) {
  return (await deleteSession(db, userId, sessionId)) ? [204, null] : [404, { error: NOT_FOUND }];
}

// Data first: if it can't be deleted, nothing else happens. A failed revoke doesn't undo the deletion;
// `revoked: false` lets the client tell the user to revoke Panta on GitHub.
async function deleteAccount({ db, userId, session, context }) {
  await deleteAccountData(db, userId);
  const revoked = await revokeAppGrant({
    clientId: context.env.GITHUB_APP_CLIENT_ID,
    clientSecret: context.env.GITHUB_APP_CLIENT_SECRET,
    accessToken: session.accessToken,
  });
  context.endUserLoginSessions(userId);
  return [200, { revoked }, { 'Set-Cookie': context.clearSessionCookie }];
}

function errorResponse(error) {
  if (error instanceof SessionConflictError || error instanceof AlreadyImportedError) return [409, { error: error.message }];
  if (error instanceof InvalidSessionError) return [400, { error: error.message }];
  // Request-body errors from readJsonBody carry their own status.
  if (Number.isInteger(error?.status)) return [error.status, { error: error.message }];
  console.error('Session storage error:', error?.message || error);
  return [503, { error: 'Panta couldn’t reach its database. Try again.' }];
}

export async function handleSessionRoute(context) {
  const { request, response, requestUrl, writeJson, getSession, db, readJsonBody } = context;
  const { pathname } = requestUrl;

  let routeMatch;
  const route = routes.find((candidate) => (routeMatch = candidate.match(pathname)));
  if (!route) return false;

  const handler = route.methods[request.method];
  if (!handler) {
    const allow = Object.keys(route.methods).join(', ');
    writeJson(response, 405, { error: `Use ${allow} for this session route.` }, { Allow: allow });
    return true;
  }

  const { session } = getSession();
  const userId = session && canonicalGitHubUserId(session.user);
  if (!userId) {
    writeJson(response, 401, { error: 'Sign in with GitHub first.' });
    return true;
  }
  if (!db) {
    writeJson(response, 503, { error: 'Session storage isn’t set up on this server.' });
    return true;
  }

  let sessionId;
  if (Array.isArray(routeMatch)) {
    try {
      sessionId = decodeURIComponent(routeMatch[1]);
    } catch {
      sessionId = null;
    }
    if (!isValidSessionId(sessionId)) {
      writeJson(response, 400, { error: 'The session ID is invalid.' });
      return true;
    }
  }

  let status;
  let body;
  let headers = {};
  try {
    [status, body, headers = {}] = await handler({ db, userId, sessionId, readJsonBody, session, context });
  } catch (error) {
    [status, body] = errorResponse(error);
  }

  if (status === 204) {
    response.writeHead(204, { 'Cache-Control': 'no-store', ...headers });
    response.end();
  } else {
    writeJson(response, status, body, headers);
  }
  return true;
}
