import React from 'react';

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

function EmptyDataNote({ children }) {
  return <p className="dashboard-empty-note">{children}</p>;
}

export function WeeklySummary({ summary }) {
  if (!summary) {
    return (
      <section className="dashboard-section weekly-section" aria-labelledby="weekly-heading">
        <div className="dashboard-section-heading">
          <div><span className="section-kicker">THIS WEEK</span><h2 id="weekly-heading">A little context</h2></div>
        </div>
        <EmptyDataNote>Weekly totals will show up here once session history is connected.</EmptyDataNote>
      </section>
    );
  }

  const metrics = [
    { label: 'Sessions', value: summary.sessionCount },
    { label: 'Focus time', value: formatDuration(summary.focusMinutes) },
    { label: 'Commits', value: summary.commitCount },
    { label: 'Repositories', value: summary.repositoryCount },
  ];

  return (
    <section className="dashboard-section weekly-section" aria-labelledby="weekly-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">THIS WEEK</span><h2 id="weekly-heading">A little context</h2></div></div>
      <div className="weekly-metrics">
        {metrics.map((metric) => <div className="weekly-metric" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
      </div>
    </section>
  );
}

function RecentSessionCard({ session, onSelect }) {
  const content = (
    <>
      <div className="recent-session-heading">
        <span className="recent-session-repo">{session.repositoryName}</span>
        <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
      </div>
      <p className="recent-session-goal">{session.goal || 'Focused coding session'}</p>
      <div className="recent-session-stats">
        <span>{session.commitCount} {session.commitCount === 1 ? 'commit' : 'commits'}</span>
        <span>{session.filesChanged} files</span>
        <span className="additions">+{session.additions}</span>
        <span className="deletions">−{session.deletions}</span>
        {session.pullRequestCount > 0 && <span>{session.pullRequestCount} PR</span>}
      </div>
      <time className="recent-session-date" dateTime={session.finishedAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(session.finishedAt))}</time>
    </>
  );

  return session.detailHref
    ? <a className="recent-session-card" href={session.detailHref} onClick={onSelect ? (event) => { event.preventDefault(); onSelect(session.id); } : undefined}>{content}</a>
    : <article className="recent-session-card">{content}</article>;
}

export function RecentSessions({ sessions = [], onStart, onViewAll, onSelectSession }) {
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <div><span className="section-kicker">RECENT SESSIONS</span><h2 id="recent-heading">Time well spent</h2></div>
        {sessions.length > 0 && <button className="text-link" type="button" onClick={onViewAll}>All sessions <span aria-hidden="true">→</span></button>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list">{sessions.map((session) => <RecentSessionCard key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌁</span>
          <div><span className="section-kicker">NO SESSIONS YET</span><h3>Your first coding session starts here.</h3><p>Session history isn’t connected yet. This space is ready for your recaps.</p></div>
          <button className="subtle-action" type="button" onClick={onStart}>Start a coding session <span aria-hidden="true">→</span></button>
        </div>
      )}
    </section>
  );
}

export function CodingNow() {
  return (
    <section className="dashboard-section coding-now-section" aria-labelledby="coding-now-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">CODING NOW</span><h2 id="coding-now-heading">Around the workspace</h2></div></div>
      <div className="presence-empty"><span className="presence-dot" aria-hidden="true" /><p>Presence for people you follow will appear here when that feature is connected.</p></div>
    </section>
  );
}

export function SessionActivity({ days }) {
  const maxFocus = days?.length ? Math.max(1, ...days.map(({ focusMinutes }) => focusMinutes)) : 1;
  return (
    <section className="dashboard-section activity-section" aria-labelledby="activity-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">SESSION ACTIVITY</span><h2 id="activity-heading">A week at a glance</h2></div></div>
      {days?.length ? (
        <div className="session-activity-chart" role="img" aria-label="Session focus time by day">
          {days.map((day) => <div className="activity-day" key={day.day}><span className="activity-bar-track"><i style={{ height: `${Math.max(4, day.focusMinutes / maxFocus * 100)}%` }} /></span><span>{day.day}</span></div>)}
        </div>
      ) : (
        <EmptyDataNote>Session activity will appear here after sessions are recorded.</EmptyDataNote>
      )}
    </section>
  );
}
