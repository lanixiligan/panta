import React, { useState } from 'react';
import { getSessionDurationMinutes } from '../../sessions/sessionHelpers.js';
import { orderCommits } from '../../components/sessions/SessionCommitList.jsx';
import EditableGoal from '../../components/sessions/EditableGoal.jsx';
import { followRouteLink, routePaths } from '../../routing.js';
import RepositoryName, { repositoryFullName } from '../../components/repository/RepositoryName.jsx';
import ScrollArea from '../../components/layout/ScrollArea.jsx';

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

function getRepositoryUrl(repository) {
  return repository.html_url || repository.htmlUrl || `https://github.com/${repositoryFullName(repository)}`;
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
  const fullName = repositoryFullName(repository);
  return (
    <a className="session-detail-repo" href={getRepositoryUrl(repository)} target="_blank" rel="noreferrer">
      <RepositoryName name={fullName} /><span aria-hidden="true"> ↗</span>
    </a>
  );
}

// A deletion that fails keeps the session, and its error takes the question's place until Delete is tried again.
function DeleteSession({ onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError.message || 'Couldn’t delete this session. Try again.');
      setDeleting(false);
    }
  }

  if (!confirming) {
    return <button className="session-detail-delete" type="button" onClick={() => setConfirming(true)}>Delete session</button>;
  }
  return (
    <div className="session-detail-delete-confirm" role="group" aria-label="Confirm deleting this session">
      {error ? <span role="alert">{error}</span> : <span>Delete this session from history?</span>}
      <button className="session-detail-delete danger" type="button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
      <button className="session-detail-delete" type="button" onClick={() => { setConfirming(false); setError(''); }} disabled={deleting}>Cancel</button>
    </div>
  );
}

// A single branch called main or master is the default case and isn't worth a figure.
function showBranches(branches) {
  return branches.length > 1 || (branches.length === 1 && !['main', 'master'].includes(branches[0].name));
}

// One line of figures: declared session time first, then what GitHub recorded. Each number appears once on the page.
function SessionStats({ session, isPlaceholder, commits, files, branches, onRetry }) {
  const { activity } = session;
  const status = isPlaceholder ? 'placeholder' : session.activityStatus;
  const isChecking = status === 'loading';
  const hasTimes = isValidDate(session.startedAt) && isValidDate(session.endedAt);
  const commitCount = activity?.commits ?? commits.length;
  const hasActivity = Boolean(activity) || isPlaceholder;

  const githubFigures = !hasActivity
    ? [{ label: 'Commits', value: isChecking ? 'Checking…' : 'Unavailable', muted: true }]
    : commitCount === 0
      ? [{ label: 'Commits', value: 'No commits', muted: true }]
      : [
        { label: commitCount === 1 ? 'Commit' : 'Commits', value: commitCount },
        { label: 'Lines', value: activity?.additions === undefined && !isPlaceholder ? 'Unavailable' : <><span className="history-additions">+{activity?.additions ?? 0}</span> <span className="history-deletions">−{activity?.deletions ?? 0}</span></> },
        { label: files.length === 1 ? 'File' : 'Files', value: files.length },
        ...(showBranches(branches) ? [{ label: branches.length === 1 ? 'Branch' : 'Branches', value: <span className="session-stats-branches">{branches.map(({ name }) => <code key={name} translate="no">{name}</code>)}</span> }] : []),
      ];

  return (
    <section className="session-stats" aria-label="Session summary">
      <dl>
        <div className="session-stats-primary">
          <dt>Session time</dt>
          <dd>{hasTimes ? formatDuration(getSessionDurationMinutes(session)) : 'Unavailable'}</dd>
        </div>
        {githubFigures.map(({ label, value, muted }) => (
          <div key={label} className={muted ? 'muted' : ''}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!isPlaceholder && (
        <button
          className="session-detail-refresh"
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          title={isValidDate(session.activityCheckedAt) ? `Last checked ${formatDateTime(session.activityCheckedAt)}` : undefined}
        >
          {isChecking ? <><span className="dashboard-spinner" /> Checking GitHub…</> : 'Check GitHub again'}
        </button>
      )}
      {status === 'error' && <p className="session-stats-error" role="alert">{session.activityError || 'Could not retrieve GitHub activity for this session.'}</p>}
    </section>
  );
}

// Commits on a vertical rail, newest first: when each landed and what it changed, in one list.
function CommitTimeline({ commits, primaryBranch, compareUrl, selectedFile, onClearFile }) {
  const touchesFile = (commit) => !selectedFile || (commit.files || []).some(({ filename }) => filename === selectedFile);
  const visibleCommits = orderCommits(commits, 'newest').filter(touchesFile);

  return (
    <section className="session-detail-section session-detail-commits" aria-labelledby="session-commits-heading">
      <div className="session-detail-section-heading">
        <h2 id="session-commits-heading">Commits</h2>
        {compareUrl && <a href={compareUrl} target="_blank" rel="noreferrer">View changes on GitHub <span aria-hidden="true">↗</span></a>}
      </div>
      {selectedFile && (
        <div className="session-detail-filter" role="status">
          <span><code translate="no">{selectedFile.slice(selectedFile.lastIndexOf('/') + 1)}</code> · {visibleCommits.length} of {commits.length}</span>
          <button type="button" onClick={onClearFile} aria-label="Show all commits">×</button>
        </div>
      )}
      <ScrollArea className="session-detail-scroll" watch={visibleCommits.length}>
        <ol className="session-timeline" aria-label="Session commits">
          {visibleCommits.map((commit) => {
            const message = commit.message?.split('\n')[0] || 'Commit message unavailable';
            const hasLines = Array.isArray(commit.files);
            // Only commits outside the session's main branch get a branch tag.
            const otherBranches = commit.branches?.length && !commit.branches.includes(primaryBranch) ? commit.branches : [];
            const content = (
              <>
                <time dateTime={commit.timestamp || undefined}>{isValidDate(commit.timestamp) ? formatTime(commit.timestamp) : '—'}</time>
                <span className="session-timeline-dot" aria-hidden="true" />
                <span className="session-timeline-body">
                  <span className="session-timeline-message">{message}</span>
                  <span className="session-timeline-meta">
                    <code className="session-timeline-sha" translate="no">{commit.sha?.slice(0, 7) || 'Unknown'}{commit.htmlUrl && <span aria-hidden="true"> ↗</span>}</code>
                    {otherBranches.map((branch) => <code key={branch} className="session-timeline-branch" translate="no">{branch}</code>)}
                  </span>
                </span>
                <span className="session-timeline-lines">
                  {hasLines && <><span className="history-additions">+{commit.additions ?? 0}</span> <span className="history-deletions">−{commit.deletions ?? 0}</span></>}
                </span>
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
      </ScrollArea>
    </section>
  );
}

const FILE_STATUS_TAGS = { added: 'new', removed: 'deleted', renamed: 'renamed' };

function FilesSection({ files, selectedFile, onSelectFile }) {
  const maxChanges = Math.max(1, ...files.map((file) => file.additions + file.deletions));
  const fileTypes = getFileTypeBreakdown(files);

  return (
    <section className="session-detail-section session-detail-files" aria-labelledby="session-files-heading">
      <div className="session-detail-section-heading">
        <h2 id="session-files-heading">Files</h2>
      </div>
      <ScrollArea className="session-detail-scroll" watch={files.length}>
        <ul className="session-file-list">
          {files.map((file) => {
            const slash = file.filename.lastIndexOf('/');
            const changes = file.additions + file.deletions;
            const isSelected = selectedFile === file.filename;
            const tag = FILE_STATUS_TAGS[file.status];
            return (
              <li key={file.filename}>
                <button
                  type="button"
                  className={isSelected ? 'selected' : ''}
                  aria-pressed={isSelected}
                  title={`${file.filename} — show the commits that touched it`}
                  onClick={() => onSelectFile(isSelected ? null : file.filename)}
                >
                  <span className="session-file-path" translate="no">
                    {slash >= 0 && <span>{file.filename.slice(0, slash + 1)}</span>}{file.filename.slice(slash + 1)}
                  </span>
                  {tag ? <span className={`session-file-tag ${file.status}`}>{tag}</span> : <span />}
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
      </ScrollArea>
      {fileTypes.length > 0 && (
        <div className="session-file-types" aria-label="Lines changed by file type">
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

export default function SessionDetailPage({ session, onBack, onRetryActivity, onDelete, onUpdateGoal, backHref = routePaths['Session History'], backLabel = '← Session History' }) {
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
  const hasTimes = isValidDate(session.startedAt) && isValidDate(session.endedAt);

  return (
    <article className="session-detail-page">
      <div className="session-detail-topbar">
        <a className="back-button" href={backHref} onClick={(event) => followRouteLink(event, () => onBack())}>{backLabel}</a>
        {!isPlaceholder && onDelete && <DeleteSession onDelete={() => onDelete(session.id)} />}
      </div>

      <header className="session-detail-heading">
        <EditableGoal goal={session.goal} placeholder="What did you work on?" onSave={isPlaceholder || !onUpdateGoal ? undefined : (goal) => onUpdateGoal(session.id, goal)} />
        <p className="session-detail-meta">
          <RepositoryLink repository={session.repository} />
          <span aria-hidden="true">·</span>
          <span>{formatSessionDate(session.startedAt, session.endedAt)}</span>
          {hasTimes && <><span aria-hidden="true">·</span><span>{formatTimeRange(session.startedAt, session.endedAt)}</span></>}
          {isPlaceholder && <span className="session-detail-badge">Example</span>}
        </p>
      </header>

      <SessionStats session={session} isPlaceholder={isPlaceholder} commits={commits} files={files} branches={branches} onRetry={() => onRetryActivity(session)} />

      {commits.length > 0 && (
        <div className={`session-detail-body${files.length ? '' : ' no-files'}`}>
          <CommitTimeline commits={commits} primaryBranch={branches[0]?.name} compareUrl={compareUrl} selectedFile={activeFile} onClearFile={() => setSelectedFile(null)} />
          {files.length > 0 && <FilesSection files={files} selectedFile={activeFile} onSelectFile={setSelectedFile} />}
        </div>
      )}

      {!isPlaceholder && (
        <p className="session-history-boundary">
          Session time is what you declared. GitHub activity is what GitHub recorded in that window across all branches; it is not a measure of coding time.
        </p>
      )}
    </article>
  );
}
