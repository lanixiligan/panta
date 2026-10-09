import React, { useState } from 'react';
import packageJson from '../../../package.json';
import { logoutCurrentUser } from '../../api/auth.js';

function SettingsSection({ label, children }) {
  return (
    <section className="settings-section" aria-labelledby={`settings-${label.toLowerCase()}-heading`}>
      <div className="settings-section-heading">
        <h2 id={`settings-${label.toLowerCase()}-heading`}>{label}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage({ identity, onLogout }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const username = identity?.username || '';
  const displayName = identity?.displayName?.trim() || username;
  const profileUrl = identity?.profileUrl || `https://github.com/${encodeURIComponent(username)}`;

  async function disconnectGitHub() {
    setDisconnecting(true);
    setDisconnectError('');
    try {
      await logoutCurrentUser();
      onLogout();
    } catch {
      setDisconnectError('Could not disconnect GitHub right now. Please try again.');
      setDisconnecting(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="page-intro">
        <span className="section-kicker">SETTINGS</span>
        <h1>Settings</h1>
        <p>Manage your Panta account and GitHub connection.</p>
      </div>

      <div className="settings-content">
        <SettingsSection label="Account">
          <div className="settings-account-row">
            {identity?.avatarUrl
              ? <img className="settings-avatar" src={identity.avatarUrl} alt="" width="55" height="55" />
              : <span className="settings-avatar settings-avatar-fallback" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>}
            <div className="settings-account-copy">
              <strong>{displayName}</strong>
              <span>@{username}</span>
              <span className="settings-connected"><i aria-hidden="true" />Connected with GitHub</span>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection label="GitHub">
          <div className="settings-row">
            <div className="settings-row-copy">
              <strong>GitHub account</strong>
              <span>@{username}</span>
            </div>
            <span className="settings-value settings-connected"><i aria-hidden="true" />Connected</span>
          </div>

          <div className="settings-row settings-repository-row">
            <div className="settings-row-copy">
              <strong>Repository access</strong>
              <span>Control which repositories Panta can access through GitHub.</span>
            </div>
            <a className="settings-action-link" href="/api/auth/github/install" target="_blank" rel="noreferrer">
              Manage repository access <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="settings-row settings-disconnect-row">
            <div className="settings-row-copy">
              <strong>Disconnect GitHub</strong>
              <span>Disconnect your GitHub account from Panta.</span>
            </div>
            {confirmingDisconnect ? (
              <div className="settings-disconnect-confirm" role="group" aria-label="Confirm disconnecting GitHub">
                <span>This signs you out of Panta.</span>
                <button className="settings-disconnect-button is-danger" type="button" onClick={disconnectGitHub} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect GitHub'}
                </button>
                <button className="settings-cancel-button" type="button" onClick={() => setConfirmingDisconnect(false)} disabled={disconnecting}>Cancel</button>
              </div>
            ) : (
              <button className="settings-disconnect-button" type="button" onClick={() => setConfirmingDisconnect(true)}>Disconnect</button>
            )}
            {disconnectError && <p className="settings-error" role="alert">{disconnectError}</p>}
          </div>
        </SettingsSection>

        <SettingsSection label="Appearance">
          <div className="settings-row">
            <div className="settings-row-copy">
              <strong>Theme</strong>
            </div>
            <span className="settings-value">Dark</span>
          </div>
        </SettingsSection>

        <SettingsSection label="About">
          <div className="settings-about">
            <div className="settings-about-brand">
              <span className="settings-about-mark" aria-hidden="true">P</span>
              <div><strong>Panta</strong><span>Your work, over time.</span></div>
            </div>
            <div className="settings-about-meta">
              <span>Version {packageJson.version}</span>
              <a href={profileUrl} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
              <span>MIT License</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </section>
  );
}
