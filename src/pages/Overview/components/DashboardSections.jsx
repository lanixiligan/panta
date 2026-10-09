import React from 'react';
import { followRouteLink, routePaths } from '../../../routing.js';

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

function formatDate(value, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function followSessionLink(event, onSelect, sessionId) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onSelect(sessionId);
}

export function WeeklySummary({ summary }) {
  const metrics = [
    { label: 'Sessions', value: summary.sessionCount },
    { label: 'Session time', value: formatDuration(summary.sessionMinutes) },
    { label: 'Commits', value: summary.commitCount ?? '—', title: summary.commitCount === null ? 'No GitHub activity recorded this week' : undefined },
    { label: 'Projects', value: summary.repositoryCount },
  ];
  const maxMinutes = Math.max(1, ...summary.days.map(({ sessionMinutes }) => sessionMinutes));

  return (
    <div className="dashboard-side">
      <section className="dashboard-section weekly-section" aria-labelledby="weekly-heading">
        <div className="dashboard-section-heading">
          <h2 id="weekly-heading">This week</h2>
          <span className="dashboard-section-meta">{formatDate(summary.start, { month: 'short', day: 'numeric' })} – {formatDate(summary.end, { month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="weekly-metrics">
          {metrics.map((metric) => <div className="weekly-metric" key={metric.label} title={metric.title}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
        </div>
      </section>
      <section className="dashboard-section weekly-section weekly-days" aria-labelledby="weekly-days-heading">
        <div className="dashboard-section-heading">
          <h2 id="weekly-days-heading">Session time by day</h2>
          {summary.includesExamples && <span className="dashboard-section-meta">includes examples</span>}
        </div>
        <div className="session-activity-chart" role="img" aria-label={`Session time by day this week: ${summary.days.filter((day) => !day.isFuture).map((day) => `${day.label} ${formatDuration(day.sessionMinutes)}`).join(', ')}`}>
          {summary.days.map((day) => (
            <div className={`activity-day ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`} key={day.date} title={day.isFuture ? undefined : `${day.label}: ${formatDuration(day.sessionMinutes)}`}>
              <span className="activity-bar-track">
                {day.sessionMinutes > 0 && <i style={{ height: `${Math.max(6, (day.sessionMinutes / maxMinutes) * 100)}%` }} />}
              </span>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecentSessionRow({ session, onSelect }) {
  const status = session.activityStatus === 'loading'
    ? 'Fetching GitHub…'
    : session.activityStatus === 'error' || !session.hasActivity
      ? 'Activity unavailable'
      : session.commitCount === 0 ? 'No commits' : formatCount(session.commitCount, 'commit');

  return (
    <a className="recent-session-row" href={session.detailHref} onClick={(event) => followSessionLink(event, onSelect, session.id)}>
      <span className="recent-session-main">
        <span className={`recent-session-goal ${session.goal ? '' : 'empty'}`}>{session.goal || 'No goal set'}</span>
        <span className="recent-session-meta">
          <span className="recent-session-repo">{session.repositoryName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          {session.isPlaceholder && <span className="session-source-badge placeholder">EXAMPLE</span>}
        </span>
      </span>
      <span className="recent-session-commits">{status}</span>
      <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
    </a>
  );
}

export function RecentSessions({ sessions = [], onViewAll, onSelectSession }) {
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <h2 id="recent-heading">Recent sessions</h2>
        {sessions.length > 0 && <a className="text-link" href={routePaths['Session History']} onClick={(event) => followRouteLink(event, () => onViewAll())}>View all <span aria-hidden="true">→</span></a>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list">{sessions.map((session) => <RecentSessionRow key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌁</span>
          <div><span className="section-kicker">NO SESSIONS YET</span><h3>Your first coding session starts here.</h3><p>Start a session to build your development history.</p></div>
        </div>
      )}
    </section>
  );
}
