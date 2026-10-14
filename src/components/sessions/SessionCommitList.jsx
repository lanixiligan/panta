import React from 'react';
import { formatRelativeTime } from '../../sessions/sessionHelpers.js';

function formatTimestamp(value, mode, now) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';

  // Compact, like the active session's "Checked 12s ago".
  if (mode === 'relative') return formatRelativeTime(date, now);

  const options = mode === 'datetime'
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { hour: 'numeric', minute: '2-digit' };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function orderCommits(commits = [], direction = 'newest') {
  return [...commits].sort((left, right) => {
    const difference = Date.parse(left.timestamp || 0) - Date.parse(right.timestamp || 0);
    return direction === 'oldest' ? difference : -difference;
  });
}

// `linkRows` makes each whole row the link to the commit on GitHub (the active session); otherwise only the message links.
// `repositoryUrl` fills in the link for commits that arrived without one.
export default function SessionCommitList({ commits = [], mode = 'recap', timestampMode = 'time', now = Date.now(), showDetails = false, order = 'oldest', linkRows = false, repositoryUrl }) {
  return (
    <ol className={`session-commit-list session-commit-list-${mode}`} aria-label="Session commits">
      {orderCommits(commits, order).map((commit) => {
        const message = commit.message?.split('\n')[0] || 'Commit message unavailable';
        const href = commit.htmlUrl || (repositoryUrl && commit.sha ? `${repositoryUrl}/commit/${commit.sha}` : null);
        const time = <time dateTime={commit.timestamp || undefined}>{formatTimestamp(commit.timestamp, timestampMode, now)}</time>;
        const sha = <code translate="no">{commit.sha?.slice(0, 7) || 'Unknown SHA'}</code>;

        if (linkRows && href) {
          return (
            <li key={commit.sha}>
              <a className="session-commit-row-main session-commit-row-link" href={href} target="_blank" rel="noreferrer" title="View commit on GitHub">
                <code translate="no">{commit.sha?.slice(0, 7) || 'Unknown SHA'}<span aria-hidden="true"> ↗</span></code>
                <strong>{message}</strong>
                {time}
              </a>
            </li>
          );
        }

        return (
          <li key={commit.sha}>
            <div className="session-commit-row-main">
              {sha}
              <strong>{href ? <a href={href} target="_blank" rel="noreferrer">{message}</a> : message}</strong>
              {time}
            </div>
            {showDetails && (
              <div className="session-commit-row-details">
                <small>
                  {commit.author?.name || commit.author?.login || 'Unknown author'}
                  {commit.committer?.name && commit.committer.name !== commit.author?.name ? ` · committed by ${commit.committer.name}` : ''}
                </small>
                {commit.files?.length > 0 && <small className="session-commit-files">{commit.files.map(({ filename }) => filename).join(' · ')}</small>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
