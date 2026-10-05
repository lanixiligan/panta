import React from 'react';

export default function NotFoundPage({ onGoHome }) {
  return (
    <section className="page-intro">
      <span className="section-kicker">404</span>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <button className="subtle-action" type="button" onClick={onGoHome}>Back to Overview</button>
    </section>
  );
}
