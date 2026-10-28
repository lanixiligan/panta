import React, { useMemo, useState } from 'react';
import { calculateSessionAnalytics } from '../../analytics/sessionAnalytics.js';
import { followRouteLink, repositoryDetailPath, updateSearchParams } from '../../routing.js';
import DateRangePicker, { readRange, rangeBounds, writeRange } from '../../components/filters/DateRangePicker.jsx';
import { toDayString } from '../../components/calendar/calendarDates.js';
import RepositoryName from '../../components/repository/RepositoryName.jsx';
import { formatCount } from '../../sessions/sessionHelpers.js';

const DEFAULT_PERIOD = 'month';
const HOUR_MS = 3_600_000;

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 60_000) return '<1m';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

// The heading for a range: "Today · Oct 29", "Oct 29, 2026", "Oct 1–29, 2026", "Sep 15 – Oct 29, 2026".
function formatRangeHeading(start, end, today = new Date()) {
  const full = { month: 'short', day: 'numeric', year: 'numeric' };
  if (toDayString(start) === toDayString(end)) {
    return toDayString(start) === toDayString(today) ? `Today · ${formatDate(start)}` : formatDate(start, full);
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) return `${formatDate(start)}–${end.getDate()}, ${end.getFullYear()}`;
  return `${formatDate(start, start.getFullYear() === end.getFullYear() ? undefined : full)} – ${formatDate(end, full)}`;
}

function shiftDays(date, days) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

// The period just before the selected one, and how to name it. None for all time.
function previousPeriod(range, bounds) {
  if (!bounds) return null;
  if (range.period === 'month') {
    const start = new Date(bounds.start.getFullYear(), bounds.start.getMonth() - 1, 1);
    return { bounds: { start, end: bounds.start }, label: formatDate(start, { month: 'long' }) };
  }
  const days = Math.round((bounds.end - bounds.start) / 86_400_000);
  const label = range.period === 'week' ? 'last week' : range.period === 'today' ? 'yesterday' : `previous ${formatCount(days, 'day')}`;
  return { bounds: { start: shiftDays(bounds.start, -days), end: bounds.start }, label };
}

function SummaryMetrics({ analytics, previous, fileTypes }) {
  const { activity } = analytics;
  const activeShare = analytics.periodDays ? Math.min(100, analytics.activeDays / analytics.periodDays * 100) : 0;
  const change = previous && previous.totalDurationMs > 0 ? analytics.totalDurationMs / previous.totalDurationMs - 1 : null;

  return (
    <section className="analytics-section analytics-summary" aria-labelledby="analytics-summary-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-summary-heading">Summary</h2>
      </div>
      <dl className="analytics-summary-list">
        <div>
          <dt>Coding time</dt>
          <dd>
            <strong>{formatDuration(analytics.totalDurationMs)}</strong>
            {change !== null && (
              <small className={change >= 0 ? 'is-up' : 'is-down'}>
                <span aria-hidden="true">{change >= 0 ? '▲' : '▼'}</span> {Math.abs(Math.round(change * 100))}% vs {previous.label}
              </small>
            )}
          </dd>
        </div>
        <div>
          <dt>Sessions</dt>
          <dd>
            <strong>{formatNumber(analytics.sessionCount)}</strong>
            <small>Avg. {formatDuration(analytics.averageDurationMs)} / session</small>
          </dd>
        </div>
        <div>
          <dt>Active days</dt>
          <dd>
            <strong>{formatNumber(analytics.activeDays)}/{formatCount(analytics.periodDays, 'day')}</strong>
            <div className="analytics-progress-row">
              <div className="analytics-progress" role="progressbar" aria-label="Active days" aria-valuemin={0} aria-valuemax={analytics.periodDays} aria-valuenow={analytics.activeDays}>
                <i style={{ width: `${activeShare}%` }} />
              </div>
              <small>{Math.round(activeShare)}%</small>
            </div>
          </dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>
            <strong>{activity.commits.total === null ? '—' : formatNumber(activity.commits.total)}</strong>
            {activity.additions.total !== null && (
              <small>
                <span className="analytics-additions">+{formatNumber(activity.additions.total)}</span>{' '}
                <span className="analytics-deletions">−{formatNumber(activity.deletions.total ?? 0)}</span> lines
              </small>
            )}
          </dd>
        </div>
      </dl>
      <FileTypes fileTypes={fileTypes} />
    </section>
  );
}

function bucketLabel(bucket, unit) {
  if (unit === 'week') {
    const lastDay = new Date(bucket.end.getTime() - 1);
    return `Week of ${formatDate(bucket.start)} – ${formatDate(lastDay)}`;
  }
  return formatDate(bucket.start, { weekday: 'short', month: 'short', day: 'numeric' });
}

function axisLabel(bucket, index, buckets, unit) {
  if (unit === 'week') {
    const previous = buckets[index - 1];
    return !previous || previous.start.getMonth() !== bucket.start.getMonth() ? formatDate(bucket.start, { month: 'short' }) : '';
  }
  if (buckets.length <= 10) return formatDate(bucket.start, { weekday: 'short' });
  // Every seventh day and the last one; a weekly label too close to the last would overlap it.
  const last = buckets.length - 1;
  return index === last || (index % 7 === 0 && last - index >= 3) ? formatDate(bucket.start) : '';
}

// Always seven gridlines (zero and six steps), so the chart keeps its shape whatever the longest day is.
// The top is the longest day rounded up to a whole hour (half hours for short totals), so every step is a round number of minutes.
const SCALE_LINES = 7;

function chartScale(maxMs) {
  const unit = maxMs <= 2 * HOUR_MS ? HOUR_MS / 2 : HOUR_MS;
  const top = Math.max(unit, Math.ceil(maxMs / unit) * unit);
  return { top, ticks: Array.from({ length: SCALE_LINES }, (_, index) => (index * top) / (SCALE_LINES - 1)) };
}

function SessionTimeChart({ timeline, averageMs }) {
  const { buckets, unit } = timeline;
  const maxDuration = Math.max(...buckets.map(({ durationMs }) => durationMs), 0);
  const { top, ticks } = chartScale(maxDuration);
  const x = (index) => (buckets.length > 1 ? (index / (buckets.length - 1)) * 100 : 50);
  const y = (durationMs) => 100 - (durationMs / top) * 100;
  const past = buckets.map((bucket, index) => ({ bucket, index })).filter(({ bucket }) => !bucket.isFuture);
  const lastPast = past.length - 1;
  const linePath = past.map(({ bucket, index }, order) => `${order ? 'L' : 'M'}${x(index)},${y(bucket.durationMs)}`).join(' ');
  const areaPath = past.length ? `${linePath} L${x(past[lastPast].index)},100 L${x(0)},100 Z` : '';
  const peak = past.reduce((best, entry) => (entry.bucket.durationMs > (best?.bucket.durationMs || 0) ? entry : best), null);
  const todayIndex = buckets.some((bucket) => bucket.isFuture) ? past[lastPast]?.index : null;
  const step = 100 / buckets.length;
  const align = (index) => (index < buckets.length * 0.15 ? 'start' : index > buckets.length * 0.85 ? 'end' : 'center');

  return (
    <section className="analytics-section analytics-time-chart" aria-labelledby="analytics-time-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-time-heading">{unit === 'week' ? 'Weekly session time' : 'Daily session time'}</h2>
        <ul className="analytics-legend" aria-hidden="true">
          <li><i className="is-line" />Session time</li>
          <li><i className="is-dot" />Day with commits</li>
          <li><i className="is-hollow" />No commits</li>
          {averageMs > 0 && <li><i className="is-dashed" />Average per active {unit}</li>}
        </ul>
      </div>
      <div className="analytics-line-chart">
        <div className="analytics-line-scale" aria-hidden="true">
          {ticks.map((tick) => <span key={tick} style={{ top: `${y(tick)}%` }}>{tick ? formatDuration(tick) : '0'}</span>)}
        </div>
        <div className="analytics-line-plot">
          {ticks.map((tick) => <span key={tick} className="analytics-line-grid" style={{ top: `${y(tick)}%` }} aria-hidden="true" />)}
          <svg className="analytics-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="analytics-area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--workspace-accent)', stopOpacity: 0.32 }} />
                <stop offset="100%" style={{ stopColor: 'var(--workspace-accent)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {todayIndex !== null && todayIndex !== undefined && (
              <line className="analytics-line-future" x1={x(todayIndex)} x2="100" y1="100" y2="100" vectorEffect="non-scaling-stroke" />
            )}
            {areaPath && <path className="analytics-line-area" d={areaPath} />}
            {linePath && <path className="analytics-line-path" d={linePath} vectorEffect="non-scaling-stroke" />}
            {averageMs > 0 && <line className="analytics-line-average" x1="0" x2="100" y1={y(averageMs)} y2={y(averageMs)} vectorEffect="non-scaling-stroke" />}
          </svg>
          {averageMs > 0 && <span className="analytics-line-average-label" style={{ top: `${y(averageMs)}%` }} aria-hidden="true">avg {formatDuration(averageMs)}</span>}
          {past.map(({ bucket, index }) => bucket.sessionCount > 0 && (
            <span key={index} className={`analytics-line-point${bucket.commits > 0 ? ' has-commits' : ''}`} style={{ left: `${x(index)}%`, top: `${y(bucket.durationMs)}%` }} aria-hidden="true" />
          ))}
          {peak && <span className="analytics-line-peak" style={{ left: `${x(peak.index)}%`, top: `${y(peak.bucket.durationMs)}%` }} aria-hidden="true">{formatDuration(peak.bucket.durationMs)}</span>}
          <div className="analytics-line-hits" role="list" aria-label={`Session time per ${unit}`}>
            {buckets.map((bucket, index) => {
              const label = bucketLabel(bucket, unit);
              return (
                <div
                  className={`analytics-line-hit${bucket.isFuture ? ' is-future' : ''}`}
                  key={bucket.start.toISOString()}
                  style={{ left: `${x(index) - step / 2}%`, width: `${step}%`, '--guide': `${x(index) === 0 ? 0 : x(index) === 100 ? 100 : 50}%` }}
                  role="listitem"
                  tabIndex={bucket.isFuture ? -1 : 0}
                  aria-label={bucket.isFuture ? `${label}: upcoming` : `${label}: ${bucket.sessionCount ? formatDuration(bucket.durationMs) : 'no sessions'}${bucket.sessionCount ? `, ${formatCount(bucket.sessionCount, 'session')}, ${formatCount(bucket.commits, 'commit')}` : ''}`}
                >
                  {!bucket.isFuture && (
                    <span className={`analytics-tooltip ${align(index)}`} role="tooltip">
                      <span className="analytics-tooltip-title">{label}</span>
                      <span className="analytics-tooltip-value">{bucket.sessionCount ? formatDuration(bucket.durationMs) : 'No sessions'}</span>
                      {bucket.sessionCount > 0 && (
                        <span className="analytics-tooltip-meta">{formatCount(bucket.sessionCount, 'session')}{bucket.hasCommits ? ` · ${formatCount(bucket.commits, 'commit')}` : ''}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="analytics-line-axis" aria-hidden="true">
          {buckets.map((bucket, index) => {
            const isToday = index === todayIndex;
            const nearToday = todayIndex !== null && todayIndex !== undefined && !isToday && Math.abs(index - todayIndex) < 3;
            const text = isToday ? 'Today' : nearToday ? '' : axisLabel(bucket, index, buckets, unit);
            if (!text) return null;
            const edge = index === 0 ? ' is-first' : index === buckets.length - 1 ? ' is-last' : '';
            return <span key={index} className={`${isToday ? 'is-today' : ''}${edge}`} style={{ left: `${x(index)}%` }}>{text}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

const TOP_REPOSITORIES = 5;
const TOP_FILE_TYPES = 4;

// Always drawn, so the block keeps its place at the bottom: `null` means file data was never recorded, an empty list means no files changed.
function FileTypes({ fileTypes }) {
  const top = (fileTypes || []).slice(0, TOP_FILE_TYPES);
  const rest = (fileTypes || []).slice(TOP_FILE_TYPES);
  const parts = rest.length ? [...top, { extension: 'other', share: rest.reduce((total, type) => total + type.share, 0) }] : top;
  return (
    <div className="analytics-file-types">
      <h3 className="analytics-label">Files changed, by type</h3>
      <span className="analytics-file-bar" aria-hidden="true">
        {parts.map((part, index) => <i key={part.extension} style={{ width: `${part.share * 100}%`, background: `var(--workspace-type-${index})` }} />)}
      </span>
      {parts.length ? (
        <ul className="analytics-file-legend">
          {parts.map((part, index) => (
            <li key={part.extension}><i style={{ background: `var(--workspace-type-${index})` }} aria-hidden="true" />{part.extension} <span>{Math.round(part.share * 100)}%</span></li>
          ))}
        </ul>
      ) : <p className="analytics-file-empty">{fileTypes ? 'No files changed' : 'Unavailable'}</p>}
    </div>
  );
}

// An invisible row the size of a real one, so the list always takes the space of the top repositories and the "other repositories" row.
function RepositoryPlaceholder() {
  return (
    <li className="is-placeholder" aria-hidden="true">
      <div className="analytics-repository-row">
        <span className="analytics-repository-title"><span className="analytics-repository-name">&nbsp;</span></span>
        <span className="analytics-repository-duration">&nbsp;</span>
        <span className="analytics-repository-track" />
      </div>
    </li>
  );
}

function RepositoryBreakdown({ repositories, onNavigate }) {
  const topRepositories = repositories.slice(0, TOP_REPOSITORIES);
  const others = repositories.slice(TOP_REPOSITORIES);
  const othersDurationMs = others.reduce((total, repository) => total + repository.durationMs, 0);
  const othersShare = others.reduce((total, repository) => total + repository.share, 0);
  return (
    <section className="analytics-section" aria-labelledby="analytics-repositories-heading">
      <div className="analytics-section-heading">
        <h2 id="analytics-repositories-heading">Where your time went</h2>
        <span>{formatCount(repositories.length, 'repository', 'repositories')}</span>
      </div>
      {repositories.length ? (
        <ol className="analytics-repository-list">
          {topRepositories.map((repository) => {
            const content = (
              <>
                <span className="analytics-repository-title">
                  <span className="analytics-repository-name"><RepositoryName name={repository.fullName} /></span>
                  <small className="analytics-repository-meta">
                    {formatCount(repository.sessionCount, 'session')}{repository.commits !== null ? ` · ${formatCount(repository.commits, 'commit')}` : ''} · avg {formatDuration(repository.durationMs / repository.sessionCount)}
                  </small>
                </span>
                <span className="analytics-repository-duration">{formatDuration(repository.durationMs)} <small>· {Math.round(repository.share * 100)}%</small></span>
                <span className="analytics-repository-track" aria-hidden="true"><i style={{ width: `${repository.share * 100}%` }} /></span>
              </>
            );
            return (
              <li key={repository.fullName}>
                {repository.isExample || !repository.fullName.includes('/')
                  ? <div className="analytics-repository-row">{content}</div>
                  : <a className="analytics-repository-row" href={repositoryDetailPath(repository.fullName)} onClick={(event) => followRouteLink(event, onNavigate)}>{content}</a>}
              </li>
            );
          })}
          {Array.from({ length: TOP_REPOSITORIES - topRepositories.length }, (_, index) => <RepositoryPlaceholder key={`empty-${index}`} />)}
          {others.length === 0 ? <RepositoryPlaceholder /> : (
            <li>
              <div className="analytics-repository-row is-others">
                <span className="analytics-repository-title"><span className="analytics-repository-name">{formatCount(others.length, 'other repository', 'other repositories')}</span></span>
                <span className="analytics-repository-duration">{formatDuration(othersDurationMs)} <small>· {Math.round(othersShare * 100)}%</small></span>
                <span className="analytics-repository-track" aria-hidden="true"><i style={{ width: `${othersShare * 100}%` }} /></span>
              </div>
            </li>
          )}
        </ol>
      ) : <p className="analytics-empty-inline">No repository information</p>}
    </section>
  );
}

const EMPTY_PERIOD = { today: 'No sessions yet today.', week: 'No sessions yet this week.', month: 'No sessions yet this month.' };

function AnalyticsEmptyState({ period, hasAnySessions, onShowAllTime }) {
  return (
    <section className="analytics-empty-state" role="status">
      <h2>{hasAnySessions ? EMPTY_PERIOD[period] || 'No sessions in this period.' : 'Complete a session to start building your work history.'}</h2>
      {hasAnySessions && period !== 'all' && <button className="text-link" type="button" onClick={onShowAllTime}>Show all time <span aria-hidden="true">→</span></button>}
    </section>
  );
}

export default function AnalyticsPage({ sessions = [], notice = null, onNavigate }) {
  // The range lives in the URL (?period= or ?from=&to=) so links and reloads keep the view.
  const [range, setRangeState] = useState(() => readRange(new URLSearchParams(window.location.search), DEFAULT_PERIOD));
  const setRange = (next) => {
    const params = new URLSearchParams();
    writeRange(params, next, DEFAULT_PERIOD);
    setRangeState(next);
    updateSearchParams({ period: params.get('period'), from: params.get('from'), to: params.get('to'), date: null });
  };
  const bounds = useMemo(() => rangeBounds(range), [range]);
  const analytics = useMemo(() => calculateSessionAnalytics(sessions, bounds), [sessions, bounds]);
  const previous = useMemo(() => {
    const prior = previousPeriod(range, bounds);
    return prior && { label: prior.label, totalDurationMs: calculateSessionAnalytics(sessions, prior.bounds).totalDurationMs };
  }, [sessions, range, bounds]);
  const activeDays = useMemo(() => new Set(sessions.map((session) => toDayString(new Date(session.startedAt)))), [sessions]);
  const hasSessions = analytics.sessionCount > 0;
  const averagePerActive = analytics.timeline.unit === 'week'
    ? analytics.totalDurationMs / Math.max(1, analytics.timeline.buckets.filter((bucket) => bucket.sessionCount).length)
    : analytics.activeDays ? analytics.totalDurationMs / analytics.activeDays : 0;

  return (
    <div className="analytics-page">
      <section className="analytics-page-intro">
        <div>
          <h1>
            {range.period === 'month' ? formatDate(analytics.rangeStart, { month: 'long', year: 'numeric' }) : formatRangeHeading(analytics.rangeStart, analytics.rangeEnd)}
          </h1>
        </div>
        <div className="analytics-controls">
          <DateRangePicker value={range} onChange={setRange} activeDays={activeDays} />
        </div>
      </section>

      {notice}

      {!hasSessions ? (notice ? null : <AnalyticsEmptyState period={range.period} hasAnySessions={analytics.totalCompletedSessions > 0} onShowAllTime={() => setRange({ period: 'all' })} />) : (
        <>
          <SessionTimeChart timeline={analytics.timeline} averageMs={averagePerActive} />
          <div className="analytics-grid">
            <SummaryMetrics analytics={analytics} previous={previous} fileTypes={analytics.fileTypes} />
            <RepositoryBreakdown repositories={analytics.repositories} onNavigate={onNavigate} />
          </div>
        </>
      )}
    </div>
  );
}
