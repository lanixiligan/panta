import { dummyRepositories } from './repositories.js';

const [pokefolio, portfolio, gitittogether, playground] = dummyRepositories.map(({ owner, name, fullName }) => ({ owner, name, fullName }));
const repository = { pokefolio, portfolio, gitittogether, playground };

export const dummySessions = [
  {
    id: 'session-001', repository: repository.pokefolio, goal: 'Finish the binder page redesign',
    startedAt: '2026-09-30T19:02:00+08:00', endedAt: '2026-09-30T21:16:00+08:00', durationMinutes: 134, status: 'completed',
    activity: { commits: 3, filesChanged: 14, additions: 642, deletions: 183, pullRequests: 1, issues: 0, reviews: 0 },
    commits: [
      { sha: 'a1b2c3d', message: 'Refactor binder components', timestamp: '2026-09-30T19:42:00+08:00' },
      { sha: 'e4f5a6b', message: 'Fix mobile card spacing', timestamp: '2026-09-30T20:21:00+08:00' },
      { sha: 'c7d8e9f', message: 'Improve binder page layout', timestamp: '2026-09-30T21:03:00+08:00' },
    ],
  },
  {
    id: 'session-002', repository: repository.gitittogether, goal: 'Implement session history',
    startedAt: '2026-10-02T09:12:00+08:00', endedAt: '2026-10-02T10:46:00+08:00', durationMinutes: 94, status: 'completed',
    activity: { commits: 2, filesChanged: 8, additions: 318, deletions: 74, pullRequests: 0, issues: 1, reviews: 0 },
    commits: [
      { sha: 'f1a2b3c', message: 'Add session history page structure', timestamp: '2026-10-02T09:54:00+08:00' },
      { sha: 'd4e5f6a', message: 'Polish empty history state', timestamp: '2026-10-02T10:35:00+08:00' },
    ],
  },
  {
    id: 'session-003', repository: repository.portfolio, goal: 'Polish project section',
    startedAt: '2026-10-01T20:05:00+08:00', endedAt: '2026-10-01T21:37:00+08:00', durationMinutes: 92, status: 'completed',
    activity: { commits: 2, filesChanged: 6, additions: 204, deletions: 61, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'b2c3d4e', message: 'Tighten project card typography', timestamp: '2026-10-01T20:42:00+08:00' },
      { sha: 'f5a6b7c', message: 'Tune project section spacing', timestamp: '2026-10-01T21:28:00+08:00' },
    ],
  },
  {
    id: 'session-004', repository: repository.playground, goal: 'Experiment with repository search',
    startedAt: '2026-10-01T17:18:00+08:00', endedAt: '2026-10-01T18:31:00+08:00', durationMinutes: 73, status: 'completed',
    activity: { commits: 2, filesChanged: 5, additions: 151, deletions: 29, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'c3d4e5f', message: 'Try repository search query parameters', timestamp: '2026-10-01T17:52:00+08:00' },
      { sha: 'a6b7c8d', message: 'Handle empty repository results', timestamp: '2026-10-01T18:22:00+08:00' },
    ],
  },
  {
    id: 'session-005', repository: repository.pokefolio, goal: 'Add responsive filters to the collection',
    startedAt: '2026-09-29T19:24:00+08:00', endedAt: '2026-09-29T21:02:00+08:00', durationMinutes: 98, status: 'completed',
    activity: { commits: 3, filesChanged: 9, additions: 287, deletions: 48, pullRequests: 0, issues: 1, reviews: 0 },
    commits: [
      { sha: 'd4e5f6a', message: 'Add collection filter controls', timestamp: '2026-09-29T20:01:00+08:00' },
      { sha: 'b7c8d9e', message: 'Make filters wrap on narrow screens', timestamp: '2026-09-29T20:34:00+08:00' },
      { sha: 'e1f2a3b', message: 'Keep selected filter in the URL', timestamp: '2026-09-29T20:53:00+08:00' },
    ],
  },
  {
    id: 'session-006', repository: repository.gitittogether, goal: 'Build the project repository cards',
    startedAt: '2026-09-29T09:08:00+08:00', endedAt: '2026-09-29T10:34:00+08:00', durationMinutes: 86, status: 'completed',
    activity: { commits: 2, filesChanged: 7, additions: 229, deletions: 33, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'f6a7b8c', message: 'Add repository cards to projects view', timestamp: '2026-09-29T09:49:00+08:00' },
      { sha: 'c9d0e1f', message: 'Show repository language and update date', timestamp: '2026-09-29T10:21:00+08:00' },
    ],
  },
  {
    id: 'session-007', repository: repository.portfolio, goal: 'Refresh the about page copy',
    startedAt: '2026-09-27T14:11:00+08:00', endedAt: '2026-09-27T15:03:00+08:00', durationMinutes: 52, status: 'completed',
    activity: { commits: 1, filesChanged: 3, additions: 73, deletions: 44, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [{ sha: 'a7b8c9d', message: 'Clarify the about page introduction', timestamp: '2026-09-27T14:54:00+08:00' }],
  },
  {
    id: 'session-008', repository: repository.playground, goal: 'Clean up profile loading and errors',
    startedAt: '2026-09-26T10:16:00+08:00', endedAt: '2026-09-26T11:41:00+08:00', durationMinutes: 85, status: 'completed',
    activity: { commits: 2, filesChanged: 6, additions: 190, deletions: 67, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'b8c9d0e', message: 'Separate profile loading state', timestamp: '2026-09-26T10:52:00+08:00' },
      { sha: 'd1e2f3a', message: 'Show a useful error for missing users', timestamp: '2026-09-26T11:29:00+08:00' },
    ],
  },
  {
    id: 'session-009', repository: repository.pokefolio, goal: 'Improve the Pokédex detail panel',
    startedAt: '2026-09-24T19:31:00+08:00', endedAt: '2026-09-24T21:07:00+08:00', durationMinutes: 96, status: 'completed',
    activity: { commits: 3, filesChanged: 11, additions: 412, deletions: 126, pullRequests: 1, issues: 0, reviews: 1 },
    commits: [
      { sha: 'c9d0e1f', message: 'Reshape Pokémon detail panel', timestamp: '2026-09-24T20:02:00+08:00' },
      { sha: 'e2f3a4b', message: 'Add type badges and stat labels', timestamp: '2026-09-24T20:36:00+08:00' },
      { sha: 'f5a6b7c', message: 'Refine detail panel keyboard focus', timestamp: '2026-09-24T20:54:00+08:00' },
    ],
  },
  {
    id: 'session-010', repository: repository.gitittogether, goal: 'Shape the overview session card',
    startedAt: '2026-09-23T09:17:00+08:00', endedAt: '2026-09-23T10:42:00+08:00', durationMinutes: 85, status: 'completed',
    activity: { commits: 2, filesChanged: 8, additions: 273, deletions: 58, pullRequests: 0, issues: 1, reviews: 0 },
    commits: [
      { sha: 'f2a3b4c', message: 'Design overview start-session card', timestamp: '2026-09-23T09:52:00+08:00' },
      { sha: 'a5b6c7d', message: 'Add duration choices and goal field', timestamp: '2026-09-23T10:29:00+08:00' },
    ],
  },
  {
    id: 'session-011', repository: repository.portfolio, goal: 'Make the portfolio header work on mobile',
    startedAt: '2026-09-21T15:06:00+08:00', endedAt: '2026-09-21T16:18:00+08:00', durationMinutes: 72, status: 'completed',
    activity: { commits: 2, filesChanged: 4, additions: 118, deletions: 39, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'b3c4d5e', message: 'Collapse portfolio links on mobile', timestamp: '2026-09-21T15:42:00+08:00' },
      { sha: 'd6e7f8a', message: 'Align header content at tablet widths', timestamp: '2026-09-21T16:07:00+08:00' },
    ],
  },
  {
    id: 'session-012', repository: repository.playground, goal: 'Add a contribution activity view',
    startedAt: '2026-09-19T11:02:00+08:00', endedAt: '2026-09-19T12:46:00+08:00', durationMinutes: 104, status: 'completed',
    activity: { commits: 3, filesChanged: 10, additions: 366, deletions: 92, pullRequests: 0, issues: 0, reviews: 0 },
    commits: [
      { sha: 'e4f5a6b', message: 'Query public contribution calendar', timestamp: '2026-09-19T11:39:00+08:00' },
      { sha: 'c7d8e9f', message: 'Render contribution weeks with accessible labels', timestamp: '2026-09-19T12:11:00+08:00' },
      { sha: 'a0b1c2d', message: 'Add loading and unavailable states', timestamp: '2026-09-19T12:34:00+08:00' },
    ],
  },
];
