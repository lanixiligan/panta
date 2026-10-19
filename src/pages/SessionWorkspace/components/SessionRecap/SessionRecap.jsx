import React from 'react';
import ScrollArea from '../../../../components/layout/ScrollArea.jsx';
import SessionCommitList from '../../../../components/sessions/SessionCommitList.jsx';
import { followRouteLink, sessionDetailPath } from '../../../../routing.js';
import { getSessionDurationMinutes } from '../../../../sessions/sessionHelpers.js';
import RepositoryName from '../../../../components/repository/RepositoryName.jsx';

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDay(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatDuration(durationMinutes) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

// Same frame as the active session: the finished session on the left (declared), GitHub activity on the right (observed).
export default function SessionRecap({ session, onViewSession, onStartAnother, onRetryActivity }) {
  const activity = session.activity || {};
  const activityReady = session.activityStatus === 'complete';
  const commits = session.commits || [];
  const repository = session.repository;
  const duration = formatDuration(getSessionDurationMinutes(session));
  const day = formatDay(session.startedAt);
  const range = [formatTime(session.startedAt), formatTime(session.endedAt)];
  // Files and lines come from commit details. With commits but no details, they were never recorded; zero commits is a recorded 0.
  const detailsRecorded = commits.length === 0 || commits.some((commit) => Array.isArray(commit.files));
  const unavailable = <span className="is-unavailable">Unavailable</span>;

  return (
    <article className="session-workspace-already-active session-recap" aria-label="Completed coding session">
      <div className="session-console-panel">
        <span className="session-console-status is-complete"><i aria-hidden="true">✓</i> SESSION COMPLETE</span>
        <div className="session-console-timer" aria-label={`Session time ${duration}`}>
          <span className="session-console-time">{duration}</span>
        </div>
        <div className="session-console-context">
          <p className="session-console-repo"><RepositoryName repository={repository} /></p>
          {session.goal && <h2>{session.goal}</h2>}
          {day && <p className="session-console-meta">{day}{range[0] && range[1] && <> · {range[0]} <span aria-hidden="true">–</span> {range[1]}</>}</p>}
        </div>
        {activityReady && (
          <dl className="session-recap-stats">
            <div><dt>{commits.length === 1 ? 'Commit' : 'Commits'}</dt><dd>{commits.length}</dd></div>
            <div><dt>{activity.filesChanged === 1 ? 'File changed' : 'Files changed'}</dt><dd>{detailsRecorded ? activity.filesChanged ?? 0 : unavailable}</dd></div>
            <div aria-label={detailsRecorded ? `${activity.additions ?? 0} lines added and ${activity.deletions ?? 0} lines deleted` : undefined}>
              <dt>Lines</dt>
              <dd>{detailsRecorded ? <><span className="history-additions">+{activity.additions ?? 0}</span> <span className="history-deletions">−{activity.deletions ?? 0}</span></> : unavailable}</dd>
            </div>
          </dl>
        )}
        <div className="session-console-actions">
          <a className="continue-session-button" href={sessionDetailPath(session.id)} onClick={(event) => followRouteLink(event, () => onViewSession(session.id))}>View session <span aria-hidden="true">→</span></a>
          <button className="session-workspace-button session-recap-next" type="button" onClick={onStartAnother}>Start another session</button>
        </div>
      </div>

      <section className="session-console-activity" aria-labelledby="session-recap-activity-heading">
        <div className="session-console-activity-heading">
          <h3 id="session-recap-activity-heading">GitHub activity</h3>
        </div>
        {session.activityStatus === 'loading' && (
          <p className="session-recap-state" role="status"><span className="dashboard-spinner" />Retrieving GitHub activity…</p>
        )}
        {session.activityStatus === 'error' && (
          <div className="dashboard-error session-recap-state" role="alert">
            <span>{session.activityError || 'GitHub activity could not be retrieved.'}</span>
            <button type="button" onClick={() => onRetryActivity(session)}>Try again</button>
          </div>
        )}
        {activityReady && (commits.length ? (
          <ScrollArea watch={commits.length}>
            <SessionCommitList commits={commits} mode="active" timestampMode="time" order="newest" linkRows repositoryUrl={repository.html_url} />
          </ScrollArea>
        ) : (
          <p className="session-recap-state">No commits</p>
        ))}
      </section>
    </article>
  );
}
