import React from 'react';
import SessionCommitList from './SessionCommitList.jsx';

function repositoryFullName(repository) {
  return repository.fullName || repository.full_name || `${repository.owner?.login || repository.owner}/${repository.name}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDuration(startedAt, endedAt) {
  const durationMinutes = Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

export default function SessionCompleteCard({ session, onViewSession, onStartAnother, onRetryActivity }) {
  const activity = session.activity || {};
  const activityReady = session.activityStatus === 'complete';
  const commits = session.commits || [];
  const commitCount = activity.commits ?? session.commits?.length ?? 0;
  const filesChanged = activity.filesChanged ?? 0;
  const additions = activity.additions ?? 0;
  const deletions = activity.deletions ?? 0;

  return (
    <article className="session-complete-card">
      <header className="session-complete-heading">
        <div>
          <div className="session-complete-topline">
            <span className="session-complete-label"><i aria-hidden="true" /> SESSION COMPLETE</span>
            <span className="session-history-status completed">✓ COMPLETE</span>
            <span className="session-complete-id">SESSION ID <code>{session.id}</code></span>
          </div>
          <h2>{session.repository.name}</h2>
          <p className="session-complete-repository">{repositoryFullName(session.repository)}</p>
          {session.goal && <p className="session-complete-goal">{session.goal}</p>}
          <p className="session-complete-time">
            {formatDateTime(session.startedAt)} <span aria-hidden="true">–</span> {formatDateTime(session.endedAt)}
            <strong>{formatDuration(session.startedAt, session.endedAt)}</strong>
          </p>
        </div>
      </header>

      <section className="session-complete-activity" aria-labelledby="session-complete-activity-heading">
        <div className="dashboard-section-heading">
          <div><span className="section-kicker">GITHUB ACTIVITY</span><h3 id="session-complete-activity-heading">During this session</h3></div>
        </div>
        {session.activityStatus === 'loading' && (
          <p className="session-complete-activity-state" role="status"><span className="dashboard-spinner" />Retrieving GitHub activity…</p>
        )}
        {session.activityStatus === 'error' && (
          <div className="dashboard-error session-complete-activity-state" role="alert">
            <span>{session.activityError || 'GitHub activity could not be retrieved.'}</span>
            <button type="button" onClick={() => onRetryActivity(session)}>Try again</button>
          </div>
        )}
        {activityReady && (
          <>
            <div className="session-complete-metrics">
              <span><strong>{commitCount}</strong> {commitCount === 1 ? 'commit' : 'commits'}</span>
              <span><strong>{filesChanged}</strong> {filesChanged === 1 ? 'file changed' : 'files changed'}</span>
            </div>
            <div className="session-complete-diff" role="group" aria-label={`${additions} lines added and ${deletions} lines deleted`}>
              <span className="session-complete-diff-label">changes</span>
              <span className="session-complete-additions">+{additions}</span>
              <span className="session-complete-diff-separator" aria-hidden="true">/</span>
              <span className="session-complete-deletions">−{deletions}</span>
            </div>
            {commits.length > 0 ? (
              <div className="session-complete-commits">
                <span className="section-kicker">COMMITS</span>
                <SessionCommitList commits={commits} mode="recap" timestampMode="time" order="oldest" />
              </div>
            ) : (
              <p className="session-complete-no-commits">No GitHub commits were recorded during this session.</p>
            )}
          </>
        )}
      </section>

      <p className="session-complete-note">Session duration is the time you chose to work. GitHub activity is what GitHub recorded during that timeframe; it is not an exact measure of coding time.</p>
      <div className="session-complete-actions">
        <button className="subtle-action" type="button" onClick={() => onViewSession(session.id)}>View session <span aria-hidden="true">→</span></button>
        <button className="start-session-button" type="button" onClick={onStartAnother}>Start another session</button>
      </div>
    </article>
  );
}
