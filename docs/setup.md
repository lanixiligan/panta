# Setup

Running Panta locally, deploying it, and configuring the GitHub App. The [README](../README.md) has the overview.

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm
- A GitHub account
- Credentials for the Panta GitHub App (see [GitHub App Configuration](#github-app-configuration))

### Installation

```bash
git clone https://github.com/lanixiligan/panta.git
cd panta
npm install
```

### Environment Variables

Copy the example file and fill in the GitHub App credentials:

```bash
cp .env.example .env
```

```ini
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:5173/api/auth/github/callback
GITHUB_APP_SLUG=panta-by-lanix-iligan
DATABASE_URL=postgresql://user:password@host-pooler.region.aws.neon.tech/neondb?sslmode=verify-full
```

`GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL` are required for sign-in. `DATABASE_URL` is required for stored sessions (see [Database](#database)). A malformed `DATABASE_URL` is treated like a missing one: sign-in works, session routes return 503, and the log never prints the value. `npm run build` doesn’t connect to the database. `GITHUB_APP_SLUG` defaults to `panta-by-lanix-iligan` and also accepts the full GitHub App URL.

These values are read by the server only. Keep them in the root `.env` file (ignored by Git) and never in frontend `VITE_` variables.

Use the existing **Panta by Lanix Iligan** GitHub App. In **GitHub → Settings → Developer settings → GitHub Apps → Panta by Lanix Iligan → Edit**, copy the **Client ID** (not the App ID) into `GITHUB_APP_CLIENT_ID`. Under **Client secrets**, generate a client secret and put it in `GITHUB_APP_CLIENT_SECRET`. The secret is shown only once, so store it securely. Panta obtains user access through OAuth; no personal access token is needed.

### Database

Sessions are stored in Postgres on [Neon](https://neon.tech)'s free tier.

1. Create a Neon project, then add a branch named `dev` (**Branches → New branch**, parent `main`). Local development uses `dev`, so it never touches deployed data.
2. In **Connect**, choose the `dev` branch, turn on **Connection pooling**, and copy the connection string.
3. Put it in the root `.env` as `DATABASE_URL`, changing `sslmode=require` to `sslmode=verify-full`. Both verify the certificate today, but `pg` warns that `require` will get weaker in its next major version.

The server creates its tables on startup (`server/db.js`), and doing so again changes nothing. To check the connection:

```bash
node --env-file=.env -e "import('./server/db.js').then(async m => { const db = m.createDatabase(process.env); await db.ready; console.log((await db.query('select count(*) from sessions')).rows); await db.close(); })"
```

### Run the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

### Build and Preview

```bash
npm run build
npm run preview
```

`npm run preview` serves the production build with the same API middleware. Preview runs in production mode, where the server only accepts an HTTPS `GITHUB_CALLBACK_URL` and marks cookies `Secure`, so sign-in with the local `http://` callback works under `npm run dev` only.

## Deployment

The frontend is a static build on Vercel, and the API runs as a Node service on Render. Vercel proxies `/api/*` to Render, so the browser only ever talks to the Vercel domain and the `panta_session` cookie and OAuth callback stay same-origin.

1. **API on Render.** Create a Blueprint from `render.yaml` (or a Node web service with build `npm ci --omit=dev` and start `npm start`). Set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, and `GITHUB_CALLBACK_URL`, and set `DATABASE_URL` to the Neon `main` branch's pooled connection string (with `sslmode=verify-full`). `/healthz` is the health check.
2. **Frontend on Vercel.** Import the repository; Vercel detects Vite. In `vercel.json`, replace `panta-api.onrender.com` with your Render service URL.
3. **Callback URL.** Set `GITHUB_CALLBACK_URL` to `https://<your-site>.vercel.app/api/auth/github/callback` (the Vercel domain, not Render's) and add the same URL to the GitHub App.

Logins and presence live in the API process's memory, so a restart signs everyone out and only one instance can run. Render's free tier sleeps after about 15 minutes idle and takes about a minute to wake, which also signs everyone out.

## GitHub App Configuration

Panta signs users in through the **Panta by Lanix Iligan** GitHub App (**GitHub → Settings → Developer settings → GitHub Apps**).

Register this callback URL as a user authorization callback URL in the app, and keep `GITHUB_CALLBACK_URL` identical to it:

```text
http://localhost:5173/api/auth/github/callback
```

The deployed site needs its own entry, using the Vercel domain (not Render's):

```text
https://pantarhei-lanixiligan.vercel.app/api/auth/github/callback
```

GitHub requires the callback URL used by the app to match its registered callback ([user authorization callback URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url)). See GitHub's guide to [generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) for the Client ID and client secret fields.

### Repository Access

Repository access is controlled by the GitHub App installation. **Settings → Manage repository access** opens the app's installation page on GitHub (through `/api/auth/github/install`, using `GITHUB_APP_SLUG`), where you choose which repositories Panta can access.

For session setup, the server requests the repositories the signed-in user can access through the app. This can include public and private repositories owned by the user, collaborator repositories, and organization repositories when the app is installed for them. The list is paginated, and only repository metadata needed by the interface is returned to the browser. A repository appears only when both the signed-in user and the app installation can access it.

Enable these **read-only permissions** in the GitHub App settings:

- **Metadata: Read-only** — list accessible repositories and read repository metadata.
- **Contents: Read-only** — list commits and read commit details for session activity.
- **Followers: Read-only** (user permission) — list the people the user follows and their followers for the Socials section.

Do not grant write permissions for the current workflow. GitHub may require the installation or authorization to be reviewed again after permissions change.

### Socials and Presence

The Socials section loads `GET /user/following` and `GET /user/followers` on the server, follows pagination for both, and intersects the lists by GitHub user ID. A mutual is shown as online when a recent Panta heartbeat exists, and offline otherwise; offline does not indicate whether the person has a Panta account. The relationship list is cached for five minutes, while presence refreshes separately. Signed-in clients send heartbeats every 30 seconds, and an account counts as online for 90 seconds after its latest heartbeat. Presence is in-memory and process-local, so a server restart clears it.

To check Socials locally, sign in to the same Panta server from two isolated browser profiles with separate GitHub accounts that follow each other. Each account should show the other as online. After one account logs out, or 90 seconds after its tab is closed, it should appear offline.

See GitHub's documentation for [listing repositories for the authenticated user](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user), [listing commits](https://docs.github.com/en/rest/commits/commits#list-commits), [listing people the authenticated user follows](https://docs.github.com/en/rest/users/followers#list-the-people-the-authenticated-user-follows), and [choosing GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).
