import React from 'react';
import AuthControl from '../../components/auth/AuthControl.jsx';
import { PantaWordmark } from '../../components/brand/PantaLogo.jsx';

export default function AuthenticationPage({ identityError, onRetryIdentity }) {
  return (
    <main className="auth-screen">
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
