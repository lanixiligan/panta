import { randomBytes, timingSafeEqual } from 'node:crypto';
import { exchangeCode, getAuthenticatedUser } from './githubApi.js';

function authErrorUrl(error) {
  return `/?auth_error=${encodeURIComponent(error)}`;
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function handleAuthRoute(context) {
  const {
    response,
    requestUrl,
    route,
    cookies,
    env,
    production,
    sessions,
    sessionCookie,
    stateCookie,
    stateTtlSeconds,
    sessionTtlMs,
    clearStateCookie,
    clearSessionCookie,
    cookieOptions,
    writeJson,
    redirect,
    getSession,
  } = context;

  if (route === 'GET /api/auth/github/install') {
    const appSlug = getGitHubAppSlug(env.GITHUB_APP_SLUG);
    if (!appSlug) {
      redirect(response, authErrorUrl('repository_access'));
      return true;
    }
    redirect(response, `https://github.com/apps/${appSlug}/installations/new`);
    return true;
  }

  if (route === 'GET /api/auth/github') {
    const { GITHUB_APP_CLIENT_ID: clientId, GITHUB_APP_CLIENT_SECRET: clientSecret, GITHUB_CALLBACK_URL: callbackUrl } = env;
    if (!clientId || !clientSecret || !callbackUrl) {
      redirect(response, authErrorUrl('not_configured'));
      return true;
    }

    let callback;
    try {
      callback = new URL(callbackUrl);
      if (!['http:', 'https:'].includes(callback.protocol) || (production && callback.protocol !== 'https:')) throw new Error();
    } catch {
      redirect(response, authErrorUrl('not_configured'));
      return true;
    }

    const state = randomBytes(32).toString('base64url');
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizeUrl.searchParams.set('state', state);
    response.writeHead(302, {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': `${stateCookie}=${state}; ${cookieOptions({ production, path: '/api/auth/github/callback', maxAge: stateTtlSeconds })}`,
      Location: authorizeUrl.href,
    });
    response.end();
    return true;
  }

  if (route === 'GET /api/auth/github/callback') {
    const callbackUrl = env.GITHUB_CALLBACK_URL || 'http://localhost/';
    const stateFromCookie = cookies[stateCookie];
    const returnedState = requestUrl.searchParams.get('state');
    if (!safeEqual(stateFromCookie, returnedState)) {
      redirect(response, authErrorUrl('state'), [clearStateCookie]);
      return true;
    }
    if (requestUrl.searchParams.has('error')) {
      redirect(response, authErrorUrl('denied'), [clearStateCookie]);
      return true;
    }

    const code = requestUrl.searchParams.get('code');
    const clientId = env.GITHUB_APP_CLIENT_ID;
    const clientSecret = env.GITHUB_APP_CLIENT_SECRET;
    if (!code || !clientId || !clientSecret || !env.GITHUB_CALLBACK_URL) {
      redirect(response, authErrorUrl('callback'), [clearStateCookie]);
      return true;
    }

    try {
      const tokenData = await exchangeCode({ code, clientId, clientSecret, callbackUrl: env.GITHUB_CALLBACK_URL });
      const user = await getAuthenticatedUser(tokenData.access_token);
      const sessionId = randomBytes(32).toString('base64url');
      const tokenLifetime = Number(tokenData.expires_in) > 0 ? Number(tokenData.expires_in) * 1000 : sessionTtlMs;
      const expiresAt = Date.now() + Math.min(sessionTtlMs, tokenLifetime);
      sessions.set(sessionId, { user, accessToken: tokenData.access_token, expiresAt });

      redirect(response, new URL('/', callbackUrl).href, [
        clearStateCookie,
        `${sessionCookie}=${sessionId}; ${cookieOptions({ production, maxAge: Math.floor((expiresAt - Date.now()) / 1000) })}`,
      ]);
    } catch {
      redirect(response, authErrorUrl('exchange'), [clearStateCookie]);
    }
    return true;
  }

  if (route === 'GET /api/auth/me') {
    const { session } = getSession();
    if (!session) {
      writeJson(response, 401, { authenticated: false, user: null }, { 'Set-Cookie': clearSessionCookie });
      return true;
    }
    writeJson(response, 200, { authenticated: true, user: session.user });
    return true;
  }

  if (route === 'POST /api/auth/logout') {
    const sessionId = cookies[sessionCookie];
    if (sessionId) {
      sessions.delete(sessionId);
      context.presenceBySession.delete(sessionId);
    }
    response.writeHead(204, { 'Cache-Control': 'no-store', 'Set-Cookie': clearSessionCookie });
    response.end();
    return true;
  }

  writeJson(response, 404, { error: 'Authentication route not found.' });
  return true;
}

function getGitHubAppSlug(configuredValue) {
  const value = configuredValue?.trim();
  if (!value) return 'panta-by-lanix-iligan';

  const appUrlMatch = value.match(/^https:\/\/github\.com\/apps\/([a-z0-9-]+)\/?$/i);
  if (appUrlMatch) return appUrlMatch[1];
  if (/^[a-z0-9-]+$/i.test(value)) return value;
  return null;
}
