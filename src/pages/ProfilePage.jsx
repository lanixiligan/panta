import React from 'react';

export default function ProfilePage({ identity, hasSessions, onStart }) {
  return (
    <section className="personal-profile-page">
      <div className="page-intro"><span className="section-kicker">PROFILE</span><h1>Your development history.</h1><p>Your GitHub identity and Panta activity in one place.</p></div>
      <section className="personal-profile-card panel">
        {identity.avatarUrl ? <img className="personal-profile-avatar" src={identity.avatarUrl} alt="" /> : <span className="personal-profile-avatar fallback" aria-hidden="true">{identity.username?.charAt(0)?.toUpperCase()}</span>}
        <div className="personal-profile-copy"><h2>{identity.displayName || identity.username}</h2><p>@{identity.username}</p><a className="text-link" href={identity.profileUrl} target="_blank" rel="noreferrer">View GitHub profile <span aria-hidden="true">↗</span></a></div>
      </section>
      <section className="profile-activity-section">
        <div className="dashboard-section-heading"><div><span className="section-kicker">YOUR ACTIVITY</span><h2>Development history</h2></div></div>
        {hasSessions ? (
          <div className="dashboard-section"><p className="dashboard-empty-note">A local session preview is active. Session history and totals will appear when saving is connected.</p></div>
        ) : (
          <div className="profile-empty-state"><span className="empty-state-mark" aria-hidden="true">◷</span><div><h3>No sessions yet.</h3><p>Start your first coding session to build your development history.</p></div><button className="subtle-action" type="button" onClick={onStart}>Start a session</button></div>
        )}
      </section>
    </section>
  );
}
