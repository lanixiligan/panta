import React from 'react';

function formatElapsed(startedAt, now) {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function ActiveSessionIndicator({ session, now, onClick }) {
  if (!session) return null;
  const repository = session.repository?.name || session.repository?.full_name || 'Coding session';
  return (
    <button className="sidebar-live-session" type="button" onClick={onClick} aria-label={`Open active session for ${repository}`}>
      <span className="live-session-heading"><i aria-hidden="true" /> LIVE <span>LOCAL PREVIEW</span></span>
      <strong>{repository}</strong>
      <span className="live-session-time">{formatElapsed(session.startedAt, now)}</span>
    </button>
  );
}
