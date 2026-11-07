import React, { useEffect, useId, useRef, useState } from 'react';
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

// Ending stops the clock for good, and discarding deletes the session, so each asks first in a modal. "Keep going" takes
// focus, so Enter can't confirm by accident; Escape, a click outside, or Keep going closes it, and the browser returns focus
// to the button that opened it.
const EXIT_QUESTIONS = {
  end: { title: 'End this session?', detail: 'The timer stops and the session’s GitHub activity is saved.', confirm: 'End session', className: 'finish-session-button' },
  discard: { title: 'Discard this session?', detail: 'Nothing from this session will be saved.', confirm: 'Discard', className: 'cancel-session-button danger' },
};

function SessionExitDialog({ kind, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const question = EXIT_QUESTIONS[kind];

  // No close() on cleanup: its queued close event would unmount the dialog again after StrictMode's remount.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  const close = () => dialogRef.current.close();
  return (
    <dialog
      ref={dialogRef}
      className="session-exit-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <h2 id={titleId}>{question.title}</h2>
      <p>{question.detail}</p>
      <div className="session-exit-dialog-buttons">
        <button className="cancel-session-button" type="button" autoFocus onClick={close}>Keep going</button>
        <button className={question.className} type="button" onClick={() => { close(); onConfirm(); }}>{question.confirm}</button>
      </div>
    </dialog>
  );
}

function SessionExit({ onFinish, onCancel, isEnding }) {
  const [asking, setAsking] = useState(null);
  return (
    <>
      <button className="finish-session-button" type="button" onClick={() => setAsking('end')} disabled={isEnding}>{isEnding ? 'Ending…' : 'End session'}</button>
      {onCancel && !isEnding && <button className="cancel-session-button" type="button" onClick={() => setAsking('discard')}>Discard session</button>}
      {asking && (
        <SessionExitDialog
          kind={asking}
          onConfirm={asking === 'end' ? onFinish : onCancel}
          onClose={() => setAsking(null)}
        />
      )}
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
          <span className="session-console-status"><i aria-hidden="true" /> Active session</span>
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
