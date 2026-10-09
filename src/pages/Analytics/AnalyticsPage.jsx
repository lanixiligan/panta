import React, { useMemo, useState } from 'react';
import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { followRouteLink, projectDetailPath, readSearchParam, updateSearchParams } from '../../routing.js';

const timeRanges = [
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '90D', label: '90 days' },
  { value: 'All time', label: 'All time' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 60_000) return '<1m';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function SummaryMetrics({ analytics }) {
  const metrics = [
    { label: 'Session time', value: formatDuration(analytics.totalDurationMs) },
    { label: 'Sessions', value: formatNumber(analytics.sessionCount) },
    { label: 'Active days', value: formatNumber(analytics.activeDays), suffix: `of ${formatCount(analytics.periodDays, 'day')}` },
  ];

  return (
    <section className="analytics-summary" aria-label="Summary for the selected period">
      {metrics.map((metric) => (
        <div className="analytics-summary-metric" key={metric.label}>
          <span className="analytics-summary-label">{metric.label}</span>
          <strong>{metric.value}{metric.suffix && <small>{metric.suffix}</small>}</strong>
        </div>
      ))}
    </section>
  );
}

function bucketLabel(bucket, unit) {
  if (unit === 'week') {
    const lastDay = new Date(bucket.end.getTime() - 1);
    return `Week of ${formatDate(bucket.start)} – ${formatDate(lastDay)}`;
  }
  return formatDate(bucket.start, { weekday: 'short', month: 'short', day: 'numeric' });
}

function axisLabel(bucket, index, buckets, unit) {
  if (unit === 'week') {
    const previous = buckets[index - 1];
    return !previous || previous.start.getMonth() !== bucket.start.getMonth() ? formatDate(bucket.start, { month: 'short' }) : '';
  }
  if (buckets.length <= 10) return formatDate(bucket.start, { weekday: 'short' });
  return index % 7 === 0 || index === buckets.length - 1 ? formatDate(bucket.start) : '';
}

function SessionTimeChart({ timeline }) {
  const { buckets, unit } = timeline;
  const maxDuration = Math.max(...buckets.map(({ durationMs }) => durationMs), 0);

  return (
    <section className="analytics-section analytics-time-chart" aria-labelledby="analytics-time-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-time-heading">Session time</h2>
        <span>per {unit}</span>
      </div>
      <div className="analytics-bars">
        <span className="analytics-bars-scale" aria-hidden="true">{maxDuration ? formatDuration(maxDuration) : ''}</span>
        <div className="analytics-bars-plot" style={{ '--bucket-count': buckets.length }} role="list" aria-label={`Session time per ${unit}`}>
          {buckets.map((bucket, index) => {
            const label = bucketLabel(bucket, unit);
            const align = index < buckets.length * 0.15 ? 'start' : index > buckets.length * 0.85 ? 'end' : 'center';
            return (
              <div className="analytics-bar" key={bucket.start.toISOString()} role="listitem" tabIndex={0} aria-label={`${label}: ${formatDuration(bucket.durationMs)}, ${formatCount(bucket.sessionCount, 'session')}`}>
                <span className="analytics-bar-track">
                  {bucket.durationMs > 0 && <i style={{ height: `${Math.max(3, (bucket.durationMs / maxDuration) * 100)}%` }} />}
                </span>
                <span className="analytics-bar-label">{axisLabel(bucket, index, buckets, unit)}</span>
                <span className={`analytics-tooltip ${align}`} role="tooltip">
                  <span className="analytics-tooltip-title">{label}</span>
                  <span className="analytics-tooltip-value">{bucket.sessionCount ? formatDuration(bucket.durationMs) : 'No sessions'}</span>
                  {bucket.sessionCount > 0 && (
                    <span className="analytics-tooltip-meta">
                      {formatCount(bucket.sessionCount, 'session')}{bucket.hasCommits ? ` · ${formatCount(bucket.commits, 'commit')}` : ''}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const TOP_PROJECTS = 5;

function ProjectBreakdown({ projects, onNavigate }) {
  const topProjects = projects.slice(0, TOP_PROJECTS);
  const others = projects.slice(TOP_PROJECTS);
  const othersDurationMs = others.reduce((total, project) => total + project.durationMs, 0);
  const othersShare = others.reduce((total, project) => total + project.share, 0);
  return (
    <section className="analytics-section" aria-labelledby="analytics-projects-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-projects-heading">Where your time went</h2>
        <span>{formatCount(projects.length, 'project')}</span>
      </div>
      {projects.length ? (
        <ol className="analytics-project-list">
          {topProjects.map((project) => {
            const content = (
              <>
                <span className="analytics-project-name">
                  <strong>{project.name}</strong>
                  <small>{formatCount(project.sessionCount, 'session')}{project.commits !== null ? ` · ${formatCount(project.commits, 'commit')}` : ''}</small>
                </span>
                <span className="analytics-project-share">{Math.round(project.share * 100)}%</span>
                <span className="analytics-project-duration">{formatDuration(project.durationMs)}</span>
                <span className="analytics-project-track" aria-hidden="true"><i style={{ width: `${project.share * 100}%` }} /></span>
              </>
            );
            return (
              <li key={project.fullName}>
                {project.isExample || !project.fullName.includes('/')
                  ? <div className="analytics-project-row">{content}</div>
                  : <a className="analytics-project-row" href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>{content}</a>}
              </li>
            );
          })}
          {others.length > 0 && (
            <li>
              <div className="analytics-project-row is-others">
                <span className="analytics-project-name"><strong>{formatCount(others.length, 'other project')}</strong></span>
                <span className="analytics-project-share">{Math.round(othersShare * 100)}%</span>
                <span className="analytics-project-duration">{formatDuration(othersDurationMs)}</span>
                <span className="analytics-project-track" aria-hidden="true"><i style={{ width: `${othersShare * 100}%` }} /></span>
              </div>
            </li>
          )}
        </ol>
      ) : <p className="analytics-empty-inline">No repository information is available for these sessions.</p>}
    </section>
  );
}

function localDayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Session time per local day, credited to the day each session started.
function dailySessionTotals(sessions) {
  const days = new Map();
  sessions.forEach((session) => {
    const startedAt = Date.parse(session.startedAt);
    const endedAt = Date.parse(session.endedAt);
    if (session.status !== 'completed' || !Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return;
    const key = localDayKey(startedAt);
    const day = days.get(key) || { durationMs: 0, sessionCount: 0, repositories: new Set() };
    day.durationMs += endedAt - startedAt;
    day.sessionCount += 1;
    const name = session.repository?.name || session.repository?.fullName;
    if (name) day.repositories.add(name);
    days.set(key, day);
  });
  return days;
}

function WorkCalendar({ sessions }) {
  const today = new Date();
  // The viewed month is kept in the URL as ?month=YYYY-MM.
  const [month, setMonthState] = useState(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(readSearchParam('month') || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const setMonth = (value) => {
    setMonthState(value);
    const isCurrent = value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth();
    updateSearchParams({ month: isCurrent ? null : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` });
  };
  const [hovered, setHovered] = useState(null);
  const totals = useMemo(() => dailySessionTotals(sessions), [sessions]);
  const earliest = useMemo(() => {
    const starts = sessions.map((session) => Date.parse(session.startedAt)).filter(Number.isFinite);
    return starts.length ? new Date(Math.min(...starts)) : today;
  }, [sessions]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = (month.getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    return { date, ...(totals.get(localDayKey(date)) || { durationMs: 0, sessionCount: 0, repositories: new Set() }) };
  });
  const max = Math.max(0, ...days.map((day) => day.durationMs));
  const level = (value) => (!value || !max ? 0 : Math.min(4, Math.ceil((value / max) * 4)));
  const monthTotal = days.reduce((sum, day) => sum + day.durationMs, 0);
  const monthSessions = days.reduce((sum, day) => sum + day.sessionCount, 0);
  const workedDays = days.filter((day) => day.sessionCount > 0).length;
  const canGoBack = new Date(year, monthIndex, 1) > new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const canGoForward = new Date(year, monthIndex, 1) < new Date(today.getFullYear(), today.getMonth(), 1);
  const active = hovered === null ? null : days[hovered.index];
  // The tooltip sits above the hovered or focused day.
  const showDay = (event, index) => {
    const cell = event.currentTarget;
    setHovered({ index, left: cell.offsetLeft + cell.offsetWidth / 2, top: cell.offsetTop });
  };
  const changeMonth = (offset) => { setHovered(null); setMonth(new Date(year, monthIndex + offset, 1)); };

  return (
    <section className="analytics-section" aria-labelledby="analytics-rhythm-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-rhythm-heading">When you work</h2>
        <div className="analytics-calendar-nav">
          <button type="button" onClick={() => changeMonth(-1)} disabled={!canGoBack} aria-label="Previous month">‹</button>
          <span aria-live="polite">{formatDate(month, { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => changeMonth(1)} disabled={!canGoForward} aria-label="Next month">›</button>
        </div>
      </div>
      <p className="analytics-insight">
        {monthSessions
          ? `${formatCount(monthSessions, 'session')} · ${formatDuration(monthTotal)} across ${formatCount(workedDays, 'day')}.`
          : 'No sessions this month.'}
      </p>
      <div className="analytics-calendar" role="list" aria-label={`Session time per day, ${formatDate(month, { month: 'long', year: 'numeric' })}`} onMouseLeave={() => setHovered(null)}>
        {WEEKDAYS.map((weekday) => <span className="analytics-calendar-weekday" key={weekday} aria-hidden="true">{weekday}</span>)}
        {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {days.map((day, index) => {
          const isToday = localDayKey(day.date) === localDayKey(today);
          const isFuture = day.date > today;
          const label = `${formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${day.sessionCount ? `${formatDuration(day.durationMs)}, ${formatCount(day.sessionCount, 'session')}` : 'no sessions'}`;
          return (
            <div
              key={index}
              className={`analytics-calendar-day level-${level(day.durationMs)}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}${hovered?.index === index ? ' is-hovered' : ''}`}
              role="listitem"
              tabIndex={isFuture ? -1 : 0}
              aria-label={label}
              onMouseEnter={(event) => showDay(event, index)}
              onFocus={(event) => showDay(event, index)}
              onBlur={() => setHovered(null)}
            >
              <span aria-hidden="true">{index + 1}</span>
            </div>
          );
        })}
        {active && !(active.date > today) && (
          <div
            className="analytics-calendar-tooltip"
            aria-hidden="true"
            style={{ left: hovered.left, top: hovered.top - 6 }}
          >
            <span>{formatDate(active.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <strong>{active.sessionCount ? formatDuration(active.durationMs) : 'No sessions'}</strong>
            {active.sessionCount > 0 && <small>{formatCount(active.sessionCount, 'session')} · {[...active.repositories].slice(0, 3).join(', ')}{active.repositories.size > 3 ? ` +${active.repositories.size - 3}` : ''}</small>}
          </div>
        )}
      </div>
      <div className="analytics-heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((value) => <i key={value} className={`analytics-heatmap-cell level-${value}`} />)}
        <span>More</span>
      </div>
    </section>
  );
}

function GitHubActivity({ analytics }) {
  const { activity, sessionsWithActivity, sessionsWithCommits, sessionCount } = analytics;
  const value = (metric) => (metric.total === null ? '—' : formatNumber(metric.total));
  const unrecorded = sessionCount - sessionsWithActivity;

  return (
    <section className="analytics-section analytics-github" aria-labelledby="analytics-github-heading">
      <h2 id="analytics-github-heading">What GitHub recorded</h2>
      <p className="analytics-github-figures">
        <span><strong>{value(activity.commits)}</strong> commits</span>
        <span className="analytics-additions">+{value(activity.additions)}</span>
        <span className="analytics-deletions">−{value(activity.deletions)}</span>
      </p>
      <p className="analytics-github-note">
        {formatNumber(sessionsWithCommits)} of {formatCount(sessionCount, 'session')} had commits{unrecorded > 0 ? ` · ${formatNumber(unrecorded)} not recorded` : ''}
      </p>
    </section>
  );
}

function AnalyticsEmptyState({ hasAnySessions, onShowAllTime }) {
  return (
    <section className="analytics-empty-state" role="status">
      <h2>{hasAnySessions ? 'No sessions in this period.' : 'Complete a session to start building your work history.'}</h2>
      {hasAnySessions && <button className="text-link" type="button" onClick={onShowAllTime}>Show all time <span aria-hidden="true">→</span></button>}
    </section>
  );
}

export default function AnalyticsPage({ sessions = [], onNavigate }) {
  // Range and the examples toggle live in the URL (?range=, ?examples=off) so links and reloads keep the view.
  const [range, setRangeState] = useState(() => (timeRanges.some(({ value }) => value === readSearchParam('range')) ? readSearchParam('range') : '30D'));
  const setRange = (value) => { setRangeState(value); updateSearchParams({ range: value === '30D' ? null : value }); };
  const hasExamples = sessions.some((session) => session.source === 'placeholder');
  const [includeExamples, setIncludeExamplesState] = useState(() => readSearchParam('examples') !== 'off');
  const setIncludeExamples = (value) => { setIncludeExamplesState(value); updateSearchParams({ examples: value ? null : 'off' }); };
  const visibleSessions = useMemo(
    () => (includeExamples ? sessions : sessions.filter((session) => session.source !== 'placeholder')),
    [sessions, includeExamples],
  );
  const analytics = useMemo(() => calculateSessionAnalytics(visibleSessions, range), [visibleSessions, range]);
  const hasSessions = analytics.sessionCount > 0;

  return (
    <div className="analytics-page">
      <section className="analytics-page-intro">
        <div>
          <h1>Analytics</h1>
          <p>
            {formatDate(analytics.rangeStart, { month: 'short', day: 'numeric', year: 'numeric' })} – {formatDate(analytics.rangeEnd, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="analytics-controls">
          {hasExamples && (
            <label className="analytics-example-toggle">
              <input type="checkbox" checked={includeExamples} onChange={(event) => setIncludeExamples(event.target.checked)} />
              Include example sessions
            </label>
          )}
          <div className="analytics-time-range" role="group" aria-label="Time range">
            {timeRanges.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={range === value} className={range === value ? 'selected' : ''} onClick={() => setRange(value)}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      {!hasSessions ? <AnalyticsEmptyState hasAnySessions={analytics.totalCompletedSessions > 0} onShowAllTime={() => setRange('All time')} /> : (
        <>
          <SummaryMetrics analytics={analytics} />
          <GitHubActivity analytics={analytics} />
          <SessionTimeChart timeline={analytics.timeline} />
          <div className="analytics-grid">
            <ProjectBreakdown projects={analytics.projects} onNavigate={onNavigate} />
            <WorkCalendar sessions={visibleSessions} />
          </div>
          <p className="session-history-boundary">
            {analytics.includesExamples ? 'Includes example sessions. ' : ''}Session time is what you declared; GitHub activity is what GitHub recorded during it.
          </p>
        </>
      )}
    </div>
  );
}
