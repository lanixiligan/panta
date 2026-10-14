import React from 'react';

// Previous / Next paging for a long list. Renders nothing when everything fits on one page.
export default function Pager({ page, pageCount, onChange, label }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pager" aria-label={label}>
      <button className="subtle-action" type="button" onClick={() => onChange(page - 1)} disabled={page === 1}>
        <span aria-hidden="true">←</span> Previous
      </button>
      <span aria-live="polite">Page {page} of {pageCount}</span>
      <button className="subtle-action" type="button" onClick={() => onChange(page + 1)} disabled={page === pageCount}>
        Next <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
