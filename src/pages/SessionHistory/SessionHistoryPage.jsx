import React, { useMemo, useState } from 'react';
import ActiveSessionCard from '../../components/sessions/ActiveSessionCard.jsx';

const sortOptions = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['longest', 'Longest session'],
  ['shortest', 'Shortest session'],
];

function formatDateTime(value, options) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatDuration(minutes = 0) {
  if (minutes < 1) return 'Under 1m';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function SessionHistoryEntry({ session, onSelectSession }) {
  const startTime = formatDateTime(session.startedAt, { hour: 'numeric', minute: '2-digit' });
  const endTime = formatDateTime(session.finishedAt, { hour: 'numeric', minute: '2-digit' });
  const date = formatDateTime(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' });
  const activitySummary = session.hasActivity
    ? [
        formatCount(session.commitCount, 'commit'),
        formatCount(session.filesChanged, 'file changed', 'files changed'),
        <span key="changes"><span className="history-additions">+{session.additions}</span> / <span className="history-deletions">−{session.deletions}</span></span>,
      ]
    : null;

  return (
    <article className="session-history-entry">
      <div className="session-history-entry-main">
        <div className="session-history-entry-heading">
          <div className="session-history-repository">
            <h2>{session.repositoryName}</h2>
            {session.repositoryFullName && session.repositoryFullName !== session.repositoryName && (
              <span>{session.repositoryFullName}</span>
            )}
          </div>
          <span className={`session-history-status ${session.status === 'completed' ? 'completed' : ''}`}>
            {session.status === 'completed' && <span aria-hidden="true">✓ </span>}
            {session.status || 'unknown'}
          </span>
        </div>

        {session.goal && <p className="session-history-goal">{session.goal}</p>}

        <div className="session-history-when">
          <time dateTime={session.startedAt}>{date}{startTime ? ` · ${startTime}` : ''}</time>
          {endTime && <><span aria-hidden="true"> – </span><time dateTime={session.finishedAt}>{endTime}</time></>}
          <span className="session-history-duration">{formatDuration(session.durationMinutes)}</span>
        </div>

        <div className="session-history-activity" aria-label="GitHub activity summary">
          {activitySummary ? activitySummary.map((item, index) => <span key={index}>{item}</span>) : (
            <span className="session-history-activity-note">
              {session.activityStatus === 'loading' ? 'Retrieving GitHub activity…' : 'GitHub activity unavailable'}
            </span>
          )}
        </div>
      </div>

      <div className="session-history-entry-aside">
        <span className={`session-history-origin ${session.isPlaceholder ? 'example' : ''}`}>
          {session.isPlaceholder ? 'EXAMPLE SESSION' : 'GITHUB ACTIVITY'}
        </span>
        <a
          className="session-history-view-link"
          href={session.detailHref}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onSelectSession(session.id);
          }}
        >
          View session <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

function EmptyHistory({ hasFilters }) {
  return (
    <div className="session-history-empty" role="status">
      <h2>{hasFilters ? 'No sessions match your filters.' : 'No sessions yet.'}</h2>
      {!hasFilters && <p>Start a session and your work will appear here.</p>}
    </div>
  );
}

export default function SessionHistoryPage({ sessions = [], onSelectSession, onBack, activeSession, now, isEndingSession, sessionEndingAt, onFinish }) {
  const [query, setQuery] = useState('');
  const [repository, setRepository] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');

  const repositories = useMemo(() => [...new Set(sessions.map((session) => session.repositoryFullName || session.repositoryName).filter(Boolean))].sort(), [sessions]);
  const statuses = useMemo(() => [...new Set(sessions.map((session) => session.status).filter(Boolean))].sort(), [sessions]);
  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = sessions.filter((session) => {
      const matchesQuery = !normalizedQuery || [session.repositoryName, session.repositoryFullName, session.goal]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      const matchesRepository = repository === 'all' || (session.repositoryFullName || session.repositoryName) === repository;
      const matchesStatus = status === 'all' || session.status === status;
      return matchesQuery && matchesRepository && matchesStatus;
    });

    return result.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.startedAt) - new Date(right.startedAt);
      if (sort === 'longest') return right.durationMinutes - left.durationMinutes;
      if (sort === 'shortest') return left.durationMinutes - right.durationMinutes;
      return new Date(right.startedAt) - new Date(left.startedAt);
    });
  }, [sessions, query, repository, status, sort]);

  const hasFilters = Boolean(query.trim()) || repository !== 'all' || status !== 'all';

  return (
    <div className="sessions-page session-history-page">
      <section className="page-intro">
        <button className="session-history-back" type="button" onClick={onBack}>← Overview</button>
        <div className="session-history-title-row">
          <div>
            <span className="section-kicker">SESSION HISTORY</span>
            <h1>Session History</h1>
            <p>Review the work you've done across your repositories.</p>
          </div>
        </div>
      </section>

      {activeSession && <ActiveSessionCard session={activeSession} now={now} onFinish={onFinish} isEnding={isEndingSession} endingAt={sessionEndingAt} />}

      <section className="session-history-workspace" aria-label="Session history">
        <div className="session-history-toolbar">
          <label className="session-history-search">
            <span>Search sessions</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Repository or goal..."
            />
          </label>
          <label>
            <span>Repository</span>
            <select value={repository} onChange={(event) => setRepository(event.target.value)}>
              <option value="all">All repositories</option>
              {repositories.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((value) => <option value={value} key={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {sortOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="session-history-list-heading">
          <h2>Your sessions</h2>
          <span>{filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}</span>
        </div>

        {filteredSessions.length ? (
          <div className="session-history-list">
            {filteredSessions.map((session) => (
              <SessionHistoryEntry key={session.id} session={session} onSelectSession={onSelectSession} />
            ))}
          </div>
        ) : (
          <EmptyHistory hasFilters={hasFilters || sessions.length > 0} />
        )}
      </section>

      {sessions.some((session) => session.isPlaceholder) && (
        <p className="session-history-boundary">Example sessions are illustrative; their GitHub activity was not retrieved from GitHub.</p>
      )}
    </div>
  );
}
