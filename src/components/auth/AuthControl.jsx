import React, { useEffect, useState } from 'react';

const AUTH_MESSAGES = {
  not_configured: 'GitHub sign-in is not configured yet. Set the server-side GitHub App environment variables.',
  denied: 'GitHub sign-in was cancelled. You can try again whenever you’re ready.',
  state: 'The sign-in request could not be verified. Please start again.',
  repository_access: 'The Panta GitHub App link is not configured. Please contact the person maintaining this workspace.',
  callback: 'GitHub could not complete sign-in. Please try again.',
  exchange: 'GitHub sign-in could not be completed. Please try again.',
};

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="github-mark">
      <path fill="currentColor" d="M8 .2a7.8 7.8 0 0 0-2.47 15.2c.39.07.53-.17.53-.38v-1.35c-2.16.47-2.62-.92-2.62-.92-.36-.9-.88-1.14-.88-1.14-.71-.49.06-.48.06-.48.78.05 1.19.8 1.19.8.7 1.18 1.82.84 2.27.64.07-.5.27-.84.5-1.03-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-.99.08-2.06 0 0 .65-.21 2.14.8A7.4 7.4 0 0 1 8 4.11c.66 0 1.32.09 1.94.26 1.49-1.01 2.14-.8 2.14-.8.43 1.07.16 1.86.08 2.06.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.71.53 1.43v2.06c0 .21.14.46.54.38A7.8 7.8 0 0 0 8 .2Z" />
    </svg>
  );
}

export default function AuthControl({ loginLabel = 'Sign in with GitHub' }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setMessage(AUTH_MESSAGES[authError] || 'GitHub sign-in could not be completed. Please try again.');
      params.delete('auth_error');
      const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }

    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Unable to check sign-in status.');
        return response.json();
      })
      .then((result) => {
        if (cancelled) return;
        setUser(result?.authenticated ? result.user : null);
        setStatus(result?.authenticated ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('unauthenticated');
        setMessage((current) => current || 'Sign-in status is unavailable. Start the app server and try again.');
      });

    return () => { cancelled = true; };
  }, []);

  async function handleLogout() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      setUser(null);
      setStatus('unauthenticated');
    } catch {
      setMessage('Could not sign out right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-control">
      {status === 'loading' && <span className="auth-checking" role="status">Checking sign-in…</span>}
      {status === 'unauthenticated' && (
        <a className="github-sign-in" href="/api/auth/github"><GitHubMark /> {loginLabel}</a>
      )}
      {status === 'authenticated' && user && (
        <div className="auth-user">
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="auth-avatar" width="27" height="27" />}
          <span className="auth-username">{user.username}</span>
          <button className="logout-button" type="button" onClick={handleLogout} disabled={busy}>
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      )}
      {message && <p className="auth-message" role="status">{message}</p>}
    </div>
  );
}
