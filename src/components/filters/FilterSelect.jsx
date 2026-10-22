import React, { useEffect, useId, useRef, useState } from 'react';

// A single-choice dropdown styled like the date picker: a trigger button and a popover listbox.
// Arrow keys, Home/End, and typing a letter move through options; Enter or Space picks; Escape closes.
export default function FilterSelect({ value, options, onChange, labelId, icon }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [title, setTitle] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();
  const selectedIndex = Math.max(0, options.findIndex(([optionValue]) => optionValue === value));
  const selectedLabel = options[selectedIndex]?.[1] ?? '';

  function openList() {
    setActive(selectedIndex);
    // The phone's centred panel is titled with the control's own label ("Repository", "Sort").
    setTitle(labelId ? document.getElementById(labelId)?.textContent ?? '' : '');
    setOpen(true);
  }

  function close({ restoreFocus = true } = {}) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function pick(index) {
    onChange(options[index][0]);
    close();
  }

  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.focus();
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) close({ restoreFocus: false }); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option in view as it moves.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function onListKeyDown(event) {
    const last = options.length - 1;
    const moves = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last };
    if (moves[event.key] !== undefined) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close({ restoreFocus: false });
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead: jump to the next option starting with the typed letter.
      const letter = event.key.toLocaleLowerCase();
      const order = [...options.keys()].map((offset) => (active + 1 + offset) % options.length);
      const match = order.find((index) => options[index][1].toLocaleLowerCase().startsWith(letter));
      if (match !== undefined) setActive(match);
    }
  }

  function onTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    }
  }

  return (
    <div className="filter-control" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`filter-trigger${selectedIndex > 0 ? ' is-set' : ''}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId ? `${labelId} ${id}-value` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        {icon}
        <span id={`${id}-value`}>{selectedLabel}</span>
        <svg className="filter-chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <>
          <div className="filter-backdrop" aria-hidden="true" />
          <div className="filter-popover">
            <div className="filter-sheet-header">
              <strong>{title}</strong>
              <button className="filter-close" type="button" aria-label="Close" onClick={() => close()}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <ul
              ref={listRef}
              className="filter-options"
              role="listbox"
              tabIndex={-1}
              aria-labelledby={labelId}
              aria-activedescendant={`${id}-option-${active}`}
              onKeyDown={onListKeyDown}
            >
              {options.map(([optionValue, label], index) => (
                <li
                  key={optionValue}
                  id={`${id}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={[index === active && 'is-active', index === selectedIndex && 'is-selected'].filter(Boolean).join(' ')}
                  title={label}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                >
                  <span>{label}</span>
                  {index === selectedIndex && <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
