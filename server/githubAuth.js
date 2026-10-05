import { randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'gittogether_session';
const STATE_COOKIE = 'gittogether_oauth_state';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const STATE_TTL_SECONDS = 10 * 60;
const API_PREFIX = '/api/auth/';
const DEFAULT_GITHUB_APP_SLUG = 'panta-by-lanix-iligan';
const ACCESSIBLE_REPOSITORIES_PATH = '/api/github/repositories';
const SESSION_COMMITS_PATH = /^\/api\/github\/repos\/([^/]+)\/([^/]+)\/session-commits$/;
const ACTIVE_SESSION_COMMITS_PATH = /^\/api\/github\/repos\/([^/]+)\/([^/]+)\/active-session-commits$/;

function getGitHubAppSlug(configuredValue) {
  const value = configuredValue?.trim();
  if (!value) return DEFAULT_GITHUB_APP_SLUG;

  const appUrlMatch = value.match(/^https:\/\/github\.com\/apps\/([a-z0-9-]+)\/?$/i);
  if (appUrlMatch) return appUrlMatch[1];
  if (/^[a-z0-9-]+$/i.test(value)) return value;
  return null;
}

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

class GitHubApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function fetchGitHubJson(url, accessToken) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GitHubApiError('Could not reach GitHub. Try retrieving the session activity again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GitHubApiError('GitHub returned an unreadable response. Try again.');
  }

  if (!response.ok) {
    const rateLimited = response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
    const message = rateLimited
      ? 'GitHub is limiting API requests right now. Try retrieving the session activity again later.'
      : response.status === 401
        ? 'Your GitHub authorization has expired. Sign in again to access repositories.'
        : response.status === 403 || response.status === 404
          ? 'Repository access is not available to Panta. Check that the repository is included in the GitHub App installation and that read permissions are enabled.'
          : payload.message || `GitHub returned an error (${response.status}).`;
    throw new GitHubApiError(message, response.status);
  }

  return { payload, response };
}

function nextPageUrl(linkHeader) {
  const nextLink = linkHeader?.split(',').map((part) => part.trim()).find((part) => /rel="next"/.test(part));
  const match = nextLink?.match(/<([^>]+)>/);
  if (!match) return null;
  const nextUrl = new URL(match[1]);
  return nextUrl.origin === 'https://api.github.com' ? nextUrl.href : null;
}

async function getAccessibleRepositories(accessToken) {
  const repositoriesUrl = new URL('https://api.github.com/user/repos');
  repositoriesUrl.search = new URLSearchParams({
    affiliation: 'owner,collaborator,organization_member',
    visibility: 'all',
    sort: 'updated',
    per_page: '100',
  }).toString();

  const repositories = [];
  let pageUrl = repositoriesUrl.href;
  while (pageUrl) {
    const { payload, response } = await fetchGitHubJson(pageUrl, accessToken);
    if (!Array.isArray(payload)) throw new GitHubApiError('GitHub returned an invalid repository list.');
    repositories.push(...payload.map((repository) => ({
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      owner: repository.owner ? {
        login: repository.owner.login,
        avatar_url: repository.owner.avatar_url || null,
      } : null,
      description: repository.description || null,
      private: Boolean(repository.private),
      visibility: repository.visibility || (repository.private ? 'private' : 'public'),
      language: repository.language || null,
      updated_at: repository.updated_at || null,
      html_url: repository.html_url,
    })));
    pageUrl = nextPageUrl(response.headers.get('link'));
  }
  return repositories;
}

async function getSessionCommitRefs({ owner, repository, since, until, author, accessToken }) {
  const listUrl = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits`);
  const params = new URLSearchParams({ since, until, per_page: '100' });
  if (author) params.set('author', author);
  listUrl.search = params.toString();

  const commitRefs = [];
  let pageUrl = listUrl.href;
  while (pageUrl) {
    const { payload, response } = await fetchGitHubJson(pageUrl, accessToken);
    if (!Array.isArray(payload)) throw new GitHubApiError('GitHub returned an invalid commit list.');
    commitRefs.push(...payload);
    pageUrl = nextPageUrl(response.headers.get('link'));
  }

  return commitRefs
    .filter((commit) => !author || commit.author?.login?.toLocaleLowerCase() === author.toLocaleLowerCase())
    .map((commit) => ({
      sha: commit.sha,
      message: commit.commit?.message || 'Commit message unavailable',
      timestamp: commit.commit?.committer?.date || commit.commit?.author?.date || null,
      author: { name: commit.commit?.author?.name || commit.author?.login || 'Unknown author', login: commit.author?.login || null },
      htmlUrl: commit.html_url || null,
    }));
}

async function getActiveSessionCommitActivity({ owner, repository, since, until, author, accessToken }) {
  const commits = await getSessionCommitRefs({ owner, repository, since, until, author, accessToken });
  commits.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  return { commits, checkedAt: new Date().toISOString() };
}

async function getSessionCommitActivity({ owner, repository, since, until, author, accessToken }) {
  const commitRefs = await getSessionCommitRefs({ owner, repository, since, until, author, accessToken });

  const commits = [];
  for (let index = 0; index < commitRefs.length; index += 8) {
    const batch = commitRefs.slice(index, index + 8);
    const details = await Promise.all(batch.map(({ sha }) => {
      const detailUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits/${encodeURIComponent(sha)}`;
      return fetchGitHubJson(detailUrl, accessToken);
    }));

    commits.push(...details.map(({ payload }) => {
      const commit = payload.commit || {};
      const files = Array.isArray(payload.files) ? payload.files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: Number(file.additions) || 0,
        deletions: Number(file.deletions) || 0,
        changes: Number(file.changes) || 0,
      })) : [];
      return {
        sha: payload.sha,
        message: commit.message || 'Commit message unavailable',
        timestamp: commit.committer?.date || commit.author?.date || null,
        author: {
          name: commit.author?.name || payload.author?.login || 'Unknown author',
          login: payload.author?.login || null,
        },
        committer: {
          name: commit.committer?.name || payload.committer?.login || 'Unknown committer',
          login: payload.committer?.login || null,
        },
        htmlUrl: payload.html_url || null,
        additions: Number(payload.stats?.additions) || 0,
        deletions: Number(payload.stats?.deletions) || 0,
        totalChanges: Number(payload.stats?.total) || 0,
        files,
      };
    }));
  }

  commits.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  return {
    source: 'github',
    activity: {
      commits: commits.length,
      filesChanged: commits.reduce((total, commit) => total + commit.files.length, 0),
      additions: commits.reduce((total, commit) => total + commit.additions, 0),
      deletions: commits.reduce((total, commit) => total + commit.deletions, 0),
    },
    commits,
  };
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
    const sessionCommitsMatch = requestUrl.pathname.match(SESSION_COMMITS_PATH);
    const activeSessionCommitsMatch = requestUrl.pathname.match(ACTIVE_SESSION_COMMITS_PATH);
    const accessibleRepositoriesRequest = requestUrl.pathname === ACCESSIBLE_REPOSITORIES_PATH;
    if (!requestUrl.pathname.startsWith(API_PREFIX) && !sessionCommitsMatch && !activeSessionCommitsMatch && !accessibleRepositoriesRequest) return next();

    const route = `${request.method} ${requestUrl.pathname}`;
    const cookies = parseCookies(request.headers.cookie);
    const clearStateCookie = `${STATE_COOKIE}=; ${cookieOptions({ production, path: '/api/auth/github/callback', maxAge: 0 })}`;
    const clearSessionCookie = `${SESSION_COOKIE}=; ${cookieOptions({ production, maxAge: 0 })}`;

    pruneSessions(sessions);

    if (accessibleRepositoriesRequest) {
      if (request.method !== 'GET') {
        writeJson(response, 405, { error: 'Use GET to load accessible repositories.' }, { Allow: 'GET' });
        return;
      }

      const sessionId = cookies[SESSION_COOKIE];
      const session = sessionId && sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) sessions.delete(sessionId);
        writeJson(response, 401, { error: 'Sign in with GitHub to load accessible repositories.' });
        return;
      }

      try {
        const repositories = await getAccessibleRepositories(session.accessToken);
        writeJson(response, 200, { repositories });
      } catch (error) {
        writeJson(response, error instanceof GitHubApiError ? error.status : 502, {
          error: error instanceof GitHubApiError
            ? error.message
            : 'Unable to load repositories accessible to Panta. Check the GitHub App installation and try again.',
        });
      }
      return;
    }

    if (activeSessionCommitsMatch) {
      if (request.method !== 'GET') {
        writeJson(response, 405, { error: 'Use GET to retrieve active session commits.' }, { Allow: 'GET' });
        return;
      }

      const sessionId = cookies[SESSION_COOKIE];
      const session = sessionId && sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) sessions.delete(sessionId);
        writeJson(response, 401, { error: 'Sign in with GitHub to retrieve session activity.' });
        return;
      }

      let owner;
      let repository;
      try {
        owner = decodeURIComponent(activeSessionCommitsMatch[1]);
        repository = decodeURIComponent(activeSessionCommitsMatch[2]);
      } catch {
        writeJson(response, 400, { error: 'The repository path is invalid.' });
        return;
      }
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
        writeJson(response, 400, { error: 'The repository owner or name is invalid.' });
        return;
      }

      const startedTime = Date.parse(requestUrl.searchParams.get('started_at') || '');
      const sinceTime = Date.parse(requestUrl.searchParams.get('since') || '');
      const untilTime = Date.parse(requestUrl.searchParams.get('until') || '');
      if (![startedTime, sinceTime, untilTime].every(Number.isFinite) || startedTime > untilTime) {
        writeJson(response, 400, { error: 'Valid active session timestamps are required.' });
        return;
      }

      try {
        const result = await getActiveSessionCommitActivity({
          owner,
          repository,
          since: new Date(Math.max(startedTime, sinceTime)).toISOString(),
          until: new Date(untilTime).toISOString(),
          author: session.user.username,
          accessToken: session.accessToken,
        });
        writeJson(response, 200, result);
      } catch (error) {
        writeJson(response, error instanceof GitHubApiError ? error.status : 502, {
          error: error instanceof GitHubApiError ? error.message : 'Could not retrieve live GitHub commits.',
        });
      }
      return;
    }

    if (sessionCommitsMatch) {
      if (request.method !== 'GET') {
        writeJson(response, 405, { error: 'Use GET to retrieve session commits.' }, { Allow: 'GET' });
        return;
      }

      const sessionId = cookies[SESSION_COOKIE];
      const session = sessionId && sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) sessions.delete(sessionId);
        writeJson(response, 401, { error: 'Sign in with GitHub to retrieve session activity.' });
        return;
      }

      let owner;
      let repository;
      try {
        owner = decodeURIComponent(sessionCommitsMatch[1]);
        repository = decodeURIComponent(sessionCommitsMatch[2]);
      } catch {
        writeJson(response, 400, { error: 'The repository path is invalid.' });
        return;
      }
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
        writeJson(response, 400, { error: 'The repository owner or name is invalid.' });
        return;
      }
      const sinceValue = requestUrl.searchParams.get('since');
      const untilValue = requestUrl.searchParams.get('until');
      const sinceTime = Date.parse(sinceValue || '');
      const untilTime = Date.parse(untilValue || '');
      if (!Number.isFinite(sinceTime) || !Number.isFinite(untilTime) || sinceTime > untilTime) {
        writeJson(response, 400, { error: 'Valid session start and end timestamps are required.' });
        return;
      }

      try {
        const repositoryUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
        await fetchGitHubJson(repositoryUrl, session.accessToken);
        const result = await getSessionCommitActivity({
          owner,
          repository,
          since: new Date(sinceTime).toISOString(),
          until: new Date(untilTime).toISOString(),
          author: session.user.username,
          accessToken: session.accessToken,
        });
        writeJson(response, 200, result);
      } catch (error) {
        writeJson(response, error instanceof GitHubApiError ? error.status : 502, {
          error: error instanceof GitHubApiError ? error.message : 'Could not retrieve GitHub commits for this session.',
        });
      }
      return;
    }

    if (route === 'GET /api/auth/github/install') {
      const appSlug = getGitHubAppSlug(env.GITHUB_APP_SLUG);
      if (!appSlug) {
        redirect(response, authErrorUrl('repository_access'));
        return;
      }

      redirect(response, `https://github.com/apps/${appSlug}/installations/new`);
      return;
    }

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
