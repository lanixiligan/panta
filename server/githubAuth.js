import { handleAuthRoute } from './authRoutes.js';
import { isGitHubDataRoute, handleGitHubDataRoute } from './githubRoutes.js';

const PANTA_SESSION_COOKIE = 'panta_session';
const PANTA_OAUTH_STATE_COOKIE = 'panta_oauth_state';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const STATE_TTL_SECONDS = 10 * 60;
const API_PREFIX = '/api/auth/';
const PRESENCE_ONLINE_WINDOW_MS = 90_000;

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(([name]) => name));
}

function cookieOptions({ production, path, maxAge }) {
  return [
    `${path ? `Path=${path}` : 'Path=/'}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(production ? ['Secure'] : []),
    ...(maxAge === undefined ? [] : [`Max-Age=${maxAge}`]),
  ].join('; ');
}

function writeJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function redirect(response, url, cookies = []) {
  response.writeHead(302, {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    Location: url,
    ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
  });
  response.end();
}

function pruneSessions(sessions, presenceBySession) {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
      presenceBySession.delete(sessionId);
    }
  }
}

function prunePresence(presenceBySession, sessions) {
  const now = Date.now();
  for (const [sessionId, presence] of presenceBySession) {
    if (!sessions.has(sessionId) || now - presence.lastSeenAt > PRESENCE_ONLINE_WINDOW_MS) {
      presenceBySession.delete(sessionId);
    }
  }
}

function createRequestContext(request, response, requestUrl, state) {
  const { cookies, sessions, presenceBySession, production } = state;
  const sessionId = cookies[PANTA_SESSION_COOKIE];
  return {
    request,
    response,
    requestUrl,
    route: `${request.method} ${requestUrl.pathname}`,
    cookies,
    env: state.env,
    production,
    sessions,
    presenceBySession,
    mutualsCache: state.mutualsCache,
    mutualsRequests: state.mutualsRequests,
    sessionCookie: PANTA_SESSION_COOKIE,
    stateCookie: PANTA_OAUTH_STATE_COOKIE,
    sessionTtlMs: SESSION_TTL_MS,
    stateTtlSeconds: STATE_TTL_SECONDS,
    clearStateCookie: `${PANTA_OAUTH_STATE_COOKIE}=; ${cookieOptions({ production, path: '/api/auth/github/callback', maxAge: 0 })}`,
    clearSessionCookie: `${PANTA_SESSION_COOKIE}=; ${cookieOptions({ production, maxAge: 0 })}`,
    cookieOptions,
    writeJson,
    redirect,
    getSession({ clearPresenceOnInvalid = false } = {}) {
      const session = sessionId && sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) {
          sessions.delete(sessionId);
          if (clearPresenceOnInvalid) presenceBySession.delete(sessionId);
        }
        return { sessionId, session: null };
      }
      return { sessionId, session };
    },
  };
}

function createGitHubAuthMiddleware(env = process.env) {
  const sessions = new Map();
  // Process-local for the MVP. Multiple server instances need shared presence storage.
  const presenceBySession = new Map();
  const mutualsCache = new Map();
  const mutualsRequests = new Map();
  const production = env.NODE_ENV === 'production';

  return async function githubAuthMiddleware(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    const isAuthRoute = requestUrl.pathname.startsWith(API_PREFIX);
    if (!isAuthRoute && !isGitHubDataRoute(requestUrl.pathname)) return next();

    pruneSessions(sessions, presenceBySession);
    prunePresence(presenceBySession, sessions);
    const context = createRequestContext(request, response, requestUrl, {
      env,
      production,
      cookies: parseCookies(request.headers.cookie),
      sessions,
      presenceBySession,
      mutualsCache,
      mutualsRequests,
    });

    if (await handleGitHubDataRoute(context)) return;
    if (isAuthRoute) {
      await handleAuthRoute(context);
      return;
    }
    writeJson(response, 404, { error: 'Route not found.' });
  };
}

export function githubAuthApi(env = process.env) {
  const middleware = createGitHubAuthMiddleware(env);
  return {
    name: 'panta-github-auth-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
