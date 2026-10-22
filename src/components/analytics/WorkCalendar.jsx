import React, { useMemo, useState } from 'react';
import { followRouteLink, readSearchParam, routePaths, updateSearchParams } from '../../routing.js';
import RepositoryName, { repositoryFullName } from '../repository/RepositoryName.jsx';
import { formatCount, getSessionDurationMs } from '../../sessions/sessionHelpers.js';
import MonthNav from '../calendar/MonthNav.jsx';
import { monthDays, toDayString } from '../calendar/calendarDates.js';

// "When you work": a month calendar shaded by session time, used on Analytics and Overview.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 60_000) return '<1m';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

// The Session History link for one local day (?from=YYYY-MM-DD&to=YYYY-MM-DD).
function historyDayHref(date) {
  const day = toDayString(date);
  return `${routePaths['Session History']}?from=${day}&to=${day}`;
}

// Session time per local day, credited to the day each session started.
function dailySessionTotals(sessions) {
  const days = new Map();
  sessions.forEach((session) => {
    const startedAt = Date.parse(session.startedAt);
    const endedAt = Date.parse(session.endedAt);
    const durationMs = getSessionDurationMs(session);
    if (session.status !== 'completed' || !Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt || durationMs === null) return;
    const key = toDayString(new Date(startedAt));
    const day = days.get(key) || { durationMs: 0, sessionCount: 0, repositories: new Set() };
    day.durationMs += durationMs;
    day.sessionCount += 1;
    const name = repositoryFullName(session.repository);
    if (name) day.repositories.add(name);
    days.set(key, day);
  });
  return days;
}

// `browsable` adds month arrows and keeps the viewed month in the URL (Analytics); without it the calendar shows this month only (Overview).
export default function WorkCalendar({ sessions, onNavigate, browsable = true }) {
  const today = new Date();
  // The viewed month is kept in the URL as ?month=YYYY-MM.
  const [month, setMonthState] = useState(() => {
    const match = browsable && /^(\d{4})-(\d{2})$/.exec(readSearchParam('month') || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const setMonth = (value) => {
    setMonthState(value);
    const isCurrent = value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth();
    updateSearchParams({ month: isCurrent ? null : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` });
  };
  const [hovered, setHovered] = useState(null);
  const totals = useMemo(() => dailySessionTotals(sessions), [sessions]);
  const earliest = useMemo(() => {
    const starts = sessions.map((session) => Date.parse(session.startedAt)).filter(Number.isFinite);
    return starts.length ? new Date(Math.min(...starts)) : today;
  }, [sessions]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const { leading: leadingBlanks, days: dates } = monthDays(month);
  const days = dates.map((date) => ({ date, ...(totals.get(toDayString(date)) || { durationMs: 0, sessionCount: 0, repositories: new Set() }) }));
  const max = Math.max(0, ...days.map((day) => day.durationMs));
  const level = (value) => (!value || !max ? 0 : Math.min(4, Math.ceil((value / max) * 4)));
  const monthTotal = days.reduce((sum, day) => sum + day.durationMs, 0);
  const monthSessions = days.reduce((sum, day) => sum + day.sessionCount, 0);
  const workedDays = days.filter((day) => day.sessionCount > 0).length;
  const canGoBack = new Date(year, monthIndex, 1) > new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const canGoForward = new Date(year, monthIndex, 1) < new Date(today.getFullYear(), today.getMonth(), 1);
  const active = hovered === null ? null : days[hovered.index];
  // The tooltip sits above the hovered or focused day, or below it in the first two weeks so it doesn't cover the heading.
  // Near the left and right edges it lines up with the day's outer edge instead of centring, so it stays inside the card.
  const showDay = (event, index) => {
    const cell = event.currentTarget;
    const column = (leadingBlanks + index) % 7;
    const below = leadingBlanks + index < 14;
    const align = column < 2 ? 'start' : column > 4 ? 'end' : 'center';
    const left = cell.offsetLeft + { start: 0, center: cell.offsetWidth / 2, end: cell.offsetWidth }[align];
    const top = below ? cell.offsetTop + cell.offsetHeight + 6 : cell.offsetTop - 6;
    setHovered({ index, left, top, x: { start: '0%', center: '-50%', end: '-100%' }[align], y: below ? '0%' : '-100%' });
  };
  const changeMonth = (offset) => { setHovered(null); setMonth(new Date(year, monthIndex + offset, 1)); };

  return (
    <section className="analytics-section" aria-labelledby="analytics-rhythm-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-rhythm-heading">When you work</h2>
        {browsable ? (
          <MonthNav month={month} onChange={changeMonth} canGoBack={canGoBack} canGoForward={canGoForward} />
        ) : (
          <span className="analytics-calendar-month">{formatDate(month, { month: 'long', year: 'numeric' })}</span>
        )}
      </div>
      <p className="analytics-insight">
        {monthSessions
          ? `${formatCount(monthSessions, 'session')} · ${formatDuration(monthTotal)} across ${formatCount(workedDays, 'day')}.`
          : 'No sessions this month.'}
      </p>
      <div className="analytics-calendar" role="group" aria-label={`Session time per day, ${formatDate(month, { month: 'long', year: 'numeric' })}`} onMouseLeave={() => setHovered(null)}>
        {WEEKDAYS.map((weekday) => <span className="analytics-calendar-weekday" key={weekday} aria-hidden="true">{weekday}</span>)}
        {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {days.map((day, index) => {
          const isToday = toDayString(day.date) === toDayString(today);
          const isFuture = day.date > today;
          const label = `${formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${day.sessionCount ? `${formatDuration(day.durationMs)}, ${formatCount(day.sessionCount, 'session')}` : 'no sessions'}`;
          const cellProps = {
            className: `analytics-calendar-day level-${level(day.durationMs)}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}${hovered?.index === index ? ' is-hovered' : ''}`,
            onMouseEnter: (event) => showDay(event, index),
            onFocus: (event) => showDay(event, index),
            onBlur: () => setHovered(null),
          };
          // Days with sessions open Session History filtered to that day.
          return day.sessionCount ? (
            <a key={index} {...cellProps} href={historyDayHref(day.date)} aria-label={`${label}. Show sessions`} onClick={(event) => followRouteLink(event, onNavigate)}>
              <span aria-hidden="true">{index + 1}</span>
            </a>
          ) : (
            <div key={index} {...cellProps} role="img" tabIndex={isFuture ? -1 : 0} aria-label={label}>
              <span aria-hidden="true">{index + 1}</span>
            </div>
          );
        })}
        {active && !(active.date > today) && (
          <div
            className="analytics-calendar-tooltip"
            aria-hidden="true"
            style={{ left: hovered.left, top: hovered.top, '--tooltip-x': hovered.x, '--tooltip-y': hovered.y }}
          >
            <span>{formatDate(active.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <strong>{active.sessionCount ? formatDuration(active.durationMs) : 'No sessions'}</strong>
            {active.sessionCount > 0 && <small>{formatCount(active.sessionCount, 'session')} · {[...active.repositories].slice(0, 3).map((name, index) => <React.Fragment key={name}>{index > 0 && ', '}<RepositoryName name={name} /></React.Fragment>)}{active.repositories.size > 3 ? ` +${active.repositories.size - 3}` : ''}</small>}
          </div>
        )}
      </div>
      <div className="analytics-heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((value) => <i key={value} className={`analytics-heatmap-cell level-${value}`} />)}
        <span>More</span>
      </div>
    </section>
  );
}
