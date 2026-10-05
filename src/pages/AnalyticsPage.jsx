import React, { useMemo, useState } from 'react';
import { calculateSessionAnalytics } from '../analytics/sessionAnalytics.js';
import { followRouteLink, sessionDetailPath } from '../routing.js';

const timeRanges = ['7D', '30D', '90D', 'All time'];

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

function localDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatRecentDate(value) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today - sessionDay) / 86_400_000);
  const dayLabel = dayDifference === 0
    ? 'Today'
    : dayDifference === 1
      ? 'Yesterday'
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  return `${dayLabel} · ${timeLabel}`;
}

function repositoryName(session) {
  const repository = session.repository || {};
  return repository.name || repository.fullName || repository.full_name || 'Repository unavailable';
}

function repositoryFullName(session) {
  const repository = session.repository || {};
  return repository.fullName || repository.full_name || '';
}

function TimeRangeControl({ value, onChange }) {
  return (
    <div className="analytics-time-range" role="group" aria-label="Analytics time range">
      {timeRanges.map((range) => (
        <button key={range} type="button" aria-pressed={value === range} className={value === range ? 'selected' : ''} onClick={() => onChange(range)}>
          {range}
        </button>
      ))}
    </div>
  );
}

function SummaryMetrics({ analytics }) {
  const metrics = [
    { label: 'Sessions', value: formatNumber(analytics.sessionCount) },
    { label: 'Total time', value: formatDuration(analytics.totalDurationMs) },
    { label: 'Projects', value: formatNumber(analytics.projectCount) },
    { label: 'Commits', value: analytics.activity.commits.total === null ? '—' : formatNumber(analytics.activity.commits.total) },
  ];

  return (
    <section className="analytics-summary" aria-label="Summary metrics">
      {metrics.map(({ label, value }) => <div className="analytics-summary-metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}
    </section>
  );
}

function shouldLabelDay(date, index, count) {
  if (count <= 10 || index === count - 1) return true;
  if (count <= 40) return index % 7 === 0;
  return date.getDate() === 1;
}

function SessionActivityChart({ days }) {
  const maxDuration = Math.max(1, ...days.map((day) => day.durationMs));
  const firstDay = days[0]?.date;
  const lastDay = days.at(-1)?.date;

  return (
    <section className="analytics-section analytics-activity-chart" aria-labelledby="analytics-activity-heading">
      <div className="analytics-section-heading">
        <div><span className="section-kicker">SESSION ACTIVITY</span><h2 id="analytics-activity-heading">Time spent over time</h2></div>
        {firstDay && lastDay && <span className="analytics-date-span">{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(firstDay)} – {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(lastDay)}</span>}
      </div>
      <p className="analytics-section-description">Daily session duration · local time</p>
      <div className="analytics-day-chart" style={{ '--analytics-day-count': days.length }} role="list" aria-label="Daily session duration for the selected period">
        {days.map(({ date, durationMs }, index) => {
          const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
          return (
            <div className="analytics-day-column" key={localDateKey(date)} role="listitem" aria-label={`${label}: ${formatDuration(durationMs)}`} title={`${label}: ${formatDuration(durationMs)}`}>
              <div className="analytics-day-track" aria-hidden="true"><i className={durationMs > 0 ? 'has-activity' : ''} style={{ height: `${durationMs / maxDuration * 100}%` }} /></div>
              {shouldLabelDay(date, index, days.length) && <span>{days.length <= 10 ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date) : date.getDate()}</span>}
            </div>
          );
        })}
      </div>
      <div className="analytics-chart-axis"><span>{firstDay ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(firstDay) : ''}</span><span>Each bar is one day</span><span>{lastDay ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(lastDay) : ''}</span></div>
    </section>
  );
}

function ProjectActivity({ projects }) {
  const maxDuration = Math.max(1, ...projects.map((project) => project.durationMs));
  return (
    <section className="analytics-section" aria-labelledby="analytics-projects-heading">
      <div className="analytics-section-heading"><div><span className="section-kicker">PROJECT ACTIVITY</span><h2 id="analytics-projects-heading">Time by repository</h2></div></div>
      {projects.length ? (
        <div className="analytics-project-list">
          {projects.map((project) => (
            <div className="analytics-project-row" key={project.fullName}>
              <div className="analytics-project-copy"><strong>{project.name}</strong>{project.fullName !== project.name && <span>{project.fullName}</span>}</div>
              <div className="analytics-project-track" aria-hidden="true"><i style={{ width: `${project.durationMs / maxDuration * 100}%` }} /></div>
              <span className="analytics-project-duration">{formatDuration(project.durationMs)}</span>
            </div>
          ))}
        </div>
      ) : <p className="analytics-empty-inline">No repository information is available for these sessions.</p>}
    </section>
  );
}

function SessionPatterns({ patterns }) {
  if (!patterns) return null;
  const values = [
    ['Average session', formatDuration(patterns.averageDurationMs)],
    ['Longest session', formatDuration(patterns.longestDurationMs)],
    ['Shortest session', formatDuration(patterns.shortestDurationMs)],
    ['Most active day', patterns.mostActiveDay || '—'],
  ];
  return (
    <section className="analytics-section" aria-labelledby="analytics-patterns-heading">
      <div className="analytics-section-heading"><div><span className="section-kicker">SESSION PATTERNS</span><h2 id="analytics-patterns-heading">A little context</h2></div></div>
      <dl className="analytics-pattern-list">
        {values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}

function GitHubActivity({ activity, activitySessionsWithData, sessionCount }) {
  const values = [
    ['Commits', activity.commits],
    ['Files changed', activity.filesChanged],
  ];
  return (
    <section className="analytics-section analytics-github-activity" aria-labelledby="analytics-github-heading">
      <div className="analytics-section-heading"><div><span className="section-kicker">GITHUB ACTIVITY</span><h2 id="analytics-github-heading">Recorded changes</h2></div></div>
      <div className="analytics-github-metrics">
        {values.map(([label, metric]) => <div key={label}><strong>{metric.total === null ? '—' : formatNumber(metric.total)}</strong><span>{label}</span></div>)}
        <div className="analytics-diff-metric" role="group" aria-label={`Lines added ${activity.additions.total === null ? 'unavailable' : activity.additions.total}; lines deleted ${activity.deletions.total === null ? 'unavailable' : activity.deletions.total}`}>
          <strong><span className="analytics-additions">+{activity.additions.total === null ? '—' : formatNumber(activity.additions.total)}</span><span className="analytics-diff-separator" aria-hidden="true"> / </span><span className="analytics-deletions">−{activity.deletions.total === null ? '—' : formatNumber(activity.deletions.total)}</span></strong>
          <span>Lines added / deleted</span>
        </div>
      </div>
      <p className="analytics-section-description">GitHub activity is recorded for {activitySessionsWithData} of {sessionCount} sessions. Missing values are not inferred; a dash means none was stored.</p>
    </section>
  );
}

function RecentWork({ sessions, onSelectSession }) {
  return (
    <section className="analytics-section analytics-recent-work" aria-labelledby="analytics-recent-heading">
      <div className="analytics-section-heading"><div><span className="section-kicker">RECENT WORK</span><h2 id="analytics-recent-heading">Latest completed sessions</h2></div></div>
      <div className="analytics-recent-list">
        {sessions.slice(0, 6).map(({ session, endedAt, durationMs }) => (
          <a className="analytics-recent-item" href={sessionDetailPath(session.id)} key={session.id} onClick={(event) => followRouteLink(event, onSelectSession)}>
            <span className="analytics-recent-repository"><strong>{repositoryName(session)}</strong>{repositoryFullName(session) && <small>{repositoryFullName(session)}</small>}</span>
            <span className="analytics-recent-goal">{session.goal || 'Session'}</span>
            <time dateTime={session.endedAt}>{formatRecentDate(endedAt)}</time>
            <span className="analytics-recent-duration">{formatDuration(durationMs)}</span>
            <span className="analytics-recent-arrow" aria-hidden="true">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function AnalyticsEmptyState({ hasAnySessions }) {
  return (
    <section className="analytics-empty-state" role="status">
      <span className="section-kicker">{hasAnySessions ? 'NO SESSIONS IN THIS PERIOD' : 'NO SESSION DATA YET'}</span>
      <h2>{hasAnySessions ? 'No sessions in this period.' : 'Complete a session to start building your work history.'}</h2>
      {hasAnySessions && <p>Try a different time range.</p>}
    </section>
  );
}

export default function AnalyticsPage({ sessions = [], onSelectSession }) {
  const [range, setRange] = useState('30D');
  const analytics = useMemo(() => calculateSessionAnalytics(sessions, range), [sessions, range]);
  const hasSessions = analytics.sessionCount > 0;

  return (
    <div className="analytics-page">
      <section className="page-intro analytics-page-intro">
        <div><span className="section-kicker">WORK OVER TIME</span><h1>Analytics</h1><p>Understand your work over time.</p></div>
        <TimeRangeControl value={range} onChange={setRange} />
      </section>

      {!hasSessions ? <AnalyticsEmptyState hasAnySessions={analytics.totalCompletedSessions > 0} /> : (
        <>
          {analytics.includesExamples && <p className="analytics-example-note">Example sessions are included; their activity totals are illustrative.</p>}
          <SummaryMetrics analytics={analytics} />
          <SessionActivityChart days={analytics.activityByDay} />
          <div className="analytics-secondary-grid">
            <ProjectActivity projects={analytics.projects} />
            <SessionPatterns patterns={analytics.patterns} />
          </div>
          <GitHubActivity activity={analytics.activity} activitySessionsWithData={analytics.activitySessionsWithData} sessionCount={analytics.sessionCount} />
          <RecentWork sessions={analytics.sessions} onSelectSession={onSelectSession} />
        </>
      )}
    </div>
  );
}
