import React, { useState } from 'react';

function MutualRow({ user }) {
  const online = user.presence === 'online';
  return (
    <a href={user.githubUrl} target="_blank" rel="noreferrer" className="sidebar-friend-link" title={`Open ${user.login}'s GitHub profile`}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="sidebar-friend-avatar" />
        : <span className="sidebar-friend-avatar sidebar-friend-avatar-fallback" aria-hidden="true">{user.login?.slice(0, 1)?.toUpperCase() || '?'}</span>}
      <span className="sidebar-friend-copy"><strong>{user.login}</strong><small>@{user.login}</small></span>
      <i className={`sidebar-friend-state${online ? ' is-online' : ''}`} role="img" aria-label={online ? 'Online' : 'Offline'} />
    </a>
  );
}

function MutualGroup({ label, users, expanded, onToggle, emptyText }) {
  return (
    <section className="sidebar-friends-group">
      <button className="sidebar-friends-toggle" type="button" aria-expanded={expanded} onClick={onToggle}>
        <span className="sidebar-friends-indicator" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        <span>{label} · {users.length}</span>
      </button>
      {expanded && (users.length ? (
        <ul className="sidebar-friends-list">
          {users.map((user) => <li key={user.githubUserId}><MutualRow user={user} /></li>)}
        </ul>
      ) : <p className="sidebar-friends-empty">{emptyText}</p>)}
    </section>
  );
}

export default function SocialsSection({ mutuals = [], loading = false, error = '' }) {
  const [expanded, setExpanded] = useState(false);
  const [onlineExpanded, setOnlineExpanded] = useState(true);
  const [offlineExpanded, setOfflineExpanded] = useState(false);
  const onlineMutuals = mutuals.filter((user) => user.presence === 'online');
  const offlineMutuals = mutuals.filter((user) => user.presence !== 'online');

  return (
    <section className="sidebar-socials" aria-label="Socials">
      <button className="sidebar-socials-heading" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span>SOCIALS</span><span className="sidebar-socials-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="sidebar-socials-content">
          <div className="sidebar-mutuals-total">Mutuals ({mutuals.length})</div>
          {loading || error ? (
            <p className="sidebar-socials-note">{loading ? 'Loading mutuals…' : 'Unable to load GitHub mutuals.'}</p>
          ) : mutuals.length === 0 ? (
            <p className="sidebar-socials-note">No GitHub mutuals yet.<br />Follow someone who follows you to build your mutuals.</p>
          ) : (
            <>
              <MutualGroup label="ONLINE" users={onlineMutuals} expanded={onlineExpanded} onToggle={() => setOnlineExpanded((value) => !value)} emptyText="No mutuals online." />
              <MutualGroup label="OFFLINE" users={offlineMutuals} expanded={offlineExpanded} onToggle={() => setOfflineExpanded((value) => !value)} emptyText="No offline mutuals." />
            </>
          )}
        </div>
      )}
    </section>
  );
}
