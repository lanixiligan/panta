import React from 'react';
import { followRouteLink, routePaths } from '../../routing.js';
import { RecentSessions, WeekRiver } from './components/DashboardSections.jsx';
import RepositoryName from '../../components/repository/RepositoryName.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewPage({ identity, identityStatus, identityError, onRetryIdentity, activeSession, lastSession, now, onNavigateToStart, onViewSessions, recentSessions, weeklySummary, onSelectSession, notice = null, onNavigate }) {
  if (identityStatus === 'loading') {
    return <section className="dashboard-loading" role="status" aria-busy="true" aria-label="Loading your dashboard"><div /><div /><div /></section>;
  }

  if (identityStatus !== 'authenticated') {
    return (
      <section className="dashboard-access-state" role={identityError ? 'alert' : undefined}>
        <h2>{identityError ? 'Couldn’t load your account.' : 'A GitHub account brings this workspace together.'}</h2>
        <p>{identityError || 'Sign in with GitHub to choose a repository and see your personal workspace.'}</p>
        {identityError && <button className="subtle-action" type="button" onClick={onRetryIdentity}>Try again</button>}
      </section>
    );
  }

  const name = identity.displayName?.trim().split(/\s+/)[0] || identity.username;

  return (
    <div className="dashboard-home">
      {/* The greeting and the next step share one row: the running session, or the repository of the last one.
          New users start from the sidebar. The running timer lives in the sidebar's live card, so it isn't repeated here. */}
      <div className="overview-hero">
        <section className="dashboard-greeting">
          <h1>{greeting()}, {name}.</h1>
          <p>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
        </section>

        {activeSession ? (
          <a className="overview-next is-live" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onNavigateToStart())}>
            <span className="overview-next-label"><span className="overview-live-dot" aria-hidden="true" />In session</span>
            <RepositoryName className="overview-next-repo" repository={activeSession.repository} />
            <span className="overview-next-goal">{activeSession.goal || 'No goal set'}</span>
            <span className="overview-next-action">Open session <span aria-hidden="true">→</span></span>
          </a>
        ) : lastSession?.repository?.id != null && (
          <a className="overview-next" href={`${routePaths['Session Workspace']}?repo=${encodeURIComponent(lastSession.repository.id)}`} onClick={(event) => followRouteLink(event, onNavigate)}>
            <span className="overview-next-label">Continue where you left off</span>
            <RepositoryName className="overview-next-repo" repository={lastSession.repository} />
            <span className="overview-next-action">Continue <span aria-hidden="true">→</span></span>
          </a>
        )}
      </div>

      {/* While sessions load or failed to load, one line replaces the totals and the list, which would read as empty. */}
      {notice || (
        <>
          <WeekRiver summary={weeklySummary} now={now} isLive={Boolean(activeSession)} />
          <RecentSessions sessions={recentSessions} onViewAll={onViewSessions} onSelectSession={onSelectSession} onStartSession={onNavigateToStart} />
        </>
      )}
    </div>
  );
}
