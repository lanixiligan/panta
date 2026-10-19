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
  // The status lets callers tell an expired sign-in (401) apart from other failures.
  if (!response.ok) throw Object.assign(new Error(payload?.error || 'Unable to load people you follow.'), { status: response.status });
  return payload;
}

// Resolves to { ok, activeSession }: the session running on the server as { id, pausedMs }, null when none is,
// or undefined when the server couldn't check its storage.
export function sendPresenceHeartbeat() {
  return requestPresence('/api/presence/heartbeat', { method: 'POST' });
}

export async function getGitHubMutuals(signal) {
  const result = await requestPresence('/api/social/people-following', { signal });
  return Array.isArray(result?.mutuals) ? result.mutuals : [];
}
