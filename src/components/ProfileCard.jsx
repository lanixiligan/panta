import React from 'react';

function Detail({ label, children, href }) {
  if (!children) return null;
  return (
    <div className="profile-detail">
      <span className="detail-label">{label}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>}
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(value));
}

export default function ProfileCard({ user }) {
  const website = user.blog?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : undefined;

  return (
    <section className="profile-card panel" aria-labelledby="profile-heading">
      <div className="profile-main">
        <img className="avatar" src={user.avatar_url} alt={`${user.login}'s avatar`} />
        <div className="profile-copy">
          <p className="eyebrow">PUBLIC PROFILE</p>
          <h2 id="profile-heading">{user.name || user.login}</h2>
          {user.name && <a className="profile-username" href={user.html_url} target="_blank" rel="noreferrer">@{user.login}</a>}
          {!user.name && <a className="profile-username" href={user.html_url} target="_blank" rel="noreferrer">View on GitHub ↗</a>}
          {user.bio && <p className="bio">{user.bio}</p>}
        </div>
      </div>

      <div className="profile-details">
        <Detail label="LOCATION" >{user.location}</Detail>
        <Detail label="COMPANY">{user.company}</Detail>
        <Detail label="WEBSITE" href={websiteHref}>{website?.replace(/^https?:\/\//i, '')}</Detail>
        <Detail label="ON GITHUB SINCE">{user.created_at ? formatDate(user.created_at) : null}</Detail>
      </div>

      <div className="profile-stats" aria-label="GitHub statistics">
        <div><strong>{user.public_repos.toLocaleString()}</strong><span>Repositories</span></div>
        <div><strong>{user.followers.toLocaleString()}</strong><span>Followers</span></div>
        <div><strong>{user.following.toLocaleString()}</strong><span>Following</span></div>
      </div>
    </section>
  );
}
