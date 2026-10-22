import React, { useEffect, useMemo, useRef, useState } from 'react';
import MonthNav from '../calendar/MonthNav.jsx';
import { addDays, monthDays, parseDay, sameDay, startOfDay, toDayString } from '../calendar/calendarDates.js';

// Quick picks under the calendar; 'all' (no limit) is what Clear returns to.
export const RANGE_PRESETS = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
];
const PRESET_SHORT_LABELS = { today: 'Today', week: 'Week', month: 'Month' };
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// A range is a preset ({ period }) or a custom span ({ period: 'custom', from, to } as YYYY-MM-DD).
// URL form: ?period=week, or ?from=2026-10-07&to=2026-10-09 (?date= is accepted as a one-day span).
export function readRange(params, fallback = 'all') {
  const from = parseDay(params.get('from') || params.get('date'));
  if (from) {
    const to = parseDay(params.get('to')) || from;
    const [start, end] = to < from ? [to, from] : [from, to];
    return { period: 'custom', from: toDayString(start), to: toDayString(end) };
  }
  const period = params.get('period');
  return { period: period === 'all' || RANGE_PRESETS.some(([value]) => value === period) ? period : fallback };
}

// `fallback` is the period a page opens with; it is left out of the URL, so 'all' is written when the fallback is something else.
export function writeRange(params, range, fallback = 'all') {
  if (range.period === 'custom') {
    params.set('from', range.from);
    params.set('to', range.to);
  } else if (range.period !== fallback) {
    params.set('period', range.period);
  }
}

// The local-time span [start, end) a range covers; null means no limit. Weeks start on Monday, as on Overview and Analytics.
export function rangeBounds(range, now = new Date()) {
  const today = startOfDay(now);
  if (range.period === 'custom') return { start: parseDay(range.from), end: addDays(parseDay(range.to), 1) };
  if (range.period === 'today') return { start: today, end: addDays(today, 1) };
  if (range.period === 'week') {
    const start = addDays(today, -((today.getDay() + 6) % 7));
    return { start, end: addDays(start, 7) };
  }
  if (range.period === 'month') return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  return null;
}

function rangeLabel(range) {
  if (range.period !== 'custom') return RANGE_PRESETS.find(([value]) => value === range.period)?.[1] || 'All time';
  const from = parseDay(range.from);
  const to = parseDay(range.to);
  const thisYear = new Date().getFullYear();
  const options = (date) => ({ month: 'short', day: 'numeric', ...(date.getFullYear() !== thisYear ? { year: 'numeric' } : {}) });
  const format = (date) => new Intl.DateTimeFormat(undefined, options(date)).format(date);
  return sameDay(from, to) ? format(from) : `${format(from)} – ${format(to)}`;
}

export default function DateRangePicker({ value, onChange, activeDays = new Set(), labelId }) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), [open]);
  const bounds = rangeBounds(value);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [anchor, setAnchor] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(today);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const gridRef = useRef(null);

  function openPicker() {
    const start = bounds?.start && bounds.start <= today ? bounds.start : today;
    setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setFocused(start);
    setAnchor(null);
    setHovered(null);
    setOpen(true);
  }

  function close({ restoreFocus = true } = {}) {
    setOpen(false);
    setAnchor(null);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function choose(range) {
    onChange(range);
    close();
  }

  // Presets apply at once and keep the calendar open, so the chosen period shows highlighted.
  function applyPreset(range) {
    onChange(range);
    setAnchor(null);
    setHovered(null);
    const start = rangeBounds(range)?.start || today;
    setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setFocused(start <= today ? start : today);
  }

  // Clicking outside closes the picker without changing the range.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) close({ restoreFocus: false }); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep keyboard focus on the focused day as it moves between days and months.
  useEffect(() => {
    if (!open || !gridRef.current?.contains(document.activeElement)) return;
    gridRef.current.querySelector(`[data-day="${toDayString(focused)}"]`)?.focus();
  }, [focused, open]);

  function selectDay(date) {
    if (date > today) return;
    if (!anchor) {
      setAnchor(date);
      return;
    }
    const [start, end] = date < anchor ? [date, anchor] : [anchor, date];
    choose({ period: 'custom', from: toDayString(start), to: toDayString(end) });
  }

  function moveFocus(days) {
    const next = addDays(focused, days);
    if (next > today) return;
    setFocused(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function onGridKeyDown(event) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[event.key] !== undefined) {
      event.preventDefault();
      moveFocus(moves[event.key]);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const offset = event.key === 'PageUp' ? -1 : 1;
      const next = new Date(focused.getFullYear(), focused.getMonth() + offset, Math.min(focused.getDate(), 28));
      if (next <= today) { setFocused(next); setMonth(new Date(next.getFullYear(), next.getMonth(), 1)); }
    }
  }

  const changeMonth = (offset) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  const canGoForward = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= today;
  const { leading, days } = monthDays(month);
  // While choosing, the span runs from the first click to the hovered or focused day.
  const previewEnd = anchor ? (hovered || anchor) : null;
  const [spanStart, spanEnd] = anchor
    ? (previewEnd < anchor ? [previewEnd, anchor] : [anchor, previewEnd])
    : bounds ? [bounds.start, new Date(Math.min(addDays(bounds.end, -1), today))] : [null, null];
  const label = rangeLabel(value);

  return (
    <div className="filter-control date-range" ref={rootRef} onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
      <button
        ref={triggerRef}
        className={`filter-trigger${value.period !== 'all' ? ' is-set' : ''}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelId ? `${labelId} date-range-value` : undefined}
        onClick={() => (open ? close() : openPicker())}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        <span id="date-range-value">{label}</span>
        <svg className="filter-chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <>
        <div className="filter-backdrop" aria-hidden="true" />
        <div className="filter-popover date-range-popover" role="dialog" aria-label="Choose dates">
          <div className="filter-sheet-header">
            <strong>Dates</strong>
            <button className="filter-close" type="button" aria-label="Close" onClick={() => close()}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="date-range-calendar">
            <MonthNav className="date-range-month" month={month} onChange={changeMonth} canGoForward={canGoForward} />
            <div className="date-range-grid" ref={gridRef} role="group" aria-label="Dates" onKeyDown={onGridKeyDown} onMouseLeave={() => setHovered(null)}>
              <div className="date-range-row" aria-hidden="true">
                {WEEKDAYS.map((weekday) => <span key={weekday} className="date-range-weekday">{weekday}</span>)}
              </div>
              <div className="date-range-days">
                {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
                {days.map((date) => {
                  const key = toDayString(date);
                  const isFuture = date > today;
                  const inSpan = spanStart && date >= spanStart && date <= spanEnd;
                  const isEdge = sameDay(date, spanStart) || sameDay(date, spanEnd);
                  const isFocusTarget = sameDay(date, focused) || (!days.some((day) => sameDay(day, focused)) && date.getDate() === 1);
                  return (
                    <button
                      key={key}
                      type="button"
                      data-day={key}
                      className={['date-range-day', inSpan && 'in-span', isEdge && 'is-edge', sameDay(date, today) && 'is-today', activeDays.has(key) && 'has-sessions'].filter(Boolean).join(' ')}
                      tabIndex={isFocusTarget ? 0 : -1}
                      disabled={isFuture}
                      aria-pressed={Boolean(inSpan)}
                      aria-label={new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date) + (activeDays.has(key) ? ', has sessions' : '')}
                      onClick={() => selectDay(date)}
                      onMouseEnter={() => anchor && !isFuture && setHovered(date)}
                      onFocus={() => { setFocused(date); if (anchor) setHovered(date); }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
                {Array.from({ length: (7 - ((leading + days.length) % 7)) % 7 }, (_, index) => <span key={`tail-${index}`} aria-hidden="true" />)}
              </div>
            </div>
            <p className="date-range-hint" aria-live="polite">{anchor ? 'Choose an end date' : 'Choose a start date'}</p>
            <div className="date-range-footer">
              <div className="date-range-presets" role="group" aria-label="Quick picks">
                {RANGE_PRESETS.map(([period, presetLabel]) => (
                  <button key={period} type="button" aria-label={presetLabel} aria-pressed={value.period === period} className={value.period === period ? 'selected' : ''} onClick={() => applyPreset({ period })}>
                    {PRESET_SHORT_LABELS[period]}
                  </button>
                ))}
              </div>
              <button className="date-range-clear" type="button" onClick={() => applyPreset({ period: 'all' })} disabled={value.period === 'all' && !anchor}>Clear</button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
