import React from 'react';

export default function SearchBar({ username, onUsernameChange, onSubmit, loading, disabled = false }) {
  return (
    <form className="search-form" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="username">Search GitHub users</label>
      <span className="input-prefix" aria-hidden="true">⌕</span>
      <input
        id="username"
        name="username"
        type="text"
        autoComplete="off"
        spellCheck="false"
        placeholder="Search GitHub users"
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        disabled={loading || disabled}
      />
      <button type="submit" disabled={loading || disabled}>
        {loading ? <><span className="button-spinner" aria-hidden="true" /> Searching</> : 'Search'}
      </button>
    </form>
  );
}
