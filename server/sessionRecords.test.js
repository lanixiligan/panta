import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAUSE_AFTER_MS,
  sanitizeActivity,
  sanitizeCommits,
  sanitizeGoal,
  sanitizeImportedSession,
  sanitizeRepository,
  toClientSession,
} from './sessionRecords.js';

const repository = {
  id: 42,
  name: 'panta',
  full_name: 'lanixiligan/panta',
  owner: { login: 'lanixiligan', avatar_url: 'https://example.com/a.png' },
  private: true,
  html_url: 'https://github.com/lanixiligan/panta',
  description: 'Secret plans',
  language: 'JavaScript',
};

test('PAUSE_AFTER_MS is the 90 second presence window', () => {
  assert.equal(PAUSE_AFTER_MS, 90_000);
});

test('sanitizeCommits drops patch and unknown fields', () => {
  const [commit] = sanitizeCommits([{
    sha: 'abc',
    message: 'Fix',
    timestamp: '2026-10-19T10:00:00Z',
    tree: 'deadbeef',
    files: [{ filename: 'a.js', status: 'modified', additions: 1, deletions: 2, changes: 3, patch: '@@', contents: 'x' }],
  }]);
  assert.deepEqual(commit.files[0], { filename: 'a.js', status: 'modified', additions: 1, deletions: 2, changes: 3 });
  assert.ok(!('tree' in commit));
});

test('sanitizeCommits keeps files undefined when not recorded', () => {
  assert.equal(sanitizeCommits([{ sha: '1', message: 'm' }])[0].files, undefined);
});

test('sanitizeCommits returns an empty list for non-arrays and skips commits without a sha', () => {
  assert.deepEqual(sanitizeCommits('nope'), []);
  assert.deepEqual(sanitizeCommits([{ message: 'no sha' }, null]), []);
});

test('sanitizeActivity keeps unrecorded values null', () => {
  assert.deepEqual(sanitizeActivity({ commits: 2 }), { commits: 2, filesChanged: null, additions: null, deletions: null });
  assert.equal(sanitizeActivity('x'), null);
});

test('sanitizeRepository whitelists fields', () => {
  assert.deepEqual(sanitizeRepository(repository), {
    id: 42,
    name: 'panta',
    full_name: 'lanixiligan/panta',
    owner: { login: 'lanixiligan' },
    private: true,
    html_url: 'https://github.com/lanixiligan/panta',
  });
  assert.equal(sanitizeRepository({ name: 'no-id' }), null);
});

test('sanitizeGoal trims, caps, and nulls empty goals', () => {
  assert.equal(sanitizeGoal('  ship it  '), 'ship it');
  assert.equal(sanitizeGoal('   '), null);
  assert.equal(sanitizeGoal(5), null);
  assert.equal(sanitizeGoal('x'.repeat(3000)).length, 2000);
});

test('sanitizeImportedSession skips examples and bad rows', () => {
  const valid = {
    id: 'session-1',
    source: 'github',
    status: 'completed',
    repository,
    goal: '  ship  ',
    startedAt: '2026-10-19T10:00:00Z',
    endedAt: '2026-10-19T11:00:00Z',
    commits: [],
  };
  assert.equal(sanitizeImportedSession({ ...valid, source: 'placeholder' }), null);
  assert.equal(sanitizeImportedSession({ ...valid, status: 'active' }), null);
  assert.equal(sanitizeImportedSession({ ...valid, endedAt: '2026-10-19T09:00:00Z' }), null);
  assert.equal(sanitizeImportedSession({ ...valid, id: 'x'.repeat(101) }), null);
  const row = sanitizeImportedSession(valid);
  assert.ok(row);
  assert.equal(row.goal, 'ship');
  assert.equal(row.repository.description, undefined);
});

test('toClientSession maps a row', () => {
  const session = toClientSession({
    id: 'session-1',
    status: 'completed',
    repository: { id: 42, name: 'panta' },
    goal: null,
    started_at: new Date('2026-10-19T10:00:00Z'),
    ended_at: new Date('2026-10-19T11:00:00Z'),
    paused_ms: '60000',
    duration_ms: '3540000',
    activity: null,
    commits: [],
    activity_status: 'loading',
    activity_error: null,
    activity_checked_at: null,
  });
  assert.equal(session.source, 'github');
  assert.equal(session.startedAt, '2026-10-19T10:00:00.000Z');
  assert.equal(session.endedAt, '2026-10-19T11:00:00.000Z');
  assert.equal(session.pausedMs, 60000);
  assert.equal(session.duration, 3540000);
  assert.equal(session.activityCheckedAt, null);
});
