import React from 'react';
import { formatElapsed } from '../../sessions/sessionHelpers.js';
import { followRouteLink, routePaths } from '../../routing.js';
import { RecentSessions, WeeklySummary } from './components/DashboardSections.jsx';
import WorkCalendar from '../../components/analytics/WorkCalendar.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDay(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function OverviewPage({ identity, identityStatus, identityError, onRetryIdentity, activeSession, lastSession, now, onNavigateToStart, onViewSessions, recentSessions, weeklySummary, onSelectSession, calendarSessions = [], onNavigate }) {
  if (identityStatus === 'loading') {
    return <section className="dashboard-loading" aria-label="Loading your dashboard"><div /><div /><div /></section>;
  }

  if (identityStatus !== 'authenticated') {
    return (
      <section className="dashboard-access-state" role={identityError ? 'alert' : undefined}>
        <span className="section-kicker">GITHUB IDENTITY</span>
        <h2>{identityError ? 'Couldn’t load your account.' : 'A GitHub account brings this workspace together.'}</h2>
        <p>{identityError || 'Sign in with GitHub to choose a repository and see your personal workspace.'}</p>
        {identityError && <button className="subtle-action" type="button" onClick={onRetryIdentity}>Try again</button>}
      </section>
    );
  }

  const name = identity.displayName?.trim().split(/\s+/)[0] || identity.username;

  return (
    <div className="dashboard-home">
      <section className="dashboard-greeting">
        <h1>{greeting()}, {name}.</h1>
        <p>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())} · What are we getting together today?</p>
      </section>

      {/* The next step: the running session, or the repository of the last one. New users start from the sidebar. */}
      {activeSession ? (
        <a className="overview-next" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onNavigateToStart())}>
          <span className="overview-live-dot" aria-hidden="true" />
          <span className="overview-next-repo">{activeSession.repository.name}</span>
          <span className="overview-next-goal">{activeSession.goal || 'No goal set'}</span>
          <span className="overview-live-time">{formatElapsed(now - new Date(activeSession.startedAt).getTime())}</span>
          <span className="overview-next-action">Open session <span aria-hidden="true">→</span></span>
        </a>
      ) : lastSession?.repository?.id != null && (
        <a className="overview-next" href={`${routePaths['Session Workspace']}?repo=${encodeURIComponent(lastSession.repository.id)}`} onClick={(event) => followRouteLink(event, onNavigate)}>
          <span className="overview-next-label">Continue where you left off</span>
          <span className="overview-next-repo">{lastSession.repository.name}</span>
          <span className="overview-next-goal">{lastSession.goal}</span>
          <time className="overview-next-date" dateTime={lastSession.startedAt}>{formatDay(lastSession.startedAt)}</time>
          <span className="overview-next-action">Continue <span aria-hidden="true">→</span></span>
        </a>
      )}

      <WeeklySummary summary={weeklySummary} />

      <div className="dashboard-grid">
        <RecentSessions sessions={recentSessions} onViewAll={onViewSessions} onSelectSession={onSelectSession} />
        <WorkCalendar sessions={calendarSessions} onNavigate={onNavigate} browsable={false} />
      </div>
    </div>
  );
}
