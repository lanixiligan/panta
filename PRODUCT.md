# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo developers who want an honest record of their focused coding work over time. They sign in with GitHub, declare a session on one repository, work, and later look back at when and where their time went. Real use is the primary goal; Panta is also a portfolio piece for its author, which is secondary and never shapes the product at the expense of real use.

## Product Purpose

Panta is a GitHub-centered coding-session tracker. The user declares a session on one repository; GitHub commits from that time window are the evidence of what happened. Success is a trustworthy, calm history of declared work that the user wants to keep returning to, not a performance metric.

## Positioning

Two measurements, kept apart: **session time** (declared by the developer, excluding time no Panta tab was open) and **GitHub activity** (what GitHub observed in that window). Panta does not track keystrokes or IDE activity and never scores productivity. "You set the session, and GitHub shows what happened."

## Operating Context

- Flow: choose a repository → start a session with a goal → work (commits polled every 30 s) → end the session → review the recap.
- Used alongside an editor during work; the Session Workspace is often left open in a tab for hours.
- Pages: Session Workspace at `/`, the default page (Setup → Active Session → Recap), Session History and detail, Repositories and detail, Analytics, Settings, a public `/preview` example session.
- Socials is a light, ambient presence signal (which GitHub mutuals are online in Panta). No feeds, comparisons, or leaderboards are planned.
- Live site runs on free hosting; the first load after a quiet period can take up to a minute while the API wakes.

## Capabilities and Constraints

- A session with zero commits is valid. Unrecorded values are shown as unavailable, never as `0`.
- Only commits GitHub attributes to the signed-in account count. Commits from every branch changed during the session are collected.
- The clock pauses after more than 90 s without a tab heartbeat; commits during the gap still count.
- Panta stores commit metadata and file/line stats only, never code or diffs. The GitHub access token never leaves the server.
- The GitHub App holds read-only permissions (Metadata, Contents, Followers). Features needing write scopes must be flagged first.
- Example data (`source: 'placeholder'`) is always labeled as example and hidden by default.
- Open decision: handling of sessions whose repository was renamed or deleted.

## Brand Commitments

- Name: Panta, from the ancient Greek *panta rhei*, "everything flows." Tagline: "Your work, over time."
- Logo kit in `public/logos/panta-logo-kit/` (wordmark in dark and light variants).
- Voice: minimal, factual, calm. Short labels over sentences; one-line empty states; no explanatory captions under values.

## Evidence on Hand

- Live site: https://pantarhei-lanixiligan.vercel.app
- Example data in `src/dummy-data/` is illustrative only; its commits and totals were never retrieved from GitHub.
- No testimonials, user counts, or usage statistics exist. Do not fabricate them.

## Product Principles

1. Declared time and observed activity are separate truths; never derive one from the other.
2. No productivity scores, streak pressure, or judgement of the user's work.
3. Absence is information: show "unavailable" or "no commits" honestly rather than filling gaps.
4. Calm over busy: only necessary details on a page, each number shown once.
5. The user's data is theirs: store the minimum, never code, and make deletion complete.

## Accessibility & Inclusion

- WCAG 2.2 AA is the baseline for every surface, in both themes.
- Live data announces politely and sparingly to screen readers: the running timer is not announced every tick, and new commits are announced as they arrive without interrupting.
- Every chart has a text equivalent (an accessible table or summary).
- No specific known user need drives these; they are principle-driven.
