import React, { useState } from 'react';
import AuthControl from '../../components/auth/AuthControl.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

// Commits land at uneven moments, so the dots on the brand line are spaced unevenly too.
const FLOW_DOTS = [6, 22, 30, 52, 66, 78, 94];

export default function AuthenticationPage({ checking, identityError, onRetryIdentity }) {
  const [hello] = useState(greeting);

  return (
    <main className="auth-screen">
      <div className="auth-background-canvas" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-welcome-heading">
        <header className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">P</span>
          <span className="auth-flow" aria-hidden="true">
            {FLOW_DOTS.map((left, index) => <i key={left} style={{ left: `${left}%`, '--i': index }} />)}
          </span>
        </header>

        <div className="auth-copy">
          <h1 id="auth-welcome-heading">{hello}</h1>
          <p>Sign in with GitHub to see your work, over time.</p>
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
              <p className="auth-security-note">Read-only access. Panta never writes to your repositories.</p>
            </>
          )}
        </div>
      </section>
      <footer className="auth-page-footer">
        <span>Panta</span><span aria-hidden="true">·</span>
        <span><span translate="no">panta rhei</span>, everything flows</span>
      </footer>
    </main>
  );
}
