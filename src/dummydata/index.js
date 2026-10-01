import { dummyRepositories } from './repositories.js';
import { dummySessions } from './sessions.js';

export { dummyRepositories, dummySessions };

export function getSessions() {
  return [...dummySessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

export function getSessionById(id) {
  return dummySessions.find((session) => session.id === id) || null;
}

export function getSessionListItems(sessions = getSessions()) {
  return sessions.map((session) => ({
    id: session.id,
    repositoryName: session.repository.name,
    repositoryFullName: session.repository.fullName,
    goal: session.goal,
    startedAt: session.startedAt,
    finishedAt: session.endedAt,
    durationMinutes: session.durationMinutes,
    commitCount: session.activity.commits,
    filesChanged: session.activity.filesChanged,
    additions: session.activity.additions,
    deletions: session.activity.deletions,
    pullRequestCount: session.activity.pullRequests,
    detailHref: `#session/${session.id}`,
  }));
}

export function getWeeklySummary(sessions = dummySessions, referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const dayOfWeek = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const thisWeek = sessions.filter((session) => {
    const startedAt = new Date(session.startedAt);
    return startedAt >= start && startedAt < end;
  });
  return {
    sessionCount: thisWeek.length,
    focusMinutes: thisWeek.reduce((sum, session) => sum + session.durationMinutes, 0),
    commitCount: thisWeek.reduce((sum, session) => sum + session.activity.commits, 0),
    repositoryCount: new Set(thisWeek.map((session) => session.repository.fullName)).size,
  };
}

export function getDailySessionActivity(sessions = dummySessions, referenceDate = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(referenceDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const focusMinutes = sessions.reduce((sum, session) => {
      const startedAt = new Date(session.startedAt);
      return startedAt >= date && startedAt < nextDate ? sum + session.durationMinutes : sum;
    }, 0);
    return { day: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date), focusMinutes };
  });
}

export function getProjectsWithSessions() {
  return dummyRepositories.map((repository) => {
    const sessions = getSessions().filter((session) => session.repository.fullName === repository.fullName);
    return { ...repository, sessions: getSessionListItems(sessions), sessionCount: sessions.length };
  });
}
