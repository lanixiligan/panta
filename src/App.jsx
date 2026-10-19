import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser } from './api/auth.js';
import { getAccessibleRepositories, getActiveSessionCommits, getSessionActivity } from './api/github.js';
import * as sessionsApi from './api/sessions.js';
import OverviewPage from './pages/Overview/OverviewPage.jsx';
import ProjectsPage from './pages/Projects/ProjectsPage.jsx';
import ProjectDetailPage from './pages/Projects/ProjectDetailPage.jsx';
import { findProject, getExampleProjects, getProjects } from './pages/Projects/projectHistory.js';

import SessionHistoryPage from './pages/SessionHistory/SessionHistoryPage.jsx';
import SessionDetailPage from './pages/SessionHistory/SessionDetailPage.jsx';

import SettingsPage from './pages/Settings/SettingsPage.jsx';

import SessionWorkspacePage from './pages/SessionWorkspace/SessionWorkspacePage.jsx';
import AnalyticsPage from './pages/Analytics/AnalyticsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AuthenticationPage from './pages/Authentication/AuthenticationPage.jsx';
import PreviewPage from './pages/Preview/PreviewPage.jsx';
import SidebarNav from './components/navigation/SidebarNav.jsx';
import Footer from './components/layout/Footer.jsx';
import { getSessionListItems, getWeeklySummary } from './sessions/sessionHelpers.js';
import { dummyRepositories, getDummySessionById, getDummySessions } from './dummy-data/index.js';
import { resolveRoute, routePaths, sessionDetailPath } from './routing.js';
import { getGitHubMutuals, sendPresenceHeartbeat } from './api/presence.js';

// Completed sessions this browser saved before sessions were stored in Panta. They are read only to import them once.
function legacySessionsKey(username) {
  return `panta.sessions.${encodeURIComponent(username)}`;
}

function readStoredSessions(username) {
  if (!username) return [];
  try {
    const sessions = JSON.parse(window.localStorage.getItem(legacySessionsKey(username)) || '[]');
    return Array.isArray(sessions)
      ? sessions.filter((session) => session && typeof session === 'object' && session.status === 'completed' && session.id && session.repository && typeof session.repository === 'object')
      : [];
  } catch {
    return [];
  }
}

function removeStoredSessions(username) {
  try {
    window.localStorage.removeItem(legacySessionsKey(username));
  } catch {
    // Storage that can't be used was never read, so nothing was imported from it.
  }
}

function newSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeCommits(...lists) {
  const commitsBySha = new Map();
  lists.flat().forEach((commit) => {
    if (!commit?.sha) return;
    const existing = commitsBySha.get(commit.sha);
    const branches = [...new Set([...(existing?.branches || []), ...(commit.branches || [])])];
    commitsBySha.set(commit.sha, { ...existing, ...commit, ...(branches.length ? { branches } : {}) });
  });
  return [...commitsBySha.values()].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

// Totals come from the merged commits so commits kept from an earlier check
// (for example, from a branch deleted since) still count.
function summarizeCommits(commits) {
  const detailed = commits.filter((commit) => Array.isArray(commit.files));
  return {
    commits: commits.length,
    filesChanged: new Set(detailed.flatMap((commit) => commit.files.map(({ filename }) => filename))).size,
    additions: detailed.reduce((total, commit) => total + (commit.additions || 0), 0),
    deletions: detailed.reduce((total, commit) => total + (commit.deletions || 0), 0),
  };
}

const SHOW_EXAMPLES_KEY = 'panta.showExamples';
const NO_EXAMPLES = [];
// A goal edit is saved once it has stood this long, so quick successive edits send one request.
const GOAL_SAVE_DELAY_MS = 600;

// Examples are shown until the viewer turns them off; storage can be unavailable, so it only ever falls back to shown.
function readShowExamples() {
  try {
    return window.localStorage.getItem(SHOW_EXAMPLES_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const route = resolveRoute(pathname);
  const { view } = route;
  const [identity, setIdentity] = useState(null);
  const [identityStatus, setIdentityStatus] = useState('loading');
  const [identityError, setIdentityError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [sessionEndingAt, setSessionEndingAt] = useState(null);
  const [completedSession, setCompletedSession] = useState(null);
  const [realSessions, setRealSessions] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [mutuals, setMutuals] = useState([]);
  const [mutualsLoading, setMutualsLoading] = useState(true);
  const [mutualsError, setMutualsError] = useState('');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startError, setStartError] = useState('');
  const [sessionsError, setSessionsError] = useState('');
  // A failed finish or cancel, shown with the running session.
  const [sessionActionError, setSessionActionError] = useState('');
  const loadId = useRef(0);
  const endingSession = useRef(false);
  const startingSession = useRef(false);
  const cancellingSession = useRef(false);
  // The running session as last rendered, for callbacks that outlive a render (the heartbeat, list loads).
  const activeSessionRef = useRef(null);
  const sessionListRequest = useRef(0);
  // Sessions deleted from this tab, so a list that was already loading doesn't bring them back.
  const deletedSessionIds = useRef(new Set());
  // Sessions whose GitHub activity is being retrieved, so a list load doesn't start a second retrieval.
  const activityRequests = useRef(new Set());
  const goalSaveTimers = useRef(new Map());
  const [showExamples, setShowExamples] = useState(readShowExamples);
  const allDummySessions = useMemo(() => getDummySessions(), []);
  // The sidebar's "Show example data" setting hides every example session, project, and repository at once.
  const visibleDummySessions = showExamples ? allDummySessions : NO_EXAMPLES;
  const analyticsSessions = useMemo(() => [...realSessions, ...visibleDummySessions], [realSessions, visibleDummySessions]);
  const sessionItems = getSessionListItems(analyticsSessions)
    .sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt));
  const projects = useMemo(() => getProjects(realSessions, repositories), [realSessions, repositories]);
  // Overview offers to continue in the repository of the latest real session; examples never count.
  const lastRealSession = useMemo(() => realSessions.reduce((latest, session) => (!latest || new Date(session.startedAt) > new Date(latest.startedAt) ? session : latest), null), [realSessions]);
  const allExampleProjects = useMemo(() => getExampleProjects(), []);
  const exampleProjects = showExamples ? allExampleProjects : NO_EXAMPLES;
  // Example repositories shaped like GitHub's, so the session workspace can list them beside real ones.
  const exampleRepositories = useMemo(() => (showExamples ? dummyRepositories.map((repository) => ({
    id: repository.id,
    name: repository.name,
    full_name: repository.fullName,
    description: repository.description,
    language: repository.language,
    private: false,
    updated_at: exampleProjects.find((project) => project.key === `id:${repository.id}`)?.lastWorkedAt ?? null,
    isExample: true,
  })) : NO_EXAMPLES), [showExamples, exampleProjects]);
  // Direct links to an example project keep working while examples are hidden.
  const routeProject = view === 'Project Detail' ? findProject([...projects, ...allExampleProjects], route.owner, route.repo) : null;
  // Includes example sessions, like Recent sessions beside it; the card says when it does.
  const weeklySummary = getWeeklySummary(analyticsSessions, new Date(now));
  // Panta stores only a few repository fields, so pages get the live repository's details (its language) too.
  const displayedActiveSession = useMemo(() => {
    if (!activeSession) return null;
    const live = repositories.find((repository) => String(repository.id) === String(activeSession.repository?.id));
    return live ? { ...activeSession, repository: { ...activeSession.repository, ...live } } : activeSession;
  }, [activeSession, repositories]);
  const hasActiveSession = Boolean(activeSession);

  useEffect(() => {
    function syncPathname() {
      setPathname(window.location.pathname);
    }
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Errors belong to the session they came from, so a different session, or none, starts without them.
  useEffect(() => {
    setStartError('');
    setSessionActionError('');
  }, [activeSession?.id]);

  // Leaving the site while a session runs asks first. With no Panta tab open, the session clock pauses.
  useEffect(() => {
    if (!hasActiveSession) return undefined;
    function confirmLeaving(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', confirmLeaving);
    return () => window.removeEventListener('beforeunload', confirmLeaving);
  }, [hasActiveSession]);

  useEffect(() => {
    const timers = goalSaveTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function navigate(path, state = {}) {
    if (path === window.location.pathname) return;
    window.history.pushState(state, '', path);
    setPathname(window.location.pathname);
  }

  // `fromHistory` marks the entry so Back returns to Session History with its filters and scroll position.
  function openSession(sessionId, { fromHistory = false } = {}) {
    setCompletedSession(null);
    navigate(sessionDetailPath(sessionId), fromHistory ? { returnToHistory: true } : {});
  }

  async function loadRepositories() {
    const requestId = ++loadId.current;
    setRepositoriesLoading(true);
    setRepositoriesError('');
    try {
      const result = await getAccessibleRepositories();
      if (requestId === loadId.current) setRepositories(result);
    } catch (error) {
      if (requestId === loadId.current) setRepositoriesError(error.message || 'Unable to load repositories accessible to Panta.');
    } finally {
      if (requestId === loadId.current) setRepositoriesLoading(false);
    }
  }

  async function loadWorkspace() {
    const requestId = ++loadId.current;
    setIdentityStatus('loading');
    setIdentityError('');
    setRepositories([]);
    setRepositoriesError('');
    try {
      const user = await getCurrentUser();
      if (requestId !== loadId.current) return;
      if (!user) {
        resetSessionState();
        setIdentity(null);
        setIdentityStatus('unauthenticated');
        setRepositoriesLoading(false);
        return;
      }

      setIdentity(user);
      setIdentityStatus('authenticated');
      void loadSessions(user.username);
      setRepositoriesLoading(true);
      try {
        const result = await getAccessibleRepositories();
        if (requestId === loadId.current) setRepositories(result);
      } catch (error) {
        if (requestId === loadId.current) setRepositoriesError(error.message || 'Unable to load repositories accessible to Panta.');
      } finally {
        if (requestId === loadId.current) setRepositoriesLoading(false);
      }
    } catch {
      if (requestId === loadId.current) {
        setIdentity(null);
        setIdentityStatus('error');
        setIdentityError('GitHub is temporarily unavailable. Check your connection and try again.');
        setRepositoriesLoading(false);
      }
    }
  }

  // Loads the stored sessions, then moves this browser's old localStorage history into Panta, once per account.
  async function loadSessions(username) {
    if (!(await refreshSessions())) return;
    const legacySessions = readStoredSessions(username);
    if (!legacySessions.length) return;
    try {
      await sessionsApi.importSessions(legacySessions);
    } catch (error) {
      if (error.status === 401) void loadWorkspace();
      // A 409 means this account already imported its history, so the copy here is stale. Other failures keep it for the next load.
      if (error.status !== 409) return;
    }
    removeStoredSessions(username);
    await refreshSessions();
  }

  // Loads the signed-in user's sessions from Panta. Resolves to false when they couldn't be loaded.
  async function refreshSessions() {
    const requestId = ++sessionListRequest.current;
    const shownId = activeSessionRef.current?.id ?? null;
    try {
      const list = await sessionsApi.listSessions();
      if (requestId === sessionListRequest.current) {
        setSessionsError('');
        applySessionList(list, shownId);
      }
      return true;
    } catch (error) {
      if (requestId === sessionListRequest.current) {
        if (error.status === 401) void loadWorkspace();
        else setSessionsError(error.message);
      }
      return false;
    }
  }

  // Sessions from the list that this tab doesn't have yet are added. Ones it has keep this tab's copy, which is at least
  // as new for anything changed here (two tabs don't sync edits), and ones deleted here stay deleted. The running session
  // is taken from the list only if this tab didn't start, finish, or cancel one while the list loaded.
  function applySessionList({ active, sessions }, shownId) {
    const listed = sessions.filter((session) => !deletedSessionIds.current.has(session.id));
    setRealSessions((current) => {
      const known = new Set(current.map((session) => session.id));
      const added = listed.filter((session) => !known.has(session.id));
      return added.length ? [...current, ...added] : current;
    });
    // A finished session still `loading` had its activity fetch interrupted (a closed tab or a failed save), so it runs again.
    listed
      .filter((session) => session.activityStatus === 'loading' && !activityRequests.current.has(session.id))
      .forEach((session) => { void retrieveSessionActivity(session); });

    if (startingSession.current || endingSession.current || (activeSessionRef.current?.id ?? null) !== shownId) return;
    if (active) adoptActiveSession(active);
    else if (shownId) setActiveSession((current) => (current?.id === shownId ? null : current));
  }

  // Shows the session running on the server. The session already shown keeps its live commits and takes the server's paused time.
  function adoptActiveSession(session) {
    setActiveSession((current) => (current?.id === session.id
      ? withPausedMs(current, session.pausedMs)
      : { ...session, activitySyncStatus: 'loading', activityError: '' }));
    setNow(Date.now());
  }

  // Leaves the session object alone when the paused time hasn't changed, so nothing re-renders for it.
  function withPausedMs(session, pausedMs) {
    return session.pausedMs === pausedMs ? session : { ...session, pausedMs };
  }

  // The heartbeat reply names the session running on the server: { id, pausedMs }, null for none, or undefined when the server
  // couldn't check. It's ignored when this tab started, finished, or cancelled a session after the heartbeat went out, or is
  // starting or finishing one now.
  function applyHeartbeat(serverSession, sentFor) {
    if (serverSession === undefined || startingSession.current || endingSession.current) return;
    const shownId = activeSessionRef.current?.id ?? null;
    if (shownId !== sentFor) return;
    if (serverSession && serverSession.id === shownId) {
      setActiveSession((current) => (current?.id === shownId ? withPausedMs(current, serverSession.pausedMs) : current));
      return;
    }
    if (!serverSession && !shownId) return;
    // This tab's session was finished or cancelled elsewhere, or a session started elsewhere: the list has the result.
    if (!serverSession) setActiveSession((current) => (current?.id === shownId ? null : current));
    void refreshSessions();
  }

  // Clears this tab's sessions on sign-out. They stay in Panta, and a running one resumes after the next sign-in.
  function resetSessionState() {
    sessionListRequest.current += 1;
    goalSaveTimers.current.forEach((timer) => window.clearTimeout(timer));
    goalSaveTimers.current.clear();
    setActiveSession(null);
    setCompletedSession(null);
    setRealSessions([]);
    setIsEndingSession(false);
    setSessionEndingAt(null);
    setSessionsError('');
  }

  useEffect(() => {
    loadWorkspace();
    return () => { loadId.current += 1; };
  }, []);

  useEffect(() => {
    if (identityStatus !== 'authenticated' || !identity?.id) return undefined;
    let cancelled = false;
    async function sendHeartbeat() {
      // The reply describes the server when the heartbeat went out, so it's compared with what this tab showed then.
      const sentFor = activeSessionRef.current?.id ?? null;
      let result;
      try {
        result = await sendPresenceHeartbeat();
      } catch (error) {
        if (!cancelled && error.status === 401) void loadWorkspace();
        return;
      }
      if (!cancelled) applyHeartbeat(result?.activeSession, sentFor);
    }
    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(() => { void sendHeartbeat(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
    };
  }, [identityStatus, identity?.id]);

  useEffect(() => {
    if (identityStatus !== 'authenticated' || !identity?.id) {
      setMutuals([]);
      setMutualsError('');
      setMutualsLoading(false);
      return undefined;
    }

    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    async function refreshPeople(showLoading = false) {
      if (cancelled || inFlight) return;
      inFlight = true;
      if (showLoading) {
        setMutualsLoading(true);
        setMutualsError('');
      }
      try {
        const people = await getGitHubMutuals(controller.signal);
        if (!cancelled) {
          setMutuals(people);
          setMutualsError('');
        }
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') setMutualsError('Unable to load your GitHub mutuals.');
      } finally {
        inFlight = false;
        if (showLoading && !cancelled) setMutualsLoading(false);
      }
    }

    void refreshPeople(true);
    const refreshTimer = window.setInterval(() => { void refreshPeople(); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      controller.abort();
    };
  }, [identityStatus, identity?.id]);

  // Keyed on whether a session runs, not on the session object, so updates to it (commits, paused time) don't restart the tick.
  useEffect(() => {
    if (!hasActiveSession) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveSession]);

  useEffect(() => {
    if (!activeSession || isEndingSession || identityStatus !== 'authenticated' || !identity?.username) return undefined;
    const session = activeSession;
    const controller = new AbortController();
    let cancelled = false;
    let inFlight = false;
    let since = session.startedAt;

    async function pollActivity() {
      if (cancelled || inFlight) return;
      inFlight = true;
      const checkedAt = new Date().toISOString();
      setActiveSession((current) => current?.id === session.id
        ? { ...current, activitySyncStatus: current.commits?.length ? 'syncing' : 'loading', activityError: '' }
        : current);

      try {
        const result = await getActiveSessionCommits(session.repository, session.startedAt, since, checkedAt, controller.signal);
        if (cancelled) return;
        since = new Date(Math.max(Date.parse(session.startedAt), Date.parse(checkedAt) - 60_000)).toISOString();
        setActiveSession((current) => current?.id === session.id
          ? {
              ...current,
              commits: mergeCommits(current.commits || [], result.commits || []),
              activitySyncStatus: 'live',
              activityCheckedAt: result.checkedAt || checkedAt,
              activityError: '',
            }
          : current);
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return;
        setActiveSession((current) => current?.id === session.id
          ? { ...current, activitySyncStatus: 'error', activityError: error.message || 'Unable to refresh GitHub activity. Retrying…' }
          : current);
      } finally {
        inFlight = false;
      }
    }

    void pollActivity();
    const timer = window.setInterval(() => { void pollActivity(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [activeSession?.id, identity?.username, identityStatus, isEndingSession]);

  // The server stamps the start time. A 409 means a session is already running (started in another tab or browser),
  // so that one is shown instead.
  async function startSession({ repository, goal }) {
    if (activeSession || startingSession.current) return;
    startingSession.current = true;
    setIsStartingSession(true);
    setStartError('');
    let alreadyRunning = false;
    try {
      const session = await sessionsApi.createSession({ id: newSessionId(), repository, goal });
      endingSession.current = false;
      setCompletedSession(null);
      setIsEndingSession(false);
      setSessionEndingAt(null);
      adoptActiveSession(session);
    } catch (error) {
      if (error.status === 409) alreadyRunning = true;
      else if (error.status === 401) void loadWorkspace();
      else setStartError(error.message);
    } finally {
      startingSession.current = false;
      setIsStartingSession(false);
    }
    if (alreadyRunning) await refreshSessions();
  }

  function toggleExamples(value) {
    setShowExamples(value);
    try {
      window.localStorage.setItem(SHOW_EXAMPLES_KEY, value ? 'on' : 'off');
    } catch {
      // The setting still applies for this visit.
    }
  }

  // Discarding deletes the running session from Panta. A 404 means it already ended in another tab or browser.
  async function cancelSession() {
    if (!activeSession || endingSession.current || cancellingSession.current) return;
    const sessionId = activeSession.id;
    cancellingSession.current = true;
    setSessionActionError('');
    let endedElsewhere = false;
    try {
      await sessionsApi.deleteSession(sessionId);
    } catch (error) {
      if (error.status !== 404) {
        cancellingSession.current = false;
        if (error.status === 401) void loadWorkspace();
        else setSessionActionError(error.message);
        return;
      }
      endedElsewhere = true;
    }
    cancellingSession.current = false;
    cancelGoalSave(sessionId);
    setActiveSession((current) => (current?.id === sessionId ? null : current));
    if (endedElsewhere) void refreshSessions();
  }

  // Finishing has two steps. The server ends the session first and records its end time and duration (session time
  // minus pauses), so a closed tab or a failed fetch can't bring it back. Then GitHub activity is retrieved and saved.
  async function finishSession() {
    if (!activeSession || endingSession.current || cancellingSession.current) return;
    const session = activeSession;
    endingSession.current = true;
    setIsEndingSession(true);
    // The timer stops at the click while the session is saved.
    setSessionEndingAt(new Date().toISOString());
    setSessionActionError('');
    let finished;
    try {
      finished = await sessionsApi.finishSession(session.id);
    } catch (error) {
      endingSession.current = false;
      setIsEndingSession(false);
      setSessionEndingAt(null);
      if (error.status === 401) {
        void loadWorkspace();
      } else if (error.status === 404) {
        // It already ended in another tab or browser; the list has the result.
        setActiveSession((current) => (current?.id === session.id ? null : current));
        void refreshSessions();
      } else {
        // The session is still running on the server, so End Session can be tried again.
        setSessionActionError(error.message);
      }
      return;
    }

    const completed = await retrieveSessionActivity({
      ...session,
      status: 'completed',
      endedAt: finished.endedAt,
      duration: finished.duration,
      pausedMs: finished.pausedMs,
      activityStatus: 'loading',
      activityError: '',
    }, false);
    setCompletedSession(completed);
    setRealSessions((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
    setActiveSession((current) => (current?.id === session.id ? null : current));
    setIsEndingSession(false);
    setSessionEndingAt(null);
    endingSession.current = false;
    if (window.location.pathname !== routePaths['Session Workspace']) {
      navigate(routePaths['Session Workspace']);
    }
  }

  // Writes back only the activity fields, so a goal edited while GitHub is being checked survives. The result is then saved
  // to Panta. If that save fails, the stored session keeps its earlier status (`loading` after a finish), so the next load
  // retrieves the activity again.
  async function retrieveSessionActivity(session, updateState = true) {
    activityRequests.current.add(session.id);
    let fields;
    try {
      const activity = await getSessionActivity(session.repository, session.startedAt, session.endedAt);
      const commits = mergeCommits(session.commits || [], activity.commits || []);
      fields = {
        ...activity,
        activity: { ...activity.activity, ...summarizeCommits(commits) },
        commits,
        activityStatus: 'complete',
        activityError: '',
        activityCheckedAt: new Date().toISOString(),
      };
    } catch (error) {
      fields = { activity: session.activity ?? null, commits: session.commits || [], activityStatus: 'error', activityError: error.message || 'Could not retrieve GitHub commits for this session.' };
    }
    if (updateState) updateRealSession(session.id, fields);
    try {
      await sessionsApi.saveSessionActivity(session.id, {
        activity: fields.activity,
        commits: fields.commits,
        activityStatus: fields.activityStatus,
        activityError: fields.activityError,
      });
    } catch (error) {
      if (error.status === 401) void loadWorkspace();
    } finally {
      activityRequests.current.delete(session.id);
    }
    return { ...session, ...fields };
  }

  // Merges into the latest copy of the session rather than replacing it with an older one.
  function updateRealSession(sessionId, fields) {
    const merge = (session) => (session?.id === sessionId ? { ...session, ...fields } : session);
    setCompletedSession(merge);
    setRealSessions((current) => current.map(merge));
  }

  // The goal changes on the page at once and is saved to Panta when it has stood for a moment, one request per session.
  // A save still waiting when the session finishes lands on the finished session, which accepts goal edits too.
  function scheduleGoalSave(sessionId, goal) {
    const timers = goalSaveTimers.current;
    window.clearTimeout(timers.get(sessionId));
    timers.set(sessionId, window.setTimeout(() => {
      timers.delete(sessionId);
      sessionsApi.updateSessionGoal(sessionId, goal).catch((error) => {
        if (error.status === 401) void loadWorkspace();
      });
    }, GOAL_SAVE_DELAY_MS));
  }

  function cancelGoalSave(sessionId) {
    window.clearTimeout(goalSaveTimers.current.get(sessionId));
    goalSaveTimers.current.delete(sessionId);
  }

  function updateSessionGoal(sessionId, goal) {
    const withGoal = (session) => session?.id === sessionId ? { ...session, goal } : session;
    setRealSessions((current) => current.map(withGoal));
    setCompletedSession(withGoal);
    scheduleGoalSave(sessionId, goal);
  }

  function updateActiveGoal(goal) {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    setActiveSession((current) => (current?.id === sessionId ? { ...current, goal } : current));
    scheduleGoalSave(sessionId, goal);
  }

  // Deletes every completed session from Panta, then from the page. Rejects when the deletion fails.
  async function deleteSessionHistory() {
    try {
      await sessionsApi.deleteAllSessions();
    } catch (error) {
      if (error.status === 401) void loadWorkspace();
      throw error;
    }
    realSessions.forEach((session) => {
      deletedSessionIds.current.add(session.id);
      cancelGoalSave(session.id);
    });
    setRealSessions([]);
    setCompletedSession(null);
  }

  // Deletes the session from Panta first. If that fails, the session stays and the rejection reaches Session Detail.
  async function deleteSession(sessionId) {
    try {
      await sessionsApi.deleteSession(sessionId);
    } catch (error) {
      if (error.status === 401) {
        void loadWorkspace();
        return;
      }
      // A 404 means it was already deleted.
      if (error.status !== 404) throw error;
    }
    deletedSessionIds.current.add(sessionId);
    cancelGoalSave(sessionId);
    setRealSessions((current) => current.filter((session) => session.id !== sessionId));
    setCompletedSession((current) => current?.id === sessionId ? null : current);
    navigate(routePaths['Session History']);
  }

  function retrySessionActivity(session) {
    if (!session || session.activityStatus === 'loading') return;
    updateRealSession(session.id, { activityStatus: 'loading', activityError: '' });
    void retrieveSessionActivity(session);
  }

  // Signing out clears this tab only. A running session stays in Panta and resumes after the next sign-in.
  function handleLogout() {
    resetSessionState();
    setIdentity(null);
    setIdentityStatus('unauthenticated');
    setRepositories([]);
    setMutuals([]);
    setMutualsError('');
    navigate(routePaths.Overview);
  }

  const identityProps = {
    identity,
    identityStatus,
    identityError,
    repositories,
    repositoriesLoading,
    repositoriesError,
    onRetryIdentity: loadWorkspace,
    onRetryRepositories: () => identity && loadRepositories(),
  };

  // The example-session preview is public, so visitors can see a recap before signing in.
  if (view === 'Preview') return <PreviewPage onNavigate={navigate} signedIn={identityStatus === 'authenticated'} />;

  if (identityStatus !== 'authenticated') {
    return (
      <AuthenticationPage
        checking={identityStatus === 'loading'}
        identityError={identityStatus === 'error' ? identityError : ''}
        onRetryIdentity={loadWorkspace}
      />
    );
  }

  return (
    <div className="app-shell app-shell-dark workspace-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SidebarNav
        identity={identity}
        identityStatus={identityStatus}
        view={view}
        pathname={pathname}
        onNavigate={navigate}
        activeSession={displayedActiveSession}
        now={now}
        onLogout={handleLogout}
        mutuals={mutuals}
        mutualsLoading={mutualsLoading}
        mutualsError={mutualsError}
        showExamples={showExamples}
        onToggleExamples={toggleExamples}
      />
      <div className={`workspace-main${['Overview', 'Settings', 'Session Detail'].includes(view) ? ' workspace-main-fit' : ''}`}>
        <main className="app-main" id="main-content" tabIndex={-1}>
        {view === 'Overview' && (
          <OverviewPage
            {...identityProps}
            activeSession={displayedActiveSession}
            now={now}
            onNavigateToStart={() => navigate(routePaths['Session Workspace'])}
            lastSession={lastRealSession}
            onViewSessions={() => navigate(routePaths['Session History'])}
            recentSessions={sessionItems.slice(0, 5)}
            calendarSessions={analyticsSessions}
            onNavigate={navigate}
            weeklySummary={weeklySummary}
            onSelectSession={openSession}
          />
        )}
        {view === 'Session Workspace' && (
          <SessionWorkspacePage
            repositories={repositories}
            loading={repositoriesLoading}
            error={repositoriesError}
            onRetry={() => identity && loadRepositories()}
            onStart={startSession}
            starting={isStartingSession}
            startError={startError}
            sessionsError={sessionsError}
            onRetrySessions={() => identity && loadSessions(identity.username)}
            activeSession={displayedActiveSession}
            completedSession={completedSession}
            now={now}
            isEndingSession={isEndingSession}
            sessionEndingAt={sessionEndingAt}
            sessionActionError={sessionActionError}
            onFinish={finishSession}
            onCancel={cancelSession}
            onUpdateGoal={updateActiveGoal}
            onViewCompletedSession={(sessionId) => navigate(sessionDetailPath(sessionId))}
            onStartAnother={() => setCompletedSession(null)}
            onRetryActivity={retrySessionActivity}
            projects={projects}
            exampleRepositories={exampleRepositories}
            exampleProjects={exampleProjects}
            onNavigate={navigate}
          />
        )}
        {view === 'Session History' && (
          identityStatus === 'authenticated'
            ? <SessionHistoryPage sessions={sessionItems} onSelectSession={(sessionId) => openSession(sessionId, { fromHistory: true })} />
            : <OverviewPage {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Projects' && (
          identityStatus === 'authenticated'
            ? <ProjectsPage projects={projects} exampleProjects={exampleProjects} onNavigate={navigate} onStartSession={() => navigate(routePaths['Session Workspace'])} />
            : <OverviewPage {...identityProps} activeSession={null} now={now} onRetryRepositories={loadWorkspace} />
        )}
        {view === 'Project Detail' && (
          routeProject
            ? <ProjectDetailPage key={routeProject.key} project={routeProject} onBack={() => navigate(routePaths.Projects)} onSelectSession={openSession} />
            : <section className="dashboard-section"><h2>Repository not found</h2><p className="dashboard-empty-note">There are no Panta sessions for this repository yet.</p><button className="subtle-action" type="button" onClick={() => navigate(routePaths.Projects)}>Back to Repositories</button></section>
        )}
        {view === 'Analytics' && <AnalyticsPage sessions={analyticsSessions} onNavigate={navigate} />}
        {view === 'Settings' && <SettingsPage identity={identity} onLogout={handleLogout} hasActiveSession={Boolean(activeSession)} savedSessionCount={realSessions.length} onDeleteHistory={deleteSessionHistory} />}
        {view === 'Session Detail' && (
          (completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getDummySessionById(route.sessionId))
            ? <SessionDetailPage
                key={route.sessionId}
                session={completedSession?.id === route.sessionId ? completedSession : realSessions.find((session) => session.id === route.sessionId) || getDummySessionById(route.sessionId)}
                onRetryActivity={retrySessionActivity}
                onDelete={deleteSession}
                onUpdateGoal={updateSessionGoal}
                onBack={() => {
                  setCompletedSession(null);
                  if (window.history.state?.returnToHistory) window.history.back();
                  else navigate(routePaths['Session History']);
                }}
              />
            : <section className="dashboard-section"><h2>Session not found</h2><p className="dashboard-empty-note">That session could not be found.</p><button className="subtle-action" type="button" onClick={() => navigate(routePaths['Session History'])}>Back to Session History</button></section>
        )}
        {view === 'Not Found' && <NotFoundPage onGoHome={() => navigate(routePaths.Overview)} />}
        </main>
        <Footer />
      </div>
    </div>
  );
}
