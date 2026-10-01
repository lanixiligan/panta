import React from 'react';
import RepositoryCard from './RepositoryCard.jsx';

export default function RepositoryList({ repositories }) {
  return (
    <section className="repositories-section" aria-labelledby="repositories-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EXPLORER</p>
          <h2 id="repositories-heading">Repositories</h2>
        </div>
        <span className="count-badge">{repositories.length} shown</span>
      </div>
      {repositories.length ? (
        <div className="repo-grid">
          {repositories.map((repository) => <RepositoryCard key={repository.id} repository={repository} />)}
        </div>
      ) : (
        <div className="empty-repositories panel">No public repositories to show.</div>
      )}
    </section>
  );
}
