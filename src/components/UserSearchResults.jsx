import React from 'react';

function UserResult({ user, onSelect }) {
  return (
    <article className="user-result panel">
      <button className="user-result-select" type="button" onClick={() => onSelect(user.login)}>
        <img className="user-result-avatar" src={user.avatar_url} alt="" />
        <span className="user-result-copy">
          <strong>{user.login}</strong>
          <span>{user.type || 'User'}</span>
        </span>
        <span className="inspect-label">Inspect →</span>
      </button>
      <a className="user-profile-link" href={user.html_url} target="_blank" rel="noreferrer" aria-label={`Open ${user.login} on GitHub`}>
        GitHub profile ↗
      </a>
    </article>
  );
}

export default function UserSearchResults({ query, users, totalCount, incompleteResults, hasMore, loadingMore, onSelect, onShowMore }) {
  return (
    <section className="user-search-results" aria-labelledby="user-results-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEARCH RESULTS</p>
          <h2 id="user-results-heading">Users</h2>
        </div>
        {Number.isFinite(totalCount) && <span className="count-badge">{totalCount.toLocaleString()} {totalCount === 1 ? 'user' : 'users'} found · {users.length} shown</span>}
      </div>

      {users.length === 0 ? (
        <div className="empty-repositories panel">No GitHub users found for “{query}”.</div>
      ) : (
        <>
          <div className="user-result-list">
            {users.map((user) => <UserResult key={user.id} user={user} onSelect={onSelect} />)}
          </div>
          {hasMore && (
            <div className="show-more-wrap">
              <button className="show-more-button" type="button" onClick={onShowMore} disabled={loadingMore}>
                {loadingMore ? <><span className="button-spinner dark-spinner" aria-hidden="true" /> Loading more users...</> : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
      {incompleteResults && <p className="incomplete-results-note">GitHub marked these search results as incomplete.</p>}
    </section>
  );
}
