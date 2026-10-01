import React, { useState } from 'react';

const durations = [
  { value: '30', label: '30m' },
  { value: '60', label: '1h' },
  { value: '120', label: '2h' },
  { value: 'custom', label: 'Custom' },
];

export default function SessionStartCard({ repositories, loading, error, onRetry, onStart }) {
  const [repositoryId, setRepositoryId] = useState('');
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState('60');
  const [customMinutes, setCustomMinutes] = useState('90');
  const selectedRepository = repositories.find((repository) => String(repository.id) === repositoryId);

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedRepository) return;
    const targetMinutes = duration === 'custom' ? Number(customMinutes) : Number(duration);
    if (targetMinutes < 5 || targetMinutes > 480) return;
    onStart({ repository: selectedRepository, goal: goal.trim(), targetMinutes });
  }

  return (
    <section className="start-session-card" id="start-session" aria-labelledby="start-session-heading">
      <div className="session-card-topline">
        <span className="section-kicker">START A CODING SESSION</span>
        <span className="single-repo-note">ONE SESSION = ONE REPOSITORY</span>
      </div>
      <h2 id="start-session-heading">Make a little room to focus.</h2>
      <p className="start-session-intro">Choose one project, set an intention, and get into it.</p>

      <form className="session-form" onSubmit={handleSubmit}>
        <label className="dashboard-field">
          <span>Repository</span>
          <select value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} disabled={loading || repositories.length === 0} required>
            <option value="" disabled>{loading ? 'Loading your repositories…' : 'Select a repository'}</option>
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>{repository.full_name || repository.name}</option>
            ))}
          </select>
        </label>
        {selectedRepository && (
          <div className="selected-repository-meta">
            <span>{selectedRepository.description || 'No description provided.'}</span>
            {selectedRepository.language && <span className="project-language">{selectedRepository.language}</span>}
          </div>
        )}

        <label className="dashboard-field">
          <span>Optional goal</span>
          <input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={160} placeholder="What are you trying to accomplish?" />
        </label>

        <fieldset className="duration-field">
          <legend>Target duration</legend>
          <div className="duration-options">
            {durations.map((option) => (
              <button
                className={duration === option.value ? 'duration-option selected' : 'duration-option'}
                key={option.value}
                type="button"
                aria-pressed={duration === option.value}
                onClick={() => setDuration(option.value)}
              >{option.label}</button>
            ))}
            {duration === 'custom' && (
              <label className="custom-duration">
                <input type="number" min="5" max="480" step="5" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} aria-label="Custom target duration in minutes" required />
                <span>min</span>
              </label>
            )}
          </div>
        </fieldset>

        {loading && <p className="inline-dashboard-status" role="status"><span className="dashboard-spinner" /> Loading your repositories…</p>}
        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>Try again</button>
          </div>
        )}
        {!loading && !error && repositories.length === 0 && <p className="inline-dashboard-status">No public repositories found for this GitHub account.</p>}

        <button className="start-session-button" type="submit" disabled={!selectedRepository || loading || Boolean(error)}>
          Start session <span aria-hidden="true">→</span>
        </button>
        <p className="session-prototype-note">Session timing is a local preview for now. Sessions aren’t saved or synced yet.</p>
      </form>
    </section>
  );
}
