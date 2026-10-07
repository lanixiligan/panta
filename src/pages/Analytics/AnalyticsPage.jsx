import React, { useMemo, useState } from 'react';
import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { followRouteLink, projectDetailPath, sessionDetailPath } from '../../routing.js';

const timeRanges = [
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '90D', label: '90 days' },
  { value: 'All time', label: 'All time' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_PARTS = [
  { label: 'mornings', hours: [5, 6, 7, 8, 9, 10, 11] },
  { label: 'afternoons', hours: [12, 13, 14, 15, 16] },
  { label: 'evenings', hours: [17, 18, 19, 20, 21] },
  { label: 'nights', hours: [22, 23, 0, 1, 2, 3, 4] },
];

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

function formatHour(hour) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function periodLabel(rangeDays) {
  return rangeDays ? `previous ${rangeDays} days` : null;
}

// A neutral comparison with the previous period of the same length; it states the change, it doesn't grade it.
function Comparison({ current, previous, previousSessionCount, rangeDays, format }) {
  if (!rangeDays) return <span className="analytics-comparison">Across all recorded sessions</span>;
  if (current === null || current === undefined) return <span className="analytics-comparison">Nothing recorded</span>;
  if (!previousSessionCount) return <span className="analytics-comparison">No sessions in the {periodLabel(rangeDays)}</span>;
  if (previous === null || previous === undefined) return <span className="analytics-comparison">Not recorded in the {periodLabel(rangeDays)}</span>;
  const difference = current - previous;
  if (Math.abs(difference) < 1) return <span className="analytics-comparison">Same as the {periodLabel(rangeDays)}</span>;
  return (
    <span className="analytics-comparison">
      <span aria-hidden="true">{difference > 0 ? '↑' : '↓'}</span> {format(Math.abs(difference))} {difference > 0 ? 'more' : 'less'} than the {periodLabel(rangeDays)}
    </span>
  );
}

function SummaryMetrics({ analytics }) {
  const { previous, rangeDays } = analytics;
  const metrics = [
    { label: 'Session time', value: formatDuration(analytics.totalDurationMs), current: analytics.totalDurationMs, previous: previous?.totalDurationMs, format: formatDuration },
    { label: 'Sessions', value: formatNumber(analytics.sessionCount), current: analytics.sessionCount, previous: previous?.sessionCount, format: formatNumber },
    { label: 'Average session', value: formatDuration(analytics.averageDurationMs), current: analytics.averageDurationMs, previous: previous?.averageDurationMs, format: formatDuration },
    { label: 'Commits', value: analytics.commits === null ? '—' : formatNumber(analytics.commits), current: analytics.commits, previous: previous?.commits, format: formatNumber },
  ];

  return (
    <section className="analytics-summary" aria-label="Summary for the selected period">
      {metrics.map((metric) => (
        <div className="analytics-summary-metric" key={metric.label}>
          <span className="analytics-summary-label">{metric.label}</span>
          <strong>{metric.value}</strong>
          <Comparison current={metric.current} previous={metric.previous} previousSessionCount={previous?.sessionCount} rangeDays={rangeDays} format={metric.format} />
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

function ProjectBreakdown({ projects, onNavigate }) {
  return (
    <section className="analytics-section" aria-labelledby="analytics-projects-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-projects-heading">Where your time went</h2>
        <span>{formatCount(projects.length, 'project')}</span>
      </div>
      {projects.length ? (
        <ol className="analytics-project-list">
          {projects.map((project) => {
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
        </ol>
      ) : <p className="analytics-empty-inline">No repository information is available for these sessions.</p>}
    </section>
  );
}

function getPeakSummary(weekdayHours) {
  let peak = null;
  weekdayHours.forEach((hours, weekday) => DAY_PARTS.forEach((part) => {
    const total = part.hours.reduce((sum, hour) => sum + hours[hour], 0);
    if (total > 0 && (!peak || total > peak.total)) peak = { total, weekday, part };
  }));
  return peak ? `Most of your session time falls on ${WEEKDAY_NAMES[peak.weekday]} ${peak.part.label}.` : null;
}

function WorkRhythm({ weekdayHours }) {
  const max = Math.max(...weekdayHours.flat(), 0);
  const level = (value) => (!value || !max ? 0 : Math.min(4, Math.ceil((value / max) * 4)));
  const peak = getPeakSummary(weekdayHours);

  return (
    <section className="analytics-section" aria-labelledby="analytics-rhythm-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-rhythm-heading">When you work</h2>
        <span>local time</span>
      </div>
      {peak && <p className="analytics-insight">{peak}</p>}
      <div className="analytics-heatmap" role="img" aria-label={peak || 'No session time in this period'}>
        {weekdayHours.map((hours, weekday) => (
          <div className="analytics-heatmap-row" key={WEEKDAYS[weekday]}>
            <span className="analytics-heatmap-day">{WEEKDAYS[weekday]}</span>
            {hours.map((value, hour) => (
              <span
                key={hour}
                className={`analytics-heatmap-cell level-${level(value)}`}
                title={`${WEEKDAY_NAMES[weekday]}, ${formatHour(hour)}–${formatHour((hour + 1) % 24)}: ${value ? formatDuration(value) : 'no sessions'}`}
              />
            ))}
          </div>
        ))}
        <div className="analytics-heatmap-row analytics-heatmap-axis" aria-hidden="true">
          <span className="analytics-heatmap-day" />
          {Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour % 6 === 0 ? formatHour(hour) : ''}</span>)}
        </div>
      </div>
      <div className="analytics-heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((value) => <i key={value} className={`analytics-heatmap-cell level-${value}`} />)}
        <span>More</span>
      </div>
    </section>
  );
}

function SessionLengths({ analytics, onSelectSession }) {
  const { lengthBuckets, longestSession, averageDurationMs } = analytics;
  const maxCount = Math.max(1, ...lengthBuckets.map(({ count }) => count));

  return (
    <section className="analytics-section" aria-labelledby="analytics-lengths-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-lengths-heading">How long your sessions run</h2>
        <span>average {formatDuration(averageDurationMs)}</span>
      </div>
      <ol className="analytics-length-list">
        {lengthBuckets.map(({ label, count }) => (
          <li key={label}>
            <span className="analytics-length-label">{label}</span>
            <span className="analytics-length-track" aria-hidden="true">{count > 0 && <i style={{ width: `${(count / maxCount) * 100}%` }} />}</span>
            <span className="analytics-length-count">{formatCount(count, 'session')}</span>
          </li>
        ))}
      </ol>
      {longestSession && (
        <a className="analytics-longest" href={sessionDetailPath(longestSession.session.id)} onClick={(event) => followRouteLink(event, () => onSelectSession(longestSession.session.id))}>
          <span>Longest</span>
          <strong>{longestSession.session.goal || 'No goal set'}</strong>
          <span className="analytics-longest-duration">{formatDuration(longestSession.durationMs)} <span aria-hidden="true">→</span></span>
        </a>
      )}
    </section>
  );
}

function GitHubActivity({ analytics }) {
  const { activity, sessionsWithActivity, sessionsWithCommits, sessionCount } = analytics;
  const value = (metric) => (metric.total === null ? '—' : formatNumber(metric.total));

  return (
    <section className="analytics-section" aria-labelledby="analytics-github-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-github-heading">What GitHub recorded</h2>
        <span>during sessions</span>
      </div>
      <dl className="analytics-github-metrics">
        <div><dt>Commits</dt><dd>{value(activity.commits)}</dd></div>
        <div><dt>Lines added</dt><dd className="analytics-additions">+{value(activity.additions)}</dd></div>
        <div><dt>Lines deleted</dt><dd className="analytics-deletions">−{value(activity.deletions)}</dd></div>
      </dl>
      <div className="analytics-github-coverage">
        <span className="analytics-coverage-track" aria-hidden="true">
          <i className="with-commits" style={{ flexGrow: sessionsWithCommits }} />
          <i className="without-commits" style={{ flexGrow: sessionsWithActivity - sessionsWithCommits }} />
          <i className="unrecorded" style={{ flexGrow: sessionCount - sessionsWithActivity }} />
        </span>
        <p>
          {formatNumber(sessionsWithCommits)} of {formatCount(sessionCount, 'session')} had commits.
          {sessionCount > sessionsWithActivity && ` ${formatNumber(sessionCount - sessionsWithActivity)} have no recorded GitHub activity.`}
          {' '}Sessions without commits still count; planning, reading, and debugging are work too.
        </p>
      </div>
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

export default function AnalyticsPage({ sessions = [], onSelectSession, onNavigate }) {
  const [range, setRange] = useState('30D');
  const hasExamples = sessions.some((session) => session.source === 'placeholder');
  const [includeExamples, setIncludeExamples] = useState(true);
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
            {analytics.rangeDays ? ` · compared with the ${periodLabel(analytics.rangeDays)}` : ''}
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
          <SessionTimeChart timeline={analytics.timeline} />
          <div className="analytics-grid">
            <ProjectBreakdown projects={analytics.projects} onNavigate={onNavigate} />
            <WorkRhythm weekdayHours={analytics.weekdayHours} />
            <SessionLengths analytics={analytics} onSelectSession={onSelectSession} />
            <GitHubActivity analytics={analytics} />
          </div>
          <p className="session-history-boundary">
            {analytics.includesExamples ? 'Example sessions are included; their activity is illustrative. ' : ''}
            Session time is what you declared for each session. GitHub activity is what GitHub recorded during those sessions; neither is a measure of productivity.
          </p>
        </>
      )}
    </div>
  );
}
