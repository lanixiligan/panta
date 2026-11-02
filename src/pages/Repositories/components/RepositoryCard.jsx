import React from 'react';
import { followRouteLink, repositoryDetailPath } from '../../../routing.js';
import { formatLastWorked, formatRepositoryDuration } from '../repositoryHistory.js';
import { formatCount } from '../../../sessions/sessionHelpers.js';
import RepositoryName from '../../../components/repository/RepositoryName.jsx';

// `showExample` is off when every listed repository is an example; the page labels them once instead.
function RepositoryBadge({ repository, showExample = true }) {
  if (repository.isExample) return showExample ? <span className="repository-badge is-example">Example</span> : null;
  return repository.visibility === 'private' ? <span className="repository-badge is-private">Private</span> : null;
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

export default function RepositoryCard({ repository, showExample, onNavigate }) {
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
              {commits.total > 0 && <LineChanges additions={additions.total} deletions={deletions.total} />}
            </>
          )}
        </div>
      </div>

      <span className="repository-card-meta">Last worked <time dateTime={new Date(repository.lastWorkedAt).toISOString()}>{formatLastWorked(repository.lastWorkedAt)}</time></span>
    </a>
  );
}
