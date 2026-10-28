import React, { useMemo, useRef, useState } from 'react';
import { followRouteLink, readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import { recentDailyMinutes } from './repositoryHistory.js';
import RepositoryCard, { ACTIVITY_DAYS } from './components/RepositoryCard.jsx';
import Pager from '../../components/navigation/Pager.jsx';

// Three full rows in the three-column grid.
const PAGE_SIZE = 9;
const sortOptions = [
  ['recent', 'Last worked'],
  ['time', 'Most time'],
  ['sessions', 'Most sessions'],
];

function sortRepositories(repositories, sort) {
  if (sort === 'time') return [...repositories].sort((left, right) => right.totalDurationMs - left.totalDurationMs);
  if (sort === 'sessions') return [...repositories].sort((left, right) => right.sessionCount - left.sessionCount || right.lastWorkedAt - left.lastWorkedAt);
  return repositories;
}

// `notice` is one line from App while the sessions load or when they couldn't be loaded; the empty state waits for it.
export default function RepositoriesPage({ repositories: realRepositories = [], exampleRepositories = [], notice = null, onNavigate, onStartSession }) {
  // Search, sort, and page live in the URL (?q=, ?sort=, ?page=).
  const [query, setQueryState] = useState(() => readSearchParam('q') || '');
  const [sort, setSortState] = useState(() => (sortOptions.some(([value]) => value === readSearchParam('sort')) ? readSearchParam('sort') : 'recent'));
  const [page, setPageState] = useState(() => Math.max(1, Number.parseInt(readSearchParam('page'), 10) || 1));
  const pageRef = useRef(null);
  const setPage = (value) => { setPageState(value); updateSearchParams({ page: value > 1 ? value : null }); };
  const setSort = (value) => { setSortState(value); setPage(1); updateSearchParams({ sort: value === 'recent' ? null : value }); };
  const setQuery = (value) => { setQueryState(value); setPage(1); updateSearchParams({ q: value.trim() ? value : null }); };
  const repositories = useMemo(
    () => [...realRepositories, ...exampleRepositories].sort((left, right) => right.lastWorkedAt - left.lastWorkedAt),
    [realRepositories, exampleRepositories],
  );
  const sortedRepositories = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = needle
      ? repositories.filter((repository) => [repository.fullName, repository.description].some((value) => value?.toLocaleLowerCase().includes(needle)))
      : repositories;
    return sortRepositories(matches, sort);
  }, [repositories, query, sort]);
  const activity = useMemo(() => new Map(repositories.map((repository) => [repository.key, recentDailyMinutes(repository, ACTIVITY_DAYS)])), [repositories]);
  // One scale for every repository, so bar heights compare honestly across repositories.
  const maxMinutes = Math.max(1, ...[...activity.values()].flat().map((day) => day.minutes));
  // Badges mark exceptions: when every repository is an example, the toolbar labels them once.
  const allExamples = repositories.length > 0 && repositories.every((repository) => repository.isExample);
  const pageCount = Math.max(1, Math.ceil(sortedRepositories.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRepositories = sortedRepositories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(next) {
    setPage(next);
    const scroller = pageRef.current?.closest('.workspace-main');
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  return (
    <div className="repositories-page" ref={pageRef}>
      <section className="page-intro">
        <h1>Repositories</h1>
        <p>Every repository you’ve worked on through Panta, with the time you declared and what GitHub saw.</p>
      </section>

      {notice}

      {repositories.length ? (
        <section className="repository-list-section" aria-label="Repositories">
          <div className="repository-toolbar">
            <input className="repositories-search" type="search" name="q" aria-label="Search repositories" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories…" />
            <div className="repository-toolbar-group">
              <div className="repository-segmented" role="group" aria-label="Sort repositories">
                {sortOptions.map(([value, label]) => (
                  <button key={value} type="button" className={sort === value ? 'is-active' : undefined} aria-pressed={sort === value} onClick={() => setSort(value)}>{label}</button>
                ))}
              </div>
              {allExamples && <span className="repository-badge is-example">Example data</span>}
            </div>
          </div>

          {!sortedRepositories.length ? (
            <p className="repository-list-empty">No matching repositories</p>
          ) : (
            <div className="repository-grid">
              {pageRepositories.map((repository) => (
                <RepositoryCard key={repository.key} repository={repository} days={activity.get(repository.key)} maxMinutes={maxMinutes} showExample={!allExamples} onNavigate={onNavigate} />
              ))}
            </div>
          )}
          <Pager page={currentPage} pageCount={pageCount} onChange={goToPage} label="Repository pages" />
        </section>
      ) : !notice && (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌂</span>
          <div><h3>No repositories yet</h3><p>Complete your first session and the repository will appear here.</p></div>
          <a className="subtle-action" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onStartSession())}>Start a session <span aria-hidden="true">→</span></a>
        </div>
      )}
    </div>
  );
}
