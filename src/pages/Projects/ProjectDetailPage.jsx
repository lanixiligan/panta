import React, { useMemo, useState } from 'react';
import { formatCount, formatLastWorked, formatProjectDuration, recentDailyMinutes } from './projectHistory.js';
import { followRouteLink, routePaths } from '../../routing.js';

const CHART_DAYS = 30;

function formatDate(value, options) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, options).format(date) : '';
}

function formatMinutes(minutes) {
  return formatProjectDuration(minutes * 60_000);
}

function Measure({ label, value, unavailable = false, className = '' }) {
  return (
    <div className={`project-detail-measure ${className}`}>
      <span>{label}</span>
      {unavailable ? <strong className="is-unavailable" title="Not recorded">—</strong> : <strong>{value}</strong>}
    </div>
  );
}

function SessionTimePanel({ project }) {
  const durations = project.sessions.map((session) => session.durationMinutes || 0);
  const average = project.sessionCount ? project.totalDurationMs / project.sessionCount : null;
  return (
    <section className="project-detail-panel" aria-labelledby="project-time-heading">
      <span className="project-measure-label" id="project-time-heading">Session time</span>
      <strong className="project-detail-hero">{formatProjectDuration(project.totalDurationMs)}</strong>
      <span className="project-measure-note">Declared across {formatCount(project.sessionCount, 'session')}</span>
      <div className="project-detail-measures">
        <Measure label="Sessions" value={project.sessionCount.toLocaleString()} />
        <Measure label="Average" value={formatProjectDuration(average)} unavailable={average === null} />
        <Measure label="Longest" value={formatMinutes(Math.max(0, ...durations))} unavailable={!durations.length} />
      </div>
    </section>
  );
}

function GitHubActivityPanel({ project }) {
  const { commits, filesChanged, additions, deletions } = project.activity;
  const lineTotal = (additions.total || 0) + (deletions.total || 0);
  const hasLines = additions.total !== null && deletions.total !== null && lineTotal > 0;
  return (
    <section className="project-detail-panel" aria-labelledby="project-activity-heading">
      <span className="project-measure-label" id="project-activity-heading">{project.isExample ? 'Activity' : 'GitHub activity'}</span>
      {commits.total === null ? (
        <>
          <strong className="project-detail-hero is-unavailable">Unavailable</strong>
          <span className="project-measure-note">No GitHub activity was recorded for these sessions</span>
        </>
      ) : (
        <>
          <strong className="project-detail-hero">{commits.total.toLocaleString()}<span className="project-measure-unit">{commits.total === 1 ? 'commit' : 'commits'}</span></strong>
          <span className="project-measure-note">Attributed to you in session windows</span>
        </>
      )}
      <div className="project-detail-measures">
        <Measure label="Files changed" value={filesChanged.total?.toLocaleString()} unavailable={filesChanged.total === null} />
        <Measure label="Additions" value={`+${additions.total?.toLocaleString()}`} unavailable={additions.total === null} className="is-additions" />
        <Measure label="Deletions" value={`−${deletions.total?.toLocaleString()}`} unavailable={deletions.total === null} className="is-deletions" />
      </div>
      {hasLines && (
        <div className="project-detail-lines" role="img" aria-label={`${Math.round(additions.total / lineTotal * 100)}% of changed lines were additions`}>
          <i className="is-additions" style={{ flexGrow: additions.total }} />
          <i className="is-deletions" style={{ flexGrow: deletions.total }} />
        </div>
      )}
    </section>
  );
}

function SessionTimeChart({ project }) {
  const [hovered, setHovered] = useState(null);
  const days = useMemo(() => recentDailyMinutes(project, CHART_DAYS), [project]);
  const maxMinutes = Math.max(0, ...days.map((day) => day.minutes));
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const active = hovered === null ? null : days[hovered];

  return (
    <section className="project-detail-chart" aria-labelledby="project-chart-heading">
      <div className="project-detail-section-heading">
        <h2 id="project-chart-heading">Session time by day</h2>
        <span>Last {CHART_DAYS} days · {totalMinutes ? formatMinutes(totalMinutes) : 'no sessions'}</span>
      </div>
      {maxMinutes === 0 ? (
        <p className="project-detail-chart-empty">No sessions in the last {CHART_DAYS} days. Last worked {formatLastWorked(project.lastWorkedAt)}.</p>
      ) : (
        <div className="project-detail-plot">
          <span className="project-detail-plot-max">{formatMinutes(maxMinutes)}</span>
          <div
            className="project-detail-bars"
            role="list"
            aria-label={`Session time on ${workedDays} of the last ${CHART_DAYS} days, ${formatMinutes(totalMinutes)} in total`}
            onMouseLeave={() => setHovered(null)}
          >
            {days.map((day, index) => (
              <div
                className={`project-detail-bar-slot${hovered === index ? ' is-hovered' : ''}`}
                key={day.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${day.minutes > 0 ? formatMinutes(day.minutes) : 'no sessions'}`}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
              >
                <i
                  className={[day.minutes > 0 && 'has-time', index === days.length - 1 && 'is-today'].filter(Boolean).join(' ') || undefined}
                  style={day.minutes > 0 ? { height: `${Math.max(6, day.minutes / maxMinutes * 100)}%` } : undefined}
                />
              </div>
            ))}
            {active && (
              <div className="project-detail-tooltip" style={{ left: `${(hovered + 0.5) / CHART_DAYS * 100}%` }}>
                <span>{formatDate(active.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <strong>{active.minutes > 0 ? formatMinutes(active.minutes) : 'No sessions'}</strong>
              </div>
            )}
          </div>
          <div className="project-strip-scale">
            <span>{formatDate(days[0].date, { month: 'short', day: 'numeric' })}</span>
            <span>{formatDate(days[Math.floor(CHART_DAYS / 2)].date, { month: 'short', day: 'numeric' })}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </section>
  );
}

function ProjectSessionRow({ session, longestMinutes, onSelectSession }) {
  const share = longestMinutes ? (session.durationMinutes || 0) / longestMinutes : 0;
  return (
    <article className="project-session-row">
      <time className="project-session-date" dateTime={session.startedAt}>
        <strong>{formatDate(session.startedAt, { day: 'numeric' })}</strong>
        <span>{formatDate(session.startedAt, { month: 'short', year: 'numeric' })}</span>
      </time>
      <div className="project-session-main">
        <p className="project-session-goal">{session.goal || <span>No goal recorded</span>}</p>
        <div className="project-session-duration">
          <span className="project-session-duration-track" aria-hidden="true"><i style={{ width: `${Math.max(3, share * 100)}%` }} /></span>
          <span>{formatMinutes(session.durationMinutes || 0)}</span>
        </div>
      </div>
      <div className="project-session-activity" aria-label="GitHub activity summary">
        {session.hasActivity ? (
          <>
            <span>{formatCount(session.commitCount, 'commit')}</span>
            <span className="project-lines"><span className="history-additions">+{session.additions.toLocaleString()}</span><span className="history-deletions">−{session.deletions.toLocaleString()}</span></span>
          </>
        ) : (
          <span className="project-session-activity-note">{session.activityStatus === 'loading' ? 'Retrieving GitHub activity…' : 'GitHub activity unavailable'}</span>
        )}
      </div>
      <a
        className="project-session-link"
        href={session.detailHref}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onSelectSession(session.id);
        }}
      >
        View session <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}

export default function ProjectDetailPage({ project, onBack, onSelectSession }) {
  const partialActivity = project.activitySessionsWithData < project.sessionCount;
  const firstSession = project.sessions[project.sessions.length - 1];
  const longestMinutes = Math.max(0, ...project.sessions.map((session) => session.durationMinutes || 0));

  return (
    <article className="session-detail-page project-detail-page">
      <a className="back-button" href={routePaths.Projects} onClick={(event) => followRouteLink(event, () => onBack())}>← Projects</a>
      <header className="project-detail-heading">
        <div className="project-detail-kicker">
          {project.isExample
            ? <span className="project-badge is-example">Example project</span>
            : <span className="session-complete-label"><i aria-hidden="true" /> PROJECT</span>}
          {!project.isExample && project.visibility && <span className={`project-badge is-${project.visibility}`}>{project.visibility}</span>}
        </div>
        <h1>{project.name}</h1>
        {project.htmlUrl && !project.isExample
          ? <a className="project-detail-repo" href={project.htmlUrl} target="_blank" rel="noreferrer">{project.fullName} <span aria-hidden="true">↗</span></a>
          : <span className="project-detail-repo">{project.fullName}</span>}
        {project.description && <p className="project-detail-description">{project.description}</p>}
        <p className="project-detail-dates">
          Last worked <strong>{formatLastWorked(project.lastWorkedAt)}</strong>
          {firstSession && <> <span aria-hidden="true">·</span> First session <strong>{formatDate(firstSession.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>}
        </p>
      </header>

      <div className="project-detail-panels">
        <SessionTimePanel project={project} />
        <GitHubActivityPanel project={project} />
      </div>
      {project.isExample && (
        <p className="session-history-boundary">This example project is built from example sessions; its GitHub activity was not retrieved from GitHub.</p>
      )}
      {partialActivity && (
        <p className="session-history-boundary">
          GitHub activity is available for {project.activitySessionsWithData} of {formatCount(project.sessionCount, 'session')}. Missing values are not counted.
        </p>
      )}

      <SessionTimeChart project={project} />

      <section className="project-session-history" aria-labelledby="project-session-history-heading">
        <div className="project-detail-section-heading">
          <h2 id="project-session-history-heading">Session history</h2>
          <span>{formatCount(project.sessionCount, 'session')}</span>
        </div>
        <div className="project-session-list">
          {project.sessions.map((session) => <ProjectSessionRow key={session.id} session={session} longestMinutes={longestMinutes} onSelectSession={onSelectSession} />)}
        </div>
      </section>
    </article>
  );
}
