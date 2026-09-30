const API_BASE = 'https://api.github.com';

async function request(path) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('Could not reach GitHub. Check your connection and try again.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('We couldn’t find that GitHub user. Check the username and try again.');
    }
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error('GitHub’s public API rate limit has been reached. Please try again later.');
    }
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub is limiting requests right now. Please try again in a little while.');
    }
    throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
  }

  return response.json();
}

export function getUser(username) {
  return request(`/users/${encodeURIComponent(username)}`);
}

export function getUserRepositories(username) {
  return request(`/users/${encodeURIComponent(username)}/repos?per_page=10&sort=updated`);
}

export function searchUsers(query, page = 1, perPage = 10) {
  if (!query?.trim()) {
    throw new Error('Enter a search term to find GitHub users.');
  }

  const params = new URLSearchParams({
    q: query,
    per_page: String(perPage),
    page: String(page),
  });

  return request(`/search/users?${params.toString()}`);
}
