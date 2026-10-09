import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { getSessionListItems } from '../../sessions/sessionHelpers.js';
import { dummyRepositories, getDummySessions } from '../../dummy-data/index.js';

function repositoryFullName(repository = {}) {
  const owner = repository.owner?.login || repository.owner;
  return repository.full_name || repository.fullName || (owner && repository.name ? `${owner}/${repository.name}` : '');
}

// GitHub's numeric repository id survives renames; owner/name is only a fallback.
function projectKey(repository = {}) {
  if (repository.id !== undefined && repository.id !== null && repository.id !== '') return `id:${repository.id}`;
  const fullName = repositoryFullName(repository).toLowerCase();
  return fullName ? `name:${fullName}` : null;
}

// Projects are derived only from real, completed Panta sessions. Example records are excluded.
export function getProjects(sessions = [], repositories = []) {
  return buildProjects(sessions.filter((session) => session?.source !== 'placeholder'), repositories);
}

// Example projects built from the example sessions in dummy-data, kept apart from real projects.
export function getExampleProjects() {
  return buildProjects(getDummySessions(), dummyRepositories);
}

function buildProjects(sessions, repositories) {
  const sessionsByProject = new Map();
  sessions.forEach((session) => {
    if (!session || session.status !== 'completed') return;
    const key = projectKey(session.repository);
    if (!key) return;
    sessionsByProject.set(key, [...(sessionsByProject.get(key) || []), session]);
  });

  const accessibleById = new Map(repositories.map((repository) => [`id:${repository.id}`, repository]));

  return [...sessionsByProject.entries()].flatMap(([key, projectSessions]) => {
    const history = calculateSessionAnalytics(projectSessions, 'All time');
    if (!history.sessionCount) return [];

    const latestSession = history.sessions[0].session;
    const repository = { ...latestSession.repository, ...accessibleById.get(key) };
    const fullName = repositoryFullName(repository);
    const [owner = '', name = repository.name || fullName] = fullName.split('/');
    const aliases = new Set(history.sessions.map(({ session }) => repositoryFullName(session.repository).toLowerCase()).filter(Boolean));
    aliases.add(fullName.toLowerCase());

    return [{
      key,
      isExample: latestSession.source === 'placeholder',
      name: repository.name || name,
      owner,
      fullName,
      description: repository.description || null,
      visibility: repository.visibility || (typeof repository.private === 'boolean' ? (repository.private ? 'private' : 'public') : null),
      htmlUrl: repository.html_url || repository.htmlUrl || (fullName ? `https://github.com/${fullName}` : null),
      aliases: [...aliases],
      sessionCount: history.sessionCount,
      totalDurationMs: history.totalDurationMs,
      activity: history.activity,
      activitySessionsWithData: history.activitySessionsWithData,
      lastWorkedAt: history.sessions[0].endedAt,
      sessions: getSessionListItems(history.sessions.map(({ session }) => session)),
    }];
  }).sort((left, right) => right.lastWorkedAt - left.lastWorkedAt);
}

export function findProject(projects, owner, repo) {
  const fullName = `${owner}/${repo}`.toLowerCase();
  return projects.find((project) => project.aliases.includes(fullName)) || null;
}

// The project (if any) for a repository object from GitHub or a session.
export function findProjectForRepository(projects, repository) {
  const key = repository && projectKey(repository);
  if (!key) return null;
  const fullName = repositoryFullName(repository).toLowerCase();
  return projects.find((project) => project.key === key) || projects.find((project) => fullName && project.aliases.includes(fullName)) || null;
}

// Minutes of session time per local day for the last `days` days (oldest first), credited to each session's start day.
export function recentDailyMinutes(project, days = 14, now = Date.now()) {
  const dayKey = (value) => { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return { date, key: dayKey(date), minutes: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  project.sessions.forEach((session) => {
    const bucket = byKey.get(dayKey(session.startedAt));
    if (bucket) bucket.minutes += session.durationMinutes || 0;
  });
  return buckets;
}

export function formatProjectDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 60_000) return '<1m';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  return hours ? `${hours}h` : `${remainingMinutes}m`;
}

export function formatLastWorked(timestamp, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(seconds) < 3600) return formatter.format(Math.min(-1, Math.round(seconds / 60)), 'minute');
  if (Math.abs(seconds) < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour');
  if (Math.abs(seconds) < 7 * 86_400) return formatter.format(Math.round(seconds / 86_400), 'day');
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

export function formatCount(value, singular, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}
