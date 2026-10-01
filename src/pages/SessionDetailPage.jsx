import React from 'react';

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ') || '<1m';
}

export default function SessionDetailPage({ session, onBack }) {
  const { activity } = session;
  return (
    <article className="session-detail-page">
      <button className="back-button" type="button" onClick={onBack}>← All sessions</button>
      <header className="session-detail-heading">
        <span className="session-complete-label"><i aria-hidden="true" /> SESSION COMPLETE <span>· SAMPLE RECAP</span></span>
        <h1>{session.goal}</h1>
        <a href={`https://github.com/${session.repository.fullName}`} target="_blank" rel="noreferrer">{session.repository.fullName} <span aria-hidden="true">↗</span></a>
        <p>{formatDateTime(session.startedAt)} – {formatDateTime(session.endedAt)} <span>·</span> {formatDuration(session.durationMinutes)}</p>
      </header>
      <section className="session-detail-stats" aria-label="Session activity">
        {[
          ['Commits', activity.commits], ['Files changed', activity.filesChanged], ['Additions', `+${activity.additions}`],
          ['Deletions', `−${activity.deletions}`], ['Pull requests', activity.pullRequests], ['Issues', activity.issues], ['Reviews', activity.reviews],
        ].map(([label, value]) => <div className="dashboard-section session-detail-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>
      <section className="dashboard-section session-commit-section">
        <div className="dashboard-section-heading"><div><span className="section-kicker">COMMIT ACTIVITY</span><h2>Commits in this session</h2></div></div>
        <ol className="session-commit-list">
          {session.commits.map((commit) => (
            <li key={`${commit.sha}-${commit.timestamp}`}><span className="commit-mark" aria-hidden="true" /><div><strong>{commit.message}</strong><small><code>{commit.sha}</code> · {formatDateTime(commit.timestamp)}</small></div></li>
          ))}
        </ol>
      </section>
      <p className="session-history-boundary">This recap is illustrative dummy data and does not represent live GitHub activity.</p>
    </article>
  );
}
