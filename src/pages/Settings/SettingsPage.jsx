import React, { useState } from 'react';
import { logoutCurrentUser } from '../../api/auth.js';

// A titled card of rows; `tone="danger"` marks the destructive group.
function SettingsGroup({ id, title, tone, children }) {
  return (
    <section className={`settings-group${tone ? ` is-${tone}` : ''}`} aria-labelledby={`settings-${id}-heading`}>
      <h2 id={`settings-${id}-heading`}>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function SettingsRow({ label, detail, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

export default function SettingsPage({ identity, onLogout, hasActiveSession = false, savedSessionCount = 0, onDeleteHistory }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const username = identity?.username || '';
  const displayName = identity?.displayName?.trim() || username;
  const profileUrl = identity?.profileUrl || `https://github.com/${encodeURIComponent(username)}`;

  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await logoutCurrentUser();
      onLogout();
    } catch {
      setSignOutError('Couldn’t sign out right now. Try again.');
      setSigningOut(false);
    }
  }

  function deleteHistory() {
    onDeleteHistory();
    setConfirmingDelete(false);
  }

  return (
    <div className="settings-page">
      <section className="page-intro">
        <h1>Settings</h1>
      </section>

      <SettingsGroup id="account" title="Account">
        <div className="settings-account">
          {identity?.avatarUrl
            ? <img className="settings-avatar" src={identity.avatarUrl} alt="" width="48" height="48" />
            : <span className="settings-avatar settings-avatar-fallback" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>}
          <div className="settings-account-copy">
            <strong>{displayName}</strong>
            <span translate="no">@{username}</span>
          </div>
          <a className="settings-button" href={profileUrl} target="_blank" rel="noreferrer">GitHub profile <span aria-hidden="true">↗</span></a>
        </div>
        {/* Signing out keeps saved sessions; it only asks first when it would end a running session. */}
        <SettingsRow label="Sign out" detail="Your saved sessions stay in this browser.">
          {confirmingSignOut ? (
            <div className="settings-confirm" role="group" aria-label="Confirm signing out">
              <span>Ends your running session.</span>
              <button className="settings-button" type="button" onClick={() => setConfirmingSignOut(false)} disabled={signingOut}>Cancel</button>
              <button className="settings-button is-danger is-solid" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          ) : (
            <button className="settings-button" type="button" onClick={() => (hasActiveSession ? setConfirmingSignOut(true) : signOut())} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </SettingsRow>
        {signOutError && <p className="settings-error" role="alert">{signOutError}</p>}
      </SettingsGroup>

      <SettingsGroup id="github" title="GitHub">
        <SettingsRow label="Connection">
          <span className="settings-status"><i aria-hidden="true" />Connected</span>
        </SettingsRow>
        <SettingsRow label="Repository access" detail="Choose which repositories Panta can read.">
          <a className="settings-button" href="/api/auth/github/install" target="_blank" rel="noreferrer">Manage on GitHub <span aria-hidden="true">↗</span></a>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup id="data" title="Session history" tone="danger">
        <SettingsRow
          label="Delete session history"
          detail={savedSessionCount ? `Removes ${formatCount(savedSessionCount, 'session')} saved in this browser. This can’t be undone.` : 'No sessions saved in this browser.'}
        >
          {confirmingDelete ? (
            <div className="settings-confirm" role="group" aria-label="Confirm deleting session history">
              <button className="settings-button" type="button" onClick={() => setConfirmingDelete(false)}>Keep sessions</button>
              <button className="settings-button is-danger is-solid" type="button" onClick={deleteHistory}>Delete</button>
            </div>
          ) : (
            <button className="settings-button is-danger" type="button" onClick={() => setConfirmingDelete(true)} disabled={!savedSessionCount}>Delete history</button>
          )}
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
