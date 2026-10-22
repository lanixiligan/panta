import React from 'react';

// The ‹ Month Year › header shared by the calendars. `onChange` receives -1 or 1.
export default function MonthNav({ month, onChange, canGoBack = true, canGoForward = true, className = '' }) {
  return (
    <div className={`month-nav${className ? ` ${className}` : ''}`}>
      <button type="button" onClick={() => onChange(-1)} disabled={!canGoBack} aria-label="Previous month">‹</button>
      <span aria-live="polite">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</span>
      <button type="button" onClick={() => onChange(1)} disabled={!canGoForward} aria-label="Next month">›</button>
    </div>
  );
}
