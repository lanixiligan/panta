import React from 'react';
import { followRouteLink, projectDetailPath, sessionDetailPath } from '../../../../routing.js';
import { formatCount, formatProjectDuration } from '../../../Projects/projectHistory.js';
import FilterSelect from '../../../../components/filters/FilterSelect.jsx';

function repositoryVisibility(repository) {
  if (repository.isExample) return 'example';
  return repository.visibility || (repository.private ? 'private' : 'public');
}

function formatSessionDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
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
          <strong title={repository.full_name}>{repository.name}</strong>
          <span className={`repository-visibility ${visibility}`}>{visibility}</span>
        </span>
        {repository.description && <span className="repository-select-description">{repository.description}</span>}
      </span>
      <span className="repository-select-meta">
        {repository.language && <span className="repository-select-language">{repository.language}</span>}
        {updatedAt && <span>Updated {updatedAt}</span>}
      </span>
    </button>
  );
}

const RECENT_SESSION_ROWS = 4;

// The selected repository's latest sessions, always in a four-row frame so the panel keeps its shape.
function RepositoryHistory({ project, onNavigate }) {
  const sessions = project ? project.sessions.slice(0, RECENT_SESSION_ROWS) : [];
  const fillers = RECENT_SESSION_ROWS - sessions.length;
  return (
    <section className="repository-history" aria-labelledby="repository-history-heading">
      <div className="repository-history-recent-heading">
        <h3 id="repository-history-heading" className="repository-history-heading">Recent sessions</h3>
        {project && <a className="repository-history-link" href={projectDetailPath(project.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>View project <span aria-hidden="true">→</span></a>}
      </div>
      <ul className="repository-history-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <a className="repository-history-session" href={sessionDetailPath(session.id)} onClick={(event) => followRouteLink(event, onNavigate)}>
              <strong className={session.goal ? '' : 'empty'}>{session.goal || 'No goal set'}</strong>
              <span>
                {formatSessionDate(session.startedAt)} · {formatProjectDuration(session.durationMinutes * 60_000)}
                {session.hasActivity ? ` · ${formatCount(session.commitCount, 'commit')}` : ''}
              </span>
            </a>
          </li>
        ))}
        {Array.from({ length: fillers }, (_, index) => (
          <li key={`empty-${index}`} className="repository-history-filler" aria-hidden={sessions.length > 0 || index > 0 ? 'true' : undefined}>
            {!sessions.length && index === 0 && <span>No sessions yet</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SessionSetup({ selectedProject, onNavigate, repositories, loading, error, onRetry, selectedRepository, selectedRepositoryId, setSelectedRepositoryId, goal, setGoal, handleSubmit, query, setQuery, type, setType, language, setLanguage, sort, setSort, languages, filteredRepositories }) {
  // Start is enabled once a repository is chosen and the goal isn't blank.
  const canStart = Boolean(selectedRepository) && Boolean(goal.trim());

  return (
    <div className="session-workspace-layout">
      <section className="repository-browser-column" aria-labelledby="repository-browser-heading">
        <div className="repository-browser-heading">
          <h2 id="repository-browser-heading">Choose a repository</h2>
          {!loading && !error && filteredRepositories.length < repositories.length && <span className="repository-browser-count">{filteredRepositories.length} of {repositories.length}</span>}
        </div>

        <div className="repository-browser">
          <div className="repository-browser-filters">
            <label className="repository-search-field">
              <span>Search</span>
              <input type="search" name="repository-search" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a repository…" />
            </label>
            <div className="repository-browser-filter">
              <span id="repository-type-label">Type</span>
              <FilterSelect
                labelId="repository-type-label"
                icon={<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>}
                value={type}
                options={[['all', 'All types'], ['public', 'Public'], ['private', 'Private']]}
                onChange={setType}
              />
            </div>
            <div className="repository-browser-filter">
              <span id="repository-language-label">Language</span>
              <FilterSelect
                labelId="repository-language-label"
                icon={<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2.25" fill="currentColor" /></svg>}
                value={language}
                options={[['all', 'All languages'], ...languages.map((value) => [value, value])]}
                onChange={setLanguage}
              />
            </div>
            <div className="repository-browser-filter">
              <span id="repository-sort-label">Sort</span>
              <FilterSelect
                labelId="repository-sort-label"
                icon={<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                value={sort}
                options={[['updated', 'Recently updated'], ['name', 'Name A–Z']]}
                onChange={setSort}
              />
            </div>
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
        </div>
      </section>

      <aside className="session-workspace-selection" aria-labelledby="selected-repository-heading">
        <h2 id="selected-repository-heading">Working in</h2>
        {selectedRepository ? (
          <div className="selected-repository-summary">
            <span className="selected-repository-details">
              <span className="selected-repository-heading">
                <strong>{selectedRepository.name}</strong>
                <span className={`repository-visibility ${repositoryVisibility(selectedRepository)}`}>{repositoryVisibility(selectedRepository)}</span>
              </span>
              <span className="selected-repository-fullname">{selectedRepository.full_name || selectedRepository.name}</span>
              <span className="selected-repository-meta">
                {selectedRepository.language && <span>{selectedRepository.language}</span>}
                {selectedRepository.html_url && !selectedRepository.isExample && <a className="text-link" href={selectedRepository.html_url} target="_blank" rel="noreferrer">View repository <span aria-hidden="true">↗</span></a>}
              </span>
            </span>
          </div>
        ) : (
          <div className="repository-selection-empty">
            <strong>No repository selected yet</strong>
          </div>
        )}

        {selectedRepository && <RepositoryHistory project={selectedProject} onNavigate={onNavigate} />}

        <form className="session-goal-form" onSubmit={handleSubmit}>
          <label className="dashboard-field" htmlFor="session-goal">
            <span>Goal for this session</span>
            <input
              id="session-goal"
              name="goal"
              autoComplete="off"
              required
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              maxLength={160}
              placeholder="e.g. Refactor the session timer…"
            />
          </label>
          <button className="session-workspace-button" type="submit" disabled={!canStart || loading || Boolean(error) || Boolean(selectedRepository?.isExample)}>
            {!selectedRepository ? 'Choose a repository first'
              : selectedRepository.isExample ? 'Examples can’t be tracked'
                : !goal.trim() ? 'Add a goal first'
                  : <>Start session <span aria-hidden="true">→</span></>}
          </button>
          <p className="session-goal-hint">Session time starts when you press Start. GitHub activity is tracked automatically.</p>
        </form>

      </aside>
    </div>
  );
}
