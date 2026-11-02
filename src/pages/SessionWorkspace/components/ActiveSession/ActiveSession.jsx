import React, { useEffect, useRef, useState } from 'react';
import EditableGoal from '../../../../components/sessions/EditableGoal.jsx';
import ScrollArea from '../../../../components/layout/ScrollArea.jsx';
import SessionCommitList from '../../../../components/sessions/SessionCommitList.jsx';
import { formatCount, formatElapsed, formatRelativeTime, getActiveElapsedMs } from '../../../../sessions/sessionHelpers.js';
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

// Ending stops the clock for good, and discarding deletes the session, so each asks first, in place. Only one question is
// open at a time; "Keep going" takes focus, so Enter can't confirm by accident, and returns it to the button that asked.
function SessionExit({ onFinish, onCancel, isEnding }) {
  const [asking, setAsking] = useState(null);
  const keepGoing = useRef(null);
  const triggers = useRef({});
  const lastAsked = useRef(null);
  useEffect(() => {
    if (asking) {
      lastAsked.current = asking;
      keepGoing.current?.focus();
    } else if (lastAsked.current) {
      triggers.current[lastAsked.current]?.focus();
      lastAsked.current = null;
    }
  }, [asking]);
  const confirm = (action) => () => { setAsking(null); action(); };

  if (asking) {
    const ending = asking === 'end';
    return (
      <div className="session-exit-confirm" role="group" aria-label={ending ? 'Confirm ending this session' : 'Confirm discarding this session'}>
        <span>{ending ? 'End this session?' : 'Discard without saving?'}</span>
        <span className="session-exit-buttons">
          <button className={ending ? 'finish-session-button' : 'cancel-session-button danger'} type="button" onClick={confirm(ending ? onFinish : onCancel)}>{ending ? 'End session' : 'Discard'}</button>
          <button ref={keepGoing} className="cancel-session-button" type="button" onClick={() => setAsking(null)}>Keep going</button>
        </span>
      </div>
    );
  }
  return (
    <>
      <button ref={(node) => { triggers.current.end = node; }} className="finish-session-button" type="button" onClick={() => setAsking('end')} disabled={isEnding}>{isEnding ? 'Ending…' : 'End session'}</button>
      {onCancel && !isEnding && <button ref={(node) => { triggers.current.discard = node; }} className="cancel-session-button" type="button" onClick={() => setAsking('discard')}>Discard session</button>}
    </>
  );
}

// `error` is { message, onRetry? }: a failed finish or cancel (its own button tries again), or a goal that couldn't be saved.
export default function ActiveSession({ session, now, onFinish, onCancel, onUpdateGoal, isEnding, endingAt, error = null }) {
  const elapsedEnd = isEnding && endingAt ? new Date(endingAt).getTime() : now;
  const elapsed = formatElapsed(getActiveElapsedMs(session, elapsedEnd));
  const commits = session.commits || [];
  const activityStatus = session.activitySyncStatus || 'loading';
  const repository = session.repository;

  return (
    <section className="session-workspace-already-active" aria-label="Active coding session">
      {/* Left: what you declared (the session and its controls). Right: what GitHub observed. */}
      <div className="session-console-panel">
        <div className="session-console-clock">
          <span className="session-console-status"><i aria-hidden="true" /> ACTIVE SESSION</span>
          <div className="session-console-timer" role="timer" aria-label="Elapsed time">
            <span className="session-console-time">{elapsed}</span>
          </div>
        </div>
        <div className="session-console-context">
          <p className="session-console-repo"><RepositoryName repository={repository} /></p>
          <EditableGoal as="h2" goal={session.goal} onSave={isEnding ? undefined : onUpdateGoal} />
          <p className="session-console-meta session-console-meta-row">
            {repository.language && <RepositoryLanguage language={repository.language} />}
            <a className="text-link" href={repository.html_url} target="_blank" rel="noreferrer">View repository <span aria-hidden="true">↗</span></a>
          </p>
        </div>
        <div className="session-console-actions">
          <SessionExit onFinish={onFinish} onCancel={onCancel} isEnding={isEnding} />
        </div>
        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error.message}</span>
            {error.onRetry && <button type="button" onClick={error.onRetry}>Try again</button>}
          </div>
        )}
      </div>

      <section className="session-console-activity" aria-labelledby="session-console-activity-heading">
        {/* The one live announcement: the commit count when it changes, or that GitHub can't be reached. The timer and the relative times stay silent. */}
        <p className="visually-hidden" role="status">{activityStatus === 'error' ? 'Couldn’t reach GitHub, retrying' : formatCount(commits.length, 'commit')}</p>
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
            <strong>{activityStatus === 'loading' ? 'Checking GitHub for session commits…' : 'No commits yet'}</strong>
            <p>Commits you push to <RepositoryName repository={repository} /> during this session will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
