import { sessionDetailPath } from '../routing.js';

// Helpers for session records. They work the same on real sessions and on the example sessions in src/dummy-data/.

// Session time in milliseconds, with paused time excluded, or null when it can't be determined.
// The server's stored duration wins. Sessions without one (older ones and the examples) are measured
// from their timestamps, minus any recorded paused time.
export function getSessionDurationMs(session) {
  if (Number.isFinite(session.duration) && session.duration >= 0) return session.duration;
  const startedAt = Date.parse(session.startedAt);
  const endedAt = Date.parse(session.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return null;
  const duration = endedAt - startedAt - (session.pausedMs || 0);
  return duration >= 0 ? duration : null;
}

// Session time so far for a running session, with paused time excluded.
export function getActiveElapsedMs(session, now) {
  return Math.max(0, now - Date.parse(session.startedAt) - (session.pausedMs || 0));
}

export function getSessionDurationMinutes(session) {
  const durationMs = getSessionDurationMs(session);
  return durationMs === null ? 0 : Math.floor(durationMs / 60_000);
}

export function getSessionListItems(sessions = []) {
  return sessions.filter((session) => session && typeof session === 'object').map((session) => {
    const repository = session.repository || {};
    return {
      id: session.id,
      source: session.source || 'github',
      isPlaceholder: session.source === 'placeholder',
      status: session.status || (session.endedAt ? 'completed' : 'active'),
      hasActivity: Boolean(session.activity),
      activityStatus: session.activityStatus || (session.source === 'placeholder' ? 'placeholder' : 'complete'),
      repositoryName: repository.name || repository.fullName || repository.full_name || 'Repository unavailable',
      repositoryFullName: repository.fullName || repository.full_name || '',
      goal: session.goal,
      startedAt: session.startedAt,
      finishedAt: session.endedAt,
      durationMinutes: getSessionDurationMinutes(session),
      commitCount: session.activity?.commits ?? session.commits?.length ?? 0,
      filesChanged: session.activity?.filesChanged ?? 0,
      additions: session.activity?.additions ?? 0,
      deletions: session.activity?.deletions ?? 0,
      pullRequestCount: session.activity?.pullRequests ?? 0,
      detailHref: sessionDetailPath(session.id),
    };
  });
}

// "3 sessions", "1 commit", "1,204 lines".
export function formatCount(value, singular, plural = `${singular}s`) {
  return `${Number(value).toLocaleString()} ${value === 1 ? singular : plural}`;
}

// "12s ago", "3m ago", "2h ago", "4d ago": compact enough for a timestamp column.
export function formatRelativeTime(value, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

// "2h 5m", "2h", "45m", "<1m": a whole-minute duration, compact enough for a list column.
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

// "01:05:09": elapsed time as hours, minutes, and seconds.
export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}
