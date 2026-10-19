import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveElapsedMs, getSessionDurationMinutes, getSessionDurationMs } from './sessionHelpers.js';
import { getDummySessions } from '../dummy-data/index.js';

const HOUR_MS = 3_600_000;
const session = { startedAt: '2026-10-19T10:00:00Z', endedAt: '2026-10-19T11:00:00Z' };

test('legacy session without pausedMs or duration lasts from start to end', () => {
  assert.equal(getSessionDurationMs(session), 3_600_000);
});

test('null duration and pausedMs, as the server sends for an imported legacy session, fall back to the timestamps', () => {
  assert.equal(getSessionDurationMs({ ...session, duration: null, pausedMs: null }), 3_600_000);
});

test('pausedMs is subtracted', () => {
  assert.equal(getSessionDurationMs({ ...session, pausedMs: 600_000 }), 3_000_000);
});

test('stored duration wins', () => {
  assert.equal(getSessionDurationMs({ ...session, pausedMs: 600_000, duration: 120_000 }), 120_000);
});

test('a stored duration of 0 is kept, not replaced by the timestamps', () => {
  assert.equal(getSessionDurationMs({ ...session, duration: 0 }), 0);
});

test('a negative stored duration is ignored', () => {
  assert.equal(getSessionDurationMs({ ...session, duration: -1 }), 3_600_000);
});

test('invalid timestamps give null', () => {
  assert.equal(getSessionDurationMs({ startedAt: 'nope', endedAt: session.endedAt }), null);
  assert.equal(getSessionDurationMs({ startedAt: session.startedAt, endedAt: null }), null);
  assert.equal(getSessionDurationMs({}), null);
});

test('an end before the start, or a pause longer than the session, gives null', () => {
  assert.equal(getSessionDurationMs({ startedAt: session.endedAt, endedAt: session.startedAt }), null);
  assert.equal(getSessionDurationMs({ ...session, pausedMs: 2 * HOUR_MS }), null);
});

test('example sessions, which have no duration or pausedMs, last from start to end', () => {
  for (const example of getDummySessions()) {
    assert.equal(getSessionDurationMs(example), Date.parse(example.endedAt) - Date.parse(example.startedAt), example.id);
  }
});

test('getSessionDurationMinutes floors the pause-aware duration', () => {
  assert.equal(getSessionDurationMinutes({ ...session, pausedMs: 600_000 }), 50);
  assert.equal(getSessionDurationMinutes({ ...session, duration: 119_999 }), 1);
});

test('getSessionDurationMinutes is 0 when the duration is unknown', () => {
  assert.equal(getSessionDurationMinutes({ startedAt: 'nope', endedAt: session.endedAt }), 0);
});

test('getActiveElapsedMs subtracts pausedMs', () => {
  const now = Date.parse('2026-10-19T10:10:00Z');
  assert.equal(getActiveElapsedMs({ startedAt: session.startedAt, pausedMs: 60_000 }, now), 540_000);
  assert.equal(getActiveElapsedMs({ startedAt: session.startedAt, pausedMs: null }, now), 600_000);
  assert.equal(getActiveElapsedMs({ startedAt: session.startedAt }, now), 600_000);
});

test('getActiveElapsedMs never goes below 0', () => {
  const now = Date.parse('2026-10-19T10:10:00Z');
  assert.equal(getActiveElapsedMs({ startedAt: session.startedAt, pausedMs: 700_000 }, now), 0);
  assert.equal(getActiveElapsedMs({ startedAt: '2026-10-19T10:20:00Z' }, now), 0);
});
