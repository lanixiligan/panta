import React from 'react';
import { followRouteLink, routePaths } from '../routing.js';

export default function NotFoundPage({ onGoHome }) {
  return (
    <section className="not-found-page">
      <div className="not-found-content">
        <h1>Page not found</h1>

        <p>
          The page you’re looking for doesn’t exist, or may have moved.
        </p>

        <a
          className="not-found-action"
          href={routePaths['Session Workspace']}
          onClick={(event) => followRouteLink(event, () => onGoHome())}
        >
          Back to Session Workspace
        </a>
      </div>
    </section>
  );
}