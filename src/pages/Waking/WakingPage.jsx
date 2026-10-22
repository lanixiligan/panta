import React, { useEffect, useId, useState } from 'react';

// Matches --duration-fade in tokens.css.
const WAKING_FADE_MS = 450;

// The three waves of the Panta mark, drawn as real sine curves so they can flow forever.
const X0 = 22; // where each wave starts its first crest, as in the logo
const LEFT = 18; // left edge of the visible mark
const SPEED = 40; // flow speed in SVG units per second
const WAVES = [
  { name: 'w1', y: 50, amp: 12, period: 84, width: 9, end: 106 },
  { name: 'w2', y: 68, amp: 10.5, period: 74, width: 7, end: 96 },
  { name: 'w3', y: 84, amp: 8.25, period: 64, width: 5, end: 86 },
].map((wave) => ({ ...wave, d: sinePath(wave), duration: wave.period / SPEED }));

function sinePath({ y, amp, period, end }) {
  let d = '';
  for (let x = LEFT; x <= end + period + 4; x += 1.5) {
    const waveY = y - amp * Math.sin((2 * Math.PI * (x - X0)) / period);
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${waveY.toFixed(2)}`;
  }
  return d;
}

// Seconds on this screen → the line under the title.
const MESSAGES = [
  [0, 'Starting the server…'],
  [6, 'Free servers nap when no one is around. This can take up to a minute.'],
  [25, 'Still waking up. Almost there.'],
  [50, 'Taking longer than usual.'],
];

function useSecondsShown(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds((Date.now() - started) / 1000), 500);
    return () => window.clearInterval(timer);
  }, [running]);
  return seconds;
}

// True for the length of the fade after the waking screen stops being shown. It flips during the same render, so the
// screen is never unmounted between being shown and fading out.
export function useWakingFade(shown) {
  const [wasShown, setWasShown] = useState(shown);
  const [leaving, setLeaving] = useState(false);
  if (shown !== wasShown) {
    setWasShown(shown);
    setLeaving(!shown);
  }
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => setLeaving(false), WAKING_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return leaving;
}

// Shown while a sleeping API wakes up. `leaving` fades it out over the screen that replaces it.
export default function WakingPage({ leaving = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const seconds = useSecondsShown(!leaving);
  const message = [...MESSAGES].reverse().find(([at]) => seconds >= at)[1];

  return (
    <main className={`waking-screen${leaving ? ' is-leaving' : ''}`} aria-busy={!leaving} aria-hidden={leaving || undefined}>
      <div className="waking-content">
        {/* Taller than the logo's 16 32 100 64, so the bobbing dot fits; the clip hides each wave's off-screen run. */}
        <svg className="waking-mark" viewBox="16 26 100 70" aria-hidden="true" focusable="false">
          <defs>
            {/* Each wave fades in at its start and (except the top one, which meets the dot) out at its end. */}
            {WAVES.map((wave) => (
              <linearGradient key={wave.name} id={`${uid}-${wave.name}-g`} gradientUnits="userSpaceOnUse" x1={LEFT} x2={wave.end} y1="0" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset={14 / (wave.end - LEFT)} stopColor="#fff" />
                <stop offset={wave.name === 'w1' ? 1 : 1 - 6 / (wave.end - LEFT)} stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity={wave.name === 'w1' ? 1 : 0} />
              </linearGradient>
            ))}
            {WAVES.map((wave) => (
              <mask key={wave.name} id={`${uid}-${wave.name}-m`} maskUnits="userSpaceOnUse" x={LEFT - 2} y="20" width={wave.end - LEFT + 2} height="90">
                <rect x={LEFT - 2} y="20" width={wave.end - LEFT + 2} height="90" fill={`url(#${uid}-${wave.name}-g)`} />
              </mask>
            ))}
          </defs>
          {WAVES.map((wave) => (
            <g key={wave.name} mask={`url(#${uid}-${wave.name}-m)`}>
              <g className="waking-flow" style={{ '--waking-period': wave.period, animationDuration: `${wave.duration}s` }}>
                <path className={`waking-wave waking-${wave.name}`} d={wave.d} strokeWidth={wave.width} />
              </g>
            </g>
          ))}
          <circle className="waking-dot" cx="106" cy="50" r="9" />
        </svg>

        <h1 className="waking-title">Panta is waking up</h1>
        <p className="waking-message" key={message} role={leaving ? undefined : 'status'}>{message}</p>
      </div>
    </main>
  );
}
