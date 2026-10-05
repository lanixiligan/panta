export async function getAccessibleRepositories() {
  let response;
  try {
    response = await fetch('/api/github/repositories', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Could not reach Panta’s GitHub connection. Check your connection and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Panta’s GitHub connection returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Your GitHub session expired. Sign in again to load repositories.');
    throw new Error(payload.error || `Unable to load repositories accessible to Panta (${response.status}).`);
  }

  return Array.isArray(payload.repositories) ? payload.repositories : [];
}

export async function getSessionActivity(repository, since, until) {
  const owner = repository?.owner?.login || repository?.owner;
  const name = repository?.name;
  if (!owner || !name) throw new Error('A GitHub repository is required to retrieve session activity.');
  if (!Number.isFinite(Date.parse(since)) || !Number.isFinite(Date.parse(until))) {
    throw new Error('Valid session start and end times are required to retrieve commits.');
  }

  const params = new URLSearchParams({
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
  });
  const path = `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/session-commits?${params}`;
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new Error('Could not reach Panta’s GitHub connection. Check your connection and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Panta’s GitHub connection returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Your GitHub session expired. Sign in again to retrieve commits.');
    throw new Error(payload.error || `Could not retrieve GitHub commits (${response.status}).`);
  }

  return payload;
}

export async function getActiveSessionCommits(repository, startedAt, since = startedAt, until = new Date().toISOString(), signal) {
  const owner = repository?.owner?.login || repository?.owner;
  const name = repository?.name;
  if (!owner || !name) throw new Error('A GitHub repository is required to retrieve session activity.');
  if (![startedAt, since, until].every((value) => Number.isFinite(Date.parse(value)))) {
    throw new Error('Valid session timestamps are required to retrieve live commits.');
  }

  const params = new URLSearchParams({
    started_at: new Date(startedAt).toISOString(),
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
  });
  const path = `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/active-session-commits?${params}`;
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal });
  } catch {
    throw new Error('Could not reach Panta’s GitHub connection. Check your connection and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Panta’s GitHub connection returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Your GitHub session expired. Sign in again to retrieve commits.');
    throw new Error(payload.error || `Could not retrieve live GitHub commits (${response.status}).`);
  }

  return payload;
}
