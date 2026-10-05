import React, { useEffect, useRef, useState } from 'react';
import { logoutCurrentUser } from '../../api/auth.js';
import { followRouteLink, routePaths } from '../../routing.js';

export default function UserProfileMenu({ identity, view, pathname, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
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
        <div className="account-menu" role="menu" aria-label="Account menu">
          <a role="menuitem" href={routePaths.Profile} aria-current={pathname === routePaths.Profile ? 'page' : undefined} className={pathname === routePaths.Profile ? 'account-menu-active' : undefined} onClick={(event) => { setOpen(false); followRouteLink(event, onNavigate); }}>Profile</a>
          <a role="menuitem" href={profileUrl} target="_blank" rel="noreferrer">GitHub Profile <span aria-hidden="true">↗</span></a>
          <a className={pathname === routePaths.Settings ? 'account-menu-active' : undefined} role="menuitem" href={routePaths.Settings} aria-current={pathname === routePaths.Settings ? 'page' : undefined} onClick={(event) => { setOpen(false); followRouteLink(event, onNavigate); }}>Settings</a>
          <div className="account-menu-divider" />
          <button className="account-logout" type="button" role="menuitem" onClick={logout} disabled={busy}>{busy ? 'Signing out…' : 'Log out'}</button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <button className={`account-trigger${view === 'Settings' ? ' current-settings' : ''}`} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="account-avatar" /> : <span className="account-avatar-placeholder" aria-hidden="true">{identity.username?.charAt(0)?.toUpperCase()}</span>}
        <span className="account-copy"><strong>{displayName || identity.username}</strong><small>@{identity.username}</small></span>
        <span className="account-caret" aria-hidden="true">···</span>
      </button>
    </div>
  );
}
