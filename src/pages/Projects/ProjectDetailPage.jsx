import React, { useMemo, useState } from 'react';
import { formatLastWorked, formatProjectDuration, recentDailyMinutes } from './projectHistory.js';
import { formatCount } from '../../sessions/sessionHelpers.js';
import { followRouteLink, readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import RepositoryName from '../../components/repository/RepositoryName.jsx';
import ScrollArea from '../../components/layout/ScrollArea.jsx';

const CHART_DAYS = 30;

function formatDate(value, options) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, options).format(date) : '';
}

// A local calendar day as YYYY-MM-DD, the form kept in the `day` URL parameter.
function isoDay(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function formatMinutes(minutes) {
  return formatProjectDuration(minutes * 60_000);
}

function Stat({ label, unavailable = false, children }) {
  return (
    <div className="project-stat">
      <dt>{label}</dt>
      <dd>{unavailable ? <span className="is-unavailable" title="Not recorded">—</span> : children}</dd>
    </div>
  );
}

// Declared session time and what GitHub observed stay in separate groups, one row each.
function ProjectStats({ project }) {
  const durations = project.sessions.map((session) => session.durationMinutes || 0);
  const average = project.sessionCount ? project.totalDurationMs / project.sessionCount : null;
  const { commits, filesChanged, additions, deletions } = project.activity;
  return (
    <section className="project-detail-stats" aria-label="Summary">
      <div className="project-stat-group" role="group" aria-labelledby="project-time-heading">
        <h2 id="project-time-heading">Session time</h2>
        <dl>
          <Stat label="Total">{formatProjectDuration(project.totalDurationMs)}</Stat>
          <Stat label="Sessions">{project.sessionCount.toLocaleString()}</Stat>
          <Stat label="Average" unavailable={average === null}>{formatProjectDuration(average)}</Stat>
          <Stat label="Longest" unavailable={!durations.length}>{formatMinutes(Math.max(0, ...durations))}</Stat>
        </dl>
      </div>
      <div className="project-stat-group" role="group" aria-labelledby="project-activity-heading">
        <h2 id="project-activity-heading">{project.isExample ? 'Activity' : 'GitHub activity'}</h2>
        <dl>
          <Stat label="Commits" unavailable={commits.total === null}>{commits.total?.toLocaleString()}</Stat>
          <Stat label="Files changed" unavailable={filesChanged.total === null}>{filesChanged.total?.toLocaleString()}</Stat>
          <Stat label="Lines" unavailable={additions.total === null || deletions.total === null}>
            <span className="project-lines"><span className="history-additions">+{additions.total?.toLocaleString()}</span><span className="history-deletions">−{deletions.total?.toLocaleString()}</span></span>
          </Stat>
        </dl>
      </div>
    </section>
  );
}

function SessionTimeChart({ project, selectedDay, onSelectDay }) {
  const [hovered, setHovered] = useState(null);
  const days = useMemo(() => recentDailyMinutes(project, CHART_DAYS), [project]);
  const maxMinutes = Math.max(0, ...days.map((day) => day.minutes));
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const active = hovered === null ? null : days[hovered];

  return (
    <section className="project-detail-chart" aria-labelledby="project-chart-heading">
      <div className="project-detail-section-heading">
        <h2 id="project-chart-heading">Session time by day</h2>
        <span>Last {CHART_DAYS} days</span>
      </div>
      {maxMinutes === 0 ? (
        <p className="project-detail-chart-empty">No sessions in the last {CHART_DAYS} days</p>
      ) : (
        <div className="project-detail-plot">
          <div
            className="project-detail-bars"
            role="group"
            aria-label={`Session time on ${workedDays} of the last ${CHART_DAYS} days, ${formatMinutes(totalMinutes)} in total. Choose a day to show its sessions.`}
            onMouseLeave={() => setHovered(null)}
          >
            {days.map((day, index) => {
              const selected = selectedDay === isoDay(day.date);
              const className = ['project-detail-bar-slot', hovered === index && 'is-hovered', selected && 'is-selected'].filter(Boolean).join(' ');
              const bar = (
                <i
                  className={[day.minutes > 0 && 'has-time', index === days.length - 1 && 'is-today'].filter(Boolean).join(' ') || undefined}
                  style={day.minutes > 0 ? { height: `${Math.max(6, day.minutes / maxMinutes * 100)}%` } : undefined}
                />
              );
              const hover = { onMouseEnter: () => setHovered(index) };
              // Only days with sessions can be chosen; choosing the selected day again shows every session.
              return day.minutes > 0 ? (
                <button
                  key={day.key}
                  type="button"
                  className={className}
                  aria-pressed={selected}
                  aria-label={`${formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${formatMinutes(day.minutes)}`}
                  onClick={() => onSelectDay(selected ? null : isoDay(day.date))}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  {...hover}
                >{bar}</button>
              ) : (
                <div key={day.key} className={className} aria-hidden="true" {...hover}>{bar}</div>
              );
            })}
            {active && (
              <div className="project-detail-tooltip" style={{ left: `${(hovered + 0.5) / CHART_DAYS * 100}%` }}>
                <span>{formatDate(active.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <strong>{active.minutes > 0 ? formatMinutes(active.minutes) : 'No sessions'}</strong>
              </div>
            )}
          </div>
          <div className="project-strip-scale">
            <span>{formatDate(days[0].date, { month: 'short', day: 'numeric' })}</span>
            <span>{formatDate(days[Math.floor(CHART_DAYS / 2)].date, { month: 'short', day: 'numeric' })}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </section>
  );
}

function ProjectSessionRow({ session, onSelectSession }) {
  return (
    <a
      className="project-session-row"
      href={session.detailHref}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelectSession(session.id);
      }}
    >
      <div className="project-session-main">
        <p className="project-session-goal">{session.goal || <span>No goal recorded</span>}</p>
        <span className="project-session-meta">
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          <span aria-hidden="true">·</span>
          <span>{formatMinutes(session.durationMinutes || 0)}</span>
        </span>
      </div>
      <div className="project-session-activity">
        {session.hasActivity ? (
          <>
            <span>{formatCount(session.commitCount, 'commit')}</span>
            <span className="project-lines"><span className="history-additions">+{session.additions.toLocaleString()}</span><span className="history-deletions">−{session.deletions.toLocaleString()}</span></span>
          </>
        ) : (
          <span className="project-session-activity-note">{session.activityStatus === 'loading' ? 'Retrieving…' : 'Unavailable'}</span>
        )}
      </div>
      <span className="project-session-chevron" aria-hidden="true">›</span>
    </a>
  );
}

export default function ProjectDetailPage({ project, onBack, onSelectSession }) {
  const firstSession = project.sessions[project.sessions.length - 1];
  const [selectedDay, setSelectedDay] = useState(() => (parseIsoDay(readSearchParam('day')) ? readSearchParam('day') : null));
  const selectedDate = parseIsoDay(selectedDay);
  const sessions = useMemo(
    () => (selectedDay ? project.sessions.filter((session) => isoDay(session.startedAt) === selectedDay) : project.sessions),
    [project.sessions, selectedDay],
  );
  const selectedLabel = selectedDate && (selectedDay === isoDay(Date.now()) ? 'Today' : formatDate(selectedDate, { month: 'short', day: 'numeric' }));

  function selectDay(day) {
    setSelectedDay(day);
    updateSearchParams({ day });
  }

  return (
    <article className="session-detail-page project-detail-page">
      <a className="back-button" href={routePaths.Projects} onClick={(event) => followRouteLink(event, () => onBack())}>← Repositories</a>
      <header className="project-detail-heading">
        <div className="project-detail-title">
          <h1><RepositoryName name={project.fullName} /></h1>
          {project.isExample
            ? <span className="project-badge is-example">Example</span>
            : project.visibility && <span className={`project-badge is-${project.visibility}`}>{project.visibility}</span>}
        </div>
        <p className="project-detail-meta">
          Last worked <strong>{formatLastWorked(project.lastWorkedAt)}</strong>
          {firstSession && <><span aria-hidden="true">·</span>First session <strong>{formatDate(firstSession.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>}
          {project.htmlUrl && !project.isExample && <><span aria-hidden="true">·</span><a className="project-detail-repo" href={project.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a></>}
        </p>
        {project.description && <p className="project-detail-description" title={project.description}>{project.description}</p>}
      </header>

      <div className="project-detail-summary">
        <ProjectStats project={project} />

        <SessionTimeChart project={project} selectedDay={selectedDay} onSelectDay={selectDay} />
      </div>

      <section className="project-session-history" aria-labelledby="project-session-history-heading">
        <div className="project-detail-section-heading">
          <h2 id="project-session-history-heading">Session history</h2>
          {selectedLabel && (
            <button className="project-day-filter" type="button" aria-label={`Showing ${selectedLabel}. Show all sessions`} onClick={() => selectDay(null)}>
              {selectedLabel} <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <ScrollArea className="project-session-scroll" watch={`${selectedDay}:${sessions.length}`}>
          <div className="project-session-list">
            {!sessions.length && <p className="project-session-empty">No sessions on {selectedLabel}</p>}
            {sessions.map((session) => <ProjectSessionRow key={session.id} session={session} onSelectSession={onSelectSession} />)}
          </div>
        </ScrollArea>
      </section>
    </article>
  );
}
