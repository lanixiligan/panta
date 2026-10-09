import React, { useState } from 'react';
import { getSessionDurationMinutes } from '../../sessions/sessionHelpers.js';
import { orderCommits } from '../../components/sessions/SessionCommitList.jsx';
import { followRouteLink, routePaths } from '../../routing.js';

const FILE_STATUS_LETTERS = { added: 'A', modified: 'M', removed: 'D', renamed: 'R', copied: 'C', changed: 'M' };
const FILE_TYPE_LIMIT = 5;

function isValidDate(value) {
  return Number.isFinite(Date.parse(value || ''));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

// "7:02 – 9:16 PM": the shared day period is written once.
function formatTimeRange(startedAt, endedAt) {
  const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return formatter.formatRange(new Date(startedAt), new Date(endedAt));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatSessionDate(startedAt, endedAt) {
  if (!isValidDate(startedAt)) return 'Date unavailable';
  if (!isValidDate(endedAt) || new Date(startedAt).toDateString() === new Date(endedAt).toDateString()) return formatDate(startedAt);
  return `${formatDate(startedAt)} – ${formatDate(endedAt)}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ') || 'Under 1m';
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getRepositoryName(repository) {
  return repository.fullName || repository.full_name || `${repository.owner?.login || repository.owner}/${repository.name}`;
}

function getRepositoryUrl(repository) {
  return repository.html_url || repository.htmlUrl || `https://github.com/${getRepositoryName(repository)}`;
}

function getBranchSummary(commits) {
  const counts = new Map();
  commits.forEach((commit) => (commit.branches || []).forEach((branch) => counts.set(branch, (counts.get(branch) || 0) + 1)));
  return [...counts].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function getFilesTouched(commits) {
  const files = new Map();
  orderCommits(commits, 'oldest').forEach((commit) => {
    (commit.files || []).forEach((file) => {
      const current = files.get(file.filename) || { filename: file.filename, additions: 0, deletions: 0, status: file.status };
      files.set(file.filename, {
        ...current,
        additions: current.additions + file.additions,
        deletions: current.deletions + file.deletions,
        status: current.status === 'added' && file.status !== 'removed' ? 'added' : file.status,
      });
    });
  });
  return [...files.values()].sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions) || left.filename.localeCompare(right.filename));
}

function getFileType(filename) {
  const name = filename.slice(filename.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : name;
}

// Share of changed lines per file type; files with no line changes (images, binaries) carry no weight.
function getFileTypeBreakdown(files) {
  const lines = new Map();
  files.forEach((file) => {
    const type = getFileType(file.filename);
    lines.set(type, (lines.get(type) || 0) + file.additions + file.deletions);
  });
  const total = [...lines.values()].reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  const sorted = [...lines].filter(([, value]) => value > 0).sort((left, right) => right[1] - left[1]);
  const shown = sorted.slice(0, FILE_TYPE_LIMIT).map(([type, value]) => ({ type, share: value / total }));
  const rest = sorted.slice(FILE_TYPE_LIMIT).reduce((sum, [, value]) => sum + value, 0);
  return rest ? [...shown, { type: 'Other', share: rest / total }] : shown;
}

function getCompareUrl(session, commits, branches) {
  if (!commits.length || branches.length !== 1) return null;
  const ordered = orderCommits(commits, 'oldest');
  const base = getRepositoryUrl(session.repository);
  if (ordered.length === 1) return ordered[0].htmlUrl || `${base}/commit/${ordered[0].sha}`;
  return `${base}/compare/${ordered[0].sha}%5E...${ordered[ordered.length - 1].sha}`;
}

function RepositoryLink({ repository }) {
  const fullName = getRepositoryName(repository);
  const slash = fullName.indexOf('/');
  return (
    <a className="session-detail-repo" href={getRepositoryUrl(repository)} target="_blank" rel="noreferrer">
      {slash >= 0 ? <><span>{fullName.slice(0, slash + 1)}</span>{fullName.slice(slash + 1)}</> : fullName}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

function DeleteSession({ onDelete }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button className="session-detail-delete" type="button" onClick={() => setConfirming(true)}>Delete session</button>;
  }
  return (
    <div className="session-detail-delete-confirm" role="group" aria-label="Confirm deleting this session">
      <span>Delete this session from history?</span>
      <button className="session-detail-delete danger" type="button" onClick={onDelete}>Delete</button>
      <button className="session-detail-delete" type="button" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}

function SessionSummary({ session, isPlaceholder, branches, onRetry }) {
  const { activity } = session;
  const status = isPlaceholder ? 'placeholder' : session.activityStatus;
  const isChecking = status === 'loading';
  const commitCount = activity?.commits ?? session.commits?.length;
  const hasTimes = isValidDate(session.startedAt) && isValidDate(session.endedAt);

  let activityBody;
  if (!activity && status === 'error') {
    activityBody = null;
  } else if (!activity && isChecking) {
    activityBody = <p className="session-summary-message" role="status"><span className="dashboard-spinner" /> Retrieving commits from this session’s timeframe…</p>;
  } else if (!activity) {
    activityBody = (
      <div className="session-summary-row">
        <strong className="session-summary-figure muted">Unavailable</strong>
        <p className="session-summary-message">GitHub activity was not recorded for this session.</p>
      </div>
    );
  } else if (commitCount === 0) {
    activityBody = (
      <div className="session-summary-row">
        <strong className="session-summary-figure muted">No commits</strong>
        <p className="session-summary-message">Commits pushed after the session ended will appear when you check again.</p>
      </div>
    );
  } else {
    activityBody = (
      <>
        <div className="session-summary-row">
          <strong className="session-summary-figure">{formatCount(commitCount, 'commit')}</strong>
          <dl className="session-summary-facts">
            <div>
              <dt>Lines</dt>
              <dd>
                {activity.additions === undefined ? 'Unavailable' : (
                  <><span className="history-additions">+{activity.additions}</span> <span className="history-deletions">−{activity.deletions}</span></>
                )}
              </dd>
            </div>
          </dl>
        </div>
        {branches.length > 0 && (
          <div className="session-summary-branches">
            <span>{branches.length === 1 ? 'Branch' : 'Branches'}</span>
            <ul>
              {branches.map(({ name, count }) => (
                <li key={name}><code translate="no">{name}</code>{branches.length > 1 && <small>{count}</small>}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="session-summary" aria-label="Session summary">
      <div className="session-summary-part">
        <span className="section-kicker">SESSION TIME</span>
        <strong className="session-summary-figure">{hasTimes ? formatDuration(getSessionDurationMinutes(session)) : 'Unavailable'}</strong>
        {hasTimes && <span className="session-summary-range">{formatTimeRange(session.startedAt, session.endedAt)}</span>}
      </div>

      <div className="session-summary-part">
        <div className="session-summary-part-heading">
          <span className="section-kicker">{isPlaceholder ? 'ACTIVITY' : 'GITHUB ACTIVITY'}</span>
          {!isPlaceholder && (
            <button className="session-detail-refresh" type="button" onClick={onRetry} disabled={isChecking}>
              {isChecking ? 'Checking GitHub…' : 'Check GitHub again'}
            </button>
          )}
        </div>
        {status === 'error' && (
          <p className="session-summary-message error" role="alert">{session.activityError || 'Could not retrieve GitHub activity for this session.'}</p>
        )}
        {activityBody}
        {!isPlaceholder && isValidDate(session.activityCheckedAt) && (
          <p className="session-summary-note">Last checked {formatDateTime(session.activityCheckedAt)}</p>
        )}
      </div>
    </section>
  );
}

function CommitTimeline({ session, commits, matches }) {
  const start = Date.parse(session.startedAt);
  const end = Date.parse(session.endedAt);
  const timedCommits = commits.filter((commit) => isValidDate(commit.timestamp));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !timedCommits.length) return null;
  const span = Math.max(end - start, 1);

  return (
    <div className="session-timeline" aria-label="When commits landed during the session">
      <div className="session-timeline-track">
        {timedCommits.map((commit) => {
          const offset = Math.min(Math.max((Date.parse(commit.timestamp) - start) / span, 0), 1);
          const message = commit.message?.split('\n')[0] || commit.sha.slice(0, 7);
          const align = offset < 0.15 ? 'start' : offset > 0.85 ? 'end' : 'center';
          const className = `session-timeline-tick ${matches(commit) ? '' : 'dimmed'}`;
          const tooltip = (
            <span className={`session-timeline-tooltip ${align}`} role="tooltip">
              <span className="session-timeline-tooltip-meta">
                <time dateTime={commit.timestamp}>{formatTime(commit.timestamp)}</time>
                <code translate="no">{commit.sha.slice(0, 7)}</code>
                {Array.isArray(commit.files) && <span><span className="history-additions">+{commit.additions ?? 0}</span> <span className="history-deletions">−{commit.deletions ?? 0}</span></span>}
              </span>
              <span className="session-timeline-tooltip-message">{message}</span>
            </span>
          );
          const label = `${formatTime(commit.timestamp)}: ${message}`;
          return commit.htmlUrl
            ? <a className={className} key={commit.sha} style={{ left: `${offset * 100}%` }} href={commit.htmlUrl} target="_blank" rel="noreferrer" aria-label={`${label} (opens on GitHub)`}><span className="session-timeline-dot" />{tooltip}</a>
            : <span className={className} key={commit.sha} style={{ left: `${offset * 100}%` }} tabIndex={0} role="img" aria-label={label}><span className="session-timeline-dot" />{tooltip}</span>;
        })}
      </div>
      <div className="session-timeline-labels">
        <span>{formatTime(session.startedAt)}</span>
        <span>{formatTime(session.endedAt)}</span>
      </div>
    </div>
  );
}

function CommitRows({ commits, primaryBranch }) {
  return (
    <ol className="session-commit-rows" aria-label="Session commits">
      {orderCommits(commits, 'oldest').map((commit) => {
        const message = commit.message?.split('\n')[0] || 'Commit message unavailable';
        const hasLines = Array.isArray(commit.files);
        // Only commits outside the session's main branch get a branch tag.
        const otherBranches = commit.branches?.length && !commit.branches.includes(primaryBranch) ? commit.branches : [];
        const content = (
          <>
            <code className="session-commit-rows-sha" translate="no">{commit.sha?.slice(0, 7) || 'Unknown'}</code>
            <span className="session-commit-rows-message">{message}</span>
            <span className="session-commit-rows-branches">
              {otherBranches.map((branch) => <code key={branch} translate="no">{branch}</code>)}
            </span>
            <span className="session-commit-rows-lines">
              {hasLines && <><span className="history-additions">+{commit.additions ?? 0}</span> <span className="history-deletions">−{commit.deletions ?? 0}</span></>}
            </span>
            <time dateTime={commit.timestamp || undefined}>{isValidDate(commit.timestamp) ? formatTime(commit.timestamp) : '—'}</time>
            <span className="session-commit-rows-open" aria-hidden="true">{commit.htmlUrl ? '↗' : ''}</span>
          </>
        );
        return (
          <li key={commit.sha}>
            {commit.htmlUrl
              ? <a href={commit.htmlUrl} target="_blank" rel="noreferrer" title="Open commit on GitHub">{content}</a>
              : <div>{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function CommitTimelinePanel({ session, commits, primaryBranch, compareUrl, selectedFile, onClearFile }) {
  const touchesFile = (commit) => !selectedFile || (commit.files || []).some(({ filename }) => filename === selectedFile);
  const visibleCommits = commits.filter(touchesFile);

  return (
    <section className="session-detail-panel session-detail-commits" aria-labelledby="session-commits-heading">
      <div className="session-detail-panel-heading">
        <h2 id="session-commits-heading">Commit Timeline</h2>
        <span>{selectedFile ? `${visibleCommits.length} of ${formatCount(commits.length, 'commit')}` : formatCount(commits.length, 'commit')}</span>
        {compareUrl && <a href={compareUrl} target="_blank" rel="noreferrer">View changes on GitHub <span aria-hidden="true">↗</span></a>}
      </div>
      <CommitTimeline session={session} commits={commits} matches={touchesFile} />
      {selectedFile && (
        <div className="session-detail-filter" role="status">
          <span>Commits touching <code translate="no">{selectedFile.slice(selectedFile.lastIndexOf('/') + 1)}</code></span>
          <button type="button" onClick={onClearFile}>Clear</button>
        </div>
      )}
      <div className="session-detail-panel-scroll">
        <CommitRows commits={visibleCommits} primaryBranch={primaryBranch} />
      </div>
    </section>
  );
}

function FilesPanel({ files, selectedFile, onSelectFile }) {
  const maxChanges = Math.max(1, ...files.map((file) => file.additions + file.deletions));
  const fileTypes = getFileTypeBreakdown(files);

  return (
    <section className="session-detail-panel session-detail-files" aria-labelledby="session-files-heading">
      <div className="session-detail-panel-heading">
        <h2 id="session-files-heading">Files touched</h2>
        <span>{formatCount(files.length, 'file')}</span>
      </div>
      <ul className="session-file-list session-detail-panel-scroll">
        {files.map((file) => {
          const slash = file.filename.lastIndexOf('/');
          const changes = file.additions + file.deletions;
          const isSelected = selectedFile === file.filename;
          return (
            <li key={file.filename}>
              <button
                type="button"
                className={isSelected ? 'selected' : ''}
                aria-pressed={isSelected}
                title={`${file.filename} — show the commits that touched it`}
                onClick={() => onSelectFile(isSelected ? null : file.filename)}
              >
                <span className={`session-file-status ${file.status}`} title={file.status}>{FILE_STATUS_LETTERS[file.status] || '·'}</span>
                <span className="session-file-path" translate="no">
                  {slash >= 0 && <span>{file.filename.slice(0, slash + 1)}</span>}{file.filename.slice(slash + 1)}
                </span>
                <span className="session-file-lines"><span className="history-additions">+{file.additions}</span> <span className="history-deletions">−{file.deletions}</span></span>
                <span className="session-file-bar" aria-hidden="true">
                  <span style={{ width: `${(changes / maxChanges) * 100}%` }}>
                    {changes > 0 && <>
                      <span className="additions" style={{ flexGrow: file.additions }} />
                      <span className="deletions" style={{ flexGrow: file.deletions }} />
                    </>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {fileTypes.length > 0 && (
        <div className="session-file-types">
          <span className="section-kicker">FILE TYPES · BY LINES CHANGED</span>
          <div className="session-file-types-bar" aria-hidden="true">
            {fileTypes.map(({ type, share }, index) => <span key={type} className={`type-${index}`} style={{ flexGrow: share }} />)}
          </div>
          <ul>
            {fileTypes.map(({ type, share }, index) => (
              <li key={type}><i className={`type-${index}`} aria-hidden="true" />{type} <span>{Math.round(share * 100)}%</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function SessionDetailPage({ session, onBack, onRetryActivity, onDelete }) {
  // The file filter lives in the URL (?file=), so a reload or a shared link keeps it.
  const [selectedFile, setSelectedFileState] = useState(() => new URLSearchParams(window.location.search).get('file'));
  function setSelectedFile(filename) {
    setSelectedFileState(filename);
    const params = new URLSearchParams(window.location.search);
    if (filename) params.set('file', filename);
    else params.delete('file');
    const search = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
  }
  const isPlaceholder = session.source === 'placeholder';
  const activityReady = isPlaceholder || session.activity;
  const commits = activityReady ? session.commits || [] : [];
  const branches = getBranchSummary(commits);
  const files = getFilesTouched(commits);
  const activeFile = files.some(({ filename }) => filename === selectedFile) ? selectedFile : null;
  const compareUrl = isPlaceholder ? null : getCompareUrl(session, commits, branches);
  const layoutClass = [files.length ? '' : 'no-files', commits.length ? '' : 'no-commits'].filter(Boolean).join(' ');

  return (
    <article className="session-detail-page">
      <div className="session-detail-topbar">
        <a className="back-button" href={routePaths['Session History']} onClick={(event) => followRouteLink(event, () => onBack())}>← Session History</a>
        {!isPlaceholder && onDelete && <DeleteSession onDelete={() => onDelete(session.id)} />}
      </div>

      <header className="session-detail-heading">
        {isPlaceholder && <span className="session-detail-badge">Example session</span>}
        <h1 className={session.goal ? '' : 'empty'}>{session.goal || 'No goal set'}</h1>
        <p className="session-detail-meta">
          <RepositoryLink repository={session.repository} />
          <span aria-hidden="true">·</span>
          <span>{formatSessionDate(session.startedAt, session.endedAt)}</span>
        </p>
      </header>

      <div className={`session-detail-layout ${layoutClass}`}>
        <SessionSummary session={session} isPlaceholder={isPlaceholder} branches={branches} onRetry={() => onRetryActivity(session)} />
        {commits.length > 0 && (
          <CommitTimelinePanel
            session={session}
            commits={commits}
            primaryBranch={branches[0]?.name}
            compareUrl={compareUrl}
            selectedFile={activeFile}
            onClearFile={() => setSelectedFile(null)}
          />
        )}
        {files.length > 0 && <FilesPanel files={files} selectedFile={activeFile} onSelectFile={setSelectedFile} />}
      </div>

      {!isPlaceholder && (
        <p className="session-history-boundary">
          Session time is what you declared. GitHub activity is what GitHub recorded in that window across all branches; it is not a measure of coding time.
        </p>
      )}
    </article>
  );
}
