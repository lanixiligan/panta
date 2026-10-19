import React, { useMemo, useState } from 'react';
import SessionSetup from './components/SessionSetup/SessionSetup.jsx';
import ActiveSession from './components/ActiveSession/ActiveSession.jsx';
import SessionRecap from './components/SessionRecap/SessionRecap.jsx';
import { findProjectForRepository } from '../Projects/projectHistory.js';
import { readSearchParam, updateSearchParams } from '../../routing.js';

const phases = [
  { key: 'setup', label: 'Setup', name: 'Session setup' },
  { key: 'active', label: 'Active', name: 'Active session' },
  { key: 'recap', label: 'Recap', name: 'Session recap' },
];

const phaseCopy = {
  setup: { title: 'Start a session', description: 'Choose where you’re working, then start the clock.' },
  active: { title: 'Session in progress', description: 'Session time is running. GitHub activity appears as it’s detected.' },
  recap: { title: 'Session recap', description: 'Here’s what happened during your session.' },
};

const REPOSITORY_TYPES = ['all', 'public', 'private'];
const REPOSITORY_SORTS = ['updated', 'name'];

export default function SessionWorkspacePage({ repositories: githubRepositories = [], exampleRepositories = [], exampleProjects = [], loading, error, onRetry, onStart, starting = false, startError = '', sessionsError = '', onRetrySessions, activeSession, completedSession, now, onFinish, onCancel, onUpdateGoal, isEndingSession, sessionEndingAt, activeSessionError = null, onViewCompletedSession, onStartAnother, onRetryActivity, projects = [], onNavigate }) {
  // Search, type, language, and sort live in the URL (?q=, ?type=, ?language=, ?sort=), so a reload or Back keeps the list as it was.
  const [query, setQueryState] = useState(() => readSearchParam('q') || '');
  const [type, setTypeState] = useState(() => (REPOSITORY_TYPES.includes(readSearchParam('type')) ? readSearchParam('type') : 'all'));
  const [language, setLanguageState] = useState(() => readSearchParam('language') || 'all');
  const [sort, setSortState] = useState(() => (REPOSITORY_SORTS.includes(readSearchParam('sort')) ? readSearchParam('sort') : 'updated'));
  const setQuery = (value) => { setQueryState(value); updateSearchParams({ q: value.trim() ? value : null }); };
  const setType = (value) => { setTypeState(value); updateSearchParams({ type: value === 'all' ? null : value }); };
  const setLanguage = (value) => { setLanguageState(value); updateSearchParams({ language: value === 'all' ? null : value }); };
  const setSort = (value) => { setSortState(value); updateSearchParams({ sort: value === 'updated' ? null : value }); };
  // The selected repository lives in the URL (?repo=<id>), so Overview's "Continue" can open the workspace with it chosen.
  const [selectedRepositoryId, setSelectedRepositoryIdState] = useState(() => readSearchParam('repo') || '');
  const setSelectedRepositoryId = (value) => { setSelectedRepositoryIdState(value); updateSearchParams({ repo: value || null }); };
  const [goal, setGoal] = useState('');

  const repositories = useMemo(() => (githubRepositories.length ? [...githubRepositories, ...exampleRepositories] : githubRepositories), [githubRepositories, exampleRepositories]);
  const selectedRepository = repositories.find((repository) => String(repository.id) === selectedRepositoryId);
  const selectedProject = useMemo(() => findProjectForRepository(selectedRepository?.isExample ? exampleProjects : projects, selectedRepository), [projects, exampleProjects, selectedRepository]);
  const languages = useMemo(() => [...new Set(repositories.map((repository) => repository.language).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [repositories]);
  // A language from an old link that none of the repositories use falls back to all languages.
  const activeLanguage = languages.includes(language) ? language : 'all';
  const filteredRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return repositories
      .filter((repository) => {
        // Search matches the repository name only, not the owner or the description.
        const matchesQuery = !normalizedQuery || repository.name?.toLocaleLowerCase().includes(normalizedQuery);
        const matchesType = type === 'all' || (type === 'private' ? repository.private : !repository.private);
        const matchesLanguage = activeLanguage === 'all' || repository.language === activeLanguage;
        return matchesQuery && matchesType && matchesLanguage;
      })
      .sort((left, right) => sort === 'name'
        ? (left.full_name || left.name).localeCompare(right.full_name || right.name)
        : new Date(right.updated_at || 0) - new Date(left.updated_at || 0));
  }, [repositories, query, type, activeLanguage, sort]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedRepository || selectedRepository.isExample || !goal.trim() || activeSession || starting || loading || error) return;
    onStart({ repository: selectedRepository, goal: goal.trim() });
    // The filters only matter while choosing a repository, so the next setup starts from the full list.
    setQueryState(''); setTypeState('all'); setLanguageState('all'); setSortState('updated');
    updateSearchParams({ q: null, type: null, language: null, sort: null });
  }

  const phase = completedSession ? 'recap' : activeSession ? 'active' : 'setup';
  const phaseIndex = phases.findIndex(({ key }) => key === phase);

  return (
    <div className="session-workspace-page">
      <header className="session-workspace-header">
        <div className="page-intro">
          <h1>{phaseCopy[phase].title}</h1>
          <p>{phaseCopy[phase].description}</p>
        </div>
        <ol className="session-phase-track" aria-label="Session phases">
          {phases.map(({ key, label, name }, index) => {
            const state = index < phaseIndex ? 'done' : index === phaseIndex ? 'current' : 'upcoming';
            return (
              <li key={key} data-state={state} aria-current={state === 'current' ? 'step' : undefined} aria-label={`${name}${state === 'done' ? ' (done)' : ''}`}>
                <span className="session-phase-marker" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
                <span className="session-phase-label">{label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      {completedSession ? (
        <SessionRecap
          session={completedSession}
          onViewSession={onViewCompletedSession}
          onStartAnother={() => { setSelectedRepositoryId(''); setGoal(''); onStartAnother(); }}
          onRetryActivity={onRetryActivity}
        />
      ) : activeSession ? (
        <ActiveSession session={activeSession} now={now} onFinish={onFinish} onCancel={onCancel} onUpdateGoal={onUpdateGoal} isEnding={isEndingSession} endingAt={sessionEndingAt} error={activeSessionError} />
      ) : (
        <SessionSetup
          repositories={repositories}
          loading={loading}
          error={error}
          onRetry={onRetry}
          starting={starting}
          startError={startError}
          sessionsError={sessionsError}
          onRetrySessions={onRetrySessions}
          selectedRepository={selectedRepository}
          selectedRepositoryId={selectedRepositoryId}
          setSelectedRepositoryId={setSelectedRepositoryId}
          goal={goal}
          setGoal={setGoal}
          handleSubmit={handleSubmit}
          query={query}
          setQuery={setQuery}
          type={type}
          setType={setType}
          language={activeLanguage}
          setLanguage={setLanguage}
          sort={sort}
          setSort={setSort}
          languages={languages}
          filteredRepositories={filteredRepositories}
          selectedProject={selectedProject}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
