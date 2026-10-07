import React, { useMemo, useState } from 'react';
import SessionSetup from './components/SessionSetup/SessionSetup.jsx';
import ActiveSession from './components/ActiveSession/ActiveSession.jsx';
import SessionRecap from './components/SessionRecap/SessionRecap.jsx';
import { findProjectForRepository } from '../Projects/projectHistory.js';

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

export default function SessionWorkspacePage({ repositories = [], loading, error, onRetry, onStart, activeSession, completedSession, now, onFinish, isEndingSession, sessionEndingAt, onViewCompletedSession, onStartAnother, onRetryActivity, projects = [], onNavigate }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState('updated');
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [goal, setGoal] = useState('');

  const selectedRepository = repositories.find((repository) => String(repository.id) === selectedRepositoryId);
  const selectedProject = useMemo(() => findProjectForRepository(projects, selectedRepository), [projects, selectedRepository]);
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
        <ActiveSession session={activeSession} now={now} onFinish={onFinish} isEnding={isEndingSession} endingAt={sessionEndingAt} />
      ) : (
        <SessionSetup
          repositories={repositories}
          loading={loading}
          error={error}
          onRetry={onRetry}
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
          language={language}
          setLanguage={setLanguage}
          sort={sort}
          setSort={setSort}
          languages={languages}
          filteredRepositories={filteredRepositories}
          selectedProject={selectedProject}
          projects={projects}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
