import React, { useLayoutEffect, useRef, useState } from 'react';
import { followRouteLink, routePaths } from '../../../routing.js';
import RepositoryName from '../../../components/repository/RepositoryName.jsx';
import { formatCount, formatDuration } from '../../../sessions/sessionHelpers.js';

function formatDate(value, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function followSessionLink(event, onSelect, sessionId) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onSelect(sessionId);
}

// The week as the logo's river: a faint bed runs Sunday to Saturday with two echoes beneath it (the logo's three waves),
// each day with sessions flows thicker and brighter with its session time, its commits sit on the stream as dots, and
// the stream ends at today's "now" dot. Session time and commits stay separate marks; neither is derived from the other.
const MAX_COMMIT_DOTS = 10;
const COMMIT_DOT_SPACING = 11;
const DAY_MS = 86_400_000;
// The two echoes sit below the main line, each lower, shorter in swing, and fainter, as in the logo.
const ECHOES = [{ offset: 0.26, swing: 0.75 }, { offset: 0.46, swing: 0.55 }];

// One wave per day, its swing scaled to the stream's size; the main line rides a little above the middle.
function makeRiver(width, height) {
  const dayWidth = width / 7;
  const amplitude = Math.min(height * 0.16, dayWidth / 6);
  const mid = height * 0.36;
  const y = (x, offset = 0, swing = 1) => mid + offset * height - amplitude * swing * Math.sin((2 * Math.PI * x) / dayWidth - offset * 4);
  const path = (x0, x1, offset, swing) => {
    const points = [];
    for (let x = x0; x < x1; x += 2) points.push(`${x.toFixed(1)} ${y(x, offset, swing).toFixed(1)}`);
    points.push(`${x1.toFixed(1)} ${y(x1, offset, swing).toFixed(1)}`);
    return `M${points.join(' L')}`;
  };
  return { dayWidth, y, path, scale: Math.min(1, dayWidth / 120) };
}

// Weight and shade grow with the day's session time, up to four hours.
function flowWeight(minutes, scale) {
  return (5 + (11 * Math.min(minutes, 240)) / 240) * Math.max(scale, 0.5);
}

function flowLevel(minutes) {
  if (minutes < 45) return 2;
  if (minutes < 120) return 3;
  return 4;
}

function useClientSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => setSize((current) => (current.width === element.clientWidth && current.height === element.clientHeight
      ? current : { width: element.clientWidth, height: element.clientHeight }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function describeDay(day) {
  const name = formatDate(day.date, { weekday: 'long' });
  if (!day.sessionCount) return `${name}: no sessions`;
  const commits = day.commitCount === null ? 'commits unavailable' : formatCount(day.commitCount, 'commit');
  return `${name}: ${formatDuration(day.sessionMinutes)}, ${formatCount(day.sessionCount, 'session')}, ${commits}`;
}

export function WeekRiver({ summary, now, isLive = false }) {
  const streamRef = useRef(null);
  const { width, height } = useClientSize(streamRef);
  const river = makeRiver(width, height);
  const { dayWidth } = river;
  const inset = dayWidth * 0.1;
  const todayIndex = summary.days.findIndex((day) => day.isToday);
  const startOfToday = todayIndex >= 0 ? new Date(summary.days[todayIndex].date).getTime() : null;
  const nowX = startOfToday === null ? null : (todayIndex + Math.min(Math.max((now - startOfToday) / DAY_MS, 0), 1)) * dayWidth;
  const figures = [
    { label: 'Session time', value: formatDuration(summary.sessionMinutes) },
    { label: summary.sessionCount === 1 ? 'Session' : 'Sessions', value: summary.sessionCount },
    // Never recorded is unavailable, not 0.
    { label: 'Commits', value: summary.commitCount ?? 'Unavailable' },
    { label: summary.repositoryCount === 1 ? 'Repository' : 'Repositories', value: summary.repositoryCount },
  ];

  return (
    <section className="dashboard-section week-river" aria-labelledby="weekly-heading">
      <div className="dashboard-section-heading">
        <h2 id="weekly-heading">This week</h2>
        <span className="dashboard-section-meta">
          {formatDate(summary.start, { month: 'short', day: 'numeric' })} – {formatDate(summary.end, { month: 'short', day: 'numeric' })}
          {summary.includesExamples && ' · includes examples'}
        </span>
      </div>
      <div className="week-river-stream" ref={streamRef}>
        {width > 0 && height > 0 && (
          <svg className="week-river-svg" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            {ECHOES.map((echo, index) => <path key={index} className={`week-river-echo echo-${index + 1}`} d={river.path(0, width, echo.offset, echo.swing)} />)}
            <path className="week-river-bed" d={river.path(0, nowX ?? width)} />
            {nowX !== null && nowX < width && <path className="week-river-bed is-ahead" d={river.path(nowX, width)} />}
            {summary.days.map((day, index) => {
              if (!day.sessionCount) return null;
              const x0 = index * dayWidth + inset;
              const x1 = (index + 1) * dayWidth - inset;
              // A dot per commit, up to as many as fit; the exact count is in the day's spoken description.
              const span = x1 - x0 - 16;
              const dots = Math.min(day.commitCount ?? 0, MAX_COMMIT_DOTS, Math.floor(span / (COMMIT_DOT_SPACING * river.scale)) + 1);
              return (
                <g key={day.date} style={{ '--river-delay': `${index * 70}ms` }}>
                  <path className={`week-river-flow level-${flowLevel(day.sessionMinutes)}`} d={river.path(x0, x1)} pathLength="1" strokeWidth={flowWeight(day.sessionMinutes, river.scale)} />
                  {Array.from({ length: dots }, (_, dot) => {
                    const x = x0 + 8 + (dots === 1 ? span / 2 : (span * dot) / (dots - 1));
                    return <circle className="week-river-commit" key={dot} cx={x} cy={river.y(x)} r={3 * Math.max(river.scale, 0.75)} />;
                  })}
                </g>
              );
            })}
            {nowX !== null && <circle className={`week-river-now${isLive ? ' is-live' : ''}`} cx={nowX} cy={river.y(nowX)} r={7 * Math.max(river.scale, 0.7)} />}
          </svg>
        )}
      </div>
      <ol className="week-river-days">
        {summary.days.map((day) => (
          <li key={day.date} className={day.isToday ? 'is-today' : undefined} aria-current={day.isToday ? 'date' : undefined}>
            <span aria-hidden="true">{day.label}</span>
            {day.sessionCount > 0 && <span className="week-river-time" aria-hidden="true">{formatDuration(day.sessionMinutes)}</span>}
            <span className="visually-hidden">{describeDay(day)}</span>
          </li>
        ))}
      </ol>
      {summary.sessionCount ? (
        <dl className="week-river-figures">
          {figures.map((figure) => <div key={figure.label}><dt>{figure.label}</dt><dd>{figure.value}</dd></div>)}
        </dl>
      ) : <p className="week-river-empty">No sessions yet this week</p>}
    </section>
  );
}

function RecentSessionRow({ session, onSelect }) {
  const status = session.activityStatus === 'loading'
    ? 'Fetching GitHub…'
    : session.activityStatus === 'error' || !session.hasActivity
      ? 'Activity unavailable'
      : session.commitCount === 0 ? 'No commits' : formatCount(session.commitCount, 'commit');

  return (
    <a className="recent-session-row" href={session.detailHref} onClick={(event) => followSessionLink(event, onSelect, session.id)}>
      <span className="recent-session-main">
        {/* Without a goal, the repository leads the row instead of a "No goal set" placeholder. */}
        <span className={`recent-session-goal${session.goal ? '' : ' is-repo'}`}>{session.goal || <RepositoryName name={session.repositoryFullName || session.repositoryName} />}</span>
        <span className="recent-session-meta">
          {session.goal && <><RepositoryName className="recent-session-repo" name={session.repositoryFullName || session.repositoryName} /><span aria-hidden="true">·</span></>}
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          {session.isPlaceholder && <span className="session-source-badge">Example</span>}
        </span>
      </span>
      <span className="recent-session-commits">{status}</span>
      <span className="recent-session-duration">{formatDuration(session.durationMinutes)}</span>
    </a>
  );
}

// Hides rows that would be cut off at the bottom of the list, so a window-fitted list only shows whole rows.
// `rowsKey` changes when the rows do (not on every render), so new or reordered rows are measured again.
function useWholeRows(listRef, rowsKey) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => {
      const bottom = list.getBoundingClientRect().bottom;
      [...list.children].forEach((row) => {
        const fits = row.getBoundingClientRect().bottom <= bottom + 1;
        row.style.visibility = fits ? '' : 'hidden';
        if (fits) row.removeAttribute('aria-hidden');
        else row.setAttribute('aria-hidden', 'true');
        if (fits) row.removeAttribute('tabindex');
        else row.tabIndex = -1;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, rowsKey]);
}

export function RecentSessions({ sessions = [], onViewAll, onSelectSession, onStartSession }) {
  const listRef = useRef(null);
  useWholeRows(listRef, sessions.map((session) => session.id).join());
  return (
    <section className="dashboard-section recent-section" aria-labelledby="recent-heading">
      <div className="dashboard-section-heading">
        <h2 id="recent-heading">Recent sessions</h2>
        {sessions.length > 0 && <a className="text-link" href={routePaths['Session History']} onClick={(event) => followRouteLink(event, () => onViewAll())}>View all <span aria-hidden="true">→</span></a>}
      </div>
      {sessions.length ? (
        <div className="recent-session-list" ref={listRef}>{sessions.map((session) => <RecentSessionRow key={session.id} session={session} onSelect={onSelectSession} />)}</div>
      ) : (
        <p className="dashboard-empty-note">No sessions yet. <a className="text-link" href={routePaths['Session Workspace']} onClick={(event) => followRouteLink(event, () => onStartSession())}>Start a session <span aria-hidden="true">→</span></a></p>
      )}
    </section>
  );
}
