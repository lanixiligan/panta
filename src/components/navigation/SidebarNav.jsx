import React, { useEffect, useRef, useState } from 'react';
import AuthControl from '../auth/AuthControl.jsx';
import { logoutCurrentUser } from '../../api/auth.js';
import { followRouteLink, routePaths } from '../../routing.js';

const items = [
  { label: 'Overview', view: 'Overview', path: routePaths.Overview, icon: '▣' },
  { label: 'Start a session', view: 'Session Workspace', path: routePaths['Session Workspace'], icon: '+' },
  { label: 'Session History', view: 'Session History', path: routePaths['Session History'], icon: '◷' },
  { label: 'Projects', view: 'Projects', path: routePaths.Projects, icon: '□' },
  { label: 'Analytics', view: 'Analytics', path: routePaths.Analytics, icon: '▥' },
];

function NavLinks({ pathname, onNavigate }) {
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {items.map(({ label, view, path, icon }) => {
        const active = pathname === path || ((view === 'Session History' || view === 'Projects') && pathname.startsWith(`${path}/`));
        return <a key={view} href={path} className={`sidebar-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={(event) => followRouteLink(event, onNavigate)}>
          <span className="sidebar-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </a>;
      })}
    </nav>
  );
}

function MutualRow({ user }) {
  const online = user.presence === 'online';
  return (
    <a href={user.githubUrl} target="_blank" rel="noreferrer" className="sidebar-friend-link" title={`Open ${user.login}'s GitHub profile`}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="sidebar-friend-avatar" width="22" height="22" loading="lazy" />
        : <span className="sidebar-friend-avatar sidebar-friend-avatar-fallback" aria-hidden="true">{user.login?.slice(0, 1)?.toUpperCase() || '?'}</span>}
      <span className="sidebar-friend-copy"><strong translate="no">{user.login}</strong><small translate="no">@{user.login}</small></span>
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

function SocialsSection({ mutuals = [], loading = false, error = '' }) {
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
            <p className="sidebar-socials-note">{loading ? 'Loading mutuals…' : 'Couldn’t load your GitHub mutuals. Panta will try again in a minute.'}</p>
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

function formatElapsed(startedAt, now) {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function ActiveSessionIndicator({ session, now, onNavigate }) {
  if (!session) return null;
  const repository = session.repository?.name || session.repository?.full_name || 'Coding session';
  return (
    <a className="sidebar-live-session" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, onNavigate)} aria-label={`Open active session for ${repository}`}>
      <span className="live-session-heading"><i aria-hidden="true" /> LIVE</span>
      <strong>{repository}</strong>
      <span className="live-session-time">{formatElapsed(session.startedAt, now)}</span>
    </a>
  );
}

function UserProfileMenu({ identity, view, pathname, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      // Keyboard users land back on the button that opened the menu.
      if (rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
      setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await logoutCurrentUser();
      setOpen(false);
      onLogout();
    } catch {
      setError('Could not sign out right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const profileUrl = identity.profileUrl || `https://github.com/${encodeURIComponent(identity.username)}`;
  const displayName = identity.displayName?.trim();

  return (
    <div className="sidebar-account" ref={rootRef}>
      {open && (
        <div className="account-menu" id="account-menu">
          <a href={profileUrl} target="_blank" rel="noreferrer">GitHub Profile <span aria-hidden="true">↗</span></a>
          <a className={pathname === routePaths.Settings ? 'account-menu-active' : undefined} href={routePaths.Settings} aria-current={pathname === routePaths.Settings ? 'page' : undefined} onClick={(event) => { setOpen(false); followRouteLink(event, onNavigate); }}>Settings</a>
          <div className="account-menu-divider" />
          <button className="account-logout" type="button" onClick={logout} disabled={busy}>{busy ? 'Signing out…' : 'Log out'}</button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <button ref={triggerRef} className={`account-trigger${view === 'Settings' ? ' current-settings' : ''}`} type="button" aria-controls="account-menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="account-avatar" width="30" height="30" /> : <span className="account-avatar-placeholder" aria-hidden="true">{identity.username?.charAt(0)?.toUpperCase()}</span>}
        <span className="account-copy"><strong>{displayName || identity.username}</strong><small>@{identity.username}</small></span>
        <span className="account-caret" aria-hidden="true">···</span>
      </button>
    </div>
  );
}

export default function SidebarNav({ identity, identityStatus, view, pathname, onNavigate, activeSession, now, onLogout, mutuals, mutualsLoading, mutualsError }) {
  return (
    <aside className="workspace-sidebar">
      <a className="app-brand sidebar-brand" href={routePaths.Overview} onClick={(event) => followRouteLink(event, onNavigate)} aria-label="Panta overview">
        <span className="brand-symbol" aria-hidden="true">P</span><span><strong>Panta</strong><small>Your work, over time.</small></span>
      </a>
      <NavLinks pathname={pathname} onNavigate={onNavigate} />
      <SocialsSection mutuals={mutuals} loading={mutualsLoading} error={mutualsError} />
      <ActiveSessionIndicator session={activeSession} now={now} onNavigate={onNavigate} />
      <div className="sidebar-bottom">
        {identityStatus === 'authenticated' && identity ? (
          <UserProfileMenu identity={identity} view={view} pathname={pathname} onNavigate={onNavigate} onLogout={onLogout} />
        ) : (
          <div className="sidebar-auth"><AuthControl /></div>
        )}
      </div>
    </aside>
  );
}
