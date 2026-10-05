import React, { useMemo, useState } from 'react';
import ActiveSessionCard from '../components/sessions/ActiveSessionCard.jsx';
import SessionCompleteCard from '../components/sessions/SessionCompleteCard.jsx';

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
      <span className="repository-select-main">
        <span className="repository-select-heading">
          <strong>{repository.name}</strong>
          <span className={`repository-visibility ${visibility}`}>{visibility}</span>
        </span>
        <span className="repository-select-fullname">{repository.full_name || repository.name}</span>
        {repository.description && <span className="repository-select-description">{repository.description}</span>}
        <span className="repository-select-meta">
          {repository.language && <span>{repository.language}</span>}
          {updatedAt && <span>Updated {updatedAt}</span>}
        </span>
      </span>
      <span className="repository-select-indicator" aria-hidden="true">{selected ? '✓' : ''}</span>
    </button>
  );
}

export default function StartSessionPage({ repositories = [], loading, error, onRetry, onStart, activeSession, completedSession, now, onFinish, isEndingSession, sessionEndingAt, onViewCompletedSession, onStartAnother, onRetryActivity }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState('updated');
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [goal, setGoal] = useState('');

  const selectedRepository = repositories.find((repository) => String(repository.id) === selectedRepositoryId);
  const languages = useMemo(() => [...new Set(repositories.map((repository) => repository.language).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [repositories]);
  const filteredRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return repositories
      .filter((repository) => {
        const matchesQuery = !normalizedQuery || [repository.name, repository.full_name, repository.description]
          .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
        const matchesType = type === 'all' || (type === 'private' ? repository.private : !repository.private);
        const matchesLanguage = language === 'all' || repository.language === language;
        return matchesQuery && matchesType && matchesLanguage;
      })
      .sort((left, right) => sort === 'name'
        ? (left.full_name || left.name).localeCompare(right.full_name || right.name)
        : new Date(right.updated_at || 0) - new Date(left.updated_at || 0));
  }, [repositories, query, type, language, sort]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedRepository || activeSession || loading || error) return;
    onStart({ repository: selectedRepository, goal: goal.trim() });
  }

  return (
    <div className="start-session-page">
      <section className="page-intro">
        <span className="section-kicker">FOCUSED WORK</span>
        <h1>Start a session</h1>
        <p>Choose where you're going to work.</p>
      </section>

      {completedSession ? (
        <SessionCompleteCard
          session={completedSession}
          onViewSession={onViewCompletedSession}
          onStartAnother={() => { setSelectedRepositoryId(''); setGoal(''); onStartAnother(); }}
          onRetryActivity={onRetryActivity}
        />
      ) : activeSession ? (
        <section className="start-session-already-active">
          <ActiveSessionCard session={activeSession} now={now} onFinish={onFinish} isEnding={isEndingSession} endingAt={sessionEndingAt} />
        </section>
      ) : (
        <div className="start-session-layout">
          <aside className="start-session-selection" aria-labelledby="selected-repository-heading">
            <span className="section-kicker">SESSION SETUP</span>
            <h2 id="selected-repository-heading">Repository</h2>
            {selectedRepository ? (
              <div className="selected-repository-summary">
                <span className="selected-repository-mark" aria-hidden="true">{selectedRepository.name?.slice(0, 1).toUpperCase() || 'R'}</span>
                <span className="selected-repository-details">
                  <span className="section-kicker">REPOSITORY</span>
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

            <form className="session-goal-form" onSubmit={handleSubmit}>
              <label className="dashboard-field" htmlFor="session-goal">
                <span>Goal <small>· Optional</small></span>
                <input id="session-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={160} placeholder="What are you working on?" />
              </label>
              <button className="start-session-button" type="submit" disabled={!selectedRepository || loading || Boolean(error)}>
                Start session <span aria-hidden="true">→</span>
              </button>
            </form>
          </aside>

          <section className="repository-browser" aria-labelledby="repository-browser-heading">
            <div className="repository-browser-heading">
              <div><span className="section-kicker">REPOSITORIES</span><h2 id="repository-browser-heading">Choose a repository</h2></div>
              {!loading && !error && <span className="repository-browser-count">{filteredRepositories.length} of {repositories.length}</span>}
            </div>

            <div className="repository-browser-filters">
              <label className="repository-search-field">
                <span>Search</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a repository..." />
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
        </div>
      )}
    </div>
  );
}
