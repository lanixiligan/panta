const RANGE_DAYS = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
};

const HOUR_MS = 3_600_000;
// Ranges longer than this are charted per week so the bars stay readable.
const MAX_DAILY_BUCKETS = 45;

export const SESSION_LENGTH_BUCKETS = [
  { label: 'Under 15m', maxMs: 15 * 60_000 },
  { label: '15–30m', maxMs: 30 * 60_000 },
  { label: '30m–1h', maxMs: HOUR_MS },
  { label: '1–2h', maxMs: 2 * HOUR_MS },
  { label: '2h+', maxMs: Infinity },
];

function startOfLocalDay(value) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function startOfLocalWeek(value) {
  const day = startOfLocalDay(value);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
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
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || startedAt > endedAt || endedAt > now) return [];
    seen.add(session.id);

    return [{
      session,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      repository: session.repository || {},
      commits: typeof session.activity?.commits === 'number' && session.activity.commits >= 0 ? session.activity.commits : null,
    }];
  });
}

// Splits a session at every hour boundary so time is attributed to the hours it actually covered.
function forEachHourSegment(record, callback) {
  let cursor = record.startedAt;
  while (cursor < record.endedAt) {
    const hourStart = new Date(cursor);
    hourStart.setMinutes(0, 0, 0);
    const segmentEnd = Math.min(record.endedAt, hourStart.getTime() + HOUR_MS);
    callback(new Date(cursor), segmentEnd - cursor);
    cursor = segmentEnd;
  }
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
    averageDurationMs: records.length ? totalDurationMs / records.length : null,
    commits: sumAvailable(records, (session) => session.activity?.commits).total,
  };
}

function buildTimeline(records, chartStart, chartEnd) {
  const days = new Map();
  for (let date = new Date(chartStart); date <= chartEnd; date.setDate(date.getDate() + 1)) {
    days.set(dayKey(date), { start: new Date(date), durationMs: 0, sessionCount: 0, commits: 0, hasCommits: false });
  }

  records.forEach((record) => {
    forEachHourSegment(record, (segmentStart, durationMs) => {
      const day = days.get(dayKey(segmentStart));
      if (day) day.durationMs += durationMs;
    });
    const startDay = days.get(dayKey(record.startedAt));
    if (startDay) {
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

export function calculateSessionAnalytics(sessions = [], range = '30D', referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate.getTime() : Date.parse(referenceDate);
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const allCompleted = completedSessionRecords(sessions, safeNow);
  const rangeDays = RANGE_DAYS[range];
  const rangeStart = startOfLocalDay(safeNow);
  if (rangeDays) rangeStart.setDate(rangeStart.getDate() - rangeDays + 1);

  const records = allCompleted
    .filter(({ startedAt }) => !rangeDays || startedAt >= rangeStart.getTime())
    .sort((left, right) => right.endedAt - left.endedAt);

  // The previous period has the same length and ends where the selected one starts.
  let previous = null;
  if (rangeDays) {
    const previousStart = new Date(rangeStart);
    previousStart.setDate(previousStart.getDate() - rangeDays);
    previous = summarize(allCompleted.filter(({ startedAt }) => startedAt >= previousStart.getTime() && startedAt < rangeStart.getTime()));
  }

  const current = summarize(records);
  const projects = new Map();
  const weekdayHours = Array.from({ length: 7 }, () => Array(24).fill(0));
  const lengthBuckets = SESSION_LENGTH_BUCKETS.map(({ label }) => ({ label, count: 0 }));

  records.forEach((record) => {
    const name = record.repository.name || record.repository.fullName || record.repository.full_name;
    const fullName = record.repository.fullName || record.repository.full_name || name;
    if (name) {
      const project = projects.get(fullName) || { name, fullName, durationMs: 0, sessionCount: 0, commits: null, isExample: record.session.source === 'placeholder' };
      project.durationMs += record.durationMs;
      project.sessionCount += 1;
      if (record.commits !== null) project.commits = (project.commits || 0) + record.commits;
      projects.set(fullName, project);
    }

    forEachHourSegment(record, (segmentStart, durationMs) => {
      weekdayHours[(segmentStart.getDay() + 6) % 7][segmentStart.getHours()] += durationMs;
    });

    lengthBuckets[SESSION_LENGTH_BUCKETS.findIndex(({ maxMs }) => record.durationMs < maxMs)].count += 1;
  });

  const chartStart = rangeDays
    ? rangeStart
    : records.length
      ? startOfLocalDay(Math.min(...records.map(({ startedAt }) => startedAt)))
      : startOfLocalDay(safeNow);
  const longest = records.reduce((best, record) => (!best || record.durationMs > best.durationMs ? record : best), null);

  return {
    range,
    rangeDays: rangeDays || null,
    rangeStart: chartStart,
    rangeEnd: new Date(safeNow),
    totalCompletedSessions: allCompleted.length,
    sessions: records.map(({ session, startedAt, endedAt, durationMs }) => ({ session, startedAt, endedAt, durationMs })),
    ...current,
    previous,
    projectCount: projects.size,
    projects: [...projects.values()]
      .map((project) => ({ ...project, share: current.totalDurationMs ? project.durationMs / current.totalDurationMs : 0 }))
      .sort((left, right) => right.durationMs - left.durationMs),
    timeline: buildTimeline(records, chartStart, startOfLocalDay(safeNow)),
    weekdayHours,
    lengthBuckets,
    longestSession: longest ? { session: longest.session, durationMs: longest.durationMs } : null,
    activity: {
      commits: sumAvailable(records, (session) => session.activity?.commits),
      filesChanged: sumAvailable(records, (session) => session.activity?.filesChanged),
      additions: sumAvailable(records, (session) => session.activity?.additions),
      deletions: sumAvailable(records, (session) => session.activity?.deletions),
    },
    sessionsWithActivity: records.filter(({ commits }) => commits !== null).length,
    // Used by Projects: sessions with any recorded GitHub activity field.
    activitySessionsWithData: records.filter(({ session }) => ['commits', 'filesChanged', 'additions', 'deletions'].some((field) => {
      const value = session.activity?.[field];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    })).length,
    sessionsWithCommits: records.filter(({ commits }) => commits > 0).length,
    includesExamples: records.some(({ session }) => session.source === 'placeholder'),
  };
}
