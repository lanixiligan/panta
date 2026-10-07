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
          <div><span className="section-kicker">WEEKLY TOTALS</span><h2 id="weekly-heading">This week</h2></div>
        </div>
        <EmptyDataNote>Weekly totals will show up here once session history is connected.</EmptyDataNote>
      </section>
    );
  }

  const metrics = [
    { label: 'Sessions', value: summary.sessionCount },
    { label: 'Session duration', value: formatDuration(summary.sessionMinutes) },
    { label: 'Commits', value: summary.commitCount },
    { label: 'Projects', value: summary.repositoryCount },
  ];

  return (
    <section className="dashboard-section weekly-section" aria-labelledby="weekly-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">EXAMPLE DATA</span><h2 id="weekly-heading">This week</h2></div></div>
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
        <span className={`session-source-badge ${session.isPlaceholder ? 'placeholder' : ''}`}>
          {session.isPlaceholder ? 'EXAMPLE' : session.activityStatus === 'loading' ? 'FETCHING GITHUB' : session.activityStatus === 'error' ? 'ACTIVITY UNAVAILABLE' : 'GITHUB ACTIVITY'}
        </span>
        <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
      </div>
      <p className="recent-session-goal">{session.goal || 'Focused coding session'}</p>
      {session.activityStatus === 'loading' ? <p className="recent-session-data-status">Retrieving commits from this session’s timeframe…</p> : session.activityStatus === 'error' ? <p className="recent-session-data-status">GitHub activity could not be retrieved.</p> : <div className="recent-session-stats">
        <span>{session.commitCount} {session.commitCount === 1 ? 'commit' : 'commits'}</span>
        <span>{session.filesChanged} files</span>
        <span className="additions">+{session.additions}</span>
        <span className="deletions">−{session.deletions}</span>
        {session.pullRequestCount > 0 && <span>{session.pullRequestCount} PR</span>}
      </div>}
      <time className="recent-session-date" dateTime={session.finishedAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(session.finishedAt))}</time>
    </>
  );

  return session.detailHref
    ? <a className="recent-session-card" href={session.detailHref} onClick={onSelect ? (event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onSelect(session.id); } : undefined}>{content}</a>
    : <article className="recent-session-card">{content}</article>;
}

export function RecentSessions({ sessions = [], onViewAll, onSelectSession }) {
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <div><span className="section-kicker">RECENT SESSIONS</span><h2 id="recent-heading">Recent sessions</h2></div>
        {sessions.length > 0 && <button className="text-link" type="button" onClick={onViewAll}>Session History <span aria-hidden="true">→</span></button>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list">{sessions.map((session) => <RecentSessionCard key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌁</span>
          <div><span className="section-kicker">NO SESSIONS YET</span><h3>Your first coding session starts here.</h3><p>Start a session to build your development history.</p></div>
        </div>
      )}
    </section>
  );
}

export function CodingNow() {
  return (
    <section className="dashboard-section coding-now-section" aria-labelledby="coding-now-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">CODING NOW</span><h2 id="coding-now-heading">Around the workspace</h2></div></div>
      <div className="presence-empty"><span className="presence-dot" aria-hidden="true" /><p>Mutuals who are coding will appear here once this section is connected.</p></div>
    </section>
  );
}

export function SessionActivity({ days }) {
  const maxDuration = days?.length ? Math.max(1, ...days.map(({ sessionMinutes }) => sessionMinutes)) : 1;
  return (
    <section className="dashboard-section activity-section" aria-labelledby="activity-heading">
      <div className="dashboard-section-heading"><div><span className="section-kicker">EXAMPLE DATA</span><h2 id="activity-heading">A week at a glance</h2></div></div>
      {days?.length ? (
        <div className="session-activity-chart" role="img" aria-label="Session duration by day">
          {days.map((day) => <div className="activity-day" key={day.day}><span className="activity-bar-track"><i style={{ height: `${Math.max(4, day.sessionMinutes / maxDuration * 100)}%` }} /></span><span>{day.day}</span></div>)}
        </div>
      ) : (
        <EmptyDataNote>Session activity will appear here after sessions are recorded.</EmptyDataNote>
      )}
    </section>
  );
}
