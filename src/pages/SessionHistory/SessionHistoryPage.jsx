import React, { useEffect, useMemo, useRef, useState } from 'react';
import DateRangePicker, { readRange, rangeBounds, toDayString, writeRange } from './components/DateRangePicker.jsx';
import FilterSelect from '../../components/filters/FilterSelect.jsx';
import Pager from '../../components/navigation/Pager.jsx';
import RepositoryName from '../../components/repository/RepositoryName.jsx';

const sortOptions = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['longest', 'Longest session'],
  ['shortest', 'Shortest session'],
];
const PAGE_SIZE = 30;
const CHRONOLOGICAL_SORTS = new Set(['newest', 'oldest']);

// Filters, sort, and the current page live in the URL, so Back from a session and shared links restore the same view.
function readHistoryParams() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page'), 10);
  return {
    query: params.get('q') || '',
    repository: params.get('repo') || 'all',
    sort: sortOptions.some(([value]) => value === sort) ? sort : 'newest',
    range: readRange(params),
    page: Number.isFinite(page) && page > 1 ? page : 1,
    collapsed: new Set((params.get('collapsed') || '').split(',').filter((key) => /^\d{4}-\d{2}$/.test(key))),
  };
}

function writeHistoryParams({ query, repository, sort, range, page, collapsed }) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (repository !== 'all') params.set('repo', repository);
  if (sort !== 'newest') params.set('sort', sort);
  writeRange(params, range);
  if (page > 1) params.set('page', String(page));
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

// Groups one page of sessions by month. Month headings keep the whole month's totals, even when it spans pages.
function pageGroups(sessions, pageSessions, collapsed) {
  const totals = new Map(groupByMonth(sessions).map((group) => [group.key, group]));
  return groupByMonth(pageSessions).map((group) => {
    const isCollapsed = collapsed.has(group.key);
    const { count, minutes } = totals.get(group.key) || group;
    return { ...group, count, minutes, isCollapsed, rows: isCollapsed ? [] : group.sessions };
  });
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
  return <RepositoryName className="history-row-repo" name={fullName} />;
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
  const date = formatDateTime(session.startedAt, { month: 'numeric', day: 'numeric', year: '2-digit' });
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
        <time className="history-row-date" dateTime={session.startedAt}>{date}</time>
        <div className="history-row-meta">
          <RepositoryLabel session={session} />
          <span aria-hidden="true">·</span>
          <span className="history-row-duration">{formatDuration(session.durationMinutes)}</span>
          {startTime && (
            <>
              <span className="history-row-divider" aria-hidden="true" />
              <span className="history-row-time">{startTime}{endTime ? ` – ${endTime}` : ''}</span>
            </>
          )}
          {showStatus && <span className="history-row-badge">{session.status || 'unknown'}</span>}
          {session.isPlaceholder && <span className="history-row-badge example">Example</span>}
        </div>
        {session.goal && <p className="history-row-goal">{session.goal}</p>}
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

export default function SessionHistoryPage({ sessions = [], onSelectSession }) {
  const initial = useMemo(readHistoryParams, []);
  const [query, setQuery] = useState(initial.query);
  const [repository, setRepository] = useState(initial.repository);
  const [sort, setSort] = useState(initial.sort);
  const [range, setRange] = useState(initial.range);
  const [page, setPage] = useState(initial.page);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const pageRef = useRef(null);

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
    setPage(1);
  };

  function goToPage(next) {
    setPage(next);
    const scroller = pageRef.current?.closest('.workspace-main');
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const activeDays = useMemo(() => new Set(sessions.map((session) => toDayString(new Date(session.startedAt)))), [sessions]);
  const repositories = useMemo(() => [...new Set(sessions.map((session) => session.repositoryFullName || session.repositoryName).filter(Boolean))].sort(), [sessions]);
  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = sessions.filter((session) => {
      const matchesQuery = !normalizedQuery || [session.repositoryName, session.repositoryFullName, session.goal]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      const matchesRepository = repository === 'all' || (session.repositoryFullName || session.repositoryName) === repository;
      const startedAt = new Date(session.startedAt);
      const matchesDate = !bounds || (startedAt >= bounds.start && startedAt < bounds.end);
      return matchesQuery && matchesRepository && matchesDate;
    });

    return result.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.startedAt) - new Date(right.startedAt);
      if (sort === 'longest') return right.durationMinutes - left.durationMinutes;
      if (sort === 'shortest') return left.durationMinutes - right.durationMinutes;
      return new Date(right.startedAt) - new Date(left.startedAt);
    });
  }, [sessions, query, repository, sort, bounds]);

  const hasFilters = Boolean(query.trim()) || repository !== 'all' || Boolean(bounds);
  const isChronological = CHRONOLOGICAL_SORTS.has(sort);
  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageSessions = filteredSessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    writeHistoryParams({ query, repository, sort, range, page: currentPage, collapsed });
  }, [query, repository, sort, range, currentPage, collapsed]);

  const groups = isChronological
    ? pageGroups(filteredSessions, pageSessions, collapsed)
    : [{ key: sort, title: sort === 'longest' ? 'Longest sessions first' : 'Shortest sessions first', count: filteredSessions.length, isCollapsed: false, rows: pageSessions }];

  return (
    <div className="sessions-page session-history-page" ref={pageRef}>
      <section className="page-intro">
        <div className="session-history-title-row">
          <div>
            <h1>Session History</h1>
            <p>Review the work you’ve done across your repositories.</p>
          </div>
        </div>
      </section>

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
          <div className="session-history-filter">
            <span id="history-repository-label">Repository</span>
            <FilterSelect
              labelId="history-repository-label"
              icon={<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5h8.5v9H4.5a1.5 1.5 0 0 0 0 3h8V11.5M3 13V4a1.5 1.5 0 0 1 1-1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              value={repository}
              options={[['all', 'All repositories'], ...repositories.map((name) => [name, name.split('/').pop()])]}
              onChange={(next) => { setRepository(next); setPage(1); }}
            />
          </div>
          <div className="session-history-filter">
            <span id="history-period-label">Dates</span>
            <DateRangePicker labelId="history-period-label" value={range} onChange={(next) => { setRange(next); setPage(1); }} activeDays={activeDays} />
          </div>
          <div className="session-history-filter">
            <span id="history-sort-label">Sort</span>
            <FilterSelect
              labelId="history-sort-label"
              icon={<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              value={sort}
              options={sortOptions}
              onChange={(next) => { setSort(next); setPage(1); }}
            />
          </div>
        </div>

        {filteredSessions.length > 0 && (
          <div className="history-groups">
            {groups.map((group) => (
              <SessionHistoryGroup key={group.key} groupKey={group.key} {...group} collapsible={isChronological} onToggle={() => toggleMonth(group.key)} onSelectSession={selectSession} />
            ))}
            <Pager page={currentPage} pageCount={pageCount} onChange={goToPage} label="Session history pages" />
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
