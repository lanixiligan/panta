import React, { useEffect, useRef, useState } from 'react';

// A scroll area with its own always-visible scrollbar. Browsers with overlay scrollbars (Firefox on Linux, macOS)
// hide the native one until you hover or scroll, so the native bar is hidden and this track is drawn instead.
// `watch` is any value that changes when the content does (an item count), so the thumb is re-measured.
export default function ScrollArea({ children, watch, className = '' }) {
  const rootRef = useRef(null);
  const [thumb, setThumb] = useState(null);

  const scroller = () => rootRef.current?.querySelector('.scroll-area-content > *');

  useEffect(() => {
    const element = scroller();
    if (!element) return undefined;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      // A list that scrolls but holds nothing focusable (commits without links) takes focus itself, so the keyboard can scroll it.
      const scrolls = scrollHeight > clientHeight + 1;
      if (scrolls && !element.querySelector('a[href], button, input, [tabindex]')) element.setAttribute('tabindex', '0');
      else if (element.getAttribute('tabindex') === '0') element.removeAttribute('tabindex');
      if (!scrolls) { setThumb(null); return; }
      const height = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
      setThumb({ height, top: (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height) });
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, [watch]);

  // Dragging the thumb scrolls the list in proportion.
  function startDrag(event) {
    const element = scroller();
    if (!element || !thumb) return;
    event.preventDefault();
    const startY = event.clientY;
    const startScroll = element.scrollTop;
    const ratio = (element.scrollHeight - element.clientHeight) / (element.clientHeight - thumb.height);
    const move = (moveEvent) => { element.scrollTop = startScroll + (moveEvent.clientY - startY) * ratio; };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  return (
    <div className={`scroll-area${className ? ` ${className}` : ''}`} ref={rootRef}>
      <div className="scroll-area-content">{children}</div>
      {thumb && (
        <div className="scroll-area-track" aria-hidden="true">
          <div className="scroll-area-thumb" style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }} onPointerDown={startDrag} />
        </div>
      )}
    </div>
  );
}
