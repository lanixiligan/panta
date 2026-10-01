import React, { useEffect, useRef, useState } from 'react';

export default function UserProfileMenu({ identity, onNavigate, onLogout }) {
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
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Sign out failed.');
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
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate('Profile'); }}>Profile</button>
          <a role="menuitem" href={profileUrl} target="_blank" rel="noreferrer">GitHub Profile <span aria-hidden="true">↗</span></a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate('Settings'); }}>Settings <small>Coming soon</small></button>
          <div className="account-menu-divider" />
          <button className="account-logout" type="button" role="menuitem" onClick={logout} disabled={busy}>{busy ? 'Signing out…' : 'Log out'}</button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="account-avatar" /> : <span className="account-avatar-placeholder" aria-hidden="true">{identity.username?.charAt(0)?.toUpperCase()}</span>}
        <span className="account-copy"><strong>{displayName || identity.username}</strong><small>@{identity.username}</small></span>
        <span className="account-caret" aria-hidden="true">···</span>
      </button>
    </div>
  );
}
