import { dummyRepositories } from './repositories.js';

const [pokefolio, portfolio, originalPrototype, playground] = dummyRepositories.map(({ owner, name, fullName }) => ({ owner, name, fullName }));
const repository = { pokefolio, portfolio, originalPrototype, playground };

// Five example-only records keep the history surfaces populated during development.
// Their activity and commit timestamps are illustrative, never retrieved from GitHub.
export const dummySessions = [
  {
    id: 'session-001', source: 'placeholder', repository: repository.pokefolio, goal: 'Finish the binder page redesign',
    startedAt: '2026-09-30T19:02:00+08:00', endedAt: '2026-09-30T21:16:00+08:00', status: 'completed',
    activity: { commits: 3, filesChanged: 14, additions: 642, deletions: 183, pullRequests: 1, issues: 0, reviews: 0 },
    commits: [
      { sha: 'a1b2c3d', message: 'Refactor binder components', timestamp: '2026-09-30T19:42:00+08:00' },
      { sha: 'e4f5a6b', message: 'Fix mobile card spacing', timestamp: '2026-09-30T20:21:00+08:00' },
      { sha: 'c7d8e9f', message: 'Improve binder page layout', timestamp: '2026-09-30T21:03:00+08:00' },
    ],
  },
  {
    id: 'session-002', source: 'placeholder', repository: repository.originalPrototype, goal: 'Implement session history',
    startedAt: '2026-10-02T09:12:00+08:00', endedAt: '2026-10-02T10:46:00+08:00', status: 'completed',
    activity: { commits: 2, filesChanged: 8, additions: 318, deletions: 74, pullRequests: 0, issues: 1, reviews: 0 },
    commits: [
      { sha: 'f1a2b3c', message: 'Add session history page structure', timestamp: '2026-10-02T09:54:00+08:00' },
      { sha: 'd4e5f6a', message: 'Polish empty history state', timestamp: '2026-10-02T10:35:00+08:00' },
    ],
  },
  {
    id: 'session-003', source: 'placeholder', repository: repository.portfolio, goal: 'Polish project section',
    startedAt: '2026-10-01T20:05:00+08:00', endedAt: '2026-10-01T21:37:00+08:00', status: 'completed',
    activity: { commits: 2, filesChanged: 6, additions: 204, deletions: 61, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'b2c3d4e', message: 'Tighten project card typography', timestamp: '2026-10-01T20:42:00+08:00' },
      { sha: 'f5a6b7c', message: 'Tune project section spacing', timestamp: '2026-10-01T21:28:00+08:00' },
    ],
  },
  {
    id: 'session-004', source: 'placeholder', repository: repository.playground, goal: 'Experiment with repository search',
    startedAt: '2026-10-01T17:18:00+08:00', endedAt: '2026-10-01T18:31:00+08:00', status: 'completed',
    activity: { commits: 2, filesChanged: 5, additions: 151, deletions: 29, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'c3d4e5f', message: 'Try repository search query parameters', timestamp: '2026-10-01T17:52:00+08:00' },
      { sha: 'a6b7c8d', message: 'Handle empty repository results', timestamp: '2026-10-01T18:22:00+08:00' },
    ],
  },
  {
    id: 'session-005', source: 'placeholder', repository: repository.pokefolio, goal: 'Add responsive filters to the collection',
    startedAt: '2026-09-29T19:24:00+08:00', endedAt: '2026-09-29T21:02:00+08:00', status: 'completed',
    activity: { commits: 3, filesChanged: 9, additions: 287, deletions: 48, pullRequests: 0, issues: 1, reviews: 0 },
    commits: [
      { sha: 'd4e5f6a', message: 'Add collection filter controls', timestamp: '2026-09-29T20:01:00+08:00' },
      { sha: 'b7c8d9e', message: 'Make filters wrap on narrow screens', timestamp: '2026-09-29T20:34:00+08:00' },
      { sha: 'e1f2a3b', message: 'Keep selected filter in the URL', timestamp: '2026-09-29T20:53:00+08:00' },
    ],
  },
];
