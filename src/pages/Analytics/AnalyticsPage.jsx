import React, { useMemo, useState } from 'react';
import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { followRouteLink, projectDetailPath, readSearchParam, updateSearchParams } from '../../routing.js';
import DateRangePicker, { readRange, rangeBounds, toDayString, writeRange } from '../../components/filters/DateRangePicker.jsx';
import WorkCalendar from '../../components/analytics/WorkCalendar.jsx';
import RepositoryName from '../../components/repository/RepositoryName.jsx';
import { formatCount } from '../../sessions/sessionHelpers.js';

const DEFAULT_PERIOD = 'month';

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
  // Every seventh day and the last one; a weekly label too close to the last would overlap it.
  const last = buckets.length - 1;
  return index === last || (index % 7 === 0 && last - index >= 3) ? formatDate(bucket.start) : '';
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
              <div className={`analytics-bar${bucket.isFuture ? ' is-future' : ''}`} key={bucket.start.toISOString()} role="listitem" tabIndex={bucket.isFuture ? -1 : 0} aria-label={bucket.isFuture ? `${label}: upcoming` : `${label}: ${formatDuration(bucket.durationMs)}, ${formatCount(bucket.sessionCount, 'session')}`}>
                <span className="analytics-bar-track">
                  {bucket.durationMs > 0 && <i style={{ height: `${Math.max(3, (bucket.durationMs / maxDuration) * 100)}%` }} />}
                </span>
                <span className="analytics-bar-label">{axisLabel(bucket, index, buckets, unit)}</span>
                {!bucket.isFuture && <span className={`analytics-tooltip ${align}`} role="tooltip">
                  <span className="analytics-tooltip-title">{label}</span>
                  <span className="analytics-tooltip-value">{bucket.sessionCount ? formatDuration(bucket.durationMs) : 'No sessions'}</span>
                  {bucket.sessionCount > 0 && (
                    <span className="analytics-tooltip-meta">{formatCount(bucket.sessionCount, 'session')}</span>
                  )}
                </span>}
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
        <span>{formatCount(projects.length, 'repository', 'repositories')}</span>
      </div>
      {projects.length ? (
        <ol className="analytics-project-list">
          {topProjects.map((project) => {
            const content = (
              <>
                <span className="analytics-project-name">
                  <strong><RepositoryName name={project.fullName} /></strong>
                  <small>{formatCount(project.sessionCount, 'session')}{project.commits !== null ? ` · ${formatCount(project.commits, 'commit')}` : ''}</small>
                </span>
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
                <span className="analytics-project-name"><strong>{formatCount(others.length, 'other repository', 'other repositories')}</strong></span>
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

const EMPTY_PERIOD = { today: 'No sessions yet today.', week: 'No sessions yet this week.', month: 'No sessions yet this month.' };

function AnalyticsEmptyState({ period, hasAnySessions, onShowAllTime }) {
  return (
    <section className="analytics-empty-state" role="status">
      <h2>{hasAnySessions ? EMPTY_PERIOD[period] || 'No sessions in this period.' : 'Complete a session to start building your work history.'}</h2>
      {hasAnySessions && period !== 'all' && <button className="text-link" type="button" onClick={onShowAllTime}>Show all time <span aria-hidden="true">→</span></button>}
    </section>
  );
}

export default function AnalyticsPage({ sessions = [], notice = null, onNavigate }) {
  // The range lives in the URL (?period= or ?from=&to=) so links and reloads keep the view.
  const [range, setRangeState] = useState(() => readRange(new URLSearchParams(window.location.search), DEFAULT_PERIOD));
  const setRange = (next) => {
    const params = new URLSearchParams();
    writeRange(params, next, DEFAULT_PERIOD);
    setRangeState(next);
    updateSearchParams({ period: params.get('period'), from: params.get('from'), to: params.get('to'), date: null });
  };
  const bounds = useMemo(() => rangeBounds(range), [range]);
  const analytics = useMemo(() => calculateSessionAnalytics(sessions, bounds), [sessions, bounds]);
  const activeDays = useMemo(() => new Set(sessions.map((session) => toDayString(new Date(session.startedAt)))), [sessions]);
  const hasSessions = analytics.sessionCount > 0;

  return (
    <div className="analytics-page">
      <section className="analytics-page-intro">
        <div>
          <h1>Analytics</h1>
          {range.period !== 'custom' && (
            <p>
              {range.period === 'month'
                ? formatDate(analytics.rangeStart, { month: 'long', year: 'numeric' })
                : <>{formatDate(analytics.rangeStart, { month: 'short', day: 'numeric', year: 'numeric' })} – {formatDate(analytics.rangeEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</>}
            </p>
          )}
        </div>
        <div className="analytics-controls">
          <DateRangePicker value={range} onChange={setRange} activeDays={activeDays} />
        </div>
      </section>

      {notice}

      {!hasSessions ? (notice ? null : <AnalyticsEmptyState period={range.period} hasAnySessions={analytics.totalCompletedSessions > 0} onShowAllTime={() => setRange({ period: 'all' })} />) : (
        <>
          <SummaryMetrics analytics={analytics} />
          <GitHubActivity analytics={analytics} />
          <SessionTimeChart timeline={analytics.timeline} />
          <div className="analytics-grid">
            <ProjectBreakdown projects={analytics.projects} onNavigate={onNavigate} />
            <WorkCalendar sessions={sessions} onNavigate={onNavigate} />
          </div>
          <p className="session-history-boundary">
            {analytics.includesExamples ? 'Includes example sessions. ' : ''}Session time is what you declared; GitHub activity is what GitHub recorded during it.
          </p>
        </>
      )}
    </div>
  );
}
