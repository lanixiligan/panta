import { getSessionDurationMs } from '../sessions/sessionHelpers.js';

// Ranges longer than this are charted per week so the bars stay readable.
const MAX_DAILY_BUCKETS = 45;

function startOfLocalDay(value) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function startOfLocalWeek(value) {
  const day = startOfLocalDay(value);
  day.setDate(day.getDate() - day.getDay());
  return day;
}

// The span is { start, end } in local time with `end` exclusive (what rangeBounds returns), or null for everything.
function periodBounds(span) {
  if (!span) return null;
  const last = new Date(span.end);
  last.setDate(last.getDate() - 1);
  return { start: span.start, end: span.end, last };
}

function dayKey(value) {
  const day = new Date(value);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function completedSessionRecords(sessions, now) {
  const seen = new Set();
  return sessions.flatMap((session) => {
    if (!session || session.status !== 'completed' || !session.id || seen.has(session.id)) return [];

    const startedAt = Date.parse(session.startedAt);
    const endedAt = Date.parse(session.endedAt);
    const durationMs = getSessionDurationMs(session);
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || startedAt > endedAt || endedAt > now || durationMs === null) return [];
    seen.add(session.id);

    return [{
      session,
      startedAt,
      endedAt,
      durationMs,
      repository: session.repository || {},
      commits: typeof session.activity?.commits === 'number' && session.activity.commits >= 0 ? session.activity.commits : null,
    }];
  });
}

function sumAvailable(records, getValue) {
  let total = 0;
  let sessionsWithValue = 0;
  records.forEach((record) => {
    const value = getValue(record.session);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
    total += value;
    sessionsWithValue += 1;
  });
  return { total: sessionsWithValue ? total : null, sessionsWithValue };
}

function summarize(records) {
  const totalDurationMs = records.reduce((total, record) => total + record.durationMs, 0);
  return {
    sessionCount: records.length,
    totalDurationMs,
    // Days with at least one session, by the local day each session started.
    activeDays: new Set(records.map(({ startedAt }) => dayKey(startedAt))).size,
    averageDurationMs: records.length ? totalDurationMs / records.length : null,
  };
}

function buildTimeline(records, chartStart, chartEnd, today) {
  const days = new Map();
  for (let date = new Date(chartStart); date <= chartEnd; date.setDate(date.getDate() + 1)) {
    days.set(dayKey(date), { start: new Date(date), durationMs: 0, sessionCount: 0, commits: 0, hasCommits: false, isFuture: date > today });
  }

  // A session counts entirely toward the day it started, matching the calendar and Repositories.
  records.forEach((record) => {
    const startDay = days.get(dayKey(record.startedAt));
    if (startDay) {
      startDay.durationMs += record.durationMs;
      startDay.sessionCount += 1;
      if (record.commits !== null) {
        startDay.commits += record.commits;
        startDay.hasCommits = true;
      }
    }
  });

  const dailyBuckets = [...days.values()].map((day) => {
    const end = new Date(day.start);
    end.setDate(end.getDate() + 1);
    return { ...day, end };
  });
  if (dailyBuckets.length <= MAX_DAILY_BUCKETS) return { unit: 'day', buckets: dailyBuckets };

  const weeks = new Map();
  dailyBuckets.forEach((day) => {
    const weekStart = startOfLocalWeek(day.start);
    const key = dayKey(weekStart);
    const week = weeks.get(key) || { start: weekStart, end: new Date(weekStart.getTime()), durationMs: 0, sessionCount: 0, commits: 0, hasCommits: false };
    week.end = day.end;
    week.durationMs += day.durationMs;
    week.sessionCount += day.sessionCount;
    week.commits += day.commits;
    week.hasCommits ||= day.hasCommits;
    weeks.set(key, week);
  });
  return { unit: 'week', buckets: [...weeks.values()] };
}

function fileExtension(filename) {
  const name = filename.split('/').pop();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : 'other';
}

// Files changed per extension, each file counted once per session. Null when no session has file details.
function buildFileTypes(records) {
  const counts = new Map();
  let recorded = false;
  records.forEach(({ session }) => {
    if (!Array.isArray(session.commits) || !session.commits.some((commit) => Array.isArray(commit.files))) return;
    recorded = true;
    const filenames = new Set(session.commits.flatMap((commit) => (commit.files || []).map(({ filename }) => filename)));
    filenames.forEach((filename) => counts.set(fileExtension(filename), (counts.get(fileExtension(filename)) || 0) + 1));
  });
  if (!recorded) return null;
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([extension, count]) => ({ extension, count, share: total ? count / total : 0 }))
    .sort((left, right) => right.count - left.count);
}

export function calculateSessionAnalytics(sessions = [], span = null, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate.getTime() : Date.parse(referenceDate);
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const allCompleted = completedSessionRecords(sessions, safeNow);
  const period = periodBounds(span);
  const today = startOfLocalDay(safeNow);

  const records = allCompleted
    .filter(({ startedAt }) => !period || (startedAt >= period.start.getTime() && startedAt < period.end.getTime()))
    .sort((left, right) => right.endedAt - left.endedAt);

  const current = summarize(records);
  const repositories = new Map();

  records.forEach((record) => {
    const name = record.repository.name || record.repository.fullName || record.repository.full_name;
    const fullName = record.repository.fullName || record.repository.full_name || name;
    if (name) {
      const repository = repositories.get(fullName) || { name, fullName, durationMs: 0, sessionCount: 0, commits: null, isExample: record.session.source === 'placeholder' };
      repository.durationMs += record.durationMs;
      repository.sessionCount += 1;
      if (record.commits !== null) repository.commits = (repository.commits || 0) + record.commits;
      repositories.set(fullName, repository);
    }
  });

  const chartStart = period
    ? period.start
    : records.length
      ? startOfLocalDay(Math.min(...records.map(({ startedAt }) => startedAt)))
      : startOfLocalDay(safeNow);

  return {
    // Days of the period so far, today included; for all time, since the first session.
    periodDays: Math.round((Math.min(period ? period.last : today, today) - chartStart) / 86_400_000) + 1,
    rangeStart: chartStart,
    rangeEnd: period ? period.last : new Date(safeNow),
    totalCompletedSessions: allCompleted.length,
    // Used by Repositories.
    sessions: records.map(({ session, startedAt, endedAt, durationMs }) => ({ session, startedAt, endedAt, durationMs })),
    ...current,
    repositories: [...repositories.values()]
      .map((repository) => ({ ...repository, share: current.totalDurationMs ? repository.durationMs / current.totalDurationMs : 0 }))
      .sort((left, right) => right.durationMs - left.durationMs),
    // A bounded period charts all of its days, with days still ahead marked as future.
    timeline: buildTimeline(records, chartStart, period ? period.last : today, today),
    fileTypes: buildFileTypes(records),
    activity: {
      commits: sumAvailable(records, (session) => session.activity?.commits),
      filesChanged: sumAvailable(records, (session) => session.activity?.filesChanged),
      additions: sumAvailable(records, (session) => session.activity?.additions),
      deletions: sumAvailable(records, (session) => session.activity?.deletions),
    },
    // Used by Repositories: sessions with any recorded GitHub activity field.
    activitySessionsWithData: records.filter(({ session }) => ['commits', 'filesChanged', 'additions', 'deletions'].some((field) => {
      const value = session.activity?.[field];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    })).length,
  };
}
