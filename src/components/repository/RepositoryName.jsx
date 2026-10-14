import React from 'react';

// Accepts both GitHub's shape (full_name, owner.login) and Panta's (fullName, owner string).
export function repositoryFullName(repository) {
  if (!repository) return '';
  const owner = repository.owner?.login || (typeof repository.owner === 'string' ? repository.owner : '');
  return repository.fullName || repository.full_name || (owner && repository.name ? `${owner}/${repository.name}` : repository.name || '');
}

// Every repository is named the same way: the repository icon, then its name. Repositories are the signed-in user's own, so the owner is left to the tooltip.
export default function RepositoryName({ repository, name = repositoryFullName(repository), className }) {
  return (
    <span className={`repository-name${className ? ` ${className}` : ''}`} title={name}>
      <svg className="repository-name-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" />
      </svg>
      <span className="repository-name-text">{name.slice(name.lastIndexOf('/') + 1)}</span>
    </span>
  );
}
