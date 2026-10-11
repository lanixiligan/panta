import React, { useEffect, useRef, useState } from 'react';

// A session goal shown as a heading, editable in place. Enter or blur saves, Escape cancels.
export default function EditableGoal({ goal, onSave, as: Heading = 'h1', className = '', placeholder = 'What are you working on?' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal || '');
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const cancelled = useRef(false);
  const wasEditing = useRef(false);

  // Select the text when editing starts; return focus to the edit button when it ends from the keyboard.
  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (wasEditing.current && document.activeElement === document.body) buttonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function startEditing() {
    cancelled.current = false;
    setDraft(goal || '');
    setEditing(true);
  }

  function finish() {
    setEditing(false);
    if (cancelled.current) return;
    // A goal can be changed but not cleared; an empty draft keeps the current goal.
    const next = draft.trim();
    if (next && next !== (goal || '')) onSave(next);
  }

  if (!onSave) return <Heading className={`${className} ${goal ? '' : 'empty'}`}>{goal || 'No goal set'}</Heading>;

  if (editing) {
    return (
      <Heading className={`editable-goal ${className}`}>
        <input
          ref={inputRef}
          className="editable-goal-input"
          aria-label="Session goal"
          autoComplete="off"
          maxLength={160}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
          }}
        />
      </Heading>
    );
  }

  return (
    <Heading className={`editable-goal ${className} ${goal ? '' : 'empty'}`}>
      <span>{goal || 'No goal set'}</span>
      <button ref={buttonRef} className="editable-goal-button" type="button" onClick={startEditing} aria-label="Edit goal" title="Edit goal">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.1 2.3a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1L6 12.6 2.5 13.5l.9-3.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </button>
    </Heading>
  );
}
