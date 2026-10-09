import React, { useMemo, useState } from 'react';
import { followRouteLink, projectDetailPath, readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import { formatCount, formatLastWorked, formatProjectDuration, recentDailyMinutes } from './projectHistory.js';

const ACTIVITY_DAYS = 7;
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

function formatDay(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function RepositoryIcon() {
  return (
    <svg className="project-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" />
    </svg>
  );
}

function ProjectBadge({ project }) {
  if (project.isExample) return <span className="project-badge is-example">Example</span>;
  return project.visibility ? <span className={`project-badge is-${project.visibility}`}>{project.visibility}</span> : null;
}

function LineChanges({ additions, deletions }) {
  if (additions === null && deletions === null) return null;
  return (
    <span className="project-lines">
      {additions !== null && <span className="history-additions">+{additions.toLocaleString()}</span>}
      {deletions !== null && <span className="history-deletions">−{deletions.toLocaleString()}</span>}
    </span>
  );
}

function ActivityStrip({ days, maxMinutes, compact = false }) {
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const dayValues = days.filter((day) => day.minutes > 0).map((day) => `${formatDay(day.date)} ${formatProjectDuration(day.minutes * 60_000)}`).join(', ');
  return (
    <div className={`project-strip${compact ? ' is-compact' : ''}`} role="img" aria-label={`Session time on ${workedDays} of the last ${ACTIVITY_DAYS} days${dayValues ? `: ${dayValues}` : ''}`}>
      {days.map((day, index) => {
        const isToday = index === days.length - 1;
        return (
          <i
            key={day.key}
            className={[day.minutes > 0 && 'has-time', isToday && 'is-today'].filter(Boolean).join(' ') || undefined}
            style={day.minutes > 0 ? { height: `${Math.max(16, Math.round(day.minutes / maxMinutes * 100))}%` } : undefined}
            title={`${formatDay(day.date)}: ${day.minutes > 0 ? formatProjectDuration(day.minutes * 60_000) : 'no sessions'}`}
          />
        );
      })}
    </div>
  );
}

function ProjectCard({ project, days, maxMinutes, onNavigate }) {
  const { commits, additions, deletions } = project.activity;
  return (
    <a className="project-card" href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>
      <div className="project-card-head">
        <div className="project-card-title">
          <RepositoryIcon />
          <strong>{project.name}</strong>
          <ProjectBadge project={project} />
        </div>
        <span className="project-card-fullname">{project.fullName}</span>
        {project.description && <p className="project-card-description">{project.description}</p>}
      </div>

      <div className="project-card-measures">
        <div className="project-card-measure">
          <span className="project-measure-label">Session time</span>
          <strong>{formatProjectDuration(project.totalDurationMs)}</strong>
          <span className="project-measure-note">{formatCount(project.sessionCount, 'session')}</span>
        </div>
        <div className="project-card-measure">
          <span className="project-measure-label">GitHub activity</span>
          {commits.total === null ? (
            <>
              <strong className="is-unavailable">Unavailable</strong>
              <span className="project-measure-note">Not recorded for these sessions</span>
            </>
          ) : (
            <>
              <strong>{commits.total.toLocaleString()}<span className="project-measure-unit">{commits.total === 1 ? 'commit' : 'commits'}</span></strong>
              <LineChanges additions={additions.total} deletions={deletions.total} />
            </>
          )}
        </div>
      </div>

      <div className="project-card-activity">
        <ActivityStrip days={days} maxMinutes={maxMinutes} />
        <div className="project-strip-scale">
          <span>{formatDay(days[0].date)}</span>
          <span>Last {ACTIVITY_DAYS} days</span>
          <span>Today</span>
        </div>
      </div>

      <div className="project-card-footer">
        <span>Last worked <time dateTime={new Date(project.lastWorkedAt).toISOString()}>{formatLastWorked(project.lastWorkedAt)}</time></span>
        <span className="project-card-go">View project <span aria-hidden="true">→</span></span>
      </div>
    </a>
  );
}

function ProjectTable({ projects, activity, maxMinutes, onNavigate }) {
  return (
    <div className="project-table-wrap">
      <table className="project-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col" className="is-numeric">Session time</th>
            <th scope="col" className="is-numeric">Sessions</th>
            <th scope="col" className="is-numeric">Commits</th>
            <th scope="col" className="is-numeric">Lines</th>
            <th scope="col">Last {ACTIVITY_DAYS} days</th>
            <th scope="col" className="is-numeric">Last worked</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const { commits, additions, deletions } = project.activity;
            const hasLines = additions.total !== null || deletions.total !== null;
            return (
              <tr key={project.key}>
                <td>
                  <div className="project-table-name">
                    <a href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>{project.name}</a>
                    <ProjectBadge project={project} />
                  </div>
                  <span className="project-card-fullname">{project.fullName}</span>
                </td>
                <td className="is-numeric project-table-time">{formatProjectDuration(project.totalDurationMs)}</td>
                <td className="is-numeric project-table-muted">{project.sessionCount.toLocaleString()}</td>
                <td className="is-numeric">{commits.total === null ? <span className="project-table-unavailable" title="Not recorded">—</span> : commits.total.toLocaleString()}</td>
                <td className="is-numeric">{hasLines ? <LineChanges additions={additions.total} deletions={deletions.total} /> : <span className="project-table-unavailable" title="Not recorded">—</span>}</td>
                <td><ActivityStrip days={activity.get(project.key)} maxMinutes={maxMinutes} compact /></td>
                <td className="is-numeric project-table-muted">
                  <time dateTime={new Date(project.lastWorkedAt).toISOString()}>{formatLastWorked(project.lastWorkedAt)}</time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectsPage({ projects: realProjects = [], exampleProjects = [], onNavigate, onStartSession }) {
  // Sort, layout, and the examples toggle live in the URL (?sort=, ?view=list, ?examples=off).
  const [sort, setSortState] = useState(() => (sortOptions.some(([value]) => value === readSearchParam('sort')) ? readSearchParam('sort') : 'recent'));
  const [layout, setLayoutState] = useState(() => (readSearchParam('view') === 'list' ? 'list' : 'grid'));
  const [includeExamples, setIncludeExamplesState] = useState(() => readSearchParam('examples') !== 'off');
  const setSort = (value) => { setSortState(value); updateSearchParams({ sort: value === 'recent' ? null : value }); };
  const setLayout = (value) => { setLayoutState(value); updateSearchParams({ view: value === 'grid' ? null : value }); };
  const setIncludeExamples = (value) => { setIncludeExamplesState(value); updateSearchParams({ examples: value ? null : 'off' }); };
  const projects = useMemo(
    () => (includeExamples ? [...realProjects, ...exampleProjects].sort((left, right) => right.lastWorkedAt - left.lastWorkedAt) : realProjects),
    [realProjects, exampleProjects, includeExamples],
  );
  const sortedProjects = useMemo(() => sortProjects(projects, sort), [projects, sort]);
  const activity = useMemo(() => new Map(projects.map((project) => [project.key, recentDailyMinutes(project, ACTIVITY_DAYS)])), [projects]);
  // One scale for every project, so bar heights compare honestly across projects.
  const maxMinutes = Math.max(1, ...[...activity.values()].flat().map((day) => day.minutes));

  return (
    <div className="projects-page">
      <section className="page-intro">
        <span className="section-kicker">PROJECTS</span>
        <h1>Projects</h1>
        <p>Every repository you’ve worked on through Panta, with the time you declared and what GitHub saw.</p>
      </section>

      {projects.length || exampleProjects.length ? (
        <section className="project-list-section" aria-label="Projects">
          <div className="project-toolbar">
            <div className="project-toolbar-group">
              <div className="project-segmented" role="group" aria-label="Sort projects">
                {sortOptions.map(([value, label]) => (
                  <button key={value} type="button" className={sort === value ? 'is-active' : undefined} aria-pressed={sort === value} onClick={() => setSort(value)}>{label}</button>
                ))}
              </div>
              {exampleProjects.length > 0 && (
                <label className="analytics-example-toggle project-example-toggle">
                  <input type="checkbox" checked={includeExamples} onChange={(event) => setIncludeExamples(event.target.checked)} />
                  Include example projects
                </label>
              )}
            </div>
            <div className="project-segmented is-icons" role="group" aria-label="Layout">
              <button type="button" className={layout === 'grid' ? 'is-active' : undefined} aria-pressed={layout === 'grid'} aria-label="Grid view" onClick={() => setLayout('grid')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></svg>
              </button>
              <button type="button" className={layout === 'list' ? 'is-active' : undefined} aria-pressed={layout === 'list'} aria-label="List view" onClick={() => setLayout('list')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
              </button>
            </div>
          </div>

          {!projects.length ? (
            <p className="project-list-empty">No projects yet. Complete a session and its repository will appear here.</p>
          ) : layout === 'list' ? (
            <ProjectTable projects={sortedProjects} activity={activity} maxMinutes={maxMinutes} onNavigate={onNavigate} />
          ) : (
            <div className="project-grid">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.key} project={project} days={activity.get(project.key)} maxMinutes={maxMinutes} onNavigate={onNavigate} />
              ))}
            </div>
          )}
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
