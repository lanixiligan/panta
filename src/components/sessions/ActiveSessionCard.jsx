import React from 'react';

function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function ActiveSessionCard({ session, now, onFinish }) {
  const elapsed = now - session.startedAt;

  return (
    <section className="active-session-card" aria-labelledby="active-session-heading">
      <div className="session-card-topline">
        <span className="section-kicker">CURRENT SESSION</span>
        <span className="active-status"><i /> ACTIVE · LOCAL PREVIEW</span>
      </div>
      <div className="active-session-content">
        <div className="active-session-copy">
          <p className="active-repository-label">{session.repository.full_name || session.repository.name}</p>
          <h2 id="active-session-heading">{session.goal || 'A focused block of coding time'}</h2>
          <p className="active-session-intention">One repository. One thing at a time.</p>
          <div className="active-session-meta">
            <span>Target {session.targetMinutes >= 60 && session.targetMinutes % 60 === 0 ? `${session.targetMinutes / 60}h` : `${session.targetMinutes}m`}</span>
            {session.repository.language && <span>{session.repository.language}</span>}
          </div>
        </div>
        <div className="session-timer" aria-label={`Elapsed time ${formatElapsed(elapsed)}`}>
          <span>{formatElapsed(elapsed)}</span>
          <small>ELAPSED</small>
        </div>
      </div>
      <div className="session-activity-placeholder">
        <span className="activity-pulse" aria-hidden="true" />
        GitHub activity and session saving will connect here later.
      </div>
      <div className="active-session-actions">
        <a className="continue-session-button" href={session.repository.html_url} target="_blank" rel="noreferrer">Continue in repository <span aria-hidden="true">↗</span></a>
        <button className="finish-session-button" type="button" onClick={onFinish}>End local preview</button>
      </div>
    </section>
  );
}
