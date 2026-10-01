import { randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'gittogether_session';
const STATE_COOKIE = 'gittogether_oauth_state';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const STATE_TTL_SECONDS = 10 * 60;
const API_PREFIX = '/api/auth/';

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

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function authErrorUrl(error) {
  return `/?auth_error=${encodeURIComponent(error)}`;
}

function pruneSessions(sessions) {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

async function exchangeCode({ code, clientId, clientSecret, callbackUrl }) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error('GitHub token exchange failed.');
  const result = await response.json();
  if (!result.access_token || result.error) throw new Error('GitHub token exchange failed.');
  return result;
}

async function getAuthenticatedUser(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('GitHub could not verify the authorized user.');

  const user = await response.json();
  if (user.id === undefined || !user.login) throw new Error('GitHub returned an incomplete user profile.');

  return {
    id: user.id,
    username: user.login,
    displayName: user.name || null,
    avatarUrl: user.avatar_url || null,
    profileUrl: user.html_url || `https://github.com/${encodeURIComponent(user.login)}`,
  };
}

function createGitHubAuthMiddleware(env = process.env) {
  const sessions = new Map();
  const production = env.NODE_ENV === 'production';

  return async function githubAuthMiddleware(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    if (!requestUrl.pathname.startsWith(API_PREFIX)) return next();

    const route = `${request.method} ${requestUrl.pathname}`;
    const cookies = parseCookies(request.headers.cookie);
    const clearStateCookie = `${STATE_COOKIE}=; ${cookieOptions({ production, path: '/api/auth/github/callback', maxAge: 0 })}`;
    const clearSessionCookie = `${SESSION_COOKIE}=; ${cookieOptions({ production, maxAge: 0 })}`;

    pruneSessions(sessions);

    if (route === 'GET /api/auth/github') {
      const { GITHUB_APP_CLIENT_ID: clientId, GITHUB_APP_CLIENT_SECRET: clientSecret, GITHUB_CALLBACK_URL: callbackUrl } = env;
      if (!clientId || !clientSecret || !callbackUrl) {
        redirect(response, authErrorUrl('not_configured'));
        return;
      }

      let callback;
      try {
        callback = new URL(callbackUrl);
        if (!['http:', 'https:'].includes(callback.protocol) || (production && callback.protocol !== 'https:')) throw new Error();
      } catch {
        redirect(response, authErrorUrl('not_configured'));
        return;
      }

      const state = randomBytes(32).toString('base64url');
      const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
      authorizeUrl.searchParams.set('client_id', clientId);
      authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
      authorizeUrl.searchParams.set('state', state);
      response.writeHead(302, {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Set-Cookie': `${STATE_COOKIE}=${state}; ${cookieOptions({ production, path: '/api/auth/github/callback', maxAge: STATE_TTL_SECONDS })}`,
        Location: authorizeUrl.href,
      });
      response.end();
      return;
    }

    if (route === 'GET /api/auth/github/callback') {
      const callbackUrl = env.GITHUB_CALLBACK_URL || 'http://localhost/';
      const stateCookie = cookies[STATE_COOKIE];
      const returnedState = requestUrl.searchParams.get('state');
      if (!safeEqual(stateCookie, returnedState)) {
        redirect(response, authErrorUrl('state'), [clearStateCookie]);
        return;
      }

      if (requestUrl.searchParams.has('error')) {
        redirect(response, authErrorUrl('denied'), [clearStateCookie]);
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const clientId = env.GITHUB_APP_CLIENT_ID;
      const clientSecret = env.GITHUB_APP_CLIENT_SECRET;
      if (!code || !clientId || !clientSecret || !env.GITHUB_CALLBACK_URL) {
        redirect(response, authErrorUrl('callback'), [clearStateCookie]);
        return;
      }

      try {
        const tokenData = await exchangeCode({ code, clientId, clientSecret, callbackUrl: env.GITHUB_CALLBACK_URL });
        const user = await getAuthenticatedUser(tokenData.access_token);
        const sessionId = randomBytes(32).toString('base64url');
        const tokenLifetime = Number(tokenData.expires_in) > 0 ? Number(tokenData.expires_in) * 1000 : SESSION_TTL_MS;
        const expiresAt = Date.now() + Math.min(SESSION_TTL_MS, tokenLifetime);
        sessions.set(sessionId, { user, accessToken: tokenData.access_token, expiresAt });

        redirect(response, new URL('/', callbackUrl).href, [
          clearStateCookie,
          `${SESSION_COOKIE}=${sessionId}; ${cookieOptions({ production, maxAge: Math.floor((expiresAt - Date.now()) / 1000) })}`,
        ]);
      } catch {
        redirect(response, authErrorUrl('exchange'), [clearStateCookie]);
      }
      return;
    }

    if (route === 'GET /api/auth/me') {
      const sessionId = cookies[SESSION_COOKIE];
      const session = sessionId && sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) sessions.delete(sessionId);
        writeJson(response, 401, { authenticated: false, user: null }, { 'Set-Cookie': clearSessionCookie });
        return;
      }

      writeJson(response, 200, { authenticated: true, user: session.user });
      return;
    }

    if (route === 'POST /api/auth/logout') {
      const sessionId = cookies[SESSION_COOKIE];
      if (sessionId) sessions.delete(sessionId);
      response.writeHead(204, { 'Cache-Control': 'no-store', 'Set-Cookie': clearSessionCookie });
      response.end();
      return;
    }

    writeJson(response, 404, { error: 'Authentication route not found.' });
  };
}

export function githubAuthApi(env = process.env) {
  const middleware = createGitHubAuthMiddleware(env);
  return {
    name: 'github-app-auth-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
