import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, monthDays, parseDay, sameDay, startOfDay, startOfWeek, toDayString } from './calendarDates.js';

test('toDayString pads month and day in local time', () => {
  assert.equal(toDayString(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

test('parseDay reads YYYY-MM-DD as local midnight and round-trips', () => {
  const date = parseDay('2026-10-22');
  assert.ok(sameDay(date, new Date(2026, 9, 22)));
  assert.equal(toDayString(date), '2026-10-22');
});

test('parseDay rejects other formats', () => {
  assert.equal(parseDay(''), null);
  assert.equal(parseDay(null), null);
  assert.equal(parseDay('2026-10-2'), null);
  assert.equal(parseDay('22/10/2026'), null);
});

test('startOfDay drops the time and addDays crosses month ends', () => {
  assert.ok(sameDay(startOfDay(new Date(2026, 9, 22, 15, 4)), new Date(2026, 9, 22)));
  assert.ok(sameDay(addDays(new Date(2026, 9, 31), 1), new Date(2026, 10, 1)));
  assert.ok(sameDay(addDays(new Date(2026, 2, 1), -1), new Date(2026, 1, 28)));
});

test('sameDay is false when either side is missing', () => {
  assert.equal(sameDay(null, new Date(2026, 9, 22)), false);
  assert.equal(sameDay(new Date(2026, 9, 22), undefined), false);
});

test('monthDays lays the month out from Sunday over six weeks', () => {
  // October 2026 starts on a Thursday; February 2026 starts on a Sunday.
  const october = monthDays(new Date(2026, 9, 15));
  assert.equal(october.leading, 4);
  assert.equal(october.days.length, 31);
  assert.ok(sameDay(october.days[0], new Date(2026, 9, 1)));
  assert.ok(sameDay(october.before[0], new Date(2026, 8, 27)));
  assert.ok(sameDay(october.after[0], new Date(2026, 10, 1)));
  assert.ok(sameDay(october.after.at(-1), new Date(2026, 10, 7)));
  const february = monthDays(new Date(2026, 1, 1));
  assert.equal(february.leading, 0);
  assert.equal(february.days.length, 28);
  assert.equal(february.before.length + february.days.length + february.after.length, 42);
});

test('startOfWeek goes back to Sunday', () => {
  assert.ok(sameDay(startOfWeek(new Date(2026, 9, 28, 14)), new Date(2026, 9, 25)));
  assert.ok(sameDay(startOfWeek(new Date(2026, 9, 25)), new Date(2026, 9, 25)));
  assert.ok(sameDay(startOfWeek(new Date(2026, 10, 1)), new Date(2026, 10, 1)));
});
