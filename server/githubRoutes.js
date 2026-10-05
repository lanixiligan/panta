import {
  GitHubApiError,
  canonicalGitHubUserId,
  fetchGitHubJson,
  getAccessibleRepositories,
  getActiveSessionCommitActivity,
  getAuthenticatedUserList,
  getSessionCommitActivity,
} from './githubApi.js';

const ACCESSIBLE_REPOSITORIES_PATH = '/api/github/repositories';
const PRESENCE_HEARTBEAT_PATH = '/api/presence/heartbeat';
const PEOPLE_FOLLOWING_PATH = '/api/social/people-following';
const FOLLOWING_CACHE_TTL_MS = 5 * 60_000;
const SESSION_COMMITS_PATH = /^\/api\/github\/repos\/([^/]+)\/([^/]+)\/session-commits$/;
const ACTIVE_SESSION_COMMITS_PATH = /^\/api\/github\/repos\/([^/]+)\/([^/]+)\/active-session-commits$/;

export function isGitHubDataRoute(pathname) {
  return pathname === ACCESSIBLE_REPOSITORIES_PATH
    || pathname === PRESENCE_HEARTBEAT_PATH
    || pathname === PEOPLE_FOLLOWING_PATH
    || SESSION_COMMITS_PATH.test(pathname)
    || ACTIVE_SESSION_COMMITS_PATH.test(pathname);
}

function respondWithGitHubError(response, writeJson, error, fallbackMessage) {
  writeJson(response, error instanceof GitHubApiError ? error.status : 502, {
    error: error instanceof GitHubApiError ? error.message : fallbackMessage,
  });
}

function getRepositoryPathParams(routeMatch) {
  let owner;
  let repository;
  try {
    owner = decodeURIComponent(routeMatch[1]);
    repository = decodeURIComponent(routeMatch[2]);
  } catch {
    return { error: 'The repository path is invalid.' };
  }
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    return { error: 'The repository owner or name is invalid.' };
  }
  return { owner, repository };
}

export async function handleGitHubDataRoute(context) {
  const {
    request,
    response,
    requestUrl,
    writeJson,
    getSession,
    presenceBySession,
    mutualsCache,
    mutualsRequests,
  } = context;
  const { pathname } = requestUrl;

  if (pathname === PRESENCE_HEARTBEAT_PATH) {
    if (request.method !== 'POST') {
      writeJson(response, 405, { error: 'Use POST to update online presence.' }, { Allow: 'POST' });
      return true;
    }

    const { sessionId, session } = getSession({ clearPresenceOnInvalid: true });
    if (!session) {
      writeJson(response, 401, { error: 'Sign in with GitHub to update presence.' });
      return true;
    }
    const githubUserId = canonicalGitHubUserId(session.user);
    if (!githubUserId) {
      writeJson(response, 401, { error: 'Sign in with GitHub to update presence.' });
      return true;
    }
    presenceBySession.set(sessionId, { githubUserId, lastSeenAt: Date.now() });
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === PEOPLE_FOLLOWING_PATH) {
    if (request.method !== 'GET') {
      writeJson(response, 405, { error: 'Use GET to load people you follow.' }, { Allow: 'GET' });
      return true;
    }

    const { session } = getSession({ clearPresenceOnInvalid: true });
    if (!session) {
      writeJson(response, 401, { error: 'Sign in with GitHub to view your mutuals.' });
      return true;
    }

    const githubUserId = canonicalGitHubUserId(session.user);
    if (!githubUserId) {
      writeJson(response, 401, { error: 'Sign in with GitHub to view your mutuals.' });
      return true;
    }

    try {
      let cachedMutuals = mutualsCache.get(githubUserId);
      if (!cachedMutuals || cachedMutuals.expiresAt <= Date.now()) {
        let mutualsRequest = mutualsRequests.get(githubUserId);
        if (!mutualsRequest) {
          mutualsRequest = Promise.all([
            getAuthenticatedUserList('following', session.accessToken),
            getAuthenticatedUserList('followers', session.accessToken),
          ])
            .then(([following, followers]) => {
              const followerIds = new Set(followers.map((user) => user.githubUserId));
              const mutuals = following.filter((user) => followerIds.has(user.githubUserId));
              mutualsCache.set(githubUserId, { users: mutuals, expiresAt: Date.now() + FOLLOWING_CACHE_TTL_MS });
              return mutuals;
            })
            .finally(() => mutualsRequests.delete(githubUserId));
          mutualsRequests.set(githubUserId, mutualsRequest);
        }
        cachedMutuals = { users: await mutualsRequest };
      }

      const onlineIds = new Set([...presenceBySession.values()].map(canonicalGitHubUserId).filter(Boolean));
      const mutuals = cachedMutuals.users
        .filter((user) => user.githubUserId !== githubUserId)
        .map((user) => ({ ...user, presence: onlineIds.has(user.githubUserId) ? 'online' : 'offline' }))
        .sort((left, right) => left.login.localeCompare(right.login));
      writeJson(response, 200, { mutuals });
    } catch {
      writeJson(response, 502, { error: 'Unable to load GitHub mutuals.' });
    }
    return true;
  }

  const accessibleRepositoriesRequest = pathname === ACCESSIBLE_REPOSITORIES_PATH;
  if (accessibleRepositoriesRequest) {
    if (request.method !== 'GET') {
      writeJson(response, 405, { error: 'Use GET to load accessible repositories.' }, { Allow: 'GET' });
      return true;
    }

    const { session } = getSession();
    if (!session) {
      writeJson(response, 401, { error: 'Sign in with GitHub to load accessible repositories.' });
      return true;
    }

    try {
      const repositories = await getAccessibleRepositories(session.accessToken);
      writeJson(response, 200, { repositories });
    } catch (error) {
      respondWithGitHubError(response, writeJson, error, 'Unable to load repositories accessible to Panta. Check the GitHub App installation and try again.');
    }
    return true;
  }

  const activeSessionCommitsMatch = pathname.match(ACTIVE_SESSION_COMMITS_PATH);
  if (activeSessionCommitsMatch) {
    if (request.method !== 'GET') {
      writeJson(response, 405, { error: 'Use GET to retrieve active session commits.' }, { Allow: 'GET' });
      return true;
    }

    const { session } = getSession();
    if (!session) {
      writeJson(response, 401, { error: 'Sign in with GitHub to retrieve session activity.' });
      return true;
    }

    const repositoryPath = getRepositoryPathParams(activeSessionCommitsMatch);
    if (repositoryPath.error) {
      writeJson(response, 400, { error: repositoryPath.error });
      return true;
    }
    const { owner, repository } = repositoryPath;

    const startedTime = Date.parse(requestUrl.searchParams.get('started_at') || '');
    const sinceTime = Date.parse(requestUrl.searchParams.get('since') || '');
    const untilTime = Date.parse(requestUrl.searchParams.get('until') || '');
    if (![startedTime, sinceTime, untilTime].every(Number.isFinite) || startedTime > untilTime) {
      writeJson(response, 400, { error: 'Valid active session timestamps are required.' });
      return true;
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
      respondWithGitHubError(response, writeJson, error, 'Could not retrieve live GitHub commits.');
    }
    return true;
  }

  const sessionCommitsMatch = pathname.match(SESSION_COMMITS_PATH);
  if (sessionCommitsMatch) {
    if (request.method !== 'GET') {
      writeJson(response, 405, { error: 'Use GET to retrieve session commits.' }, { Allow: 'GET' });
      return true;
    }

    const { session } = getSession();
    if (!session) {
      writeJson(response, 401, { error: 'Sign in with GitHub to retrieve session activity.' });
      return true;
    }

    const repositoryPath = getRepositoryPathParams(sessionCommitsMatch);
    if (repositoryPath.error) {
      writeJson(response, 400, { error: repositoryPath.error });
      return true;
    }
    const { owner, repository } = repositoryPath;

    const sinceTime = Date.parse(requestUrl.searchParams.get('since') || '');
    const untilTime = Date.parse(requestUrl.searchParams.get('until') || '');
    if (!Number.isFinite(sinceTime) || !Number.isFinite(untilTime) || sinceTime > untilTime) {
      writeJson(response, 400, { error: 'Valid session start and end timestamps are required.' });
      return true;
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
      respondWithGitHubError(response, writeJson, error, 'Could not retrieve GitHub commits for this session.');
    }
    return true;
  }

  return false;
}
