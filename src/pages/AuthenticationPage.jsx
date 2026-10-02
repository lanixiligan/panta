import React from 'react';
import AuthControl from '../components/auth/AuthControl.jsx';

export default function AuthenticationPage({ checking, identityError, onRetryIdentity }) {
  return (
    <main className="auth-screen">
      {/* Reserved for future Panta artwork; keep this background canvas empty until an image is provided. */}
      <div className="auth-background-canvas" aria-hidden="true" />
        <section className="auth-card" aria-labelledby="auth-welcome-heading">
          <header className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true">P</span>
          </header>

        <div className="auth-copy">
          <h1 id="auth-welcome-heading">Welcome back.</h1>
          <p>Continue with GitHub to access your workspace.</p>
          {identityError && (
            <div className="auth-identity-error" role="alert">
              <span>{identityError}</span>
              <button type="button" onClick={onRetryIdentity}>Try again</button>
            </div>
          )}
          {checking ? (
            <p className="auth-screen-checking" role="status">Checking your GitHub session…</p>
          ) : (
            <>
              <AuthControl loginLabel="Continue with GitHub" />
              <p className="auth-security-note">Authentication is handled securely through GitHub OAuth.</p>
            </>
          )}
        </div>
      </section>
      <footer className="auth-page-footer">
        <span>Panta</span><span aria-hidden="true">·</span>
        <a href="https://github.com" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  );
}
