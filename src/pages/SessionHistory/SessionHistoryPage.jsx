import React, { useEffect, useMemo, useRef, useState } from 'react';
import ActiveSessionCard from '../../components/sessions/ActiveSessionCard.jsx';
import { followRouteLink, routePaths } from '../../routing.js';

const sortOptions = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['longest', 'Longest session'],
  ['shortest', 'Shortest session'],
];
const PAGE_SIZE = 30;
const CHRONOLOGICAL_SORTS = new Set(['newest', 'oldest']);

// Filters, sort, and how many sessions are shown live in the URL, so Back from a session and shared links restore the same view.
function readHistoryParams() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const show = Number.parseInt(params.get('show'), 10);
  return {
    query: params.get('q') || '',
    repository: params.get('repo') || 'all',
    sort: sortOptions.some(([value]) => value === sort) ? sort : 'newest',
    visibleCount: Number.isFinite(show) && show > PAGE_SIZE ? show : PAGE_SIZE,
    collapsed: new Set((params.get('collapsed') || '').split(',').filter((key) => /^\d{4}-\d{2}$/.test(key))),
  };
}

function writeHistoryParams({ query, repository, sort, visibleCount, collapsed }) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (repository !== 'all') params.set('repo', repository);
  if (sort !== 'newest') params.set('sort', sort);
  if (visibleCount > PAGE_SIZE) params.set('show', String(visibleCount));
  if (collapsed.size) params.set('collapsed', [...collapsed].sort().join(','));
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
  if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', url);
}

function monthKey(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
}

// Consecutive sessions from the same month form one group, with that month's session count and declared time.
function groupByMonth(sessions) {
  return sessions.reduce((groups, session) => {
    const key = monthKey(session.startedAt);
    let group = groups[groups.length - 1];
    if (group?.key !== key) {
      group = {
        key,
        title: key === 'unknown' ? 'Unknown date' : formatDateTime(session.startedAt, { month: 'long', year: 'numeric' }),
        sessions: [],
        count: 0,
        minutes: 0,
      };
      groups.push(group);
    }
    group.sessions.push(session);
    group.count += 1;
    group.minutes += session.durationMinutes || 0;
    return groups;
  }, []);
}

// Spends the loaded-session budget on expanded groups in order; collapsed groups show only their heading and cost nothing.
function allocateRows(groups, budget, collapsed) {
  let left = budget;
  const shown = [];
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.key);
    if (!isCollapsed && left <= 0) break;
    const rows = isCollapsed ? [] : group.sessions.slice(0, left);
    left -= rows.length;
    shown.push({ ...group, isCollapsed, rows });
  }
  return shown;
}

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

function RepositoryLabel({ session }) {
  const fullName = session.repositoryFullName || session.repositoryName || 'Unknown repository';
  const slash = fullName.indexOf('/');
  if (slash < 0) return <span className="history-row-repo">{fullName}</span>;
  return (
    <span className="history-row-repo">
      <span className="history-row-repo-owner">{fullName.slice(0, slash + 1)}</span>{fullName.slice(slash + 1)}
    </span>
  );
}

function SessionActivityStats({ session }) {
  if (!session.hasActivity) {
    return (
      <span className="history-row-note">
        {session.activityStatus === 'loading' ? 'Retrieving GitHub activity…' : 'GitHub activity unavailable'}
      </span>
    );
  }
  if (session.commitCount === 0) return <span className="history-row-note">No commits</span>;

  return (
    <>
      <span className="history-row-stat">{formatCount(session.commitCount, 'commit')}</span>
      <span className="history-row-stat">{formatCount(session.filesChanged, 'file')}</span>
      <span className="history-row-stat">
        <span className="history-additions">+{session.additions}</span> / <span className="history-deletions">−{session.deletions}</span>
      </span>
    </>
  );
}

function SessionHistoryEntry({ session, onSelectSession }) {
  const startTime = formatDateTime(session.startedAt, { hour: 'numeric', minute: '2-digit' });
  const endTime = formatDateTime(session.finishedAt, { hour: 'numeric', minute: '2-digit' });
  const date = formatDateTime(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' });
  const showStatus = session.status !== 'completed';

  return (
    <a
      className="history-row"
      href={session.detailHref}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelectSession(session.id);
      }}
    >
      <div className="history-row-main">
        <h3 className={`history-row-goal ${session.goal ? '' : 'empty'}`}>{session.goal || 'No goal set'}</h3>
        <div className="history-row-meta">
          <RepositoryLabel session={session} />
          <span aria-hidden="true">·</span>
          <time dateTime={session.startedAt}>{date}{startTime ? `, ${startTime}` : ''}{endTime ? ` – ${endTime}` : ''}</time>
          <span aria-hidden="true">·</span>
          <span className="history-row-duration">{formatDuration(session.durationMinutes)}</span>
          {showStatus && <span className="history-row-badge">{session.status || 'unknown'}</span>}
          {session.isPlaceholder && <span className="history-row-badge">Example</span>}
        </div>
      </div>

      <div className="history-row-stats" aria-label="GitHub activity summary">
        <SessionActivityStats session={session} />
      </div>
      <span className="history-row-chevron" aria-hidden="true">›</span>
    </a>
  );
}

function SessionHistoryGroup({ groupKey, title, count, minutes, rows, isCollapsed, collapsible, onToggle, onSelectSession }) {
  const listId = `history-group-${groupKey}`;
  const summary = <span>{formatCount(count, 'session')}{minutes !== undefined && <> · {formatDuration(minutes)}</>}</span>;
  return (
    <section className={`history-section${isCollapsed ? ' is-collapsed' : ''}`} aria-label={title}>
      <div className="session-history-list-heading history-month-heading">
        {collapsible ? (
          <button className="history-month-toggle" type="button" aria-expanded={!isCollapsed} aria-controls={listId} onClick={onToggle}>
            <svg className="history-month-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            <h2>{title}</h2>
          </button>
        ) : <h2>{title}</h2>}
        {summary}
      </div>
      {!isCollapsed && (
        <div className="history-list" id={listId}>
          {rows.map((session) => (
            <SessionHistoryEntry key={session.id} session={session} onSelectSession={onSelectSession} />
          ))}
        </div>
      )}
    </section>
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
  const initial = useMemo(readHistoryParams, []);
  const [query, setQuery] = useState(initial.query);
  const [repository, setRepository] = useState(initial.repository);
  const [sort, setSort] = useState(initial.sort);
  const [visibleCount, setVisibleCount] = useState(initial.visibleCount);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const pageRef = useRef(null);

  useEffect(() => {
    writeHistoryParams({ query, repository, sort, visibleCount, collapsed });
  }, [query, repository, sort, visibleCount, collapsed]);

  function toggleMonth(key) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Coming back from a session restores where the list was scrolled to.
  useEffect(() => {
    const saved = window.history.state?.historyScroll;
    if (!saved) return;
    const scroller = pageRef.current?.closest('.workspace-main');
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = saved.main;
      window.scrollTo(0, saved.window);
    });
  }, []);

  function selectSession(sessionId) {
    const scroller = pageRef.current?.closest('.workspace-main');
    const historyScroll = { main: scroller?.scrollTop || 0, window: window.scrollY };
    window.history.replaceState({ ...window.history.state, historyScroll }, '', window.location.href);
    onSelectSession(sessionId);
  }

  // Changing what is listed starts again from the first page of results.
  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setVisibleCount(PAGE_SIZE);
  };

  const repositories = useMemo(() => [...new Set(sessions.map((session) => session.repositoryFullName || session.repositoryName).filter(Boolean))].sort(), [sessions]);
  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = sessions.filter((session) => {
      const matchesQuery = !normalizedQuery || [session.repositoryName, session.repositoryFullName, session.goal]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      const matchesRepository = repository === 'all' || (session.repositoryFullName || session.repositoryName) === repository;
      return matchesQuery && matchesRepository;
    });

    return result.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.startedAt) - new Date(right.startedAt);
      if (sort === 'longest') return right.durationMinutes - left.durationMinutes;
      if (sort === 'shortest') return left.durationMinutes - right.durationMinutes;
      return new Date(right.startedAt) - new Date(left.startedAt);
    });
  }, [sessions, query, repository, sort]);

  const hasFilters = Boolean(query.trim()) || repository !== 'all';
  const isChronological = CHRONOLOGICAL_SORTS.has(sort);
  const groups = allocateRows(
    isChronological
      ? groupByMonth(filteredSessions)
      : [{ key: sort, title: sort === 'longest' ? 'Longest sessions first' : 'Shortest sessions first', sessions: filteredSessions, count: filteredSessions.length }],
    visibleCount,
    isChronological ? collapsed : new Set(),
  );
  const shownCount = groups.reduce((total, group) => total + group.rows.length, 0);
  const collapsedCount = groups.reduce((total, group) => total + (group.isCollapsed ? group.count : 0), 0);
  const remaining = filteredSessions.length - shownCount - collapsedCount;

  return (
    <div className="sessions-page session-history-page" ref={pageRef}>
      <section className="page-intro">
        <a className="session-history-back" href={routePaths.Overview} onClick={(event) => followRouteLink(event, () => onBack())}>← Overview</a>
        <div className="session-history-title-row">
          <div>
            <span className="section-kicker">SESSION HISTORY</span>
            <h1>Session History</h1>
            <p>Review the work you’ve done across your repositories.</p>
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
              name="q"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={changeFilter(setQuery)}
              placeholder="Repository or goal…"
            />
          </label>
          <label>
            <span>Repository</span>
            <select value={repository} onChange={changeFilter(setRepository)}>
              <option value="all">All repositories</option>
              {repositories.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={changeFilter(setSort)}>
              {sortOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {filteredSessions.length > 0 && (
          <div className="history-groups">
            {groups.map((group) => (
              <SessionHistoryGroup key={group.key} groupKey={group.key} {...group} collapsible={isChronological} onToggle={() => toggleMonth(group.key)} onSelectSession={selectSession} />
            ))}
            <div className="history-more">
              <span>Showing {shownCount.toLocaleString()} of {formatCount(filteredSessions.length, 'session')}{collapsedCount > 0 && <> · {collapsedCount.toLocaleString()} in collapsed months</>}</span>
              {remaining > 0 && (
                <button className="subtle-action" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, remaining)} more
                </button>
              )}
            </div>
            {filteredSessions.some((session) => session.isPlaceholder) && (
              <p className="session-history-boundary">Example sessions are illustrative; their GitHub activity was not retrieved from GitHub.</p>
            )}
          </div>
        )}

        {!filteredSessions.length && <EmptyHistory hasFilters={hasFilters || sessions.length > 0} />}
      </section>
    </div>
  );
}
