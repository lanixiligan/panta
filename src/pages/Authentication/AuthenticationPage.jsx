import React from 'react';
import AuthControl from '../../components/auth/AuthControl.jsx';
import { PantaWordmark } from '../../components/brand/PantaLogo.jsx';

// Commits land at uneven moments, so the dots on the brand line are spaced unevenly too.
const FLOW_DOTS = [6, 22, 30, 52, 66, 78, 94];

export default function AuthenticationPage({ identityError, onRetryIdentity }) {
  return (
    <main className="auth-screen">
      <div className="auth-background-canvas" aria-hidden="true" />
      <header className="auth-motto">
        <span className="auth-flow" aria-hidden="true">
          {FLOW_DOTS.map((left, index) => <i key={left} style={{ left: `${left}%`, '--i': index }} />)}
        </span>
        <p><span translate="no">Panta rhei</span>, everything flows</p>
      </header>

      <section className="auth-hero" aria-labelledby="auth-heading">
        <h1 id="auth-heading"><PantaWordmark className="auth-wordmark" /></h1>
        <p className="auth-tagline">Your work, over time</p>
        <p className="auth-subline">Pick a repository, set a goal, and get a recap of every commit from the session.</p>

        {identityError && (
          <div className="auth-identity-error" role="alert">
            <span>{identityError}</span>
            <button type="button" onClick={onRetryIdentity}>Try again</button>
          </div>
        )}
        <div className="auth-actions">
          <AuthControl loginLabel="Continue with GitHub" signedOut />
        </div>
      </section>
    </main>
  );
}
