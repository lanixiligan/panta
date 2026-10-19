# Features

The full detail for each page. The [README](../README.md) has the short version.

## Overview

A one-screen dashboard that never scrolls on windows 1024×600 and larger. Under the greeting, one line shows the next step: the running session (with its timer), or **Continue where you left off**, which opens the Session Workspace with the repository of your latest real session already selected (`?repo=<id>`). Below it, **This week** shows the current Monday-to-Sunday totals in one row (sessions, session time, commits, repositories), followed by the five most recent sessions and **When you work**, the current month's calendar from Analytics, where a day with sessions opens Session History for that day. Like the rest of the dashboard they include example sessions while example data is shown, and say so. Smaller windows stack the cards and scroll.

## Session Workspace

Setup, Active Session, and Recap are described in the [README](../README.md#the-session-workspace). A running session is stored in Panta, so a reload, a closed tab, or a new sign-in returns to it with the time no Panta tab was open left out, and leaving the site while it runs asks first.

## Session History

A searchable list of completed sessions with repository, date, and sort filters. The date picker is a calendar for choosing any span of days, with days that have sessions marked, plus Today, Week, and Month quick picks and Clear; the Analytics calendar links here with a single day selected. Sessions are grouped into collapsible months, each heading showing that whole month's session count and declared session time, and are split into pages of 30. The search, filters, sort, page, and collapsed months are kept in the URL, so going back from a session returns to the same list and scroll position, and a filtered view can be shared as a link. Each session has a detail page: the goal (editable), the repository, date, and time window, then one line of figures that keeps the declared session time apart from what GitHub recorded (commits, lines, files, and branches when they're not just `main`). Commits are shown newest first on a vertical timeline, each linking to GitHub, beside the files changed with their line changes and a breakdown by file type. On windows 1024×600 and larger the page fits the window and the commit and file lists scroll on their own; selecting a file filters the commits to the ones that touched it, and the selection is kept in the URL. **Check GitHub again** re-fetches the window and merges the result with the stored commits, which picks up commits pushed after the session ended without losing commits from branches deleted since. Recorded sessions can be deleted from their detail page.

## Repositories

The GitHub repositories that have become part of your Panta work history. They are derived from your completed sessions — a repository appears here only after you complete a session in it — and are grouped by GitHub repository ID. (In the code these are still called projects: `pages/Projects/`, `getProjects`.)

Each repository card keeps the total session time and session count separate from the GitHub activity recorded for it (commits and line changes, shown as unavailable when none was recorded), followed by a 7-day activity strip and when you last worked in it. Repositories can be searched by name or description, sorted by last worked, total time, or number of sessions, and are split into pages of 9; the search, sort, and page are kept in the URL. A repository's page shows its declared session time (total, average, and longest session) and its GitHub activity (commits, files changed, and line changes) as separate rows of one summary strip, a chart of session time per day over the last 30 days, and the sessions recorded for it, each linking to its Session History entry. Choosing a day in the chart narrows the sessions to that day (kept in the URL as `?day=YYYY-MM-DD`); choosing it again, or clearing the day chip, shows them all again. Example repositories built from the example sessions in `src/dummy-data/` are shown alongside your own, labeled as examples.

## Analytics

Aggregated views of completed sessions, each organized around a question. The date picker is the same calendar as Session History: any span of days, or Today, Week (Monday first, matching Overview), and Month quick picks, with Clear for all time. It opens on this month.

- **Summary** — session time, sessions, and active days (days with at least one session, out of the days in the period). Commits live in **What GitHub recorded**.
- **What GitHub recorded** — one line with the commits and lines added and deleted during sessions, how many sessions had commits, and how many have no recorded activity.
- **Session time** — per day across the whole range (days still ahead are shown empty), or per week when it spans more than 45 days, with a tooltip for the session count in each bar. Like the calendar and Repositories, a session counts entirely toward the day it started.
- **Where your time went** — the five repositories with the most session time and their session time with a bar, then one line totalling the rest; real repositories link to their Repositories page.
- **When you work** — a month calendar with each date shaded by its session time (credited to the day a session started). Hovering or focusing a date shows its session time, session count, and repositories, and a date with sessions links to Session History filtered to that day; arrows move between months, back to your first session. It ignores the time range.

Values that were never recorded are shown as unavailable rather than zero. Analytics includes the example sessions from `src/dummy-data/` while example data is shown, and the page notes when they are part of the totals. The range (`?period=` or `?from=&to=`) and the month shown in the calendar are kept in the URL.

## Socials

A collapsible sidebar section listing your GitHub mutuals (people you follow who also follow you), grouped as online or offline based on recent Panta presence.

## Settings

Settings is a narrow column of three cards. **Account** shows your avatar, name, and username with a link to your GitHub profile, and **Sign out**, which ends the login but keeps your saved sessions in Panta; a running session is paused and resumes after the next sign-in (it asks first only when a session is running). **GitHub** shows the connection status and links to the GitHub App installation page to manage repository access. **Data** has **Delete session history**, which, after a confirmation, removes your real sessions from Panta; example data is unaffected. **Delete account**, also after a confirmation, deletes all your stored sessions, revokes Panta’s GitHub authorization, signs you out everywhere, and returns you to sign-in. The GitHub App installation stays; remove it with **Manage on GitHub**. If the revoke fails, sign-in shows a notice to revoke Panta in your GitHub settings. A note states that Panta stores commit messages, times, and file and line stats, never code. Signing out never revokes the authorization.
