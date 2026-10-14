# Branch activity on session detail

Status: on hold (October 2026). Nothing here is built yet. “Bigger idea” below sketches the larger refactor this could grow into.

## Problem

A session records commits from every branch of the repository (see `getSessionCommitRefs` in `server/githubApi.js`). The session detail page shows them in a single timeline. It lists the session's branches in the figures row and tags only commits that aren't on the session's main branch. You can't see one branch's work on its own, and pull request merges look like ordinary commits.

## What we already have

- Each stored commit has `branches`: the branches that contained it when Panta fetched the session.
- `getBranchSummary()` in `SessionDetailPage.jsx` counts commits per branch.
- The file filter (`?file=`, with a chip like `perft.cpp · 3 of 20 ×`) is the pattern a branch filter would follow.

## Plan

### 1. Branch categories (no new data)

- When a session has more than one branch, show tabs above the commit timeline: **Overall**, then one tab per branch.
- **Overall** shows every commit, each tagged with its branch.
- A branch tab filters the timeline to that branch. Keep the choice in the URL (`?branch=`). It combines with the file filter.
- Sessions on a single branch don't change.

### 2. Which branch a commit was made on (best guess)

Git doesn't record the branch a commit was made on, only which branches contain it. Label each commit as follows:

- If it's on any branch other than the default, it belongs to that branch, even if it's also on `main` after a merge.
- If it's only on the default branch, it belongs to `main`.

Known gap: if a feature branch is deleted before Panta fetches the session, its commits show up only under `main`. In the UI, say "on `feature/x`", not "made on".

### 3. Pull request merges

**Option A: detect merge commits (preferred, no new permission).**

- A merge done with GitHub's merge button creates a commit with two parents and the message `Merge pull request #12 from owner/branch`.
- Show it as a timeline event, "Merged #12 · feature/x → main", instead of a regular commit.
- Requires storing each commit's parent count (`payload.parents.length`), which `getSessionCommitActivity` currently drops.
- Limits:
  - Squash merges look like normal commits ending in `(#12)`, so they can only be guessed from the message.
  - Rebase merges can't be detected.
  - Merges clicked by someone else aren't attributed to the user, so they don't appear.

**Option B: pull requests API (exact, needs a new permission).**

- `GET /repos/{owner}/{repo}/commits/{sha}/pulls` or `/pulls?state=closed` returns PR numbers, titles, and `merged_at` for every merge method.
- Requires adding **Pull requests: read** to the GitHub App. That's still read-only, but it goes beyond the Metadata, Contents, and Followers permissions in CLAUDE.md, and existing users would need to approve it.

## Suggested order

1. Branch tabs with Overall.
2. Merge events from merge commits (Option A), plus storing parent counts.
3. Only if squash or rebase merges matter, Option B with the new permission.

## Bigger idea: sessions track GitHub activity, not just commits

The branch work above points toward a refactor. Instead of storing a list of commits, a session would store the GitHub activity that happened in its window: commits, branch changes, merges, and the other events below. Commits remain the core, and everything else appears as events on the same timeline.

### What could be tracked

Each row lists where the data comes from and what GitHub App permission it needs. The current permissions are Metadata, Contents, and Followers, all read-only.

| Activity | Source | Permission |
| --- | --- | --- |
| Commits, with the branch they're on | Commits API (today) | Contents (have) |
| Pushes: when work actually reached GitHub, which can differ from commit time, and force pushes | Events API (`PushEvent`, with `forced`) | Metadata/Contents (have)* |
| Branches and tags created or deleted | Events API (`CreateEvent`, `DeleteEvent`) | Metadata/Contents (have)* |
| Pull requests opened, merged, or closed | Merge commits (approximate) or Pulls API (exact) | Contents (have) / **Pull requests: read** |
| Pull request reviews and review comments | Pulls API | **Pull requests: read** |
| Issues opened, closed, or commented on | Issues API / Events API | **Issues: read** |
| Releases published | Releases API | Contents (have) |
| CI results for the session's commits (passed, failed) | Checks / Actions API | **Checks: read** or **Actions: read** |
| Deployments | Deployments API | **Deployments: read** |
| Discussions and wiki edits | Events API (`DiscussionEvent`, `GollumEvent`) | **Discussions: read** / Contents |

\* Check before relying on it. The Events API returns at most 300 events from the last 90 days. Events can appear anywhere from 30 seconds to 6 hours late. For private repositories, the user token must have access.

### Rules to keep

These come from the product invariants in CLAUDE.md:

- Session time and GitHub activity stay separate measurements. More event types are not a productivity score, so don't add totals like "12 actions".
- Only activity GitHub attributes to the signed-in account counts. For a merge, that means the user clicked merge. For a review, the user wrote it.
- When an activity type wasn't fetched, for example because its permission wasn't granted, show it as unavailable, not as zero.
- A session with no activity at all is still valid.

### Shape of the change

- **Server:** `githubApi.js` gets one fetcher per source and a merge step that turns every source into one list of events (`{ type, at, branch, ref, title, url, … }`), sorted by time. Commits keep their file and line details.
- **Storage:** sessions in `localStorage` gain `events` next to `commits`. Older sessions only have commits, so their other event types are unavailable, not empty.
- **Session detail:**
  - The commit timeline becomes an activity timeline: commits as they are today, plus event rows such as "Merged #12 · feature/x → main", "Created branch feature/x", and "Released v0.6.0".
  - The branch tabs from the plan above filter it.
  - The figures row stays focused: session time, commits, lines, files. Other event types appear only on the timeline.
- **Timing:** because the Events API can be late, fetching at finish plus **Check GitHub again** stays the model. Live polling during a session can stay commits only.

### Open questions

- Is a new permission worth it for each type? Each one is something existing users have to approve. Pull requests and CI results seem the most valuable; issues, deployments, and discussions the least.
- Does a push or force push belong on the timeline, or is it noise next to the commits it pushed?
- Should activity on other repositories during the session (for example, reviewing someone else's PR) count? So far, a session covers one repository.

## Out of scope

- A branch filter on Session History. Branch names like `main` repeat across repositories, the list would grow with every feature branch, and a session can span several branches or have none (zero commits is valid). Branch filtering belongs inside one repository: on session detail, and later perhaps on project detail.
