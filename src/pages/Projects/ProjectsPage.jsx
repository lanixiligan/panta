import React, { useMemo, useRef, useState } from 'react';
import { followRouteLink, readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import { recentDailyMinutes } from './projectHistory.js';
import ProjectCard, { ACTIVITY_DAYS } from './components/ProjectCard.jsx';
import Pager from '../../components/navigation/Pager.jsx';

// Three full rows in the three-column grid.
const PAGE_SIZE = 9;
const sortOptions = [
  ['recent', 'Last worked'],
  ['time', 'Most time'],
  ['sessions', 'Most sessions'],
];

function sortProjects(projects, sort) {
  if (sort === 'time') return [...projects].sort((left, right) => right.totalDurationMs - left.totalDurationMs);
  if (sort === 'sessions') return [...projects].sort((left, right) => right.sessionCount - left.sessionCount || right.lastWorkedAt - left.lastWorkedAt);
  return projects;
}

export default function ProjectsPage({ projects: realProjects = [], exampleProjects = [], onNavigate, onStartSession }) {
  // Search, sort, and page live in the URL (?q=, ?sort=, ?page=).
  const [query, setQueryState] = useState(() => readSearchParam('q') || '');
  const [sort, setSortState] = useState(() => (sortOptions.some(([value]) => value === readSearchParam('sort')) ? readSearchParam('sort') : 'recent'));
  const [page, setPageState] = useState(() => Math.max(1, Number.parseInt(readSearchParam('page'), 10) || 1));
  const pageRef = useRef(null);
  const setPage = (value) => { setPageState(value); updateSearchParams({ page: value > 1 ? value : null }); };
  const setSort = (value) => { setSortState(value); setPage(1); updateSearchParams({ sort: value === 'recent' ? null : value }); };
  const setQuery = (value) => { setQueryState(value); setPage(1); updateSearchParams({ q: value.trim() ? value : null }); };
  const projects = useMemo(
    () => [...realProjects, ...exampleProjects].sort((left, right) => right.lastWorkedAt - left.lastWorkedAt),
    [realProjects, exampleProjects],
  );
  const sortedProjects = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = needle
      ? projects.filter((project) => [project.fullName, project.description].some((value) => value?.toLocaleLowerCase().includes(needle)))
      : projects;
    return sortProjects(matches, sort);
  }, [projects, query, sort]);
  const activity = useMemo(() => new Map(projects.map((project) => [project.key, recentDailyMinutes(project, ACTIVITY_DAYS)])), [projects]);
  // One scale for every project, so bar heights compare honestly across projects.
  const maxMinutes = Math.max(1, ...[...activity.values()].flat().map((day) => day.minutes));
  // Badges mark exceptions: when every project is an example, the toolbar labels them once.
  const allExamples = projects.length > 0 && projects.every((project) => project.isExample);
  const pageCount = Math.max(1, Math.ceil(sortedProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageProjects = sortedProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(next) {
    setPage(next);
    const scroller = pageRef.current?.closest('.workspace-main');
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  return (
    <div className="projects-page" ref={pageRef}>
      <section className="page-intro">
        <h1>Projects</h1>
        <p>Every repository you’ve worked on through Panta, with the time you declared and what GitHub saw.</p>
      </section>

      {projects.length || exampleProjects.length ? (
        <section className="project-list-section" aria-label="Projects">
          <div className="project-toolbar">
            <input className="project-search" type="search" name="q" aria-label="Search projects" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects…" />
            <div className="project-toolbar-group">
              <div className="project-segmented" role="group" aria-label="Sort projects">
                {sortOptions.map(([value, label]) => (
                  <button key={value} type="button" className={sort === value ? 'is-active' : undefined} aria-pressed={sort === value} onClick={() => setSort(value)}>{label}</button>
                ))}
              </div>
              {allExamples && <span className="project-badge is-example">Example data</span>}
            </div>
          </div>

          {!projects.length ? (
            <p className="project-list-empty">No projects yet. Complete a session and its repository will appear here.</p>
          ) : !sortedProjects.length ? (
            <p className="project-list-empty">No matching projects</p>
          ) : (
            <div className="project-grid">
              {pageProjects.map((project) => (
                <ProjectCard key={project.key} project={project} days={activity.get(project.key)} maxMinutes={maxMinutes} showExample={!allExamples} onNavigate={onNavigate} />
              ))}
            </div>
          )}
          <Pager page={currentPage} pageCount={pageCount} onChange={goToPage} label="Project pages" />
        </section>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌂</span>
          <div><h3>No projects yet</h3><p>Complete your first session and the repository will appear here.</p></div>
          <a className="subtle-action" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onStartSession())}>Start a session <span aria-hidden="true">→</span></a>
        </div>
      )}
    </div>
  );
}
