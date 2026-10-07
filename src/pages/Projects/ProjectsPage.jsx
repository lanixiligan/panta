import React, { useMemo, useState } from 'react';
import { followRouteLink, projectDetailPath } from '../../routing.js';
import { formatCount, formatLastWorked, formatProjectDuration, recentDailyMinutes } from './projectHistory.js';

const ACTIVITY_DAYS = 14;
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

function ActivityStrip({ days, maxMinutes }) {
  const workedDays = days.filter((day) => day.minutes > 0).length;
  return (
    <div className="project-card-activity">
      <div className="project-card-strip" role="img" aria-label={`Session time on ${workedDays} of the last ${ACTIVITY_DAYS} days`}>
        {days.map((day) => (
          <i
            key={day.key}
            className={day.minutes > 0 ? 'has-time' : undefined}
            style={day.minutes > 0 ? { height: `${Math.max(14, Math.round(day.minutes / maxMinutes * 100))}%` } : undefined}
            title={`${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(day.date)}: ${day.minutes > 0 ? formatProjectDuration(day.minutes * 60_000) : 'no sessions'}`}
          />
        ))}
      </div>
      <span>Last {ACTIVITY_DAYS} days</span>
    </div>
  );
}

function ProjectCard({ project, days, maxMinutes, onNavigate }) {
  const commits = project.activity.commits.total;
  return (
    <a className="project-card" href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>
      <div className="project-card-head">
        <div className="project-card-title">
          <strong>{project.name}</strong>
          {project.visibility && <span className={`repository-visibility ${project.visibility}`}>{project.visibility}</span>}
        </div>
        <span className="project-card-fullname">{project.fullName}</span>
        {project.description && <p className="project-card-description">{project.description}</p>}
      </div>

      <div className="project-card-total">
        <strong>{formatProjectDuration(project.totalDurationMs)}</strong>
        <span>Total session time</span>
      </div>

      <ActivityStrip days={days} maxMinutes={maxMinutes} />

      <div className="project-card-footer">
        <span>{formatCount(project.sessionCount, 'session')}{commits > 0 && <> · {formatCount(commits, 'commit')}</>}</span>
        <time dateTime={new Date(project.lastWorkedAt).toISOString()}>{formatLastWorked(project.lastWorkedAt)}</time>
      </div>
    </a>
  );
}

export default function ProjectsPage({ projects = [], onNavigate, onStartSession }) {
  const [sort, setSort] = useState('recent');
  const sortedProjects = useMemo(() => sortProjects(projects, sort), [projects, sort]);
  const activity = useMemo(() => new Map(projects.map((project) => [project.key, recentDailyMinutes(project, ACTIVITY_DAYS)])), [projects]);
  // One scale for every card, so bar heights compare honestly across projects.
  const maxMinutes = Math.max(1, ...[...activity.values()].flat().map((day) => day.minutes));
  const totalTime = projects.reduce((sum, project) => sum + project.totalDurationMs, 0);

  return (
    <div className="projects-page">
      <section className="page-intro">
        <span className="section-kicker">PROJECTS</span>
        <h1>Projects</h1>
        <p>Repositories you’ve worked on through Panta.</p>
      </section>

      {projects.length ? (
        <section className="project-list-section" aria-label="Projects">
          <div className="project-grid-toolbar">
            <p className="project-grid-summary">
              <strong>{formatCount(projects.length, 'project')}</strong> · {formatProjectDuration(totalTime)} across all of them
            </p>
            <label className="project-sort">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="project-grid">
            {sortedProjects.map((project) => (
              <ProjectCard key={project.key} project={project} days={activity.get(project.key)} maxMinutes={maxMinutes} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌂</span>
          <div><h3>No projects yet</h3><p>Complete your first session and the repository will appear here.</p></div>
          <button className="subtle-action" type="button" onClick={onStartSession}>Start a session <span aria-hidden="true">→</span></button>
        </div>
      )}
    </div>
  );
}
