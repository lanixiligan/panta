import { useEffect, useState } from 'react';

// A hosted API that has been idle takes up to a minute to wake, so a wait this long gets its own message.
const SLOW_WAIT_MS = 4000;

export default function useSlowWait(waiting) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) { setSlow(false); return undefined; }
    const timer = window.setTimeout(() => setSlow(true), SLOW_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return slow;
}
