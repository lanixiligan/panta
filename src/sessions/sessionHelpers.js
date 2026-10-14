import { sessionDetailPath } from '../routing.js';

// Helpers for session records. They work the same on real sessions and on the example sessions in src/dummy-data/.

export function getSessionDurationMinutes(session) {
  const startedAt = new Date(session.startedAt).getTime();
  const endedAt = new Date(session.endedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return 0;
  return Math.floor((endedAt - startedAt) / 60_000);
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

// Totals and per-day session time for the current Monday-to-Sunday week.
export function getWeeklySummary(sessions = [], referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const thisWeek = sessions.filter((session) => {
    const startedAt = new Date(session.startedAt);
    return startedAt >= start && startedAt < end;
  });
  const withActivity = thisWeek.filter((session) => typeof session.activity?.commits === 'number');
  const today = new Date(referenceDate).toDateString();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = date.toDateString();
    return {
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      date: date.toISOString(),
      sessionMinutes: thisWeek
        .filter((session) => new Date(session.startedAt).toDateString() === dateKey)
        .reduce((sum, session) => sum + getSessionDurationMinutes(session), 0),
      isToday: dateKey === today,
      isFuture: date > new Date(referenceDate),
    };
  });

  return {
    start: start.toISOString(),
    end: new Date(end.getTime() - 1).toISOString(),
    sessionCount: thisWeek.length,
    sessionMinutes: thisWeek.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0),
    // Commits are unavailable, not zero, when no session this week has recorded activity.
    commitCount: withActivity.length ? withActivity.reduce((sum, session) => sum + session.activity.commits, 0) : null,
    repositoryCount: new Set(thisWeek.map((session) => session.repository?.fullName || session.repository?.name)).size,
    includesExamples: thisWeek.some((session) => session.source === 'placeholder'),
    days,
  };
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

// "01:05:09": elapsed time as hours, minutes, and seconds.
export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}
