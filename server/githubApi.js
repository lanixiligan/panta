export class GitHubApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function canonicalGitHubUserId(user) {
  const value = user?.githubUserId ?? user?.id;
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return String(value);
}

export async function fetchGitHubJson(url, accessToken) {
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

export function nextPageUrl(linkHeader) {
  const nextLink = linkHeader?.split(',').map((part) => part.trim()).find((part) => /rel="next"/.test(part));
  const match = nextLink?.match(/<([^>]+)>/);
  if (!match) return null;
  const nextUrl = new URL(match[1]);
  return nextUrl.origin === 'https://api.github.com' ? nextUrl.href : null;
}

export async function getAccessibleRepositories(accessToken) {
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

export async function getAuthenticatedUserList(endpoint, accessToken) {
  const firstPage = new URL(`https://api.github.com/user/${endpoint}`);
  firstPage.search = new URLSearchParams({ per_page: '100', page: '1' }).toString();
  const users = new Map();
  let pageUrl = firstPage.href;

  while (pageUrl) {
    const { payload, response } = await fetchGitHubJson(pageUrl, accessToken);
    if (!Array.isArray(payload)) throw new GitHubApiError(`GitHub returned an invalid ${endpoint} list.`);
    for (const user of payload) {
      if (!user?.login) continue;
      const githubUserId = canonicalGitHubUserId(user);
      if (!githubUserId) continue;
      if (!users.has(githubUserId)) {
        users.set(githubUserId, {
          githubUserId,
          login: user.login,
          avatarUrl: user.avatar_url || null,
          githubUrl: user.html_url || `https://github.com/${encodeURIComponent(user.login)}`,
        });
      }
    }
    pageUrl = nextPageUrl(response.headers.get('link'));
  }
  return [...users.values()];
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

export async function getActiveSessionCommitActivity({ owner, repository, since, until, author, accessToken }) {
  const commits = await getSessionCommitRefs({ owner, repository, since, until, author, accessToken });
  commits.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  return { commits, checkedAt: new Date().toISOString() };
}

export async function getSessionCommitActivity({ owner, repository, since, until, author, accessToken }) {
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

export async function exchangeCode({ code, clientId, clientSecret, callbackUrl }) {
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

export async function getAuthenticatedUser(accessToken) {
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
    // githubUserId is the canonical identity key used across auth and presence.
    githubUserId: String(user.id),
    id: user.id,
    username: user.login,
    displayName: user.name || null,
    avatarUrl: user.avatar_url || null,
    profileUrl: user.html_url || `https://github.com/${encodeURIComponent(user.login)}`,
  };
}
