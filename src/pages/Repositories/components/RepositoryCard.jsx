import React from 'react';
import { followRouteLink, repositoryDetailPath } from '../../../routing.js';
import { formatLastWorked, formatRepositoryDuration } from '../repositoryHistory.js';
import { formatCount } from '../../../sessions/sessionHelpers.js';
import RepositoryName from '../../../components/repository/RepositoryName.jsx';

export const ACTIVITY_DAYS = 7;

function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

// `showExample` is off when every listed repository is an example; the page labels them once instead.
function RepositoryBadge({ repository, showExample = true }) {
  if (repository.isExample) return showExample ? <span className="repository-badge is-example">Example</span> : null;
  return repository.visibility ? <span className={`repository-badge is-${repository.visibility}`}>{repository.visibility}</span> : null;
}

function LineChanges({ additions, deletions }) {
  if (additions === null && deletions === null) return null;
  return (
    <span className="repository-lines">
      {additions !== null && <span className="history-additions">+{additions.toLocaleString()}</span>}
      {deletions !== null && <span className="history-deletions">−{deletions.toLocaleString()}</span>}
    </span>
  );
}

function ActivityStrip({ days, maxMinutes }) {
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const dayValues = days.filter((day) => day.minutes > 0).map((day) => `${formatDay(day.date)} ${formatRepositoryDuration(day.minutes * 60_000)}`).join(', ');
  return (
    <div className="repository-strip" role="img" aria-label={`Session time on ${workedDays} of the last ${ACTIVITY_DAYS} days${dayValues ? `: ${dayValues}` : ''}`}>
      {days.map((day, index) => {
        const isToday = index === days.length - 1;
        return (
          <i
            key={day.key}
            className={[day.minutes > 0 && 'has-time', isToday && 'is-today'].filter(Boolean).join(' ') || undefined}
            style={day.minutes > 0 ? { height: `${Math.max(16, Math.round(day.minutes / maxMinutes * 100))}%` } : undefined}
            title={`${formatDay(day.date)}: ${day.minutes > 0 ? formatRepositoryDuration(day.minutes * 60_000) : 'no sessions'}`}
          />
        );
      })}
    </div>
  );
}

export default function RepositoryCard({ repository, days, maxMinutes, showExample, onNavigate }) {
  const { commits, additions, deletions } = repository.activity;
  return (
    <a className="repository-card" href={repositoryDetailPath(repository.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>
      <div className="repository-card-head">
        <div className="repository-card-title">
          <strong><RepositoryName name={repository.fullName} /></strong>
          <RepositoryBadge repository={repository} showExample={showExample} />
        </div>
        {repository.description && <p className="repository-card-description">{repository.description}</p>}
      </div>

      <div className="repository-card-measures">
        <div className="repository-card-measure">
          <span className="repository-measure-label">Session time</span>
          <strong>{formatRepositoryDuration(repository.totalDurationMs)}</strong>
          <span className="repository-measure-note">{formatCount(repository.sessionCount, 'session')}</span>
        </div>
        <div className="repository-card-measure">
          <span className="repository-measure-label">GitHub activity</span>
          {commits.total === null ? (
            <strong className="is-unavailable">Unavailable</strong>
          ) : (
            <>
              <strong>{commits.total.toLocaleString()}<span className="repository-measure-unit">{commits.total === 1 ? 'commit' : 'commits'}</span></strong>
              <LineChanges additions={additions.total} deletions={deletions.total} />
            </>
          )}
        </div>
      </div>

      <div className="repository-card-activity">
        <ActivityStrip days={days} maxMinutes={maxMinutes} />
        <div className="repository-strip-scale">
          <span>{formatDay(days[0].date)}</span>
          <span>Last {ACTIVITY_DAYS} days</span>
          <span>Today</span>
        </div>
      </div>

      <div className="repository-card-footer">
        <span>Last worked <time dateTime={new Date(repository.lastWorkedAt).toISOString()}>{formatLastWorked(repository.lastWorkedAt)}</time></span>
        <span className="repository-card-go">View repository <span aria-hidden="true">→</span></span>
      </div>
    </a>
  );
}
