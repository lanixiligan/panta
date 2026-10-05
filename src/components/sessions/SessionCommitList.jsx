import React from 'react';

function formatTimestamp(value, mode, now) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';

  if (mode === 'relative') {
    const seconds = Math.round((date.getTime() - now) / 1000);
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
    if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
    if (Math.abs(seconds) < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour');
    return formatter.format(Math.round(seconds / 86_400), 'day');
  }

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

export default function SessionCommitList({ commits = [], mode = 'recap', timestampMode = 'time', now = Date.now(), showDetails = false, order = 'oldest' }) {
  return (
    <ol className={`session-commit-list session-commit-list-${mode}`} aria-label="Session commits">
      {orderCommits(commits, order).map((commit) => (
        <li key={commit.sha}>
          <div className="session-commit-row-main">
            <code>{commit.sha?.slice(0, 7) || 'Unknown SHA'}</code>
            <strong>
              {commit.htmlUrl
                ? <a href={commit.htmlUrl} target="_blank" rel="noreferrer">{commit.message?.split('\n')[0] || 'Commit message unavailable'}</a>
                : (commit.message?.split('\n')[0] || 'Commit message unavailable')}
            </strong>
            <time dateTime={commit.timestamp || undefined}>{formatTimestamp(commit.timestamp, timestampMode, now)}</time>
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
      ))}
    </ol>
  );
}
