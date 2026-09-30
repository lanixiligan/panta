import React from 'react';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function RepositoryCard({ repository }) {
  return (
    <article className="repo-card panel">
      <div className="repo-heading">
        <a className="repo-name" href={repository.html_url} target="_blank" rel="noreferrer">{repository.name} <span aria-hidden="true">↗</span></a>
        {repository.private && <span className="private-badge">Private</span>}
      </div>
      <p className="repo-description">{repository.description || 'No description provided.'}</p>
      <div className="repo-meta">
        {repository.language && <span className="language"><i aria-hidden="true" />{repository.language}</span>}
        <span title="Stars">☆ {repository.stargazers_count.toLocaleString()}</span>
        <span title="Forks">⑂ {repository.forks_count.toLocaleString()}</span>
        <span title="Open issues">◎ {repository.open_issues_count.toLocaleString()}</span>
      </div>
      <p className="repo-updated">Updated {formatDate(repository.updated_at)}</p>
    </article>
  );
}
