import React from 'react';
import { RecentSessions, WeeklySummary } from '../components/dashboard/DashboardSections.jsx';
import ActiveSessionCard from '../components/sessions/ActiveSessionCard.jsx';

export default function SessionsPage({ sessions, weeklySummary, onSelectSession, onStart, activeSession, now, onFinish }) {
  return (
    <div className="sessions-page">
      <section className="page-intro">
        <span className="section-kicker">SESSIONS · SAMPLE HISTORY</span>
        <h1>Make time for the work.</h1>
        <p>Explore a set of example sessions while session storage is being built.</p>
      </section>
      {activeSession && <ActiveSessionCard session={activeSession} now={now} onFinish={onFinish} />}
      <WeeklySummary summary={weeklySummary} />
      <RecentSessions sessions={sessions} onSelectSession={onSelectSession} onStart={onStart} />
      <p className="session-history-boundary">Example data from <code>src/dummydata/</code>. It is not saved or synced.</p>
    </div>
  );
}
