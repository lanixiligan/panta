import React from 'react';
import SessionCommitList from '../../../../components/sessions/SessionCommitList.jsx';
import { formatElapsed, relativeTime } from '../../../../components/sessions/ActiveSessionCard.jsx';

function syncLabel(status, isEnding) {
  if (isEnding) return 'Syncing final activity';
  if (status === 'error') return 'Retrying GitHub sync';
  if (status === 'loading' || status === 'syncing') return 'Syncing with GitHub';
  return 'Tracking GitHub activity';
}

export default function ActiveSession({ session, now, onFinish, isEnding, endingAt }) {
  const elapsedEnd = isEnding && endingAt ? new Date(endingAt).getTime() : now;
  const elapsed = formatElapsed(elapsedEnd - new Date(session.startedAt).getTime());
  const commits = session.commits || [];
  const activityStatus = session.activitySyncStatus || 'loading';
  const repository = session.repository;

  return (
    <section className="session-workspace-already-active" aria-label="Active coding session">
      <div className="session-console-hero">
        <span className="session-console-status"><i aria-hidden="true" /> ACTIVE SESSION</span>
        <div className="session-console-context">
          <p className="session-console-repo">{repository.full_name || repository.name}</p>
          <h2>{session.goal || repository.name}</h2>
          <div className="session-console-meta">
            {repository.language && <span>{repository.language}</span>}
            <span>One repository. One thing at a time.</span>
          </div>
        </div>
        <div className="session-console-timer" aria-label={`Elapsed time ${elapsed}`}>
          <span className="session-console-time">{elapsed}</span>
          <span className="session-console-sync" data-status={isEnding ? 'ending' : activityStatus}><i aria-hidden="true" /> {syncLabel(activityStatus, isEnding)}</span>
        </div>
      </div>

      <section className="session-console-activity" aria-labelledby="session-console-activity-heading" aria-live="polite">
        <div className="session-console-activity-heading">
          <div><span className="section-kicker">GITHUB ACTIVITY</span><h3 id="session-console-activity-heading">Observed during this session</h3></div>
          <span className="session-console-count"><strong>{commits.length}</strong> {commits.length === 1 ? 'commit' : 'commits'}</span>
        </div>
        {commits.length ? (
          <SessionCommitList commits={commits} mode="active" timestampMode="relative" now={now} order="newest" />
        ) : (
          <div className="session-console-empty">
            <strong>{activityStatus === 'loading' ? 'Checking GitHub for session commits…' : 'Waiting for GitHub activity…'}</strong>
            <p>Commits you push to {repository.name} during this session will appear here.</p>
          </div>
        )}
        <p className="session-console-checked">
          {activityStatus === 'error'
            ? <span className="active-session-activity-error">Unable to refresh GitHub activity. Retrying automatically.</span>
            : session.activityCheckedAt && <>Last checked {relativeTime(session.activityCheckedAt, now)}</>}
        </p>
      </section>

      <div className="session-console-actions">
        <a className="continue-session-button" href={repository.html_url} target="_blank" rel="noreferrer">Continue in repository <span aria-hidden="true">↗</span></a>
        <button className="finish-session-button" type="button" onClick={onFinish} disabled={isEnding}>
          {isEnding ? 'Syncing final activity…' : 'End Session'}
        </button>
      </div>
    </section>
  );
}
