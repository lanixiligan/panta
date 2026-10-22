import React, { useState } from 'react';
import { History, Layers, Palette } from 'lucide-react';
import ThemeToggle from '../../components/theme/ThemeToggle.jsx';
import DeleteDialog from './components/DeleteDialog.jsx';
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
  // Which delete dialog is open: 'history', 'account', or none.
  const [deleteDialog, setDeleteDialog] = useState(null);
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
    await onDeleteHistory();
    setDeleteDialog(null);
  }

  const sessionCountLabel = sessionsStatus === 'ready' ? formatCount(savedSessionCount, 'saved session') : '';
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
          <button className="settings-button is-danger" type="button" onClick={() => setDeleteDialog('history')} disabled={sessionsStatus !== 'ready' || !savedSessionCount}>Delete history</button>
        </SettingsRow>
        <SettingsRow label="Delete account" detail="Deletes your sessions and disconnects GitHub. This can’t be undone.">
          <button className="settings-button is-danger" type="button" onClick={() => setDeleteDialog('account')}>Delete account</button>
        </SettingsRow>
        <p className="settings-note">Panta stores commit messages, times, and file and line stats. Never code.</p>
      </SettingsGroup>

      {deleteDialog === 'history' && (
        <DeleteDialog
          title="Delete session history"
          summary={(
            <>
              <span className="delete-dialog-summary-icon" aria-hidden="true"><History size={22} strokeWidth={1.6} /></span>
              <strong>Session history</strong>
              <span>{sessionCountLabel}</span>
            </>
          )}
          startLabel="I want to delete my session history"
          effects={[
            'Permanently deletes every completed session saved in Panta, with its commits and file stats.',
            hasActiveSession ? 'Keeps your running session.' : null,
            'Keeps your account and GitHub connection. Nothing changes on GitHub.',
          ].filter(Boolean)}
          confirmText="delete session history"
          confirmLabel="Delete session history"
          errorMessage="Couldn’t delete your history. Try again."
          onConfirm={deleteHistory}
          onClose={() => setDeleteDialog(null)}
        />
      )}

      {/* On success the app reloads to the sign-in page, so the dialog stays on its pending label. */}
      {deleteDialog === 'account' && (
        <DeleteDialog
          title="Delete Panta account"
          summary={(
            <>
              {identity?.avatarUrl
                ? <img src={identity.avatarUrl} alt="" width="48" height="48" />
                : <span className="delete-dialog-summary-icon" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>}
              <strong>{displayName}</strong>
              <span translate="no">@{username}</span>
              {sessionCountLabel && <span>{sessionCountLabel}</span>}
            </>
          )}
          startLabel="I want to delete my Panta account"
          effects={[
            `Permanently deletes every session saved in Panta${hasActiveSession ? ', including the one running now' : ''}, with its commits and file stats.`,
            'Revokes Panta’s access to your GitHub account and signs you out on every device.',
            'Doesn’t remove the Panta GitHub App from your repositories or change anything on GitHub. Remove the app with Manage on GitHub.',
          ]}
          confirmText={username}
          confirmLabel="Delete my Panta account"
          errorMessage="Couldn’t delete your account. Try again."
          onConfirm={onDeleteAccount}
          onClose={() => setDeleteDialog(null)}
        />
      )}
    </div>
  );
}
