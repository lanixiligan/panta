const RANGE_DAYS = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
};

function startOfLocalDay(value) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
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
    }];
  });
}

function addSessionTimeToDays(record, dailyTotals) {
  if (record.durationMs === 0) {
    const key = dayKey(record.startedAt);
    dailyTotals.set(key, (dailyTotals.get(key) || 0) + 0);
    return;
  }

  let cursor = record.startedAt;
  while (cursor < record.endedAt) {
    const dayStart = startOfLocalDay(cursor);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const segmentEnd = Math.min(record.endedAt, nextDay.getTime());
    const key = dayKey(cursor);
    dailyTotals.set(key, (dailyTotals.get(key) || 0) + segmentEnd - cursor);
    cursor = segmentEnd;
  }
}

function addSessionTimeToWeekdays(record, weekdayTotals) {
  if (record.durationMs === 0) {
    const key = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(record.startedAt));
    weekdayTotals.set(key, (weekdayTotals.get(key) || 0) + 0);
    return;
  }

  let cursor = record.startedAt;
  while (cursor < record.endedAt) {
    const dayStart = startOfLocalDay(cursor);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const segmentEnd = Math.min(record.endedAt, nextDay.getTime());
    const key = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(cursor));
    weekdayTotals.set(key, (weekdayTotals.get(key) || 0) + segmentEnd - cursor);
    cursor = segmentEnd;
  }
}

function sumAvailableActivity(records, field) {
  let total = 0;
  let sessionsWithValue = 0;
  records.forEach(({ session }) => {
    const value = session.activity?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
    total += value;
    sessionsWithValue += 1;
  });
  return { total: sessionsWithValue ? total : null, sessionsWithValue };
}

export function calculateSessionAnalytics(sessions = [], range = '30D', referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate.getTime() : Date.parse(referenceDate);
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const allCompleted = completedSessionRecords(sessions, safeNow);
  const rangeStart = startOfLocalDay(safeNow);
  const rangeDays = RANGE_DAYS[range];
  if (rangeDays) rangeStart.setDate(rangeStart.getDate() - rangeDays + 1);

  const records = allCompleted
    .filter(({ startedAt }) => !rangeDays || startedAt >= rangeStart.getTime())
    .sort((left, right) => right.endedAt - left.endedAt);

  const totalDurationMs = records.reduce((total, record) => total + record.durationMs, 0);
  const projects = new Map();
  const dailyTotals = new Map();
  const weekdayTotals = new Map();

  records.forEach((record) => {
    const repositoryName = record.repository.name || record.repository.fullName || record.repository.full_name;
    const repositoryFullName = record.repository.fullName || record.repository.full_name || repositoryName;
    if (repositoryName) {
      const project = projects.get(repositoryFullName) || { name: repositoryName, fullName: repositoryFullName, durationMs: 0 };
      project.durationMs += record.durationMs;
      projects.set(repositoryFullName, project);
    }
    addSessionTimeToDays(record, dailyTotals);
    addSessionTimeToWeekdays(record, weekdayTotals);
  });

  const chartStart = rangeDays
    ? rangeStart
    : records.length
      ? startOfLocalDay(Math.min(...records.map(({ startedAt }) => startedAt)))
      : startOfLocalDay(safeNow);
  const chartEnd = startOfLocalDay(safeNow);
  const activityByDay = [];
  for (let date = new Date(chartStart); date <= chartEnd; date.setDate(date.getDate() + 1)) {
    const key = dayKey(date);
    activityByDay.push({ date: new Date(date), durationMs: dailyTotals.get(key) || 0 });
  }

  const weekdayEntries = [...weekdayTotals.entries()].sort((left, right) => right[1] - left[1]);
  const activity = {
    commits: sumAvailableActivity(records, 'commits'),
    filesChanged: sumAvailableActivity(records, 'filesChanged'),
    additions: sumAvailableActivity(records, 'additions'),
    deletions: sumAvailableActivity(records, 'deletions'),
  };
  const activitySessionsWithData = records.filter(({ session }) => ['commits', 'filesChanged', 'additions', 'deletions'].some((field) => {
    const value = session.activity?.[field];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  })).length;

  return {
    totalCompletedSessions: allCompleted.length,
    sessions: records.map(({ session, startedAt, endedAt, durationMs }) => ({ session, startedAt, endedAt, durationMs })),
    sessionCount: records.length,
    totalDurationMs,
    projectCount: projects.size,
    activity,
    activitySessionsWithData,
    projects: [...projects.values()].sort((left, right) => right.durationMs - left.durationMs),
    activityByDay,
    patterns: records.length ? {
      averageDurationMs: totalDurationMs / records.length,
      longestDurationMs: Math.max(...records.map(({ durationMs }) => durationMs)),
      shortestDurationMs: Math.min(...records.map(({ durationMs }) => durationMs)),
      mostActiveDay: weekdayEntries[0]?.[0] || null,
    } : null,
    includesExamples: records.some(({ session }) => session.source === 'placeholder'),
  };
}
