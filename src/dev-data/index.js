import { dummyRepositories } from './repositories.js';
import { dummySessions } from './sessions.js';
import { sessionDetailPath } from '../routing.js';

export { dummyRepositories, dummySessions };

export function getSessions() {
  return [...dummySessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

export function getSessionById(id) {
  return dummySessions.find((session) => session.id === id) || null;
}

export function getSessionDurationMinutes(session) {
  const startedAt = new Date(session.startedAt).getTime();
  const endedAt = new Date(session.endedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return 0;
  return Math.floor((endedAt - startedAt) / 60_000);
}

export function getSessionListItems(sessions = getSessions()) {
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
    days,
  };
}

export function getProjectsWithSessions() {
  return dummyRepositories.map((repository) => {
    const sessions = getSessions().filter((session) => session.repository.fullName === repository.fullName);
    return { ...repository, sessions: getSessionListItems(sessions), sessionCount: sessions.length };
  });
}
