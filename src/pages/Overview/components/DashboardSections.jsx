import React from 'react';

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ') || '<1m';
}

function formatShortDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

export function WeeklySummary({ summary }) {
  const metrics = [
    { label: 'Sessions', value: summary.sessionCount },
    { label: 'Session time', value: formatDuration(summary.sessionMinutes) },
    { label: 'Commits', value: summary.commitCount ?? '—', title: summary.commitCount === null ? 'No GitHub activity recorded this week' : undefined },
    { label: 'Projects', value: summary.repositoryCount },
  ];
  const maxMinutes = Math.max(1, ...summary.days.map(({ sessionMinutes }) => sessionMinutes));

  return (
    <section className="dashboard-section weekly-section" aria-labelledby="weekly-heading">
      <div className="dashboard-section-heading">
        <h2 id="weekly-heading">This week</h2>
        <span className="dashboard-section-meta">{formatShortDate(summary.start)} – {formatShortDate(summary.end)}</span>
      </div>
      <div className="weekly-metrics">
        {metrics.map((metric) => <div className="weekly-metric" key={metric.label} title={metric.title}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
      </div>
      <div className="session-activity-chart" role="img" aria-label="Session time by day this week">
        {summary.days.map((day) => (
          <div className={`activity-day ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`} key={day.date} title={day.isFuture ? undefined : `${day.label}: ${formatDuration(day.sessionMinutes)}`}>
            <span className="activity-bar-track">
              {day.sessionMinutes > 0 && <i style={{ height: `${Math.max(6, (day.sessionMinutes / maxMinutes) * 100)}%` }} />}
            </span>
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentSessionRow({ session, onSelect }) {
  const status = session.activityStatus === 'loading'
    ? 'Fetching GitHub…'
    : session.activityStatus === 'error' || !session.hasActivity
      ? 'Activity unavailable'
      : session.commitCount === 0 ? 'No commits' : `${session.commitCount} ${session.commitCount === 1 ? 'commit' : 'commits'}`;

  return (
    <a
      className="recent-session-row"
      href={session.detailHref}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(session.id);
      }}
    >
      <span className="recent-session-main">
        <span className={`recent-session-goal ${session.goal ? '' : 'empty'}`}>{session.goal || 'No goal set'}</span>
        <span className="recent-session-meta">
          <span className="recent-session-repo">{session.repositoryName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={session.startedAt}>{formatShortDate(session.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          {session.isPlaceholder && <span className="session-source-badge placeholder">EXAMPLE</span>}
        </span>
      </span>
      <span className="recent-session-commits">{status}</span>
      <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
    </a>
  );
}

export function RecentSessions({ sessions = [], onViewAll, onSelectSession }) {
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <h2 id="recent-heading">Recent sessions</h2>
        {sessions.length > 0 && <button className="text-link" type="button" onClick={onViewAll}>View all <span aria-hidden="true">→</span></button>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list">{sessions.map((session) => <RecentSessionRow key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <div className="session-empty-state">
          <span className="empty-state-mark" aria-hidden="true">⌁</span>
          <div><span className="section-kicker">NO SESSIONS YET</span><h3>Your first coding session starts here.</h3><p>Start a session to build your development history.</p></div>
        </div>
      )}
    </section>
  );
}

// Presence only says a mutual has Panta open; it does not reveal what they are working on.
export function OnlineNow({ mutuals = [], loading }) {
  const online = mutuals.filter((user) => user.presence === 'online');

  return (
    <section className="dashboard-section online-now-section" aria-labelledby="online-now-heading">
      <div className="dashboard-section-heading">
        <h2 id="online-now-heading">Online now</h2>
        {!loading && <span className="dashboard-section-meta">{online.length} of {mutuals.length} mutuals</span>}
      </div>
      {loading ? (
        <p className="dashboard-empty-note">Checking who’s around…</p>
      ) : online.length ? (
        <ul className="online-now-list">
          {online.map((user) => (
            <li key={user.login}>
              <a href={user.githubUrl} target="_blank" rel="noreferrer" title={`Open ${user.login}'s GitHub profile`}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="" />
                  : <span className="online-now-fallback" aria-hidden="true">{user.login?.slice(0, 1)?.toUpperCase() || '?'}</span>}
                <span>{user.login}</span>
                <i aria-label="Online" role="img" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="presence-empty">
          <span className="presence-dot" aria-hidden="true" />
          <p>{mutuals.length ? 'None of your mutuals have Panta open right now.' : 'Mutuals on GitHub who use Panta will show up here when they’re online.'}</p>
        </div>
      )}
    </section>
  );
}
