import React, { useState } from 'react';
import { followRouteLink, projectDetailPath, routePaths } from '../../../../routing.js';
import { formatCount, formatLastWorked, formatProjectDuration } from '../../../Projects/projectHistory.js';

function repositoryVisibility(repository) {
  return repository.visibility || (repository.private ? 'private' : 'public');
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function RepositoryRow({ repository, selected, onSelect }) {
  const visibility = repositoryVisibility(repository);
  const updatedAt = formatUpdatedAt(repository.updated_at);

  return (
    <button
      className={`repository-select-row${selected ? ' selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(String(repository.id))}
    >
      <span className="repository-select-indicator" aria-hidden="true">{selected ? '✓' : ''}</span>
      <span className="repository-select-main">
        <span className="repository-select-heading">
          <strong>{repository.name}</strong>
          <span className={`repository-visibility ${visibility}`}>{visibility}</span>
        </span>
        <span className="repository-select-fullname">{repository.full_name || repository.name}</span>
        {repository.description && <span className="repository-select-description">{repository.description}</span>}
      </span>
      <span className="repository-select-meta">
        {repository.language && <span className="repository-select-language">{repository.language}</span>}
        {updatedAt && <span>Updated {updatedAt}</span>}
      </span>
    </button>
  );
}

// Where you left off: the selected repository's Panta history, or your recent work overall.
function sessionHistorySummary(project, projects, hasSelection) {
  if (hasSelection) {
    if (!project) return { kicker: 'YOUR HISTORY HERE', empty: 'No Panta sessions here yet. This will be your first.' };
    return {
      kicker: 'YOUR HISTORY HERE',
      sessions: project.sessionCount,
      durationMs: project.totalDurationMs,
      commits: project.activity.commits.total,
      lastWorkedAt: project.lastWorkedAt,
      lastSession: project.sessions[0],
      link: { href: projectDetailPath(project.fullName), label: 'View project' },
    };
  }
  if (!projects.length) return { kicker: 'YOUR RECENT WORK', empty: 'No Panta sessions yet. Your first session starts here.' };
  const latest = projects[0];
  const commitTotals = projects.map((item) => item.activity.commits.total).filter((total) => total !== null);
  return {
    kicker: 'YOUR RECENT WORK',
    sessions: projects.reduce((sum, item) => sum + item.sessionCount, 0),
    durationMs: projects.reduce((sum, item) => sum + item.totalDurationMs, 0),
    commits: commitTotals.length ? commitTotals.reduce((sum, total) => sum + total, 0) : null,
    lastWorkedAt: latest.lastWorkedAt,
    lastWorkedIn: latest.name,
    lastSession: latest.sessions[0],
    link: { href: routePaths.Projects, label: 'View all projects' },
  };
}

function RepositoryHistory({ project, projects, hasSelection, onNavigate }) {
  const summary = sessionHistorySummary(project, projects, hasSelection);
  return (
    <section className="repository-history" aria-label={hasSelection ? 'Your history in this repository' : 'Your recent work'}>
      <span className="section-kicker">{summary.kicker}</span>
      {summary.empty ? <p className="repository-history-empty">{summary.empty}</p> : (
        <>
          <p className="repository-history-totals">
            {formatCount(summary.sessions, 'session')} · {formatProjectDuration(summary.durationMs)}
            {summary.commits !== null && <> · {formatCount(summary.commits, 'commit')}</>}
          </p>
          <p className="repository-history-last-worked">
            Last worked {formatLastWorked(summary.lastWorkedAt)}{summary.lastWorkedIn && <> in <strong>{summary.lastWorkedIn}</strong></>}
          </p>
          {summary.lastSession && (
            <div className="repository-history-last-session">
              <span className="section-kicker">LAST SESSION</span>
              <strong>{summary.lastSession.goal || 'No goal set'}</strong>
              <span>
                {summary.lastWorkedIn && `${summary.lastWorkedIn} · `}
                {formatProjectDuration(summary.lastSession.durationMinutes * 60_000)}
                {summary.lastSession.hasActivity ? ` · ${formatCount(summary.lastSession.commitCount, 'commit')}` : ''}
              </span>
            </div>
          )}
          <a className="repository-history-link" href={summary.link.href} onClick={(event) => followRouteLink(event, onNavigate)}>{summary.link.label} <span aria-hidden="true">→</span></a>
        </>
      )}
    </section>
  );
}

export default function SessionSetup({ selectedProject, projects = [], onNavigate, repositories, loading, error, onRetry, selectedRepository, selectedRepositoryId, setSelectedRepositoryId, goal, setGoal, handleSubmit, query, setQuery, type, setType, language, setLanguage, sort, setSort, languages, filteredRepositories }) {
  const [needsRepository, setNeedsRepository] = useState(false);

  // Start stays clickable; pressing it before choosing a repository explains what's missing.
  function submit(event) {
    if (!selectedRepository) {
      event.preventDefault();
      setNeedsRepository(true);
      return;
    }
    handleSubmit(event);
  }

  return (
    <div className="session-workspace-layout">
      <section className="repository-browser" aria-labelledby="repository-browser-heading">
        <div className="repository-browser-heading">
          <div><span className="section-kicker">01 · REPOSITORY</span><h2 id="repository-browser-heading">Choose where you’re working</h2></div>
          {!loading && !error && <span className="repository-browser-count">{filteredRepositories.length} of {repositories.length}</span>}
        </div>

        <div className="repository-browser-filters">
          <label className="repository-search-field">
            <span>Search</span>
            <input type="search" name="repository-search" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a repository…" />
          </label>
          <label>
            <span>Type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="all">All languages</option>
              {languages.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        {loading && <p className="repository-browser-state" role="status"><span className="dashboard-spinner" />Loading repositories…</p>}
        {error && (
          <div className="repository-browser-error" role="alert">
            <div><strong>Could not load repositories</strong><p>{error}</p></div>
            <button type="button" onClick={onRetry}>Try again</button>
          </div>
        )}
        {!loading && !error && repositories.length === 0 && (
          <div className="repository-browser-state">
            <strong>No repositories available</strong>
            <p>No repositories were returned for this GitHub account. Check repository access in Settings.</p>
          </div>
        )}
        {!loading && !error && repositories.length > 0 && filteredRepositories.length === 0 && (
          <div className="repository-browser-state">
            <strong>No repositories found</strong>
            <p>Try a different search or filter.</p>
          </div>
        )}
        {!loading && !error && filteredRepositories.length > 0 && (
          <div className="repository-select-list" role="group" aria-label="Repositories">
            {filteredRepositories.map((repository) => (
              <RepositoryRow
                key={repository.id}
                repository={repository}
                selected={String(repository.id) === selectedRepositoryId}
                onSelect={setSelectedRepositoryId}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="session-workspace-selection" aria-labelledby="selected-repository-heading">
        <span className="section-kicker">02 · SESSION</span>
        <h2 id="selected-repository-heading">Working in</h2>
        {selectedRepository ? (
          <div className="selected-repository-summary">
            <span className="selected-repository-mark" aria-hidden="true">{selectedRepository.name?.slice(0, 1).toUpperCase() || 'R'}</span>
            <span className="selected-repository-details">
              <strong>{selectedRepository.name}</strong>
              <span className="selected-repository-fullname">{selectedRepository.full_name || selectedRepository.name}</span>
              <span className="selected-repository-meta">
                <span className={`repository-visibility ${repositoryVisibility(selectedRepository)}`}>{repositoryVisibility(selectedRepository)}</span>
                {selectedRepository.language && <span>{selectedRepository.language}</span>}
              </span>
            </span>
          </div>
        ) : (
          <div className="repository-selection-empty">
            <strong>No repository selected</strong>
            <p>Choose one from your repositories.</p>
          </div>
        )}

        <RepositoryHistory project={selectedProject} projects={projects} hasSelection={Boolean(selectedRepository)} onNavigate={onNavigate} />

        <form className="session-goal-form" onSubmit={submit}>
          <label className="dashboard-field" htmlFor="session-goal">
            <span>What are you working on? <small>Optional</small></span>
            <input id="session-goal" name="goal" autoComplete="off" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={160} placeholder="e.g. Refactor the session timer…" />
          </label>
          <button className="session-workspace-button" type="submit" disabled={loading || Boolean(error)}>
            Start session <span aria-hidden="true">→</span>
          </button>
          {needsRepository && !selectedRepository && <p className="session-goal-error" role="alert">Choose a repository first, then start the session.</p>}
          <p className="session-goal-hint">Session time starts when you press Start. GitHub activity is tracked automatically.</p>
        </form>

      </aside>
    </div>
  );
}
