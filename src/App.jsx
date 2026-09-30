import React, { useState } from 'react';
import { getUser, getUserRepositories, searchUsers } from './api/github.js';
import ProfileCard from './components/ProfileCard.jsx';
import RepositoryList from './components/RepositoryList.jsx';
import SearchBar from './components/SearchBar.jsx';
import UserSearchResults from './components/UserSearchResults.jsx';

const RESULTS_PER_PAGE = 10;
const GITHUB_SEARCH_LIMIT = 1000;

export default function App() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [incompleteResults, setIncompleteResults] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [repositories, setRepositories] = useState([]);

  async function handleSearch(event) {
    event.preventDefault();
    setSelectedUser(null);
    setRepositories([]);
    setProfileError('');
    setUsers([]);
    setTotalCount(null);
    setIncompleteResults(false);
    setPage(1);
    setHasMore(false);
    setError('');

    if (!query.trim()) {
      setError('Enter a search term to find GitHub users.');
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchUsers(query, 1, RESULTS_PER_PAGE);
      const firstPage = results.items || [];
      setUsers(firstPage);
      setTotalCount(results.total_count);
      setIncompleteResults(Boolean(results.incomplete_results));
      setHasMore(firstPage.length > 0 && firstPage.length < results.total_count && firstPage.length < GITHUB_SEARCH_LIMIT);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong while searching GitHub.');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleShowMore() {
    if (loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const results = await searchUsers(query, nextPage, RESULTS_PER_PAGE);
      const nextUsers = results.items || [];
      setUsers((currentUsers) => [...currentUsers, ...nextUsers]);
      setPage(nextPage);
      setIncompleteResults((currentValue) => currentValue || Boolean(results.incomplete_results));
      const loadedCount = users.length + nextUsers.length;
      setHasMore(nextUsers.length > 0 && loadedCount < totalCount && loadedCount < GITHUB_SEARCH_LIMIT);
    } catch (requestError) {
      setError(requestError.message || 'Could not load more users. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSelectUser(username) {
    setProfileLoading(true);
    setProfileError('');
    setSelectedUser(null);
    setRepositories([]);
    setError('');
    try {
      const profile = await getUser(username);
      setSelectedUser(profile);
      const repos = await getUserRepositories(username);
      setRepositories(repos);
    } catch (requestError) {
      setProfileError(requestError.message || 'Could not load this GitHub profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  function returnToSearch() {
    setSelectedUser(null);
    setRepositories([]);
    setProfileError('');
  }

  const showingProfile = Boolean(selectedUser) || profileLoading || Boolean(profileError);

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand-mark" href="#top" aria-label="GitHub API Playground home"><span aria-hidden="true">⌘</span></a>
        <div>
          <h1>GitHub API Playground</h1>
          <p>Just playing around with the GitHub API.</p>
        </div>
        <span className="header-tag"><i aria-hidden="true" />PUBLIC API</span>
      </header>

      {!showingProfile && (
        <>
          <section className="search-panel panel" id="top" aria-labelledby="search-heading">
            <div className="search-intro">
              <div className="search-icon" aria-hidden="true">⌕</div>
              <div>
                <p className="eyebrow">USER SEARCH</p>
                <h2 id="search-heading">Search GitHub users</h2>
              </div>
            </div>
            <SearchBar username={query} onUsernameChange={setQuery} onSubmit={handleSearch} loading={searchLoading} disabled={loadingMore} />
            <p className="search-hint">Try a username, name, or GitHub search query like <code>lanix in:login</code>.</p>
          </section>

          {searchLoading && <div className="status-message loading-message" role="status"><span className="loader" aria-hidden="true" /> Searching GitHub...</div>}
          {error && users.length === 0 && <div className="status-message error-message" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
          {!searchLoading && !error && totalCount === null && <div className="initial-note"><span aria-hidden="true">↳</span> Enter a query to explore public GitHub users.</div>}
          {!searchLoading && totalCount !== null && (
            <UserSearchResults
              query={query}
              users={users}
              totalCount={totalCount}
              incompleteResults={incompleteResults}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onSelect={handleSelectUser}
              onShowMore={handleShowMore}
            />
          )}
          {error && users.length > 0 && <div className="status-message error-message" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
        </>
      )}

      {showingProfile && (
        <>
          <button className="back-button" type="button" onClick={returnToSearch}>← Back to user results</button>
          {profileLoading && <div className="status-message loading-message" role="status"><span className="loader" aria-hidden="true" /> Fetching public profile and repositories…</div>}
          {profileError && <div className="status-message error-message" role="alert"><span aria-hidden="true">!</span><p>{profileError}</p></div>}
          {selectedUser && !profileLoading && (
            <div className="results">
              <ProfileCard user={selectedUser} />
              <RepositoryList repositories={repositories} />
            </div>
          )}
        </>
      )}

      <footer className="site-footer"><span>EXPERIMENTAL PROJECT</span><span>Data from the GitHub REST API</span></footer>
    </main>
  );
}
