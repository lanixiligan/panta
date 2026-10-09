import React from 'react';
import { followRouteLink, routePaths } from '../routing.js';

export default function NotFoundPage({ onGoHome }) {
  return (
    <section className="not-found-page">
      <div className="not-found-background" aria-hidden="true">
        404
      </div>

      <div className="not-found-content">
        <div className="not-found-code">
          <span className="not-found-dot" aria-hidden="true" />
          404
        </div>

        <h1>Page not found</h1>

        <p>
          The page you’re looking for doesn't exist, or may have moved.
        </p>

        <a
          className="not-found-action"
          href={routePaths.Overview}
          onClick={(event) => followRouteLink(event, () => onGoHome())}
        >
          <span>Back to Overview</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}