import React, { useState } from 'react';
import EditableGoal from '../../../../components/sessions/EditableGoal.jsx';
import ScrollArea from '../../../../components/layout/ScrollArea.jsx';
import SessionCommitList from '../../../../components/sessions/SessionCommitList.jsx';
import { formatElapsed, formatRelativeTime, getActiveElapsedMs } from '../../../../sessions/sessionHelpers.js';
import RepositoryName from '../../../../components/repository/RepositoryName.jsx';
import RepositoryLanguage from '../../../../components/repository/RepositoryLanguage.jsx';

// "12s ago", "3m ago": compact enough to sit under the timer.
// Sits under the GitHub activity heading, so it doesn't repeat "GitHub" except where it reads oddly without it.
function syncLabel(status, isEnding, checkedAt, now) {
  if (isEnding) return 'Syncing final activity…';
  if (status === 'error') return 'Couldn’t reach GitHub · retrying';
  if (checkedAt) return `Checked ${formatRelativeTime(checkedAt, now)}`;
  return 'Checking GitHub…';
}

function CancelSession({ onCancel, disabled }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button className="cancel-session-button" type="button" onClick={() => setConfirming(true)} disabled={disabled}>Cancel session</button>;
  }
  return (
    <div className="cancel-session-confirm" role="group" aria-label="Confirm cancelling this session">
      <span>Discard without saving?</span>
      <button className="cancel-session-button danger" type="button" onClick={onCancel}>Discard</button>
      <button className="cancel-session-button" type="button" onClick={() => setConfirming(false)}>Keep going</button>
    </div>
  );
}

export default function ActiveSession({ session, now, onFinish, onCancel, onUpdateGoal, isEnding, endingAt }) {
  const elapsedEnd = isEnding && endingAt ? new Date(endingAt).getTime() : now;
  const elapsed = formatElapsed(getActiveElapsedMs(session, elapsedEnd));
  const commits = session.commits || [];
  const activityStatus = session.activitySyncStatus || 'loading';
  const repository = session.repository;

  return (
    <section className="session-workspace-already-active" aria-label="Active coding session">
      {/* Left: what you declared (the session and its controls). Right: what GitHub observed. */}
      <div className="session-console-panel">
        <span className="session-console-status"><i aria-hidden="true" /> ACTIVE SESSION</span>
        <div className="session-console-timer" aria-label={`Elapsed time ${elapsed}`}>
          <span className="session-console-time">{elapsed}</span>
        </div>
        <div className="session-console-context">
          <p className="session-console-repo"><RepositoryName repository={repository} /></p>
          <EditableGoal as="h2" goal={session.goal} onSave={isEnding ? undefined : onUpdateGoal} />
          {repository.language && <p className="session-console-meta"><RepositoryLanguage language={repository.language} /></p>}
        </div>
        <div className="session-console-actions">
          <a className="continue-session-button" href={repository.html_url} target="_blank" rel="noreferrer">View repository <span aria-hidden="true">↗</span></a>
          {onCancel && !isEnding && <CancelSession onCancel={onCancel} />}
          <button className="finish-session-button" type="button" onClick={onFinish} disabled={isEnding}>
            {isEnding ? 'Syncing final activity…' : 'End Session'}
          </button>
        </div>
      </div>

      <section className="session-console-activity" aria-labelledby="session-console-activity-heading" aria-live="polite">
        <div className="session-console-activity-heading">
          <div>
            <h3 id="session-console-activity-heading">GitHub activity</h3>
            <span className="session-console-sync" data-status={isEnding ? 'ending' : activityStatus}><i aria-hidden="true" /> {syncLabel(activityStatus, isEnding, session.activityCheckedAt, now)}</span>
          </div>
          <span className="session-console-count"><strong>{commits.length}</strong> {commits.length === 1 ? 'commit' : 'commits'}</span>
        </div>
        {commits.length ? (
          <ScrollArea watch={commits.length}>
            <SessionCommitList commits={commits} mode="active" timestampMode="relative" now={now} order="newest" linkRows repositoryUrl={repository.html_url} />
          </ScrollArea>
        ) : (
          <div className="session-console-empty">
            <strong>{activityStatus === 'loading' ? 'Checking GitHub for session commits…' : 'Waiting for GitHub activity…'}</strong>
            <p>Commits you push to <RepositoryName repository={repository} /> during this session will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
