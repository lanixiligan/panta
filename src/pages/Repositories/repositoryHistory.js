import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { getSessionListItems } from '../../sessions/sessionHelpers.js';
import { dummyRepositories, getDummySessions } from '../../dummy-data/index.js';

function repositoryFullName(repository = {}) {
  const owner = repository.owner?.login || repository.owner;
  return repository.full_name || repository.fullName || (owner && repository.name ? `${owner}/${repository.name}` : '');
}

// GitHub's numeric repository id survives renames; owner/name is only a fallback.
function repositoryKey(repository = {}) {
  if (repository.id !== undefined && repository.id !== null && repository.id !== '') return `id:${repository.id}`;
  const fullName = repositoryFullName(repository).toLowerCase();
  return fullName ? `name:${fullName}` : null;
}

// Repository histories are derived only from real, completed Panta sessions. Example records are excluded.
export function getRepositoryHistories(sessions = [], repositories = []) {
  return buildHistories(sessions.filter((session) => session?.source !== 'placeholder'), repositories);
}

// Example repository histories built from the example sessions in dummy-data, kept apart from real ones.
export function getExampleRepositoryHistories() {
  return buildHistories(getDummySessions(), dummyRepositories);
}

function buildHistories(sessions, repositories) {
  const sessionsByRepository = new Map();
  sessions.forEach((session) => {
    if (!session || session.status !== 'completed') return;
    const key = repositoryKey(session.repository);
    if (!key) return;
    sessionsByRepository.set(key, [...(sessionsByRepository.get(key) || []), session]);
  });

  const accessibleById = new Map(repositories.map((repository) => [`id:${repository.id}`, repository]));

  return [...sessionsByRepository.entries()].flatMap(([key, repositorySessions]) => {
    const history = calculateSessionAnalytics(repositorySessions, null);
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

export function findRepositoryHistory(histories, owner, repo) {
  const fullName = `${owner}/${repo}`.toLowerCase();
  return histories.find((history) => history.aliases.includes(fullName)) || null;
}

// The history (if any) for a repository object from GitHub or a session.
export function findHistoryForRepository(histories, repository) {
  const key = repository && repositoryKey(repository);
  if (!key) return null;
  const fullName = repositoryFullName(repository).toLowerCase();
  return histories.find((history) => history.key === key) || histories.find((history) => fullName && history.aliases.includes(fullName)) || null;
}

// Minutes of session time per local day for the last `days` days (oldest first), credited to each session's start day.
export function recentDailyMinutes(history, days = 14, now = Date.now()) {
  const dayKey = (value) => { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return { date, key: dayKey(date), minutes: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  history.sessions.forEach((session) => {
    const bucket = byKey.get(dayKey(session.startedAt));
    if (bucket) bucket.minutes += session.durationMinutes || 0;
  });
  return buckets;
}

// Daily minutes from the repository's first session through today, never fewer than `minDays` so a young repository still has a line.
export function allTimeDailyMinutes(history, minDays = 7, now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const first = new Date(Math.min(now, ...history.sessions.map((session) => new Date(session.startedAt).getTime()).filter(Number.isFinite)));
  first.setHours(0, 0, 0, 0);
  const spanDays = Math.round((today - first) / 86_400_000) + 1;
  return recentDailyMinutes(history, Math.max(minDays, spanDays), now);
}

export function formatRepositoryDuration(milliseconds) {
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

