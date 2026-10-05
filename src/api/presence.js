async function requestPresence(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });

  if (response.status === 204) return null;
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The caller receives a stable, human-readable fallback below.
  }
  if (!response.ok) throw new Error(payload?.error || 'Unable to load people you follow.');
  return payload;
}

export function sendPresenceHeartbeat() {
  return requestPresence('/api/presence/heartbeat', { method: 'POST' });
}

export async function getGitHubMutuals(signal) {
  const result = await requestPresence('/api/social/people-following', { signal });
  return Array.isArray(result?.mutuals) ? result.mutuals : [];
}
