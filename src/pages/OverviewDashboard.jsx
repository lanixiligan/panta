import React from 'react';
import ActiveSessionCard from '../components/sessions/ActiveSessionCard.jsx';
import { CodingNow, RecentSessions, SessionActivity, WeeklySummary } from '../components/dashboard/DashboardSections.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewDashboard({ identity, identityStatus, identityError, onRetryIdentity, activeSession, now, isEndingSession, sessionEndingAt, onFinishSession, onNavigateToStart, onViewSessions, recentSessions, weeklySummary, activityDays, onSelectSession }) {
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
          <span className="section-kicker">YOUR WORKSPACE · {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}</span>
          <h1>{greeting()}, {name}.</h1>
          <p>What are we getting together today?</p>
        </div>
        {!activeSession && <button className="start-session-shortcut" type="button" onClick={onNavigateToStart}>Start a session <span aria-hidden="true">→</span></button>}
      </section>

      {activeSession && <ActiveSessionCard session={activeSession} now={now} onFinish={onFinishSession} isEnding={isEndingSession} endingAt={sessionEndingAt} />}

      <RecentSessions sessions={recentSessions} onViewAll={onViewSessions} onSelectSession={onSelectSession} />
      <div className="dashboard-lower-grid">
        <WeeklySummary summary={weeklySummary} />
        <CodingNow />
      </div>
      <SessionActivity days={activityDays} />
    </div>
  );
}
