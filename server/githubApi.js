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

const commitDateCache = new Map();
const COMMIT_DATE_CACHE_LIMIT = 5000;

function repositoryApiUrl(owner, repository, path = '') {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${path}`;
}

async function getPaginatedList(url, accessToken, invalidMessage) {
  const items = [];
  let pageUrl = url;
  while (pageUrl) {
    const { payload, response } = await fetchGitHubJson(pageUrl, accessToken);
    if (!Array.isArray(payload)) throw new GitHubApiError(invalidMessage);
    items.push(...payload);
    pageUrl = nextPageUrl(response.headers.get('link'));
  }
  return items;
}

// Commits are immutable, so a branch head's committer date can be cached by SHA.
async function getCommitDate(owner, repository, sha, accessToken) {
  const key = `${owner}/${repository}@${sha}`.toLocaleLowerCase();
  if (commitDateCache.has(key)) return commitDateCache.get(key);
  const { payload } = await fetchGitHubJson(repositoryApiUrl(owner, repository, `/git/commits/${encodeURIComponent(sha)}`), accessToken);
  const time = Date.parse(payload?.committer?.date || payload?.author?.date || '');
  if (commitDateCache.size >= COMMIT_DATE_CACHE_LIMIT) commitDateCache.clear();
  commitDateCache.set(key, time);
  return time;
}

// Branches whose head commit predates the window cannot contain commits from it,
// so only the remaining branches are queried for commits.
async function getBranchesChangedSince(owner, repository, since, accessToken) {
  const branches = await getPaginatedList(
    `${repositoryApiUrl(owner, repository, '/branches')}?per_page=100`,
    accessToken,
    'GitHub returned an invalid branch list.',
  );
  const sinceTime = Date.parse(since);
  const changed = [];
  for (let index = 0; index < branches.length; index += 8) {
    const batch = branches.slice(index, index + 8);
    const headTimes = await Promise.all(batch.map((branch) => getCommitDate(owner, repository, branch.commit.sha, accessToken)));
    batch.forEach((branch, batchIndex) => {
      if (!Number.isFinite(headTimes[batchIndex]) || headTimes[batchIndex] >= sinceTime) changed.push(branch.name);
    });
  }
  return changed;
}

async function getSessionCommitRefs({ owner, repository, since, until, author, accessToken }) {
  const branchNames = await getBranchesChangedSince(owner, repository, since, accessToken);
  const commitsBySha = new Map();

  for (let index = 0; index < branchNames.length; index += 8) {
    const batch = branchNames.slice(index, index + 8);
    const results = await Promise.all(batch.map((branch) => {
      const params = new URLSearchParams({ sha: branch, since, until, per_page: '100' });
      if (author) params.set('author', author);
      return getPaginatedList(`${repositoryApiUrl(owner, repository, '/commits')}?${params}`, accessToken, 'GitHub returned an invalid commit list.');
    }));

    results.forEach((branchCommits, batchIndex) => {
      const branch = batch[batchIndex];
      branchCommits
        .filter((commit) => !author || commit.author?.login?.toLocaleLowerCase() === author.toLocaleLowerCase())
        .forEach((commit) => {
          const existing = commitsBySha.get(commit.sha);
          if (existing) {
            existing.branches.push(branch);
            return;
          }
          commitsBySha.set(commit.sha, {
            sha: commit.sha,
            message: commit.commit?.message || 'Commit message unavailable',
            timestamp: commit.commit?.committer?.date || commit.commit?.author?.date || null,
            author: { name: commit.commit?.author?.name || commit.author?.login || 'Unknown author', login: commit.author?.login || null },
            htmlUrl: commit.html_url || null,
            branches: [branch],
          });
        });
    });
  }

  return [...commitsBySha.values()];
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
      return fetchGitHubJson(repositoryApiUrl(owner, repository, `/commits/${encodeURIComponent(sha)}`), accessToken);
    }));

    commits.push(...details.map(({ payload }, batchIndex) => {
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
        branches: batch[batchIndex].branches,
      };
    }));
  }

  commits.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  return {
    source: 'github',
    activity: {
      commits: commits.length,
      filesChanged: new Set(commits.flatMap((commit) => commit.files.map(({ filename }) => filename))).size,
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
