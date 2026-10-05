# Panta

> Your work, over time.

*From the Greek philosophical idea **panta rhei** — "everything flows."*

Panta is a GitHub-centered developer activity tracker built around focused coding sessions.

Instead of measuring productivity through keystrokes, IDE activity, or artificial productivity scores, Panta lets developers define when they are working and uses GitHub as the observable record of what happened during that period.

## How It Works

A session represents a focused period of work on a single GitHub repository.

**Choose a repository → Start a session → Work → Finish → Review**

When a session ends, Panta retrieves GitHub activity associated with that repository and time period and presents it as a session recap.

A recap can include:

- Commits
- Files changed
- Lines added and deleted
- Pull requests
- Other repository activity

Panta keeps two concepts separate:

- **Session time** — the period of work declared by the developer.
- **GitHub activity** — the work GitHub can observe during that period.

A session can therefore be meaningful even when no commits were made.

## Why Panta?

GitHub already records a large amount of development activity, but that activity is fragmented across commits, pull requests, issues, and repository pages.

Panta puts that activity into a **session-based context**.

Instead of asking:

> "How productive was I?"

Panta asks:

> "What did I work on during this session?"

The goal is to make development history easier to understand without turning it into a productivity score.

## Features

### Focused Coding Sessions

Start a session for a specific GitHub repository and track how long you worked on it.

### GitHub Activity Recaps

Review GitHub activity associated with a completed session, including commits and code changes.

### Session History

Keep a record of previous coding sessions and review how individual work periods unfolded.

### Project History

View activity for individual repositories based on the sessions you've spent working on them.

### GitHub Authentication

Sign in with your GitHub account through GitHub OAuth.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS |
| Server | Node.js, Vite server middleware |
| GitHub Integration | GitHub REST API, GitHub OAuth / GitHub App |
| Authentication | HTTP-only session cookies, server-side GitHub tokens |

## Project Structure

Panta is currently organized around a React frontend and a lightweight server layer responsible for authentication and GitHub API communication.

```text
panta/
├── src/
│   ├── components/
│   ├── pages/
│   ├── dummydata/
│   └── ...
├── server/
│   └── githubAuth.js
├── public/
├── vite.config.js
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- npm
- A GitHub account
- A GitHub App configured for local development

### Installation

Clone the repository:

```bash
git clone https://github.com/lanixiligan/nevergonnagityouup.git
cd nevergonnagityouup
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```ini
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_APP_SLUG=panta-by-lanix-iligan
GITHUB_CALLBACK_URL=http://localhost:5173/api/auth/github/callback
```

GitHub credentials and tokens must remain server-side and should never be exposed through frontend environment variables.

### Run the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

## GitHub App Configuration

For local authentication, create a GitHub App under:

**GitHub → Settings → Developer settings → GitHub Apps**

Configure the callback URL as:

```text
http://localhost:5173/api/auth/github/callback
```

`GITHUB_APP_SLUG` is the public slug `panta-by-lanix-iligan`. The optional “Grant repository access” link on the login page opens GitHub's installation page; “Continue with GitHub” remains the separate Panta sign-in action.

Panta currently uses GitHub primarily for authentication and retrieving repository activity.

For session repository selection, Panta asks the server for repositories the signed-in GitHub user can access through the app. This can include public and private repositories owned by the user, collaborator repositories, and organization repositories when the GitHub App is installed for them and has access. The list is paginated and only safe repository metadata is returned to the browser.

Enable these **read-only repository permissions** in the GitHub App settings:

- **Metadata: Read-only** — needed to list accessible repositories and read repository metadata.
- **Contents: Read-only** — needed to list commits and read commit details for session recaps.

Do not grant write permissions for the current workflow. GitHub may require the app installation or authorization to be reviewed again after changing permissions. A repository appears only when both the signed-in user and the app authorization can access it.

See GitHub’s documentation for [listing repositories for the authenticated user](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user), [listing commits](https://docs.github.com/en/rest/commits/commits#list-commits), and [choosing GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

## Design Principles

Panta is built around a simple distinction:

> **The user defines the session. GitHub provides the evidence.**

The session timer represents the period of focused work declared by the developer.

GitHub activity represents what GitHub can actually observe during that period.

These should not be treated as the same measurement.

For example, a developer could spend an hour debugging a problem without creating a commit. That is still a valid coding session, even though GitHub may have little or no activity to report.

Likewise, a commit timestamp should not be interpreted as an exact measurement of how long someone spent coding.

Panta therefore avoids surveillance-style tracking and artificial productivity scores in favor of a simple session history grounded in observable GitHub activity.

## Current Status

Panta is currently under active development.

The current focus is on building the core session experience, GitHub integration, authentication, and session history before expanding into more advanced analytics.

## Roadmap

- [ ] Persistent session storage
- [ ] More detailed session timelines
- [ ] Real-time GitHub activity updates
- [ ] Weekly and project-level statistics
- [ ] Shareable session summaries
- [ ] Improved project history
- [ ] Webhook-based activity synchronization

## Name

**Panta** comes from the Greek philosophical expression *panta rhei*, commonly translated as **"everything flows."**

The name reflects the idea that development is an ongoing process:

**sessions → activity → history → progress**

Individual work periods become part of a larger picture of how a project evolves over time.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Built by [Lanix Iligan](https://github.com/lanixiligan)

