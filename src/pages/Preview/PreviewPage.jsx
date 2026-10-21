import React from 'react';
import SessionDetailPage from '../SessionHistory/SessionDetailPage.jsx';
import { getDummySessionById } from '../../dummy-data/index.js';
import { routePaths } from '../../routing.js';

// The handcrafted example session shown to visitors before they sign in. Its ID is stable, unlike the generated examples.
const PREVIEW_SESSION_ID = 'session-001';

// A public, read-only look at a session recap, reachable from the sign-in page without a GitHub account.
export default function PreviewPage({ onNavigate, signedIn }) {
  const session = getDummySessionById(PREVIEW_SESSION_ID);

  return (
    <div className="preview-screen">
      <div className="preview-banner">
        <span className="preview-banner-label">Example session</span>
        {signedIn
          ? null
          : <a className="preview-banner-action" href="/api/auth/github">Continue with GitHub <span aria-hidden="true">→</span></a>}
      </div>
      <main className="app-main preview-main" id="main-content">
        <SessionDetailPage
          session={session}
          backHref={signedIn ? routePaths.Overview : '/'}
          backLabel={signedIn ? 'Overview' : 'Sign in'}
          onBack={() => onNavigate('/')}
          onRetryActivity={() => {}}
        />
      </main>
    </div>
  );
}
