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

export default function OverviewPage({ identity, identityStatus, identityError, onRetryIdentity, activeSession, now, onNavigateToStart, onViewSessions, recentSessions, weeklySummary, onSelectSession, calendarSessions = [], onNavigate }) {
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
        <div>
          <h1>{greeting()}, {name}.</h1>
          <p>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())} · What are we getting together today?</p>
        </div>
        {!activeSession && <a className="session-workspace-shortcut" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onNavigateToStart())}>Start a session <span aria-hidden="true">→</span></a>}
      </section>

      {activeSession && (
        <a className="overview-live-session" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onNavigateToStart())}>
          <span className="overview-live-dot" aria-hidden="true" />
          <span className="overview-live-repo">{activeSession.repository.name}</span>
          <span className="overview-live-goal">{activeSession.goal || 'No goal set'}</span>
          <span className="overview-live-time">{formatElapsed(now - new Date(activeSession.startedAt).getTime())}</span>
          <span className="overview-live-open">Open session <span aria-hidden="true">→</span></span>
        </a>
      )}

      <div className="dashboard-grid">
        <RecentSessions sessions={recentSessions} onViewAll={onViewSessions} onSelectSession={onSelectSession} />
        <WorkCalendar sessions={calendarSessions} onNavigate={onNavigate} browsable={false} />
        <WeeklySummary summary={weeklySummary} />
      </div>
    </div>
  );
}
