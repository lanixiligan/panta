// Standalone API server for deployment (the frontend is hosted separately and proxies /api here).
// In development the same middleware runs inside Vite instead; see githubAuth.js.
import { createServer } from 'node:http';
import { createGitHubAuthMiddleware } from './githubAuth.js';

const port = Number(process.env.PORT) || 3000;
const middleware = createGitHubAuthMiddleware(process.env);

const server = createServer((request, response) => {
  // Render's health check; kept out of the middleware so it never touches sessions.
  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  middleware(request, response, () => {
    response.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Route not found.' }));
  }).catch(() => {
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Something went wrong.' }));
  });
});

server.listen(port, () => console.log(`Panta API listening on :${port}`));

// Render sends SIGTERM on deploys and restarts; finish open requests first.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
