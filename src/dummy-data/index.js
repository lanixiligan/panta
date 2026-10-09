import { dummyRepositories } from './repositories.js';
import { dummySessions } from './sessions.js';

// Example-only data for development: repositories and sessions marked `source: 'placeholder'`.
// None of it was retrieved from GitHub.
export { dummyRepositories, dummySessions };

export function getDummySessions() {
  return [...dummySessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

export function getDummySessionById(id) {
  return dummySessions.find((session) => session.id === id) || null;
}
