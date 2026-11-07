import React from 'react';
import { formatRelativeTime, getBranchSummary, getOtherBranches } from '../../sessions/sessionHelpers.js';

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

// Commits arrive newest first in GitHub's history order, and commits made in the same second (a rebase, say) keep that
// order through the stable sort, so oldest first is the reverse rather than a second sort, which would leave ties backwards.
export function orderCommits(commits = [], direction = 'newest') {
  const newest = [...commits].sort((left, right) => Date.parse(right.timestamp || 0) - Date.parse(left.timestamp || 0));
  return direction === 'oldest' ? newest.reverse() : newest;
}

// `linkRows` makes each whole row the link to the commit on GitHub (the active session); otherwise only the message links.
// `repositoryUrl` fills in the link for commits that arrived without one.
// In the active list, a commit found only on branches other than the session's main one shows those branch names, as on the
// session detail page; a session on one branch shows none.
export default function SessionCommitList({ commits = [], mode = 'recap', timestampMode = 'time', now = Date.now(), showDetails = false, order = 'oldest', linkRows = false, repositoryUrl }) {
  const primaryBranch = mode === 'active' ? getBranchSummary(commits)[0]?.name : undefined;
  return (
    <ol className={`session-commit-list session-commit-list-${mode}`} aria-label="Session commits">
      {orderCommits(commits, order).map((commit) => {
        const message = commit.message?.split('\n')[0] || 'Commit message unavailable';
        const href = commit.htmlUrl || (repositoryUrl && commit.sha ? `${repositoryUrl}/commit/${commit.sha}` : null);
        const time = <time dateTime={commit.timestamp || undefined}>{formatTimestamp(commit.timestamp, timestampMode, now)}</time>;
        const sha = <code translate="no">{commit.sha?.slice(0, 7) || 'Unknown SHA'}</code>;
        const otherBranches = primaryBranch ? getOtherBranches(commit, primaryBranch) : [];
        const branchTags = otherBranches.length > 0 && (
          <span className="session-commit-branches">
            {otherBranches.map((branch) => <code key={branch} title={branch} translate="no">{branch}</code>)}
          </span>
        );
        const rowClass = `session-commit-row-main${branchTags ? ' has-branch' : ''}`;

        if (linkRows && href) {
          return (
            <li key={commit.sha}>
              <a className={`${rowClass} session-commit-row-link`} href={href} target="_blank" rel="noreferrer" title="View commit on GitHub">
                <code translate="no">{commit.sha?.slice(0, 7) || 'Unknown SHA'}<span aria-hidden="true"> ↗</span></code>
                <strong>{message}</strong>
                {branchTags}
                {time}
              </a>
            </li>
          );
        }

        return (
          <li key={commit.sha}>
            <div className={rowClass}>
              {sha}
              <strong>{href ? <a href={href} target="_blank" rel="noreferrer">{message}</a> : message}</strong>
              {branchTags}
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
