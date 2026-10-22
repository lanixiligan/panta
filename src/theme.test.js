import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThemeChoice, resolveTheme } from './theme.js';

test('normalizeThemeChoice keeps known choices and falls back to system', () => {
  assert.equal(normalizeThemeChoice('light'), 'light');
  assert.equal(normalizeThemeChoice('dark'), 'dark');
  assert.equal(normalizeThemeChoice('system'), 'system');
  assert.equal(normalizeThemeChoice(null), 'system');
  assert.equal(normalizeThemeChoice('sepia'), 'system');
});

test('resolveTheme honours an explicit choice whatever the system prefers', () => {
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('dark', true), 'dark');
});

test('resolveTheme follows the system, defaulting to dark', () => {
  assert.equal(resolveTheme('system', true), 'light');
  assert.equal(resolveTheme('system', false), 'dark');
});
