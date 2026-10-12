import React, { useState } from 'react';
import EditableGoal from '../../../../components/sessions/EditableGoal.jsx';
import ScrollArea from '../../../../components/layout/ScrollArea.jsx';
import SessionCommitList from '../../../../components/sessions/SessionCommitList.jsx';
import { formatElapsed } from '../../../../sessions/sessionHelpers.js';

// "12s ago", "3m ago": compact enough to sit under the timer.
function shortAgo(value, now) {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// Sits under the GitHub activity heading, so it doesn't repeat "GitHub" except where it reads oddly without it.
function syncLabel(status, isEnding, checkedAt, now) {
  if (isEnding) return 'Syncing final activity…';
  if (status === 'error') return 'Couldn’t reach GitHub · retrying';
  if (checkedAt) return `Checked ${shortAgo(checkedAt, now)}`;
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
  const elapsed = formatElapsed(elapsedEnd - new Date(session.startedAt).getTime());
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
          <p className="session-console-repo">{repository.full_name || repository.name}</p>
          <EditableGoal as="h2" goal={session.goal} onSave={isEnding ? undefined : onUpdateGoal} />
          {repository.language && <p className="session-console-meta">{repository.language}</p>}
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
            <p>Commits you push to {repository.name} during this session will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
