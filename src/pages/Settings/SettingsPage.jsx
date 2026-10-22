import React, { useState } from 'react';
import { Layers, Palette } from 'lucide-react';
import ThemeToggle from '../../components/theme/ThemeToggle.jsx';
import { logoutCurrentUser } from '../../api/auth.js';
import { formatCount } from '../../sessions/sessionHelpers.js';

// A titled card of rows; `tone="danger"` marks the destructive group.
function SettingsGroup({ id, title, tone, children }) {
  return (
    <section className={`settings-group${tone ? ` is-${tone}` : ''}`} aria-labelledby={`settings-${id}-heading`}>
      <h2 id={`settings-${id}-heading`}>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, detail, children }) {
  return (
    <div className={`settings-row${Icon ? ' has-icon' : ''}`}>
      {Icon && <Icon className="settings-row-icon" size={18} strokeWidth={1.6} aria-hidden="true" />}
      <div className="settings-row-copy">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export default function SettingsPage({ identity, theme = 'system', onChangeTheme, showExamples = false, onToggleExamples, onLogout, hasActiveSession = false, savedSessionCount = 0, sessionsStatus = 'ready', onDeleteHistory, onDeleteAccount, onBeforeLogout }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmingAccount, setConfirmingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  const username = identity?.username || '';
  const displayName = identity?.displayName?.trim() || username;
  const profileUrl = identity?.profileUrl || `https://github.com/${encodeURIComponent(username)}`;

  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      // Pending goal edits are sent first; they can't be after the session is gone.
      await onBeforeLogout?.();
      await logoutCurrentUser();
      onLogout();
    } catch {
      setSignOutError('Couldn’t sign out right now. Try again.');
      setSigningOut(false);
    }
  }

  async function deleteHistory() {
    setDeletingHistory(true);
    setDeleteError('');
    try {
      await onDeleteHistory();
    } catch {
      setDeleteError('Couldn’t delete your history. Try again.');
    }
    setDeletingHistory(false);
    setConfirmingDelete(false);
  }

  // On success the app reloads to the sign-in page, so the pending label simply stays.
  async function deleteAccount() {
    setDeletingAccount(true);
    setAccountError('');
    try {
      await onDeleteAccount();
    } catch {
      setAccountError('Couldn’t delete your account. Try again.');
      setDeletingAccount(false);
      setConfirmingAccount(false);
    }
  }

  const historyDetail = sessionsStatus === 'loading'
    ? 'Loading sessions…'
    : sessionsStatus === 'error'
      ? 'Couldn’t load your sessions.'
      : savedSessionCount
        ? `Removes ${formatCount(savedSessionCount, 'session')} saved in Panta. This can’t be undone.`
        : 'No saved sessions.';

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
          {/* Signing out pauses a running session, so it asks first only then. */}
          {confirmingSignOut ? (
            <div className="settings-confirm" role="group" aria-label="Confirm signing out">
              <span>Pauses your running session.</span>
              <button className="settings-button" type="button" onClick={() => setConfirmingSignOut(false)} disabled={signingOut}>Cancel</button>
              <button className="settings-button is-danger is-solid" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          ) : (
            <div className="settings-account-actions">
              <a className="settings-button" href={profileUrl} target="_blank" rel="noreferrer">GitHub profile <span aria-hidden="true">↗</span></a>
              <button className="settings-button" type="button" onClick={() => (hasActiveSession ? setConfirmingSignOut(true) : signOut())} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
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

      <SettingsGroup id="preferences" title="Preferences">
        <SettingsRow icon={Palette} label="Appearance" detail="Choose your theme">
          <ThemeToggle value={theme} onChange={onChangeTheme} size="lg" />
        </SettingsRow>
        <SettingsRow icon={Layers} label="Show example data">
          <input className="settings-checkbox" type="checkbox" aria-label="Show example data" checked={showExamples} onChange={(event) => onToggleExamples?.(event.target.checked)} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup id="data" title="Data" tone="danger">
        <SettingsRow label="Delete session history" detail={historyDetail}>
          {confirmingDelete ? (
            <div className="settings-confirm" role="group" aria-label="Confirm deleting session history">
              <button className="settings-button" type="button" onClick={() => setConfirmingDelete(false)} disabled={deletingHistory}>Keep sessions</button>
              <button className="settings-button is-danger is-solid" type="button" onClick={deleteHistory} disabled={deletingHistory}>{deletingHistory ? 'Deleting…' : 'Delete'}</button>
            </div>
          ) : (
            <button className="settings-button is-danger" type="button" onClick={() => setConfirmingDelete(true)} disabled={sessionsStatus !== 'ready' || !savedSessionCount}>Delete history</button>
          )}
        </SettingsRow>
        {deleteError && <p className="settings-error" role="alert">{deleteError}</p>}
        <SettingsRow label="Delete account" detail="Deletes your sessions and disconnects GitHub. This can’t be undone.">
          {confirmingAccount ? (
            <div className="settings-confirm" role="group" aria-label="Confirm deleting your account">
              <button className="settings-button" type="button" onClick={() => setConfirmingAccount(false)} disabled={deletingAccount}>Keep account</button>
              <button className="settings-button is-danger is-solid" type="button" onClick={deleteAccount} disabled={deletingAccount}>{deletingAccount ? 'Deleting…' : 'Delete account'}</button>
            </div>
          ) : (
            <button className="settings-button is-danger" type="button" onClick={() => setConfirmingAccount(true)}>Delete account</button>
          )}
        </SettingsRow>
        {accountError && <p className="settings-error" role="alert">{accountError}</p>}
        <p className="settings-note">Panta stores commit messages, times, and file and line stats. Never code.</p>
      </SettingsGroup>
    </div>
  );
}
