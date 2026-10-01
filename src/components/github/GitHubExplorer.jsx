import React, { useRef, useState } from 'react';
import { getUser, getUserRepositories, searchUsers } from '../../api/github.js';
import { getContributionCalendar } from '../../api/githubGraphql.js';
import ContributionGraph from './ContributionGraph.jsx';
import ProfileCard from './ProfileCard.jsx';
import RepositoryList from './RepositoryList.jsx';
import SearchBar from './SearchBar.jsx';
import UserSearchResults from './UserSearchResults.jsx';

const RESULTS_PER_PAGE = 10;
const GITHUB_SEARCH_LIMIT = 1000;

export default function GitHubExplorer() {
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
  const [contributionCalendar, setContributionCalendar] = useState(null);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [contributionError, setContributionError] = useState('');
  const selectionId = useRef(0);

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
    const requestId = ++selectionId.current;
    setProfileLoading(true);
    setProfileError('');
    setSelectedUser(null);
    setRepositories([]);
    setContributionCalendar(null);
    setContributionError('');
    setContributionLoading(false);
    setError('');
    try {
      const profile = await getUser(username);
      if (requestId !== selectionId.current) return;
      setSelectedUser(profile);
      setProfileLoading(false);
      setContributionLoading(true);

      const [reposResult, contributionsResult] = await Promise.allSettled([
        getUserRepositories(username),
        getContributionCalendar(username),
      ]);
      if (requestId !== selectionId.current) return;
      if (reposResult.status === 'fulfilled') setRepositories(reposResult.value);
      else setProfileError(reposResult.reason.message || 'Could not load this user’s repositories.');
      if (contributionsResult.status === 'fulfilled') setContributionCalendar(contributionsResult.value);
      else setContributionError(contributionsResult.reason.message || 'Could not load contribution data.');
    } catch (requestError) {
      if (requestId === selectionId.current) setProfileError(requestError.message || 'Could not load this GitHub profile.');
    } finally {
      if (requestId === selectionId.current) {
        setProfileLoading(false);
        setContributionLoading(false);
      }
    }
  }

  function returnToSearch() {
    selectionId.current += 1;
    setSelectedUser(null);
    setRepositories([]);
    setProfileError('');
    setContributionCalendar(null);
    setContributionError('');
    setContributionLoading(false);
  }

  const showingProfile = Boolean(selectedUser) || profileLoading || Boolean(profileError);

  return (
    <section className="explorer-view" aria-label="Public GitHub API explorer">
      {!showingProfile && (
        <>
          <section className="search-panel panel" aria-labelledby="explorer-heading">
            <div className="search-intro">
              <div className="search-icon" aria-hidden="true">⌕</div>
              <div>
                <p className="eyebrow">PUBLIC API EXPERIMENT</p>
                <h2 id="explorer-heading">Search GitHub users</h2>
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
          {profileLoading && <div className="status-message loading-message" role="status"><span className="loader" aria-hidden="true" /> Fetching public profile…</div>}
          {profileError && <div className="status-message error-message" role="alert"><span aria-hidden="true">!</span><p>{profileError}</p></div>}
          {selectedUser && !profileLoading && (
            <div className="results">
              <ProfileCard user={selectedUser} />
              <ContributionGraph calendar={contributionCalendar} loading={contributionLoading} error={contributionError} />
              <RepositoryList repositories={repositories} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
