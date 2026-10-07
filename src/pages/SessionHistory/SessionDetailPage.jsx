import React from 'react';
import { getSessionDurationMinutes } from '../../dev-data/index.js';
import SessionCommitList from '../../components/sessions/SessionCommitList.jsx';

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ') || '<1m';
}

function getRepositoryName(repository) {
  return repository.fullName || repository.full_name || `${repository.owner?.login || repository.owner}/${repository.name}`;
}

function getRepositoryUrl(repository) {
  return repository.html_url || repository.htmlUrl || `https://github.com/${getRepositoryName(repository)}`;
}

function ActivityState({ status, error, onRetry }) {
  if (status === 'loading') {
    return <div className="dashboard-section session-activity-state" role="status"><span className="dashboard-spinner" /> Retrieving GitHub commits from this session’s timeframe…</div>;
  }
  if (status === 'error') {
    return <div className="dashboard-error session-activity-state" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Try again</button></div>;
  }
  return null;
}

export default function SessionDetailPage({ session, onBack, onRetryActivity }) {
  const { activity } = session;
  const isPlaceholder = session.source === 'placeholder';
  const activityStatus = isPlaceholder ? 'placeholder' : session.activityStatus;
  const activityReady = isPlaceholder || activityStatus === 'complete';
  const durationMinutes = getSessionDurationMinutes(session);
  const activityMetrics = activity ? [
    ['Commits', activity.commits ?? session.commits?.length ?? 0],
    ['Files changed', activity.filesChanged ?? 0],
    ['Additions', `+${activity.additions ?? 0}`],
    ['Deletions', `−${activity.deletions ?? 0}`],
    ...[['Pull requests', 'pullRequests'], ['Issues', 'issues'], ['Reviews', 'reviews']]
      .filter(([, key]) => Object.hasOwn(activity, key))
      .map(([label, key]) => [label, activity[key]]),
  ] : [];

  return (
    <article className="session-detail-page">
      <button className="back-button" type="button" onClick={onBack}>← Session History</button>
      <header className="session-detail-heading">
        <span className="session-complete-label"><i aria-hidden="true" /> SESSION RECAP <span>· {isPlaceholder ? 'EXAMPLE' : activityStatus === 'loading' ? 'FETCHING GITHUB ACTIVITY' : activityStatus === 'error' ? 'ACTIVITY UNAVAILABLE' : 'GITHUB ACTIVITY'}</span></span>
        <h1>{session.goal || session.repository.name}</h1>
        <a href={getRepositoryUrl(session.repository)} target="_blank" rel="noreferrer">{getRepositoryName(session.repository)} <span aria-hidden="true">↗</span></a>
        <p>{formatDateTime(session.startedAt)} – {formatDateTime(session.endedAt)} <span>·</span> {formatDuration(durationMinutes)}</p>
      </header>
      <ActivityState status={activityStatus} error={session.activityError} onRetry={() => onRetryActivity(session)} />
      {activityReady && activity && <section className="session-detail-stats" aria-label="GitHub activity during this session">
        {activityMetrics.map(([label, value]) => <div className="dashboard-section session-detail-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>}
      {activityReady && !isPlaceholder && activity?.commits === 0 && <div className="dashboard-section session-activity-empty">No GitHub commits were recorded during this session.</div>}
      {activityReady && session.commits?.length > 0 && <section className="dashboard-section session-commit-section">
        <div className="dashboard-section-heading"><div><span className="section-kicker">{isPlaceholder ? 'EXAMPLE ACTIVITY' : 'GITHUB ACTIVITY'}</span><h2>{isPlaceholder ? 'Example commits' : 'Commits recorded during this session'}</h2></div></div>
        <SessionCommitList commits={session.commits} mode="detail" timestampMode="datetime" showDetails order="oldest" />
      </section>}
      {isPlaceholder && <p className="session-history-boundary">Example session only. The commit messages, timestamps, and activity totals were not fetched from GitHub.</p>}
      {!isPlaceholder && activityStatus === 'complete' && <p className="session-history-boundary">Session duration is the time you chose to work. GitHub activity above is what GitHub recorded during that timeframe; it does not represent exact coding time.</p>}
    </article>
  );
}
