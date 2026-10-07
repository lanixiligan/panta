import React from 'react';
import SessionCommitList from './SessionCommitList.jsx';

export function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function relativeTime(value, now) {
  if (!value) return '';
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  return formatter.format(Math.round(seconds / 3600), 'hour');
}

export default function ActiveSessionCard({ session, now, onFinish, isEnding = false, endingAt }) {
  const elapsedEnd = isEnding && endingAt ? new Date(endingAt).getTime() : now;
  const elapsed = elapsedEnd - new Date(session.startedAt).getTime();
  const commits = session.commits || [];
  const activityStatus = session.activitySyncStatus || 'loading';

  return (
    <section className="active-session-card" aria-label="Active coding session">
      <div className="session-card-topline">
        <span className="section-kicker">ACTIVE SESSION</span>
        <span className="active-status"><i /> LIVE</span>
      </div>
      <div className="active-session-content">
        <div className="active-session-copy">
          <p className="active-repository-label">{session.repository.full_name || session.repository.name}</p>
          {session.goal && <h2 id="active-session-heading">{session.goal}</h2>}
          <p className="active-session-intention">One repository. One thing at a time.</p>
          <div className="active-session-meta">
            {session.repository.language && <span>{session.repository.language}</span>}
          </div>
        </div>
        <div className="session-timer" aria-label={`Elapsed time ${formatElapsed(elapsed)}`}>
          <span>{formatElapsed(elapsed)}</span>
          <small>ELAPSED</small>
        </div>
      </div>
      <section className="active-session-activity" aria-label="GitHub activity" aria-live="polite">
        <div className="active-session-activity-heading">
          <span className="section-kicker">GITHUB ACTIVITY</span>
          <span className={`active-status${activityStatus === 'syncing' || activityStatus === 'loading' ? ' syncing' : ''}`}>
            <i /> {activityStatus === 'error' ? 'RETRYING' : activityStatus === 'syncing' || activityStatus === 'loading' ? 'SYNCING' : 'LIVE'}
          </span>
        </div>
        {commits.length ? (
          <SessionCommitList commits={commits} mode="active" timestampMode="relative" now={now} order="newest" />
        ) : (
          <p className="active-session-activity-empty">{activityStatus === 'loading' ? 'Checking GitHub for session commits…' : 'Waiting for GitHub activity…'}</p>
        )}
        <div className="active-session-activity-footer">
          {activityStatus === 'error'
            ? <span className="active-session-activity-error">Unable to refresh GitHub activity. Retrying automatically.</span>
            : session.activityCheckedAt && <span>Last checked {relativeTime(session.activityCheckedAt, now)}</span>}
          {commits.length > 0 && <span>{commits.length} {commits.length === 1 ? 'commit' : 'commits'}</span>}
        </div>
      </section>
      <div className="active-session-actions">
        <a className="continue-session-button" href={session.repository.html_url} target="_blank" rel="noreferrer">Continue in repository <span aria-hidden="true">↗</span></a>
        <button className="finish-session-button" type="button" onClick={onFinish} disabled={isEnding}>
          {isEnding ? 'Syncing final activity…' : 'End Session'}
        </button>
      </div>
    </section>
  );
}
