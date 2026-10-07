import React from 'react';
import { formatCount, formatLastWorked, formatProjectDuration } from './projectHistory.js';

function formatDate(value, options) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, options).format(date) : '';
}

function ProjectSessionRow({ session, onSelectSession }) {
  return (
    <article className="session-history-entry">
      <div className="session-history-entry-main">
        <div className="session-history-when">
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          <span className="session-history-duration">{formatProjectDuration(session.durationMinutes * 60_000)}</span>
        </div>
        {session.goal && <p className="session-history-goal">{session.goal}</p>}
        <div className="session-history-activity" aria-label="GitHub activity summary">
          {session.hasActivity ? (
            <>
              <span>{formatCount(session.commitCount, 'commit')}</span>
              <span><span className="history-additions">+{session.additions}</span> / <span className="history-deletions">−{session.deletions}</span></span>
            </>
          ) : (
            <span className="session-history-activity-note">{session.activityStatus === 'loading' ? 'Retrieving GitHub activity…' : 'GitHub activity unavailable'}</span>
          )}
        </div>
      </div>
      <div className="session-history-entry-aside">
        <a
          className="session-history-view-link"
          href={session.detailHref}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onSelectSession(session.id);
          }}
        >
          View session <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export default function ProjectDetailPage({ project, onBack, onSelectSession }) {
  const { activity } = project;
  const stats = [
    ['Sessions', project.sessionCount.toLocaleString()],
    ['Total session time', formatProjectDuration(project.totalDurationMs)],
    ['Commits', activity.commits.total],
    ['Files changed', activity.filesChanged.total],
    ['Additions', activity.additions.total === null ? null : `+${activity.additions.total.toLocaleString()}`],
    ['Deletions', activity.deletions.total === null ? null : `−${activity.deletions.total.toLocaleString()}`],
  ].filter(([, value]) => value !== null);
  const partialActivity = project.activitySessionsWithData < project.sessionCount;

  return (
    <article className="session-detail-page project-detail-page">
      <button className="back-button" type="button" onClick={onBack}>← Projects</button>
      <header className="session-detail-heading">
        <span className="session-complete-label"><i aria-hidden="true" /> PROJECT{project.visibility && <span> · {project.visibility.toUpperCase()}</span>}</span>
        <h1>{project.name}</h1>
        {project.htmlUrl
          ? <a href={project.htmlUrl} target="_blank" rel="noreferrer">{project.fullName} <span aria-hidden="true">↗</span></a>
          : <span>{project.fullName}</span>}
        {project.description && <p className="project-detail-description">{project.description}</p>}
        <p>Last worked {formatLastWorked(project.lastWorkedAt)}</p>
      </header>

      <section className="session-detail-stats" aria-label="Project totals">
        {stats.map(([label, value]) => (
          <div className="dashboard-section session-detail-stat" key={label}>
            <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      {partialActivity && (
        <p className="session-history-boundary">
          GitHub activity is available for {project.activitySessionsWithData} of {formatCount(project.sessionCount, 'session')}. Missing values are not counted.
        </p>
      )}

      <section className="project-session-history" aria-labelledby="project-session-history-heading">
        <div className="session-history-list-heading">
          <h2 id="project-session-history-heading">Session history</h2>
          <span>{formatCount(project.sessionCount, 'session')}</span>
        </div>
        <div className="session-history-list">
          {project.sessions.map((session) => <ProjectSessionRow key={session.id} session={session} onSelectSession={onSelectSession} />)}
        </div>
      </section>
    </article>
  );
}
