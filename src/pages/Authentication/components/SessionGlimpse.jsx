import React from 'react';
import { getDummySessionById } from '../../../dummy-data/index.js';
import { getSessionDurationMinutes } from '../../../sessions/sessionHelpers.js';
import { followRouteLink, routePaths } from '../../../routing.js';

// The same handcrafted example session the preview page shows.
const GLIMPSE_SESSION_ID = 'session-001';
const GLIMPSE_COMMITS = 5;

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  return [hours ? `${hours}h` : '', minutes % 60 ? `${minutes % 60}m` : ''].filter(Boolean).join(' ');
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

// Not rendered yet: kept for the sign-in page once the UI is finalized (its stylesheet is commented out in index.css).
// A cropped example session under the sign-in hero, so visitors see what Panta records before connecting GitHub.
export default function SessionGlimpse({ onNavigate }) {
  const session = getDummySessionById(GLIMPSE_SESSION_ID);
  if (!session) return null;
  const { activity } = session;

  return (
    <a className="auth-glimpse" href={routePaths.Preview} onClick={(event) => onNavigate && followRouteLink(event, onNavigate)} aria-label="Open an example session">
      <span className="auth-glimpse-header" aria-hidden="true">
        <span className="auth-glimpse-title">
          <strong>{session.goal}</strong>
          <span>{session.repository.name}</span>
        </span>
        <span className="auth-glimpse-stats">
          <span>{formatDuration(getSessionDurationMinutes(session))}</span>
          <span>{activity.commits} commits</span>
          <span><span className="history-additions">+{activity.additions}</span> <span className="history-deletions">−{activity.deletions}</span></span>
        </span>
      </span>
      <ol className="session-timeline auth-glimpse-timeline" aria-hidden="true">
        {session.commits.slice(0, GLIMPSE_COMMITS).map((commit) => (
          <li key={commit.sha}>
            <div>
              <time dateTime={commit.timestamp}>{formatTime(commit.timestamp)}</time>
              <span className="session-timeline-dot" />
              <span className="session-timeline-body">
                <span className="session-timeline-message">{commit.message}</span>
                <span className="session-timeline-meta"><code className="session-timeline-sha">{commit.sha.slice(0, 7)}</code></span>
              </span>
              <span className="session-timeline-lines"><span className="history-additions">+{commit.additions}</span> <span className="history-deletions">−{commit.deletions}</span></span>
            </div>
          </li>
        ))}
      </ol>
    </a>
  );
}
