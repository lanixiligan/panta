import React, { useLayoutEffect, useRef } from 'react';
import { followRouteLink, routePaths } from '../../../routing.js';
import RepositoryName from '../../../components/repository/RepositoryName.jsx';
import { formatCount } from '../../../sessions/sessionHelpers.js';

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

function formatDate(value, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function followSessionLink(event, onSelect, sessionId) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onSelect(sessionId);
}

export function WeeklySummary({ summary }) {
  const metrics = [
    { label: 'Sessions', value: summary.sessionCount },
    { label: 'Session time', value: summary.sessionCount ? formatDuration(summary.sessionMinutes) : '0m' },
    { label: 'Commits', value: summary.commitCount ?? '—', title: summary.commitCount === null ? 'No GitHub activity recorded this week' : undefined },
    { label: 'Repositories', value: summary.repositoryCount },
  ];

  return (
    <section className="dashboard-section weekly-strip" aria-labelledby="weekly-heading">
      <div className="weekly-strip-heading">
        <h2 id="weekly-heading">This week</h2>
        <span className="dashboard-section-meta">
          {formatDate(summary.start, { month: 'short', day: 'numeric' })} – {formatDate(summary.end, { month: 'short', day: 'numeric' })}
          {summary.includesExamples && ' · includes examples'}
        </span>
      </div>
      <dl className="weekly-metrics">
        {metrics.map((metric) => <div className="weekly-metric" key={metric.label} title={metric.title}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
      </dl>
    </section>
  );
}

function RecentSessionRow({ session, onSelect }) {
  const status = session.activityStatus === 'loading'
    ? 'Fetching GitHub…'
    : session.activityStatus === 'error' || !session.hasActivity
      ? 'Activity unavailable'
      : session.commitCount === 0 ? 'No commits' : formatCount(session.commitCount, 'commit');

  return (
    <a className="recent-session-row" href={session.detailHref} onClick={(event) => followSessionLink(event, onSelect, session.id)}>
      <span className="recent-session-main">
        {/* Without a goal, the repository leads the row instead of a "No goal set" placeholder. */}
        <span className={`recent-session-goal${session.goal ? '' : ' is-repo'}`}>{session.goal || <RepositoryName name={session.repositoryFullName || session.repositoryName} />}</span>
        <span className="recent-session-meta">
          {session.goal && <><RepositoryName className="recent-session-repo" name={session.repositoryFullName || session.repositoryName} /><span aria-hidden="true">·</span></>}
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          {session.isPlaceholder && <span className="session-source-badge">Example</span>}
        </span>
      </span>
      <span className="recent-session-commits">{status}</span>
      <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
    </a>
  );
}

// Hides rows that would be cut off at the bottom of the list, so a window-fitted list only shows whole rows.
// `rowsKey` changes when the rows do (not on every render), so new or reordered rows are measured again.
function useWholeRows(listRef, rowsKey) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => {
      const bottom = list.getBoundingClientRect().bottom;
      [...list.children].forEach((row) => {
        const fits = row.getBoundingClientRect().bottom <= bottom + 1;
        row.style.visibility = fits ? '' : 'hidden';
        if (fits) row.removeAttribute('aria-hidden');
        else row.setAttribute('aria-hidden', 'true');
        row.tabIndex = fits ? 0 : -1;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, rowsKey]);
}

export function RecentSessions({ sessions = [], onViewAll, onSelectSession }) {
  const listRef = useRef(null);
  useWholeRows(listRef, sessions.map((session) => session.id).join());
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <h2 id="recent-heading">Recent sessions</h2>
        {sessions.length > 0 && <a className="text-link" href={routePaths['Session History']} onClick={(event) => followRouteLink(event, () => onViewAll())}>View all <span aria-hidden="true">→</span></a>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list" ref={listRef}>{sessions.map((session) => <RecentSessionRow key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌁</span>
          <div><span className="section-kicker">NO SESSIONS YET</span><h3>Your first coding session starts here.</h3><p>Start a session to build your development history.</p></div>
        </div>
      )}
    </section>
  );
}
