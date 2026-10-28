import React, { useMemo, useState } from 'react';
import { formatLastWorked, formatRepositoryDuration, allTimeDailyMinutes } from './repositoryHistory.js';
import { formatCount } from '../../sessions/sessionHelpers.js';
import { readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import RepositoryName from '../../components/repository/RepositoryName.jsx';
import ScrollArea from '../../components/layout/ScrollArea.jsx';
import BackLink from '../../components/navigation/BackLink.jsx';

const MAX_MARKED_DAYS = 45;
const HOUR_MINUTES = 60;

// Always seven gridlines (zero and six steps), so the chart keeps its shape whatever the longest day is.
// The top is the longest day rounded up to a whole hour (half hours for short totals), so every step is a round number of minutes.
const SCALE_LINES = 7;

function chartScale(maxMinutes) {
  const unit = maxMinutes <= 2 * HOUR_MINUTES ? HOUR_MINUTES / 2 : HOUR_MINUTES;
  const top = Math.max(unit, Math.ceil(maxMinutes / unit) * unit);
  return { top, ticks: Array.from({ length: SCALE_LINES }, (_, index) => (index * top) / (SCALE_LINES - 1)) };
}

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
  return formatRepositoryDuration(minutes * 60_000);
}

function Stat({ label, unavailable = false, children }) {
  return (
    <div className="repository-stat">
      <dt>{label}</dt>
      <dd>{unavailable ? <span className="is-unavailable" title="Not recorded">—</span> : children}</dd>
    </div>
  );
}

// Declared session time and what GitHub observed stay in separate groups, one row each.
function RepositoryStats({ repository }) {
  const durations = repository.sessions.map((session) => session.durationMinutes || 0);
  const average = repository.sessionCount ? repository.totalDurationMs / repository.sessionCount : null;
  const { commits, filesChanged, additions, deletions } = repository.activity;
  return (
    <section className="repository-detail-stats" aria-label="Summary">
      <div className="repository-stat-group" role="group" aria-labelledby="repository-time-heading">
        <h2 id="repository-time-heading">Session time</h2>
        <dl>
          <Stat label="Total">{formatRepositoryDuration(repository.totalDurationMs)}</Stat>
          <Stat label="Sessions">{repository.sessionCount.toLocaleString()}</Stat>
          <Stat label="Average" unavailable={average === null}>{formatRepositoryDuration(average)}</Stat>
          <Stat label="Longest" unavailable={!durations.length}>{formatMinutes(Math.max(0, ...durations))}</Stat>
        </dl>
      </div>
      <div className="repository-stat-group" role="group" aria-labelledby="repository-activity-heading">
        <h2 id="repository-activity-heading">{repository.isExample ? 'Activity' : 'GitHub activity'}</h2>
        <dl>
          <Stat label="Commits" unavailable={commits.total === null}>{commits.total?.toLocaleString()}</Stat>
          <Stat label="Files changed" unavailable={filesChanged.total === null}>{filesChanged.total?.toLocaleString()}</Stat>
          <Stat label="Lines" unavailable={additions.total === null || deletions.total === null}>
            <span className="repository-lines"><span className="history-additions">+{additions.total?.toLocaleString()}</span><span className="history-deletions">−{deletions.total?.toLocaleString()}</span></span>
          </Stat>
        </dl>
      </div>
    </section>
  );
}

function SessionTimeChart({ repository, selectedDay, onSelectDay }) {
  const [hovered, setHovered] = useState(null);
  const days = useMemo(() => allTimeDailyMinutes(repository), [repository]);
  const dayCount = days.length;
  const maxMinutes = Math.max(0, ...days.map((day) => day.minutes));
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const workedDays = days.filter((day) => day.minutes > 0).length;
  const active = hovered === null ? null : days[hovered];
  const x = (index) => (index + 0.5) / dayCount * 100;
  const { top, ticks } = chartScale(maxMinutes);
  const y = (minutes) => 100 - minutes / top * 100;
  const averageMinutes = workedDays ? totalMinutes / workedDays : 0;
  const linePoints = days.map((day, index) => `${x(index)},${y(day.minutes)}`);
  const firstLabelOptions = new Date(days[0].date).getFullYear() === new Date().getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };

  return (
    <section className="repository-detail-chart" aria-labelledby="repository-chart-heading">
      <div className="repository-detail-section-heading">
        <h2 id="repository-chart-heading">Session time by day</h2>
        <span>All time</span>
      </div>
      {maxMinutes === 0 ? (
        <p className="repository-detail-chart-empty">No session time</p>
      ) : (
        <div className="repository-detail-plot">
          <div className="repository-detail-scale" aria-hidden="true">
            {ticks.map((tick) => <span key={tick} style={{ top: `${y(tick)}%` }}>{tick ? formatMinutes(tick) : '0'}</span>)}
          </div>
          <div
            className="repository-detail-bars"
            role="group"
            aria-label={`Session time on ${workedDays} of ${dayCount} days, ${formatMinutes(totalMinutes)} in total. Choose a day to show its sessions.`}
            style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="repository-detail-line" aria-hidden="true">
              {ticks.map((tick) => <span key={tick} className="repository-detail-grid" style={{ top: `${y(tick)}%` }} />)}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                <defs>
                  <linearGradient id="repository-area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" style={{ stopColor: 'var(--workspace-accent)', stopOpacity: 0.32 }} />
                    <stop offset="100%" style={{ stopColor: 'var(--workspace-accent)', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <polygon className="repository-detail-area" points={`${x(0)},100 ${linePoints.join(' ')} ${x(dayCount - 1)},100`} />
                <polyline className="repository-detail-stroke" points={linePoints.join(' ')} />
                {averageMinutes > 0 && <line className="repository-detail-average" x1="0" x2="100" y1={y(averageMinutes)} y2={y(averageMinutes)} vectorEffect="non-scaling-stroke" />}
              </svg>
              {averageMinutes > 0 && <span className="repository-detail-average-label" style={{ top: `${y(averageMinutes)}%` }}>avg {formatMinutes(averageMinutes)}</span>}
              {days.map((day, index) => {
                const selected = selectedDay === isoDay(day.date);
                // Dense histories only mark the day being pointed at or chosen, so the line stays readable.
                if (!(hovered === index || selected || (dayCount <= MAX_MARKED_DAYS && day.minutes > 0))) return null;
                return (
                  <i
                    key={day.key}
                    className={[selected && 'is-selected', hovered === index && 'is-hovered'].filter(Boolean).join(' ') || undefined}
                    style={{ left: `${x(index)}%`, bottom: `${100 - y(day.minutes)}%` }}
                  />
                );
              })}
            </div>
            {days.map((day, index) => {
              const selected = selectedDay === isoDay(day.date);
              const className = ['repository-detail-bar-slot', hovered === index && 'is-hovered', selected && 'is-selected'].filter(Boolean).join(' ');
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
                />
              ) : (
                <div key={day.key} className={className} aria-hidden="true" {...hover} />
              );
            })}
            {active && (
              <div className="repository-detail-tooltip" style={{ left: `${x(hovered)}%` }}>
                <span>{formatDate(active.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <strong>{active.minutes > 0 ? formatMinutes(active.minutes) : 'No sessions'}</strong>
              </div>
            )}
          </div>
          <div className="repository-strip-scale">
            <span>{formatDate(days[0].date, firstLabelOptions)}</span>
            <span>{formatDate(days[Math.floor(dayCount / 2)].date, { month: 'short', day: 'numeric' })}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </section>
  );
}

function RepositorySessionRow({ session, onSelectSession }) {
  return (
    <a
      className="repository-session-row"
      href={session.detailHref}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelectSession(session.id);
      }}
    >
      <div className="repository-session-main">
        <p className="repository-session-goal">{session.goal || <span>No goal recorded</span>}</p>
        <span className="repository-session-meta">
          <time dateTime={session.startedAt}>{formatDate(session.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          <span aria-hidden="true">·</span>
          <span>{formatMinutes(session.durationMinutes || 0)}</span>
        </span>
      </div>
      <div className="repository-session-activity">
        {session.hasActivity ? (
          <>
            <span>{formatCount(session.commitCount, 'commit')}</span>
            <span className="repository-lines"><span className="history-additions">+{session.additions.toLocaleString()}</span><span className="history-deletions">−{session.deletions.toLocaleString()}</span></span>
          </>
        ) : (
          <span className="repository-session-activity-note">{session.activityStatus === 'loading' ? 'Retrieving…' : 'Unavailable'}</span>
        )}
      </div>
      <span className="repository-session-chevron" aria-hidden="true">›</span>
    </a>
  );
}

export default function RepositoryDetailPage({ repository, onBack, onSelectSession }) {
  const firstSession = repository.sessions[repository.sessions.length - 1];
  const [selectedDay, setSelectedDay] = useState(() => (parseIsoDay(readSearchParam('day')) ? readSearchParam('day') : null));
  const selectedDate = parseIsoDay(selectedDay);
  const sessions = useMemo(
    () => (selectedDay ? repository.sessions.filter((session) => isoDay(session.startedAt) === selectedDay) : repository.sessions),
    [repository.sessions, selectedDay],
  );
  const selectedLabel = selectedDate && (selectedDay === isoDay(Date.now()) ? 'Today' : formatDate(selectedDate, { month: 'short', day: 'numeric' }));

  function selectDay(day) {
    setSelectedDay(day);
    updateSearchParams({ day });
  }

  return (
    <article className="session-detail-page repository-detail-page">
      <BackLink href={routePaths.Repositories} label="Repositories" onNavigate={() => onBack()} />
      <header className="repository-detail-heading">
        <div className="repository-detail-title">
          <h1><RepositoryName name={repository.fullName} /></h1>
          {repository.isExample
            ? <span className="repository-badge is-example">Example</span>
            : repository.visibility && <span className={`repository-badge is-${repository.visibility}`}>{repository.visibility}</span>}
        </div>
        <p className="repository-detail-meta">
          Last worked <strong>{formatLastWorked(repository.lastWorkedAt)}</strong>
          {firstSession && <><span aria-hidden="true">·</span>First session <strong>{formatDate(firstSession.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>}
          {repository.htmlUrl && !repository.isExample && <><span aria-hidden="true">·</span><a className="repository-detail-repo" href={repository.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a></>}
        </p>
        {repository.description && <p className="repository-detail-description" title={repository.description}>{repository.description}</p>}
      </header>

      <div className="repository-detail-summary">
        <RepositoryStats repository={repository} />

        <SessionTimeChart repository={repository} selectedDay={selectedDay} onSelectDay={selectDay} />
      </div>

      <section className="repository-session-history" aria-labelledby="repository-session-history-heading">
        <div className="repository-detail-section-heading">
          <h2 id="repository-session-history-heading">Session history</h2>
          {selectedLabel && (
            <button className="repository-day-filter" type="button" aria-label={`Showing ${selectedLabel}. Show all sessions`} onClick={() => selectDay(null)}>
              {selectedLabel} <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <ScrollArea className="repository-session-scroll" watch={`${selectedDay}:${sessions.length}`}>
          <div className="repository-session-list">
            {!sessions.length && <p className="repository-session-empty">No sessions on {selectedLabel}</p>}
            {sessions.map((session) => <RepositorySessionRow key={session.id} session={session} onSelectSession={onSelectSession} />)}
          </div>
        </ScrollArea>
      </section>
    </article>
  );
}
