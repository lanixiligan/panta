import React, { useState } from 'react';
import GitHubExplorer from '../components/github/GitHubExplorer.jsx';

function ProjectCard({ repository }) {
  return (
    <a className="project-card" href={repository.html_url} target="_blank" rel="noreferrer">
      <div className="project-card-heading"><span className="project-mark" aria-hidden="true">⌂</span><span aria-hidden="true">↗</span></div>
      <h3>{repository.name}</h3>
      <p>{repository.description || 'No description provided.'}</p>
      <div className="project-card-footer">
        {repository.language && <span className="project-language">{repository.language}</span>}
        <span>Updated {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(repository.updated_at))}</span>
      </div>
    </a>
  );
}

function ProjectHistoryCard({ project, onSelectSession }) {
  const latestSession = project.sessions[0];
  return (
    <article className="project-history-card">
      <div className="project-card-heading"><span className="project-mark" aria-hidden="true">⌂</span><span>{project.sessionCount} {project.sessionCount === 1 ? 'session' : 'sessions'}</span></div>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      {latestSession ? (
        <button className="project-history-link" type="button" onClick={() => onSelectSession(latestSession.id)}>
          <span><small>LATEST SESSION</small><strong>{latestSession.goal}</strong></span><span aria-hidden="true">→</span>
        </button>
      ) : <p className="project-history-empty">No example sessions yet.</p>}
    </article>
  );
}

export default function ProjectsPage({ identity, repositories, loading, error, onRetry, dummyProjects = [], onSelectSession }) {
  const [showExplorer, setShowExplorer] = useState(false);

  return (
    <div className="projects-page">
      <section className="page-intro">
        <span className="section-kicker">PROJECTS</span>
        <h1>Your GitHub repositories.</h1>
        <p>Recent public repositories associated with @{identity.username}. Choose one when you start a session.</p>
      </section>

      <section className="project-history-section">
        <div className="dashboard-section-heading"><div><span className="section-kicker">SAMPLE DATA</span><h2>Project session history</h2></div></div>
        <div className="project-history-grid">{dummyProjects.map((project) => <ProjectHistoryCard key={project.id} project={project} onSelectSession={onSelectSession} />)}</div>
        <p className="projects-source-note">Example project and session records from <code>src/dummydata/</code>.</p>
      </section>

      {loading && <div className="project-grid-skeleton" aria-label="Loading repositories"><i /><i /><i /><i /></div>}
      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Try again</button></div>}
      {!loading && !error && repositories.length === 0 && <div className="dashboard-section"><p className="dashboard-empty-note">No public repositories were found for this account.</p></div>}
      {!loading && !error && repositories.length > 0 && (
        <>
          <div className="project-grid">{repositories.map((repository) => <ProjectCard repository={repository} key={repository.id} />)}</div>
          <p className="projects-source-note">Showing up to 10 recently updated public repositories.</p>
        </>
      )}

      <section className="api-experiment-section">
        <div className="api-experiment-heading">
          <div><span className="section-kicker">EXPERIMENTAL</span><h2>Public GitHub explorer</h2><p>Profile, repository, and contribution graph lookups.</p></div>
          <button className="subtle-action" type="button" onClick={() => setShowExplorer((visible) => !visible)} aria-expanded={showExplorer}>
            {showExplorer ? 'Close explorer' : 'Open explorer'}
          </button>
        </div>
        {showExplorer && <GitHubExplorer />}
      </section>
    </div>
  );
}
