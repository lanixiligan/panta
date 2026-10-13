import React from 'react';
import { followRouteLink, projectDetailPath } from '../../../routing.js';
import { formatCount, formatLastWorked, formatProjectDuration } from '../projectHistory.js';
import RepositoryName from '../../../components/repository/RepositoryName.jsx';

export const ACTIVITY_DAYS = 7;

function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

// `showExample` is off when every listed project is an example; the page labels them once instead.
function ProjectBadge({ project, showExample = true }) {
  if (project.isExample) return showExample ? <span className="project-badge is-example">Example</span> : null;
  return project.visibility ? <span className={`project-badge is-${project.visibility}`}>{project.visibility}</span> : null;
}

function LineChanges({ additions, deletions }) {
  if (additions === null && deletions === null) return null;
  return (
    <span className="project-lines">
      {additions !== null && <span className="history-additions">+{additions.toLocaleString()}</span>}
      {deletions !== null && <span className="history-deletions">−{deletions.toLocaleString()}</span>}
    </span>
  );
}

function ActivityStrip({ days, maxMinutes }) {
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const dayValues = days.filter((day) => day.minutes > 0).map((day) => `${formatDay(day.date)} ${formatProjectDuration(day.minutes * 60_000)}`).join(', ');
  return (
    <div className="project-strip" role="img" aria-label={`Session time on ${workedDays} of the last ${ACTIVITY_DAYS} days${dayValues ? `: ${dayValues}` : ''}`}>
      {days.map((day, index) => {
        const isToday = index === days.length - 1;
        return (
          <i
            key={day.key}
            className={[day.minutes > 0 && 'has-time', isToday && 'is-today'].filter(Boolean).join(' ') || undefined}
            style={day.minutes > 0 ? { height: `${Math.max(16, Math.round(day.minutes / maxMinutes * 100))}%` } : undefined}
            title={`${formatDay(day.date)}: ${day.minutes > 0 ? formatProjectDuration(day.minutes * 60_000) : 'no sessions'}`}
          />
        );
      })}
    </div>
  );
}

export default function ProjectCard({ project, days, maxMinutes, showExample, onNavigate }) {
  const { commits, additions, deletions } = project.activity;
  return (
    <a className="project-card" href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>
      <div className="project-card-head">
        <div className="project-card-title">
          <strong><RepositoryName name={project.fullName} /></strong>
          <ProjectBadge project={project} showExample={showExample} />
        </div>
        {project.description && <p className="project-card-description">{project.description}</p>}
      </div>

      <div className="project-card-measures">
        <div className="project-card-measure">
          <span className="project-measure-label">Session time</span>
          <strong>{formatProjectDuration(project.totalDurationMs)}</strong>
          <span className="project-measure-note">{formatCount(project.sessionCount, 'session')}</span>
        </div>
        <div className="project-card-measure">
          <span className="project-measure-label">GitHub activity</span>
          {commits.total === null ? (
            <>
              <strong className="is-unavailable">Unavailable</strong>
              <span className="project-measure-note">Not recorded for these sessions</span>
            </>
          ) : (
            <>
              <strong>{commits.total.toLocaleString()}<span className="project-measure-unit">{commits.total === 1 ? 'commit' : 'commits'}</span></strong>
              <LineChanges additions={additions.total} deletions={deletions.total} />
            </>
          )}
        </div>
      </div>

      <div className="project-card-activity">
        <ActivityStrip days={days} maxMinutes={maxMinutes} />
        <div className="project-strip-scale">
          <span>{formatDay(days[0].date)}</span>
          <span>Last {ACTIVITY_DAYS} days</span>
          <span>Today</span>
        </div>
      </div>

      <div className="project-card-footer">
        <span>Last worked <time dateTime={new Date(project.lastWorkedAt).toISOString()}>{formatLastWorked(project.lastWorkedAt)}</time></span>
        <span className="project-card-go">View project <span aria-hidden="true">→</span></span>
      </div>
    </a>
  );
}
