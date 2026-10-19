// The Postgres connection for stored sessions. DATABASE_URL is server-only (see docs/setup.md).
import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  github_user_id bigint NOT NULL,
  id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  repository jsonb NOT NULL,
  goal text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  paused_ms bigint NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  duration_ms bigint,
  activity jsonb,
  commits jsonb NOT NULL DEFAULT '[]',
  activity_status text,
  activity_error text,
  activity_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (github_user_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active ON sessions (github_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sessions_by_start ON sessions (github_user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS accounts (
  github_user_id bigint PRIMARY KEY,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

// A local Postgres has no TLS; anything else (Neon) must present a valid certificate.
function sslFor(connectionString) {
  const { hostname, searchParams } = new URL(connectionString);
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return false;
  // An sslmode in the URL is applied by pg itself and takes precedence.
  return searchParams.has('sslmode') ? undefined : { rejectUnauthorized: true };
}

export function createDatabase(env = process.env) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set. See docs/setup.md.');

  const pool = new pg.Pool({ connectionString, ssl: sslFor(connectionString), max: 5 });
  // An idle client can drop (Neon suspends idle compute); without a listener that error crashes the process.
  pool.on('error', (error) => console.error('Database connection error:', error.message));

  const query = (text, params) => pool.query(text, params);

  async function transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const ready = query(SCHEMA).then(() => undefined);

  return { query, transaction, ready, close: () => pool.end() };
}
