import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { githubAuthApi } from './server/githubAuth.js';

const CONTRIBUTION_CALENDAR_QUERY = `
  query ContributionCalendar($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          colors
          months { name year firstDay totalWeeks }
          weeks {
            firstDay
            contributionDays { contributionCount contributionLevel date weekday color }
          }
        }
      }
    }
  }
`;

async function handleContributionRequest(request, response, next, serverEnv) {
  if (request.url?.split('?')[0] !== '/api/github/contributions') return next();
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST', 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ errors: [{ message: 'Use POST to request contribution data.' }] }));
    return;
  }

  const token = serverEnv.GITHUB_TOKEN;
  if (!token) {
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ errors: [{ message: 'Set GITHUB_TOKEN in the server environment to enable the authenticated GraphQL request.' }] }));
    return;
  }

  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 8192) {
        response.writeHead(413, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ errors: [{ message: 'Request body is too large.' }] }));
        return;
      }
    }

    const { username } = JSON.parse(body || '{}');
    if (typeof username !== 'string' || !username.trim() || username.length > 39) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ errors: [{ message: 'A valid GitHub username is required.' }] }));
      return;
    }

    const githubResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ query: CONTRIBUTION_CALENDAR_QUERY, variables: { login: username.trim() } }),
    });
    const responseText = await githubResponse.text();
    response.writeHead(githubResponse.status, {
      'Content-Type': githubResponse.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(responseText);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 502;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ errors: [{ message: status === 400 ? 'Request body must be valid JSON.' : 'Could not reach GitHub GraphQL.' }] }));
  }
}

function contributionApi(serverEnv) {
  return {
    name: 'contribution-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => handleContributionRequest(request, response, next, serverEnv));
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => handleContributionRequest(request, response, next, serverEnv));
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverEnv = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || (mode === 'production' ? 'production' : 'development'),
  };

  return {
    plugins: [react(), contributionApi(serverEnv), githubAuthApi(serverEnv)],
  };
});
