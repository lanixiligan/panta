import React, { useEffect, useId, useRef, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';

// A modal that asks three times before deleting, like GitHub's repository deletion: intent, then the effects,
// then typing `confirmText`. It opens on mount; the parent unmounts it from `onClose`. `onConfirm` rejects on failure.
export default function DeleteDialog({ title, summary, startLabel, effects, confirmText, confirmLabel, errorMessage, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const inputId = useId();
  const matches = typed.trim().toLowerCase() === confirmText.toLowerCase();

  // No close() on cleanup: its queued close event would unmount the dialog again after StrictMode's remount.
  // Unmounting removes it from the top layer anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  function close() {
    if (!pending) dialogRef.current.close();
  }

  async function confirm(event) {
    event.preventDefault();
    if (!matches || pending) return;
    setPending(true);
    setError('');
    try {
      await onConfirm();
    } catch {
      setError(errorMessage);
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={onClose}
    >
      <header className="delete-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button className="delete-dialog-close" type="button" aria-label="Close" onClick={close} disabled={pending}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>
      <div className="delete-dialog-summary">{summary}</div>

      {step === 1 && (
        <div className="delete-dialog-footer">
          <button className="settings-button delete-dialog-action" type="button" autoFocus onClick={() => setStep(2)}>{startLabel}</button>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="delete-dialog-body">
            <p className="delete-dialog-warning">
              <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
              This can’t be undone.
            </p>
            <ul className="delete-dialog-effects">
              {effects.map((effect) => <li key={effect}>{effect}</li>)}
            </ul>
          </div>
          <div className="delete-dialog-footer">
            <button className="settings-button delete-dialog-action" type="button" autoFocus onClick={() => setStep(3)}>I have read and understand these effects</button>
          </div>
        </>
      )}

      {step === 3 && (
        <form className="delete-dialog-footer delete-dialog-confirm" onSubmit={confirm}>
          <label htmlFor={inputId}>To confirm, type “<span translate="no">{confirmText}</span>” below</label>
          <input
            id={inputId}
            className="delete-dialog-input"
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={pending}
          />
          {error && <p className="delete-dialog-error" role="alert">{error}</p>}
          <button className="settings-button is-danger is-solid delete-dialog-action" type="submit" disabled={!matches || pending}>
            {pending ? 'Deleting…' : confirmLabel}
          </button>
        </form>
      )}
    </dialog>
  );
}
